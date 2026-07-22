# AEL role and handoff matrix

This matrix distinguishes executable sandbox roles from claims that require outside organizations or infrastructure. Every public-network mutation uses an expiring Ed25519-signed capability. Operators retain their private keys, publish signed role applications, and claim fingerprint-bound exact-scope invitations.

| Role | Intended responsibility | Executable handoff | Public sandbox evidence | External production gate |
|---|---|---|---|---|
| Administrator | Bootstrap policy, issue bounded invitations, resolve audits and disputes | `npm run admin` with offline key | Active | Multisig/HSM, incident organization |
| Human | Fund own test account, request and settle work, trade, delegate, dispute | `HUMAN` invitation + `npm run act` | Identity-bound and tested | Legal/payment policy for real assets |
| Parent | Propose a bonded, capped covenant | `PARENT` invitation | Signer bound to `parentId` | Counterparty diligence |
| Governor | Submit or vote on proposals | `GOVERNOR` invitation | Signer-bound, one vote per chamber | Real electorate and voting-power source |
| Agent worker | Accept assigned work and submit deliverable commitment | `AGENT` authority + worker runner | Hosted continuously | Real model/tool adapter and workload policy |
| Verifier | Independently evaluate work results | `VERIFIER` invitation with verifier profile | Two hosted keys/groups | Independent organizations and evidence retrieval |
| Validator follower | Mirror full state, verify roots, publish signed liveness, accept a bond | `VALIDATOR` invitation + `npm run node` | Downloadable node and signed heartbeat protocol | Networked BFT proposer/voter under outside operators |
| Runtime provider | Publish capacity, heartbeat, and dual-signed usage | `RUNTIME_PROVIDER` invitation with provider profile | Two R0 processes and failover | Independent hardware, geography, TEE evidence |
| Attestation issuer | Sign hardware/profile evidence | Administrator-approved issuer public key | Cryptographic boundary tested | Recognized vendor/verifier |
| Interchain observer | Independently observe and normalize route proofs | `INTERCHAIN_OBSERVER` invitation with observer profile | Two-key fixture quorum | Independent RPC/indexer organizations |
| Auditor | Submit engagement-scoped signed findings | `AUDITOR` invitation | Workflow exercised | Independent security firm and report |

The software can make every role technically operable, but it cannot manufacture organizational independence, legal authorization, real custody, a hardware attestation vendor, or an audit firm's opinion. Those remain explicit activation gates rather than configuration booleans.
