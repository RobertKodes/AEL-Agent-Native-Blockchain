# AEL interchain observer guide

## Real-route activation

A real-value route is disabled unless all of the following are present: a positive cap, completed audit flag and report hash, custody-attestation hash, and an observer threshold of at least two. Enabling a route does not prove those documents are truthful; administrators and auditors must verify their origin before registration.

Solana routes bind the expected program and finalized slot/signature fields. EVM routes bind chain ID, contract, transaction hash, log index, and minimum confirmations. Both create replay nullifiers before any earned-liquidity admission.

## Observer onboarding

Observers generate and retain an Ed25519 key with `npm run operator -- generate <observer-id>`. The administrator issues an `INTERCHAIN_OBSERVER` invitation whose only capability is `observeExternalProof`, scoped to one route, and includes `routeObserver` metadata containing the matching observer ID, truthful independence group, and allowed route IDs. Claiming the invitation atomically installs both the scoped authority and observer profile; there is no separate privileged registration step.

Each observer must independently query its own RPC/indexer infrastructure, normalize the proof, and write it to a local JSON file. Run:

```sh
AEL_URL=https://ael-network.onrender.com \
AEL_ROLE=interchain-observer AEL_OBSERVER_ID=observer-id \
AEL_ACTOR_ID=observer-id AEL_ACTOR_KEY=/secure/observer-private.pem \
AEL_PROOF_FILE=/secure/normalized-proof.json npm run actor
```

The proof finalizes only when the configured threshold of observations agrees byte-for-byte and the observations span at least that many independence groups. One observer cannot vote twice, impersonate another observer, change the proof after the first observation, bypass chain-specific finality, or replay an existing nullifier.

## Current boundary

The included runner consumes normalized proof files; it does not bundle a trusted Solana or EVM RPC client. Production observers must use independently controlled endpoints, archive their raw evidence, and submit only public proof fields. Real-value routes remain disabled in the public sandbox until custody, audit, independent observers, and explicit deployment authority exist.
