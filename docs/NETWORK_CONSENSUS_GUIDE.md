# Network consensus operator guide

AEL includes a networked devnet consensus profile with four separate validator processes and a 3-of-4 quorum. Each validator independently executes a proposed transition, calculates the resulting state root, and signs PREPARE and PRECOMMIT votes with Ed25519. Votes are domain-separated by chain, epoch, height, view, proposal, block, state root, and canonical validator set. The coordinator commits only after sufficient unique voting power and constructs an `AEL-FINALITY-CERTIFICATE/1`.

## Start the complete stack

Requirements: Node.js 20+ and Docker Compose.

```sh
npm run consensus-keys
docker compose --env-file .ael/consensus/compose.env -f compose.bft.yaml up --build
```

Open `http://localhost:1317`. Generated private keys and cluster tokens stay under `.ael/consensus`, are ignored by Git, and are created with owner-only permissions. Back up that directory if the identities must survive host loss. Do not share `compose.env`.

To use another public port:

```sh
AEL_PUBLIC_PORT=2317 docker compose --env-file .ael/consensus/compose.env -f compose.bft.yaml up --build
```

Inspect consensus:

```sh
curl http://localhost:1317/v1/network
curl http://localhost:1317/v1/chain/verify
curl http://localhost:1317/v1/consensus/certificates/latest
curl http://localhost:1317/v1/state/checkpoint
```

Stop one validator and commits can continue with three votes. Stop two and new state transitions halt without changing canonical state:

```sh
docker compose --env-file .ael/consensus/compose.env -f compose.bft.yaml stop validator-4
docker compose --env-file .ael/consensus/compose.env -f compose.bft.yaml stop validator-3
```

Restarting a stale validator causes an authenticated full-state synchronization before it votes again. Signed safety votes are fsynced first to a hash-chained WAL beside the validator state file. Recovery verifies the WAL and refuses a conflicting signature for the same epoch, height, view, and phase.

The coordinator fsyncs finality certificates to a hash-addressed sidecar after canonical state persistence. On restart, a certificate matching the exact height and state hash restores the parent certificate used by proposer selection. Certificates are served at `/v1/consensus/certificates/latest` and `/v1/consensus/certificates/{certificateHash}`. A stale validator accepts synchronized state only after checking the certificate hash, canonical validator-set hash, unique quorum voting power, signed vote domains, and every Ed25519 signature. A missing, corrupt, or tampered certificate leaves that validator unsynchronized.

`/v1/state/checkpoint` exposes a certificate-bound canonical JSON snapshot split into independently hashed chunks with a Merkle root. `/v1/state/chunks/{index}?checkpoint={hash}` serves an exact cached checkpoint, preventing chunks from different heights from being mixed. The follower accepts comma-separated `AEL_SYNC_SOURCES`; with two or more sources it requires matching checkpoint manifests, alternates chunk providers, reconstructs the state, verifies every chunk and the Merkle root, then verifies the finality certificate against `/v1/consensus/validator-set` before persistence.

Before each proposal, the coordinator checks the deterministically selected proposer. If that proposer is unavailable, validators sign `VIEW_CHANGE` votes, fsync them to WAL, and advance only after quorum voting power forms an `AEL-VIEW-CERTIFICATE/1`. The replacement proposal must carry that certificate. Validators recover prepared locks from WAL and reject a higher-view proposal whose state root or block hash conflicts with the locked value.

## Security boundary

This is a real multi-process quorum devnet, not a mainnet consensus claim. It handles one unavailable or divergent validator out of four, verifies signed votes, derives a deterministic weighted proposer, performs certified view changes, durably serves finality certificates, restores the parent certificate after coordinator restart, and recovers signed-vote history and locks from validator WAL. The coordinator still transports proposals and is the single snapshot source; selected proposers are liveness-gated but do not yet broadcast directly to peers. Production work still needs validator-set governance, peer-to-peer transport, multi-source chunk/Merkle state sync, denial-of-service hardening, independent organizations and regions, formal review, external audits, and an incentivized adversarial testnet.

Consensus validator identities are infrastructure identities. Public `VALIDATOR` applications and signed follower heartbeats remain a separate onboarding layer until validator-set governance binds approved external operators into the voting set.
