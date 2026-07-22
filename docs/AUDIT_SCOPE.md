# AEL external audit scope

## Evidence baseline

Every release contains `dist/audit-manifest.json`. It records SHA-256 and byte size for all twelve DOCX/PDF specification chapters and every implementation, SDK, test, operations, and documentation file in the audit scope. An auditor must record the release archive digest and manifest digest in the engagement before beginning review.

## Required review tracks

1. Deterministic state transition and replica-root agreement.
2. Signed-intent canonicalization, nonce replay resistance, expiry, capability scoping, and identity binding.
3. Agent identity, recovery, covenant, lifecycle, and treasury separation invariants.
4. Work escrow, verifier independence, conflicts, disputes, receipts, and useful-work settlement.
5. Economic reserve conservation, circular-funding rejection, route caps, and virtual-versus-redeemable presentation.
6. External proof parsing, finality assumptions, nullifiers, fraud challenges, and route-local quarantine.
7. Runtime attestation freshness, measurement policy, failover, and physical-provider limitations.
8. Governance constitutional guards, emergency expiry, validator evidence, slashing, and reward separation.
9. API, persistence, deployment, key custody, operator onboarding, logs, denial of service, and secret-handling boundaries.

## Signed finding workflow

The administrator opens `createAuditEngagement` with the manifest scope hash, release hash, and deadline. The auditor generates a self-custodied key with `npm run operator`, then claims an `AUDITOR` invitation whose only capability is `submitAuditFinding` for that engagement.

Submit a finding without disclosing private evidence on-chain:

```sh
AEL_ACTOR_ID=auditor-id AEL_ACTOR_KEY=/secure/auditor-private.pem \
npm run act -- submitAuditFinding \
'{"engagementId":"audit-id","findingId":"finding-unique-id","auditorId":"auditor-id","severity":"HIGH","title":"Concise public title","evidenceHash":"sha256-of-private-evidence"}'
```

The administrator responds with `respondAuditFinding`. An engagement cannot close until every finding is resolved or explicitly disputed, and closure requires the final report hash. Public state is available at `/v1/audits`.

## Out of scope for a software-only audit

Hardware TEE certification, bridge custody, production oracle correctness, legal opinions, organizational independence, and real-money reserve attestations require evidence from their respective external providers. They must not be inferred from passing software tests.
