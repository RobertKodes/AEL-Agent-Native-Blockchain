# AEL devnet status

Verified on 2026-07-22 against `https://ael-network.onrender.com`.

## Working now

| Requirement | Evidence |
|---|---|
| Attention-worthy terminal website | Live `/`, `/about`, `/join`, `/agents`, `/network`, `/infrastructure`, `/blocks`, `/token`, `/developers`, `/whitepaper`, and `/wallet` return 200 and render under a no-neon terminal system. |
| Easy human onboarding | `public-browser-proof-human` was auto-approved under the bounded policy, self-claimed, and funded with 100 test AEL at height 164. |
| Easy agent onboarding | `public-browser-proof-agent` was auto-approved with actor-bound capabilities, self-claimed, and created its own active agent record at height 154. |
| Installable wallet app | `/wallet` creates or imports a PBKDF2/AES-GCM encrypted Ed25519 identity and provides balance, receive, signed send, activity, backup, finality, and ownerless-agent creation without raw JSON. It is an installable standalone PWA with 192/512 icons and an offline application shell. |
| Ownerless one-step agent join | `POST /v1/agents/register` verifies one agent-signed envelope and commits its application, fixed invitation, claim, authority, and active agent record. `/downloads/ael-join.mjs` performs the complete flow locally without an owner or private-key transmission. |
| Optional extension wallet | Downloadable Manifest V3 wallet supports templates, application, status, claim, signed actions, and encrypted backup/restore. Browser store publication is not claimed. |
| Agent discovery and SDKs | `/llms.txt`, `/.well-known/ael.json`, `/v1/manifest`, `/openapi.json`, JS/Python SDK downloads, and a validated installable agent skill. |
| Devnet token | `/v1/token` identifies `AEL`, `uael`, six decimals, testnet status, faucet cap, tracked supply, and separated accounting classes. |
| Hash-linked ledger | `/v1/blocks` publishes predecessor hashes, state roots, transition and payload commitments. `/v1/chain/verify` verified 15 blocks through height 164 at audit time. |
| Network consensus release | `compose.bft.yaml` started one coordinator and four separate persistent validators. A real transition committed at height 1 with 4/4 Ed25519 PREPARE/PRECOMMIT votes. Tests cover one divergent validator, restart/resynchronization, one-node failure, and two-node safe halt. |
| Public network consensus | `/v1/network` reports `NETWORKED_BFT_DEVNET`, four separate Railway validator processes, quorum 3, and 4/4 matching signed finality through height 213. A deliberately divergent fourth validator was rejected while height 194 finalized with 3/4 votes; after recovery it returned to 4/4. Restart finality restoration uses signed `STATUS` attestations rather than an unsigned hash comparison. |
| Agent-hosted chain copies | Keyless `MIRRORING` mode and `compose.mirror.yaml` work; `compose.agent-node.yaml` runs a worker and mirror as separate sidecars. A production mirror independently matched the coordinator state hash at height 164. |
| Guided agent hosting | `npm run agent-node -- setup`, `start`, and `status` verify the public identity, protect its key file at mode `0600`, mount it read-only into the worker, and run a separate persistent keyless chain mirror. |
| Reviewed signed followers | `public-follower-node-a` previously published a verified exact-height signed heartbeat; the follower image also passes direct and Docker tests. |
| Work/runtime/verification/audit/interchain/governance paths | Covered by the executable protocol tests and public APIs; hosted worker, verifier, and runtime-provider services remain deployed. |
| Packaging | 64 tests pass; the five-container quorum stack, coordinator and mirror images start healthy; skill validates; ZIPs pass integrity checks; reproducible release is downloadable. |

## Still required before mainnet or decentralization claims

1. Replace the devnet’s fixed proposer/bootstrap source with leader rotation, view change, consensus WAL/certificates, peer-to-peer transport, and validator-set governance.
2. Recruit genuinely independent validator, verifier, observer, and runtime-provider organizations across separate accounts, regions, and fault domains.
3. Publish the extension through browser stores; this needs store ownership, review, signing, and release governance outside the repository.
4. Complete independent security and wallet audits, load/abuse testing, monitoring/on-call, backup recovery drills, a bug bounty, and legal review. Keep real-value routes disabled until those gates pass.

The present system is a working devnet blockchain implementation with deterministic hash-linked blocks, signed state transitions, external mirrors, and live multi-process signed quorum consensus. It is not decentralized mainnet because the fixed proposer and validator services remain under one project owner.
