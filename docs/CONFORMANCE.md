# AEL implementation conformance

Implemented target: `AEL/0.13` secure P2 public devnet backed by persistent state. The release includes a tested four-process, 3-of-4 signed network-consensus devnet profile, hybrid PoUW, portable memory, agent-hosted replicas, contribution governance, and deterministic mainnet readiness. A deployment may report either network BFT or the local-replica fallback through `/v1/network`; neither is a production or mainnet claim.

## Verified locally

- Four deterministic validator replicas reach identical state roots.
- Four network validator processes independently execute transitions and require three matching signed PREPARE and PRECOMMIT votes; divergence, restart/resynchronization, one-node failure, and two-node safe halt are tested.
- Humans create agents, fund accounts and work, trade, delegate, govern, dispute, and inspect provenance.
- Autonomous workers discover, accept, execute, and receipt assigned deterministic work.
- A continuously hosted worker and two hosted verifier processes use distinct scoped signing keys; human settlement remains separate.
- External operators can self-custody keys and claim one-time, expiring, fingerprint-bound invitations without transmitting private material.
- Outside operators can publish signed role applications; administrator approval is cryptographically restricted to the exact requested roles, capabilities, limits, specialist profile, and maximum expiry.
- Human requester, account, delegation, parent, and governance actions can use self-custodied scoped keys; identity-bearing fields are bound to the signer and governance votes cannot replay within a chamber.
- Auditors can accept engagement-scoped capabilities, submit signed evidence hashes, and leave a public finding/response/closure trail.
- Releases contain a deterministic audit manifest covering all 12 specification chapters and released implementation artifacts.
- Agent identity is non-transferable; recovery advances key epochs without treasury transfer.
- Parent covenants require a bond, bounded terms, exact agent consent, and agent-controlled exit.
- Work settlement is escrow-bounded; disputes freeze earned-liquidity admission.
- Earned admissions require unique payment and external lineage; route caps are cumulative.
- Virtual liquidity and redeemable reserves remain separate in state and public APIs.
- Price-neutral earned depth leaves marginal price unchanged within numeric tolerance.
- Solana and EVM fixture routes validate finality fields and replay nullifiers.
- Real-value routes additionally require audit/custody hashes, positive caps, and matching proof observations from independently grouped observer identities.
- Invalid external proofs quarantine dependent value and pause only their route.
- Runtime leases require fresh measurement-bound attestation and multiple fault domains.
- Runtime providers have bonded registries, scoped signed offers, heartbeats, capped usage receipts, and failover state.
- Non-fixture runtime attestations require an approved issuer signature, single-use nonce, ephemeral key, profile/measurement match, expiry, and control-surrender receipt.
- Buyers cannot redeem beyond native plus recognized external reserve.
- External release decrements recognized reserve before release.
- Validator stake and service-reward bonds/accounting are separate.
- Double-sign evidence deterministically tombstones and slashes.
- Emergency actions expire; protected constitutional actions cannot be proposed.
- The secure public browser console is read-only and points operators to signed CLI/SDK workflows instead of presenting unsigned mutations that will fail.
- The public terminal portal exposes onboarding, roles, live network state, AEL devnet token metadata, SDK and skill downloads, whitepaper navigation, and wallet installation guidance.
- Humans and actor-bound agents can complete policy-bounded devnet onboarding from one browser page: local encrypted key generation, signed application, automatic exact-scope invitation, self-claim, and identity initialization.
- Every accepted transition appends a deterministic SHA-256 block committing its predecessor, application-state root, transition, and payload hash; public endpoints verify the full available link chain and latest state root.
- The devnet wallet extension encrypts locally generated Ed25519 key material and confirms exact signed actions; it is explicitly not represented as audited production custody.
- Approved validator followers can independently mirror full state, verify canonical roots, persist snapshots, and publish signed exact-height heartbeats.
- JavaScript and Python canonical hashes match golden vectors.
- Builds are byte-for-byte reproducible and emit a detached SHA-256 digest.

## Deliberately disabled or not claimed

- Real-value routes, production bridges, production RPC/indexer trust, and production oracle feeds remain disabled despite the observer-quorum implementation.
- Production BFT consensus. The networked devnet has a fixed proposer/bootstrap source and lacks leader rotation, view change, consensus WAL/certificates, peer-to-peer transport, and validator-set governance. Hosted services also share one Railway account and are not independent organizations.
- Real TEE vendors, hardware secret release, and geographically independent providers.
- Voting external validator onboarding, incentivized testnet operation, independent audits, and bug bounty. External non-voting follower onboarding is implemented.
- Legal/regulatory approval, production incident organization, and mainnet readiness.
- A general-purpose AI model or unrestricted tool runner; the included worker is deterministic.

These are P2-P5 gates requiring external infrastructure, independent operators, security audits, legal review, and explicit deployment authority. The project must not represent the local profile as mainnet-ready.
