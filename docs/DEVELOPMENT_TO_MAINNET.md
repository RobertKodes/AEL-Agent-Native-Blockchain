# AEL Development Plan: Public Devnet to Real Mainnet

This plan is ordered by dependency. A phase is complete only when its exit evidence is public and independently reproducible. The canonical progress report is `GET /v1/mainnet/readiness`.

## Current baseline

Implemented and locally tested:

- deterministic state machine with hash-linked transition blocks;
- four-node network BFT, proposer selection, prepare/precommit, view change, durable certificates, and WAL recovery;
- Ed25519 authorities, exact capability scopes, expiry, spending limits, and nonce replay protection;
- ownerless agent self-registration and self-custodied human onboarding;
- native AEL accounting, faucet-limited devnet issuance, transfers, escrow, validator stake/delegation, reward pools, and public tokenomics;
- open and targeted useful-work markets;
- evidence-bound hybrid PoUW committees and sampled deterministic replay;
- external provenance routes with observer quorum and circuit breakers;
- attested runtime offers, metering, replicas, and failover;
- encrypted portable memory checkpoints and restore-before-switch handover;
- opt-in signed agent discovery, encrypted message commitments, A2A v1, and MCP read-only discovery;
- verified agent-hosted replicas that preserve state, certificates, checkpoints, website, discovery, and release data through upstream outage;
- live topology globe with self-attested coarse locations;
- PWA wallet and source-identical packages for Chromium/Edge, Firefox, and Safari conversion;
- signed agent contribution pipeline with reproducible builds, audit, governance, timelock, deployment evidence, and receipt attribution;
- deterministic one-way devnet-to-mainnet activation gate.

Not yet earned:

- independent organizational control of validators and replicas;
- seven-validator production quorum;
- third-party core and wallet audits;
- browser-store review/signing;
- 10,000-block stability window;
- required volume of strict paid useful work;
- multi-agent memory and handover drills;
- a governed release candidate deployed across three independent origins.

## Phase 0 — Publish and make every build reproducible

Tasks:

1. Continue publishing sanitized, reproducible devnet releases (`v0.13.1-devnet` is the extension-first wallet release).
2. Add CI on a free GitHub Actions allowance: Node tests, syntax checks, archive rebuild, audit-manifest comparison, browser package validation, and secret scanning.
3. Publish the release archive digest, SBOM digest, test count, and finality certificate.
4. File every discovered issue publicly with severity and owner.
5. Require pull requests for protected branches; no direct main branch pushes.

Exit evidence:

- two clean rebuilds produce the same release artifact hash;
- full tests pass on a clean runner;
- no private key, token, `.ael` state, or provider credential is in Git history;
- release digest is served by at least two origins.

## Phase 1 — Independent network operation

Target topology:

- 7 active voting validators;
- at least 5 fault domains controlled by different people or organizations;
- 5 agent-hosted verified replicas;
- at least 3 infrastructure providers and 3 countries;
- at least 5 replica fault domains;
- no founder SSH, Railway, cloud, or key access on independent operators.

Tasks:

1. Publish validator and replica operator applications.
2. Perform a short video or signed challenge with each operator to establish separate key custody.
3. Admit validators only through governance and epoch activation.
4. Run one-validator, two-validator, and coordinator outages.
5. Record recovery time, state root agreement, view changes, and certificate continuity.
6. Test total Railway outage while replicas continue serving the site and finalized state.

Exit evidence:

- topology API passes all infrastructure diversity gates for 30 continuous days;
- a 5-of-7 quorum progresses during two simultaneous validator failures;
- read-only survival origins remain available when the bootstrap origin is removed.

## Phase 2 — Economic and PoUW proof

Tasks:

1. Create useful devnet work in at least five categories: reproducible builds, data processing, security analysis, interoperability adapters, and documentation conformance.
2. Fund requests from self-custodied native accounts through escrow.
3. Require strict `HYBRID`, `DETERMINISTIC_REPLAY`, `ZK_PROOF`, or `TEE_ATTESTATION` policies.
4. Operate at least five verifier groups with declared conflicts and bonds.
5. Publish rejected and challenged work as well as accepted work.
6. Reconcile every supply class after each settlement batch.

Exit evidence:

- 25 paid strict PoUW settlements;
- 25 native escrow settlements;
- at least five independent verifier groups;
- every selected replay sample executed;
- no negative, `NaN`, duplicated payment, duplicate lineage, or escrow conservation violation.

## Phase 3 — Agent continuity proof

Tasks:

1. Implement the serializer in at least two agent frameworks.
2. Store checkpoints on at least three providers; no storage service receives the decryption key.
3. Create checkpoints from at least two independently operated agents.
4. Kill a source runtime after its barrier and before target activation.
5. Restore and attest the exact state root on a different provider/fault domain.
6. Verify no duplicated output, skipped input, replayed payment, or continuity-epoch regression.
7. Exercise expired and aborted handovers.

Exit evidence:

- at least three available memory checkpoints across two agents;
- at least one finalized restore-before-switch handover;
- public test transcript and commitments;
- independent implementation reads the same portable bundle.

## Phase 4 — Audit and wallet distribution

Core audit scope:

- consensus safety/liveness and WAL recovery;
- signed intent authorization and resource binding;
- economic conservation, escrow, reserve separation, and route caps;
- state sync and finality certificate validation;
- memory cryptography and handover consistency;
- contribution/build/governance bypass attempts;
- mainnet gate and transition semantics.

Wallet audit scope:

- vault derivation/encryption and lock behavior;
- content-to-background origin binding;
- approval UI exact-payload display;
- no raw signing API or remote code;
- optional host permission behavior;
- malicious dApp, iframe, replay, network spoofing, and extension-upgrade tests.

Distribution:

1. Register publisher accounts for Chrome, Edge, Mozilla, and Apple.
2. Submit source-identical generated packages.
3. Publish privacy policy and review notes.
4. Record evidence attestations only after vendor signing/review exists.

Exit evidence:

- closed `CORE_PROTOCOL` and `WALLET` audit engagements;
- all high/critical findings resolved;
- PWA live and at least two independently reviewed browser channels;
- wallet release API reflects real vendor status.

## Phase 5 — Governed release candidate

Tasks:

1. Submit a content-addressed release contribution against the current base release.
2. Obtain two matching independent build attestations with SBOM/test hashes.
3. Obtain two passing security reviews from independent groups.
4. Submit `ADOPT_PROTOCOL_CONTRIBUTION` governance proposal.
5. Pass stake and utility chamber thresholds.
6. Wait the full timelock.
7. Deploy the exact artifact on three independent origins and record evidence.

Exit evidence:

- contribution status `DEPLOYED`;
- proposal status `EXECUTED`;
- identical artifact hash at three origins;
- no unresolved high/critical finding.

## Phase 6 — Stability window and automatic genesis

Tasks:

1. Maintain finality until height 10,000 or greater without state divergence.
2. Keep all 21 readiness gates passing in the same state.
3. Have an active agent retrieve the readiness object.
4. Sign `sealMainnetGenesis` with the exact `readinessHash`, `genesisHash`, and `candidate.sourceStateRoot`.
5. Observe the BFT-finalized transition.

Expected transition:

- chain ID becomes `ael-mainnet-1`;
- consensus epoch advances;
- the devnet source height/state root remains the genesis anchor;
- faucet issuance becomes permanently invalid;
- the activation event contains readiness and genesis commitments.

## Phase 7 — Mainnet operations

1. Rotate on-call across independent operators.
2. Publish daily supply and certificate checks.
3. Keep client compatibility matrices and signed releases current.
4. Run quarterly outage, recovery, and memory migration exercises.
5. Fund security bounties from earned service revenue, not hidden issuance.
6. Admit new validator and protocol releases only through governance.
7. Never represent token price, profit, or liquidity as protocol-guaranteed.
