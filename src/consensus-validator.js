#!/usr/bin/env node
import { createServer } from "node:http";
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { AelEngine } from "./engine.js";
import { StateStore } from "./store.js";
import { canonicalize, hash } from "./canonical.js";
import {
  ConsensusWal,
  verifyFinalityCertificate,
} from "./consensus-primitives.js";

const validatorId = process.env.AEL_CONSENSUS_VALIDATOR_ID,
  clusterToken = process.env.AEL_CONSENSUS_CLUSTER_TOKEN,
  statePath =
    process.env.AEL_CONSENSUS_STATE ?? ".ael/consensus-validator-state.json",
  port = Number(process.env.AEL_CONSENSUS_PORT ?? 1517),
  host = process.env.AEL_CONSENSUS_HOST ?? "0.0.0.0",
  keyText = process.env.AEL_CONSENSUS_PRIVATE_KEY_B64
    ? Buffer.from(process.env.AEL_CONSENSUS_PRIVATE_KEY_B64, "base64").toString(
        "utf8",
      )
    : process.env.AEL_CONSENSUS_PRIVATE_KEY
      ? readFileSync(process.env.AEL_CONSENSUS_PRIVATE_KEY, "utf8")
      : null;
if (!validatorId || !clusterToken || !keyText)
  throw new Error(
    "AEL_CONSENSUS_VALIDATOR_ID, AEL_CONSENSUS_CLUSTER_TOKEN, and a consensus private key are required",
  );
const privateKey = createPrivateKey(keyText),
  publicKey = createPublicKey(privateKey).export({
    type: "spki",
    format: "pem",
  }),
  store = new StateStore(statePath),
  wal = new ConsensusWal(process.env.AEL_CONSENSUS_WAL ?? `${statePath}.wal`);
let engine = store.load();
const pending = new Map(),
  currentViews = new Map(),
  locks = new Map();
for (const record of wal.records) {
  const item = record.payload;
  if (record.type === "VIEW_CHANGE_SIGNED")
    currentViews.set(
      item.height,
      Math.max(currentViews.get(item.height) ?? 0, item.view),
    );
  if (record.type === "PREPARE_SIGNED")
    locks.set(item.height, {
      view: item.view,
      proposalId: item.proposalId,
      stateHash: item.stateHash,
      blockHash: item.blockHash,
    });
  if (record.type === "HEIGHT_COMMITTED") {
    locks.delete(item.height);
    currentViews.delete(item.height);
  }
}
const json = (response, status, value) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(`${JSON.stringify(value)}\n`);
  },
  readBody = async (request) => {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16_000_000)
        throw Object.assign(Error("Consensus payload exceeds 16 MB"), {
          code: "CONSENSUS_PAYLOAD_TOO_LARGE",
        });
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks));
  },
  authorized = (request) =>
    request.headers.authorization === `Bearer ${clusterToken}`,
  vote = (phase, proposal, stateHash) => {
    const body = {
      schema: "AEL-CONSENSUS-VOTE/1",
      chainId: proposal.chainId,
      epoch: proposal.epoch,
      height: proposal.height,
      view: proposal.view,
      phase,
      proposalId: proposal.proposalId,
      blockHash: proposal.blockHash ?? null,
      stateHash,
      validatorSetHash: proposal.validatorSetHash,
      validatorId,
    };
    if (phase !== "STATUS") wal.append(`${phase}_SIGNED`, body);
    return {
      ...body,
      signature: sign(
        null,
        Buffer.from(canonicalize(body)),
        privateKey,
      ).toString("base64"),
    };
  };
const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health")
      return json(response, 200, {
        status: "ok",
        validatorId,
        height: engine.state.height,
        stateHash: hash(engine.state),
        pending: pending.size,
        walRecords: wal.records.length,
        publicKey,
      });
    if (!authorized(request))
      return json(response, 401, { error: "CONSENSUS_AUTH_REQUIRED" });
    const body = await readBody(request);
    if (request.method === "POST" && request.url === "/v1/consensus/checkpoint") {
      const block=body.state?.blocks?.at(-1),applicationState=structuredClone(body.state??{});delete applicationState.blocks;
      if(body.schema!=="AEL-CHECKPOINT-PROPOSAL/1"||body.height!==body.state?.height||hash(body.state)!==body.expectedStateHash||block?.height!==body.height||block?.blockHash!==body.blockHash||block?.stateRoot!==hash(applicationState))return json(response,409,{error:"CONSENSUS_CHECKPOINT_INVALID"});
      return json(response,200,{vote:vote("CHECKPOINT",body,body.expectedStateHash)});
    }
    if (request.method === "POST" && request.url === "/v1/consensus/sync") {
      if (
        hash(body.state) !== body.stateHash ||
        !verifyFinalityCertificate({certificate:body.certificate,validatorSet:body.validatorSet,stateHash:body.stateHash,height:body.state.height})
      )
        return json(response, 409, {
          error: "CONSENSUS_SYNC_CERTIFICATE_INVALID",
        });
      engine = new AelEngine(body.state);
      store.save(engine);
      pending.clear();
      for (const height of locks.keys())
        if (height <= engine.state.height) locks.delete(height);
      for (const height of currentViews.keys())
        if (height <= engine.state.height) currentViews.delete(height);
      return json(response, 200, {
        status: "SYNCED",
        height: engine.state.height,
        stateHash: hash(engine.state),
      });
    }
    if (request.method === "POST" && request.url === "/v1/consensus/status") {
      const stateHash = hash(engine.state);
      if (
        body.height !== engine.state.height ||
        body.expectedStateHash !== stateHash
      )
        return json(response, 409, {
          error: "CONSENSUS_STATE_MISMATCH",
          height: engine.state.height,
          stateHash,
        });
      return json(response, 200, { vote: vote("STATUS", body, stateHash) });
    }
    if (
      request.method === "POST" &&
      request.url === "/v1/consensus/view-change"
    ) {
      const current = currentViews.get(body.height) ?? 0,
        locked = locks.get(body.height),
        unlockedStateValid =
          body.expectedStateHash === hash(engine.state) ||
          (body.lockedProposalId && typeof body.expectedStateHash === "string");
      if (
        body.schema !== "AEL-VIEW-CHANGE/1" ||
        body.height !== engine.state.height + 1 ||
        !Number.isInteger(body.view) ||
        body.view <= current ||
        (!locked && !unlockedStateValid) ||
        (locked &&
          (body.expectedStateHash !== locked.stateHash ||
            body.lockedProposalId !== locked.proposalId))
      )
        return json(response, 409, {
          error: "CONSENSUS_VIEW_CHANGE_REJECTED",
          height: engine.state.height,
          view: current,
        });
      currentViews.set(body.height, body.view);
      return json(response, 200, {
        vote: vote("VIEW_CHANGE", body, body.expectedStateHash),
      });
    }
    if (request.method === "POST" && request.url === "/v1/consensus/prepare") {
      const current = currentViews.get(body.height) ?? 0,
        viewCertificate = body.viewCertificate,
        { certificateHash: viewCertificateHash, ...viewCertificateBody } =
          viewCertificate ?? {},
        validViewCertificate =
          body.view === 0 ||
          (viewCertificate?.schema === "AEL-VIEW-CERTIFICATE/1" &&
            viewCertificate.view === body.view &&
            viewCertificate.height === body.height &&
            viewCertificate.validatorSetHash === body.validatorSetHash &&
            hash(viewCertificateBody) === viewCertificateHash);
      if (
        body.schema !== "AEL-CONSENSUS-PROPOSAL/1" ||
        !body.chainId ||
        !Number.isInteger(body.epoch) ||
        !Number.isInteger(body.view) ||
        body.view < current ||
        !validViewCertificate ||
        !body.validatorSetHash ||
        !body.proposerId ||
        body.beforeStateHash !== hash(engine.state) ||
        body.height !== engine.state.height + 1
      )
        return json(response, 409, {
          error: "CONSENSUS_STATE_MISMATCH",
          height: engine.state.height,
          stateHash: hash(engine.state),
        });
      if (pending.size >= 32 && !pending.has(body.proposalId))
        return json(response, 429, { error: "CONSENSUS_PENDING_LIMIT" });
      const candidate = new AelEngine(engine.state),
        stateHash = candidate.apply(body.type, body.payload),
        locked = locks.get(body.height);
      if (
        candidate.state.blocks.at(-1)?.blockHash !== body.blockHash ||
        stateHash !== body.expectedStateHash ||
        (locked &&
          (locked.stateHash !== stateHash ||
            locked.blockHash !== body.blockHash))
      )
        return json(response, 409, { error: "CONSENSUS_BLOCK_HASH_MISMATCH" });
      currentViews.set(body.height, body.view);
      wal.append("PROPOSAL_RECEIVED", {
        proposalId: body.proposalId,
        epoch: body.epoch,
        height: body.height,
        view: body.view,
        proposerId: body.proposerId,
        blockHash: body.blockHash,
      });
      pending.set(body.proposalId, {
        candidate,
        stateHash,
        precommitted: false,
        proposal: body,
      });
      const reportedStateHash =
          process.env.AEL_CONSENSUS_FAULT_ROOT === "true"
            ? "f".repeat(64)
            : stateHash,
        voteValue = vote("PREPARE", body, reportedStateHash);
      if (reportedStateHash === stateHash)
        locks.set(body.height, {
          view: body.view,
          proposalId: body.proposalId,
          stateHash,
          blockHash: body.blockHash,
        });
      return json(response, 200, { vote: voteValue });
    }
    if (
      request.method === "POST" &&
      request.url === "/v1/consensus/precommit"
    ) {
      const proposal = pending.get(body.proposalId);
      if (!proposal || proposal.stateHash !== body.expectedStateHash)
        return json(response, 409, { error: "CONSENSUS_PROPOSAL_UNKNOWN" });
      proposal.precommitted = true;
      return json(response, 200, {
        vote: vote("PRECOMMIT", body, proposal.stateHash),
      });
    }
    if (request.method === "POST" && request.url === "/v1/consensus/commit") {
      const proposal = pending.get(body.proposalId),
        certificate = body.certificate,
        { certificateHash, ...certificateBody } = certificate ?? {};
      if (
        !proposal?.precommitted ||
        proposal.stateHash !== body.stateHash ||
        proposal.candidate.state.height !== body.height ||
        certificate?.proposalId !== body.proposalId ||
        certificate?.stateHash !== body.stateHash ||
        hash(certificateBody) !== certificateHash
      )
        return json(response, 409, { error: "CONSENSUS_COMMIT_REJECTED" });
      wal.append("CERTIFICATE_APPLIED", {
        certificateHash,
        proposalId: body.proposalId,
        height: body.height,
      });
      engine = proposal.candidate;
      store.save(engine);
      wal.append("HEIGHT_COMMITTED", {
        height: body.height,
        stateHash: body.stateHash,
        certificateHash,
      });
      pending.clear();
      locks.delete(body.height);
      currentViews.delete(body.height);
      return json(response, 200, {
        status: "COMMITTED",
        validatorId,
        height: engine.state.height,
        stateHash: hash(engine.state),
        certificateHash,
      });
    }
    if (request.method === "POST" && request.url === "/v1/consensus/abort") {
      pending.delete(body.proposalId);
      return json(response, 200, {
        status: "ABORTED",
        validatorId,
        proposalId: body.proposalId,
      });
    }
    return json(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    return json(response, 500, {
      error: error.code ?? "INTERNAL_ERROR",
      message: error.message,
    });
  }
});
server.listen(port, host, () =>
  console.log(
    JSON.stringify({
      status: "ready",
      validatorId,
      port: server.address().port,
      publicKey,
    }),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
