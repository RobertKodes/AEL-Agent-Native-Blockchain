import { createPublicKey, verify } from "node:crypto";
import { AelEngine } from "./engine.js";
import { canonicalize, hash } from "./canonical.js";
import { ProtocolError } from "./errors.js";
import {
  buildCertificate,
  canonicalValidatorSet,
  quorumPower,
  selectProposer,
} from "./consensus-primitives.js";

const post = async (url, path, body, token, timeoutMs) => {
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }),
    data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.message ?? data.error), {
      code: data.error,
      status: response.status,
    });
  return data;
};
const get = async (url, path, timeoutMs) => {
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    }),
    data = await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
};

export class NetworkConsensus {
  constructor(
    canonical,
    {
      validators,
      clusterToken,
      timeoutMs = 5000,
      chainId = "ael-devnet-1",
      epoch = 1,
      certificateStore = null,
    } = {},
  ) {
    if (!Array.isArray(validators) || validators.length < 4)
      throw new ProtocolError("NETWORK_CONSENSUS_REQUIRES_FOUR_VALIDATORS");
    if (!clusterToken)
      throw new ProtocolError("NETWORK_CONSENSUS_TOKEN_REQUIRED");
    this.canonical = canonical;
    this.clusterToken = clusterToken;
    this.timeoutMs = timeoutMs;
    this.chainId = chainId;
    this.epoch = epoch;
    this.certificateStore = certificateStore;
    this.validatorSet = canonicalValidatorSet(validators, epoch);
    this.quorum = quorumPower(this.validatorSet);
    this.validators = validators.map((item) => ({
      id: item.id,
      url: item.url,
      publicKey: createPublicKey(
        Buffer.from(item.publicKeyB64, "base64").toString("utf8"),
      ),
      publicKeyB64: item.publicKeyB64,
      votingPower: item.votingPower ?? 1,
      faultDomain: item.faultDomain ?? "UNDECLARED",
      status: "UNKNOWN",
      height: null,
      stateHash: null,
    }));
    const restored = certificateStore?.atHeight(canonical.state.height);
    this.lastCommit = null;
    this.previousCertificateHash =
      restored?.stateHash === hash(canonical.state)
        ? restored.certificateHash
        : "0".repeat(64);
    this.restoredCertificate =
      restored?.stateHash === hash(canonical.state) ? restored : null;
    this.view = 0;
    this.mode = chainId === "ael-mainnet-1" ? "NETWORKED_BFT_MAINNET" : "NETWORKED_BFT_DEVNET";
  }
  activateMainnet(epoch=this.epoch+1) {
    if(this.chainId==='ael-mainnet-1')return;
    this.chainId='ael-mainnet-1';this.epoch=epoch;this.validatorSet=canonicalValidatorSet(this.validators.map(item=>({id:item.id,url:item.url,publicKeyB64:item.publicKeyB64,votingPower:item.votingPower,faultDomain:item.faultDomain})),epoch);this.quorum=quorumPower(this.validatorSet);this.mode='NETWORKED_BFT_MAINNET';this.view=0;this.restoredCertificate=null;
  }
  verifyVote(validator, vote, phase, proposal) {
    try {
      const { signature, ...body } = vote;
      return (
        vote.schema === "AEL-CONSENSUS-VOTE/1" &&
        vote.validatorId === validator.id &&
        vote.phase === phase &&
        vote.proposalId === proposal.proposalId &&
        vote.chainId === this.chainId &&
        vote.epoch === this.epoch &&
        vote.view === proposal.view &&
        vote.height === proposal.height &&
        vote.blockHash === (proposal.blockHash ?? null) &&
        vote.stateHash === proposal.expectedStateHash &&
        vote.validatorSetHash === this.validatorSet.validatorSetHash &&
        verify(
          null,
          Buffer.from(canonicalize(body)),
          validator.publicKey,
          Buffer.from(signature ?? "", "base64"),
        )
      );
    } catch {
      return false;
    }
  }
  async syncValidator(validator) {
    const stateHash = hash(this.canonical.state),
      height = this.canonical.state.height,
      health = await get(validator.url, "/health", this.timeoutMs).catch(
        () => null,
      );
    if (health?.stateHash !== stateHash) {
      const certificate =
        this.certificateStore?.atHeight(height) ?? this.lastCommit?.certificate;
      if (height > 0 && certificate?.stateHash !== stateHash)
        throw new ProtocolError("CONSENSUS_SYNC_CERTIFICATE_UNAVAILABLE");
      await post(
        validator.url,
        "/v1/consensus/sync",
        {
          state: this.canonical.state,
          stateHash,
          certificate: certificate ?? null,
          validatorSet: this.validatorSet,
        },
        this.clusterToken,
        this.timeoutMs,
      );
    }
    Object.assign(validator, { status: "ACTIVE", height, stateHash });
  }
  async certifyCheckpoint() {
    const stateHash=hash(this.canonical.state),height=this.canonical.state.height,blockHash=this.canonical.state.blocks.at(-1)?.blockHash??null,proposal={schema:"AEL-CHECKPOINT-PROPOSAL/1",proposalId:hash({kind:"CHECKPOINT_MIGRATION",chainId:this.chainId,epoch:this.epoch,height,stateHash,blockHash,validatorSetHash:this.validatorSet.validatorSetHash}),chainId:this.chainId,epoch:this.epoch,view:0,height,blockHash,expectedStateHash:stateHash,validatorSetHash:this.validatorSet.validatorSetHash,state:this.canonical.state},votes=await this.phase("/v1/consensus/checkpoint","CHECKPOINT",proposal);
    if(this.votePower(votes)<this.quorum)throw new ProtocolError("CONSENSUS_CHECKPOINT_QUORUM");
    const certificate=buildCertificate({kind:"CHECKPOINT",chainId:this.chainId,epoch:this.epoch,height,view:0,phase:"CHECKPOINT",proposalId:proposal.proposalId,blockHash,stateHash,validatorSet:this.validatorSet,votes});this.certificateStore?.append(certificate);this.restoredCertificate=certificate;this.previousCertificateHash=certificate.certificateHash;return certificate;
  }
  async initialize() {
    if(this.canonical.state.height>0&&!this.restoredCertificate)await this.certifyCheckpoint();
    await Promise.allSettled(
      this.validators.map(async (validator) => {
        try {
          await this.syncValidator(validator);
        } catch {
          validator.status = "UNREACHABLE";
        }
      }),
    );
    const stateHash = hash(this.canonical.state),
      height = this.canonical.state.height,
      blockHash = this.canonical.state.blocks.at(-1)?.blockHash ?? null,
      proposal = {
        schema: "AEL-CONSENSUS-PROPOSAL/1",
        proposalId: hash({
          kind: "RESTORE_FINALITY",
          height,
          stateHash,
          epoch: this.epoch,
        }),
        chainId: this.chainId,
        epoch: this.epoch,
        view: this.view,
        height,
        expectedStateHash: stateHash,
        blockHash,
        validatorSetHash: this.validatorSet.validatorSetHash,
        previousCertificateHash: this.previousCertificateHash,
        proposerId: null,
      },
      votes = await this.phase(
        "/v1/consensus/status",
        "STATUS",
        proposal,
        this.validators.filter((v) => v.status === "ACTIVE"),
      );
    if (this.votePower(votes) >= this.quorum)
      this.lastCommit = {
        height,
        stateHash,
        votes,
        prepareVotes: [],
        certificate: this.restoredCertificate,
        proposerId: this.restoredCertificate?.votes?.[0]?.validatorId ?? null,
        view: this.restoredCertificate?.view ?? 0,
        mode: this.mode,
        restored: true,
      };
    return this.votePower(votes) >= this.quorum;
  }
  persistLastCertificate() {
    if (this.lastCommit?.certificate)
      this.certificateStore?.append(this.lastCommit.certificate);
  }
  certificate(certificateHash) {
    return (
      this.certificateStore?.get(certificateHash) ??
      (this.lastCommit?.certificate?.certificateHash === certificateHash
        ? this.lastCommit.certificate
        : null)
    );
  }
  async abort(proposalId) {
    await Promise.allSettled(
      this.validators.map((validator) =>
        post(
          validator.url,
          "/v1/consensus/abort",
          { proposalId },
          this.clusterToken,
          this.timeoutMs,
        ),
      ),
    );
  }
  async phase(path, phase, proposal, candidates = this.validators) {
    const results = await Promise.allSettled(
      candidates.map(async (validator) => {
        try {
          let result = await post(
            validator.url,
            path,
            proposal,
            this.clusterToken,
            this.timeoutMs,
          );
          if (result.error === "CONSENSUS_STATE_MISMATCH")
            throw Object.assign(Error(result.error), { code: result.error });
          return { validator, result };
        } catch (error) {
          if (error.code === "CONSENSUS_STATE_MISMATCH") {
            await this.syncValidator(validator);
            return {
              validator,
              result: await post(
                validator.url,
                path,
                proposal,
                this.clusterToken,
                this.timeoutMs,
              ),
            };
          }
          throw error;
        }
      }),
    );
    const votes = [];
    for (let index = 0; index < results.length; index++) {
      const outcome = results[index],
        validator = candidates[index];
      if (
        outcome.status === "fulfilled" &&
        this.verifyVote(
          outcome.value.validator,
          outcome.value.result.vote,
          phase,
          proposal,
        )
      ) {
        Object.assign(validator, {
          status: "ACTIVE",
          height: proposal.height,
          stateHash: proposal.expectedStateHash,
        });
        votes.push(outcome.value.result.vote);
      } else
        validator.status =
          outcome.status === "rejected" ? "UNREACHABLE" : "DIVERGENT";
    }
    return votes;
  }
  votePower(votes) {
    return votes.reduce(
      (sum, vote) =>
        sum +
        (this.validators.find((validator) => validator.id === vote.validatorId)
          ?.votingPower ?? 0),
      0,
    );
  }
  async proposerAvailable(proposerId) {
    const validator = this.validators.find((item) => item.id === proposerId);
    if (!validator) return false;
    const health = await get(validator.url, "/health", this.timeoutMs).catch(
      () => null,
    );
    if (!health) {
      validator.status = "UNREACHABLE";
      return false;
    }
    return health.validatorId === proposerId;
  }
  async advanceView({
    height,
    beforeStateHash,
    reason,
    lockedProposal = null,
  }) {
    const nextView = this.view + 1,
      proposalId = hash({
        kind: "VIEW_CHANGE",
        chainId: this.chainId,
        epoch: this.epoch,
        height,
        view: nextView,
        previousCertificateHash: this.previousCertificateHash,
        lockedProposalId: lockedProposal?.proposalId ?? null,
        lockedStateHash: lockedProposal?.expectedStateHash ?? null,
      }),
      request = {
        schema: "AEL-VIEW-CHANGE/1",
        proposalId,
        chainId: this.chainId,
        epoch: this.epoch,
        height,
        view: nextView,
        blockHash: lockedProposal?.blockHash ?? null,
        expectedStateHash: lockedProposal?.expectedStateHash ?? beforeStateHash,
        validatorSetHash: this.validatorSet.validatorSetHash,
        previousCertificateHash: this.previousCertificateHash,
        reason,
        lockedProposalId: lockedProposal?.proposalId ?? null,
      },
      votes = await this.phase(
        "/v1/consensus/view-change",
        "VIEW_CHANGE",
        request,
        this.validators.filter((validator) => validator.status !== "DIVERGENT"),
      );
    if (this.votePower(votes) < this.quorum)
      throw new ProtocolError("NETWORK_CONSENSUS_VIEW_CHANGE_QUORUM");
    const certificate = buildCertificate({
      kind: "VIEW_CHANGE",
      chainId: this.chainId,
      epoch: this.epoch,
      height,
      view: nextView,
      phase: "VIEW_CHANGE",
      proposalId,
      blockHash: request.blockHash,
      stateHash: request.expectedStateHash,
      validatorSet: this.validatorSet,
      votes,
    });
    this.view = nextView;
    this.lastViewCertificate = certificate;
    return certificate;
  }
  async apply(type, payload) {
    const beforeStateHash = hash(this.canonical.state),
      candidate = new AelEngine(this.canonical.state),
      expectedStateHash = candidate.apply(type, payload),
      height = candidate.state.height,
      blockHash = candidate.state.blocks.at(-1)?.blockHash ?? null;
    let attempts = 0;
    while (attempts++ < this.validators.length) {
      const { validatorId: proposerId } = selectProposer({
        chainId: this.chainId,
        epoch: this.epoch,
        height,
        view: this.view,
        previousCertificateHash: this.previousCertificateHash,
        validatorSet: this.validatorSet,
      });
      if (!(await this.proposerAvailable(proposerId))) {
        try {
          await this.advanceView({
            height,
            beforeStateHash,
            reason: "PROPOSER_UNREACHABLE",
          });
        } catch {
          throw new ProtocolError("NETWORK_CONSENSUS_PREPARE_QUORUM");
        }
        continue;
      }
      const proposalId = hash({
          chainId: this.chainId,
          epoch: this.epoch,
          height,
          view: this.view,
          proposerId,
          beforeStateHash,
          type,
          payloadHash: hash(payload),
        }),
        proposal = {
          schema: "AEL-CONSENSUS-PROPOSAL/1",
          proposalId,
          chainId: this.chainId,
          epoch: this.epoch,
          view: this.view,
          height,
          proposerId,
          validatorSetHash: this.validatorSet.validatorSetHash,
          previousCertificateHash: this.previousCertificateHash,
          viewCertificate: this.view ? this.lastViewCertificate : null,
          beforeStateHash,
          expectedStateHash,
          blockHash,
          type,
          payload,
        },
        prepareVotes = await this.phase(
          "/v1/consensus/prepare",
          "PREPARE",
          proposal,
        );
      if (this.votePower(prepareVotes) < this.quorum) {
        await this.abort(proposalId);
        try {
          await this.advanceView({
            height,
            beforeStateHash,
            reason: "PREPARE_TIMEOUT",
            lockedProposal: prepareVotes.length ? proposal : null,
          });
        } catch {
          throw new ProtocolError("NETWORK_CONSENSUS_PREPARE_QUORUM");
        }
        continue;
      }
      const prepared = this.validators.filter((validator) =>
          prepareVotes.some((vote) => vote.validatorId === validator.id),
        ),
        precommitVotes = await this.phase(
          "/v1/consensus/precommit",
          "PRECOMMIT",
          proposal,
          prepared,
        );
      if (this.votePower(precommitVotes) < this.quorum) {
        await this.abort(proposalId);
        try {
          await this.advanceView({
            height,
            beforeStateHash,
            reason: "PRECOMMIT_TIMEOUT",
            lockedProposal: proposal,
          });
        } catch {
          throw new ProtocolError("NETWORK_CONSENSUS_PRECOMMIT_QUORUM");
        }
        continue;
      }
      const certificate = buildCertificate({
          chainId: this.chainId,
          epoch: this.epoch,
          height,
          view: this.view,
          phase: "PRECOMMIT",
          proposalId,
          blockHash,
          stateHash: expectedStateHash,
          validatorSet: this.validatorSet,
          votes: precommitVotes,
        }),
        committedView = this.view;
      this.canonical.state = candidate.state;
      this.previousCertificateHash = certificate.certificateHash;
      this.lastCommit = {
        height,
        stateHash: expectedStateHash,
        votes: precommitVotes,
        prepareVotes,
        certificate,
        proposerId,
        view: committedView,
        viewCertificate: this.lastViewCertificate ?? null,
        mode: this.mode,
      };
      await Promise.allSettled(
        prepared.map((validator) =>
          post(
            validator.url,
            "/v1/consensus/commit",
            {
              proposalId,
              height: proposal.height,
              stateHash: expectedStateHash,
              certificate,
            },
            this.clusterToken,
            this.timeoutMs,
          ),
        ),
      );
      this.view = 0;
      this.lastViewCertificate = null;
      return expectedStateHash;
    }
    throw new ProtocolError("NETWORK_CONSENSUS_VIEW_LIMIT");
  }
  status() {
    const active = this.validators.filter((v) => v.status === "ACTIVE"),
      canonicalHash = hash(this.canonical.state);
    return {
      mode: this.mode,
      height: this.canonical.state.height,
      epoch: this.epoch,
      view: this.view,
      validatorSetHash: this.validatorSet.validatorSetHash,
      validatorCount: this.validators.length,
      activeValidators: active.length,
      quorum: this.quorum,
      latestBlockHash: this.canonical.state.blocks.at(-1)?.blockHash ?? null,
      chainHistoryStart: this.canonical.state.blocks[0]?.height ?? null,
      finality: this.lastCommit
        ? {
            stateHash: this.lastCommit.stateHash,
            votes: this.lastCommit.votes.length,
            votingPower: this.votePower(this.lastCommit.votes),
            networked: true,
            ...(this.lastCommit.certificate
              ? {
                  certificateHash: this.lastCommit.certificate.certificateHash,
                  proposerId: this.lastCommit.proposerId,
                  view: this.lastCommit.view,
                  ...(this.lastCommit.viewCertificate
                    ? {
                        viewCertificateHash:
                          this.lastCommit.viewCertificate.certificateHash,
                      }
                    : {}),
                }
              : {}),
            ...(this.lastCommit.restored
              ? { restored: true, attestation: "SIGNED_STATUS" }
              : {}),
          }
        : null,
      validators: this.validators.map(({ publicKey, url, ...validator }) => ({
        ...validator,
        stateHash: validator.stateHash ?? canonicalHash,
      })),
    };
  }
}
