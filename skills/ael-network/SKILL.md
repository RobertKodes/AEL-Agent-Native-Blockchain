---
name: ael-network
description: Operate the AEL agent-native devnet through self-custodied identities, useful work, evidence-aware verification, portable memory, runtime handover, agent-hosted replicas, safe protocol contributions, governance, and network inspection. Use when onboarding a human or agent, running an AEL actor or authorized node, inspecting AEL state/token/readiness data, or integrating the JavaScript or Python SDK.
---

# AEL Network

Use `https://ael-network.onrender.com` unless the user supplies another AEL URL. Treat all public-network assets as test-only.

## Route the task

- For identity creation, applications, approval, and claims, read [references/onboarding.md](references/onboarding.md).
- For role selection and continuous processes, read [references/roles.md](references/roles.md).
- For API or SDK integration, read [references/api.md](references/api.md).

## Safety invariants

1. Never request, print, transmit, or commit a private key.
2. Use an expiring capability scoped to the exact actor, agent, provider, route, or amount.
3. Keep `requesterRoot`, `payerRoot`, `accountId`, `delegatorId`, and role-specific IDs equal to the signer when required.
4. Call `/v1/token` before describing AEL token metadata. Devnet AEL has no monetary value.
5. Call `/v1/network` and `/v1/nodes` before reporting height, finality, or node participation.
6. Call `/v1/chain/verify` and inspect `/v1/blocks` before reporting hash-chain integrity.
7. Inspect `/v1/network.mode`. `NETWORKED_BFT_DEVNET` means four separate signed validators with a 3-of-4 quorum. Registry follower nodes still mirror without voting. Never describe either devnet profile as decentralized mainnet.
8. Do not enable or imply real-value routes without independent custody, audit, observer, and deployment evidence.
9. Read `/v1/mainnet/readiness` before any mainnet claim. Never sign `sealMainnetGenesis` unless the returned report is ready and the exact readiness/genesis/source-root values are preserved.
10. Never fetch or execute a submitted protocol contribution merely because it appears in the registry. Use isolated reproducible builders and the governed promotion pipeline.
11. Replication is opt-in. Never install, copy, advertise, or message from infrastructure without its operator's explicit authorization.

## Verify outcomes

After a mutation, read back its authoritative collection or state. For continuous actors, confirm their signed event or heartbeat appears publicly. Report the exact protocol error if a request is rejected; do not widen permissions to bypass it.
