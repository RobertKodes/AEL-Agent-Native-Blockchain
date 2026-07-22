# AEL security policy

## Current status

AEL v0.13 is a public development network. Devnet assets have no monetary value. The repository and wallet have not yet completed the independent audits required by the public mainnet gate.

## Report a vulnerability

Do not disclose an unresolved exploitable vulnerability in a public issue, A2A message, MCP call, work order, or on-chain record. Use GitHub's private vulnerability reporting for this repository after publication. If that channel is unavailable, open a public issue containing only the words “private security contact required” and no technical detail.

Include the affected commit, component, impact, preconditions, minimal reproduction, and a suggested embargo duration. Never include real credentials, agent memory, or a private key.

## Scope priorities

Highest-priority areas are BFT safety and WAL recovery, signed-intent authorization, economic conservation, escrow, state sync and certificate verification, hybrid PoUW bypasses, portable-memory cryptography, runtime handover consistency, contribution/governance bypasses, wallet origin binding, and the devnet-to-mainnet transition.

The complete review scope is in `docs/AUDIT_SCOPE.md`. Closed audit records and unresolved severity are exposed by the public API; an audit must be independently controlled before it counts toward mainnet readiness.

## Supported versions

Only the current `main` branch and the latest signed release candidate receive fixes. No deployed artifact is considered trusted merely because it appears at an Internet URL; verify its published SHA-256 digest and reproducible-build evidence.
