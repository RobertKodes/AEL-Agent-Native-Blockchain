# AEL peer consensus design v1

Status: staged implementation for the next public-testnet phase. Canonical validator sets, weighted proposer selection, vote-domain separation, finality/view certificates, proposer-failure view changes, prepared-value locks, hash-chained fsynced validator WAL, durable certificate serving, and certificate-verified full-state sync are implemented in the coordinator compatibility profile. Direct peer transport, multi-source chunk/Merkle sync, and governed epochs remain design work. The hosted alpha remains `NETWORKED_BFT_DEVNET` until independent operators run the completed protocol across separate administrative fault domains.

## Safety target and validator set

For validator set `V` at epoch `e`, tolerate `f = floor((|V|-1)/3)` Byzantine validators and require `2f+1` voting power for prepare, precommit, view-change, and governance activation certificates. Every message commits to `chainId`, `epoch`, `height`, `view`, and the current `validatorSetHash`. Votes from a different epoch or set are invalid.

The validator set is an ordered list of `{validatorId, consensusPublicKey, votingPower, peerEndpoints, faultDomain}`. Its canonical hash is included in every block and certificate. No process may infer membership from network reachability.

## Peer transport

Peers connect directly over mutually authenticated TLS 1.3. The consensus key signs protocol messages; the TLS key may rotate independently and is bound through a signed peer record.

Handshake `AEL-PEER-HELLO/1`:

```json
{
  "schema": "AEL-PEER-HELLO/1",
  "chainId": "ael-devnet-1",
  "validatorId": "validator-a",
  "epoch": 7,
  "validatorSetHash": "<sha256>",
  "genesisHash": "<sha256>",
  "latestHeight": 1200,
  "latestCertificateHash": "<sha256>",
  "nonce": "<random-128-bit>",
  "timestampMs": 0,
  "signature": "<ed25519-base64>"
}
```

Peers reject wrong chain/genesis, stale nonce, unsupported schema, invalid membership, invalid signature, or incompatible epoch. Each peer has bounded inbound connections, message size, rate, outstanding requests, and future-height buffer. Consensus messages use length-prefixed canonical JSON initially; a later binary codec must preserve the same signed fields.

Gossip topics are `proposal`, `vote`, `view-change`, `certificate`, `peer-record`, and `state-sync`. Messages are deduplicated by canonical hash and forwarded only after cheap structural checks. Signature verification precedes state-machine execution.

## Deterministic proposer rotation

At `(epoch, height, view)`, proposer index is:

```text
SHA256(chainId || epoch || height || view || previousCertificateHash) mod totalVotingPower
```

The resulting point selects from the validator list ordered by `validatorId`, weighted by voting power. This makes leader choice deterministic, auditable, and unpredictable until the previous certificate exists. A proposer cannot choose the next proposer by changing transaction order because the previous certificate is already final.

Proposal `AEL-PROPOSAL/1` includes parent certificate hash, block header, ordered transitions, resulting state root, validator-set hash, proposer ID, and proposer signature. Validators execute independently and never sign a state root they did not derive.

## Views and view changes

Each height starts at view 0. A validator advances its local view after a deadline, invalid proposal, unavailable proposer, or receipt of `2f+1` valid higher-view messages. Timeouts use capped exponential backoff with deterministic jitter derived from validator ID; local clocks do not enter signed consensus state.

`AEL-VIEW-CHANGE/1` contains epoch, height, new view, last prepared proposal/certificate if any, reason code, validator ID, and signature. A new proposer must collect `2f+1` view-change votes into an `AEL-VIEW-CERTIFICATE/1`. It must repropose the highest prepared value represented by the certificate; only when none exists may it propose a new value. This locking rule prevents conflicting commits across views.

Validators maintain `lockedProposalId` and `lockedView`. They unlock only for a valid higher-view certificate carrying a safe value.

## Durable WAL and certificates

Before sending a signed vote, a validator atomically appends it to a write-ahead log and fsyncs. WAL record schemas are `PROPOSAL_RECEIVED`, `PREPARE_SIGNED`, `PRECOMMIT_SIGNED`, `VIEW_CHANGE_SIGNED`, `CERTIFICATE_APPLIED`, and `HEIGHT_COMMITTED`. Each record has a monotonically increasing local sequence, previous-record hash, payload hash, and checksum.

On restart, the validator verifies the WAL hash chain, restores locks and signed-vote history, and refuses to sign conflicting votes. Corruption puts the node into `RECOVERY_REQUIRED`; it may state-sync but cannot vote until an operator preserves evidence and repairs or replaces the node.

An `AEL-FINALITY-CERTIFICATE/1` contains epoch, height, view, proposal ID, block hash, state root, validator-set hash, and at least `2f+1` unique precommit signatures with summed voting power. Certificates are stored beside blocks and served by hash. The next proposal names the previous certificate hash.

## State synchronization

New or stale peers request a trusted checkpoint containing block header, state root, validator-set hash, and finality certificate. They verify the certificate against a locally trusted genesis or governance-approved epoch chain, download chunked state from multiple peers, verify chunk Merkle proofs and the reconstructed state root, then replay later certified blocks.

No single peer is a bootstrap state authority. DNS/static seeds provide addresses only; certificates provide trust.

## Validator-set governance

Membership changes use on-chain proposals with actions `ADD_VALIDATOR`, `REMOVE_VALIDATOR`, `UPDATE_VALIDATOR_POWER`, and `ROTATE_CONSENSUS_KEY`. A proposal includes the candidate peer record, bond/evidence references, fault-domain declaration, activation epoch, and resulting set hash.

Admission requires the existing governance chambers plus a `2f+1` validator readiness certificate proving the new set can communicate and reproduce the current checkpoint. Changes activate only at an epoch boundary after a minimum timelock. The old set finalizes an epoch-change block; both old-set and new-set certificates are required for the first block of the new epoch.

Emergency removal requires objective slash evidence or the constitutional emergency path, remains timelocked where safety permits, and cannot reduce the active set below four. Key rotation preserves validator identity and requires signatures from both old and new keys unless the recovery governance path is used.

## Slashing evidence

Two valid signatures by one validator for conflicting proposal IDs at the same `(epoch,height,view,phase)` form portable double-sign evidence. Evidence contains both complete signed messages and is independently verifiable without coordinator logs. Prolonged unavailability is measured by missed certified heights and is handled separately from Byzantine evidence.

## Rollout gates

1. **Implemented:** canonical validator sets, vote-domain separation, proposer selection vectors, quorum certificates, WAL restart/corruption tests, and double-sign prevention.
2. Run four local direct peers with coordinator compatibility disabled.
3. **Implemented for the compatibility transport:** proposer failure and two consecutive unavailable-proposer views produce quorum view certificates and a safe higher-view commit. Packet-loss simulation on direct peer transport remains.
4. Recover every validator from WAL at every signing boundary and prove no double-sign.
5. **Partially implemented:** full-state sync verifies a quorum certificate and rejects a corrupt signature; two-source chunk/Merkle synchronization remains.
6. Activate a validator-set change across an epoch boundary in simulation.
7. Run at least four operators across three organizations, three accounts, and two regions for 30 days.
8. Complete external consensus/security audit before renaming the mode or enabling real-value routes.

## Compatibility boundary

The coordinator-driven PREPARE/PRECOMMIT service remains an alpha compatibility profile. Its current votes include epoch, view, validator-set hash, proposer identity, block hash, and state root, and its validators persist signed-vote history. They are still not interchangeable with the future peer protocol because coordinator transport provides no peer proposal signature, live view certificate/locking flow, or certificate-trusted state sync. Migration must occur at an explicitly governed checkpoint and never silently upgrade certificate meaning.
