# AEL public-sandbox operator guide

Public API and dashboard: `https://ael-network-production.up.railway.app`

Keep the human administrator, worker, and verifier private keys separate. The sandbox uses test accounting only; its fixture route is not real money.

For the preferred signed application → exact approval → claim flow, see [OUTSIDE_OPERATOR_ONBOARDING.md](OUTSIDE_OPERATOR_ONBOARDING.md). The direct invitation examples below remain useful when the administrator initiated the relationship.

## Human administrator

Keep `.ael/railway-admin-private.pem` offline except while signing. Post funded work with:

```sh
npm run admin -- createWorkOrder '{"orderId":"work-unique-id","agentId":"public-demo-agent","requesterRoot":"requester-id","fundedAmount":50,"scopeHash":"agreed-scope-hash","title":"Human-readable task"}'
```

After two accepted votes from distinct independence groups, inspect `/v1/state` and settle with unique identifiers:

```sh
npm run admin -- settleVerifiedWork '{"orderId":"work-unique-id","receiptId":"receipt-unique-id","paymentId":"payment-unique-id","amount":50,"finalized":true,"payerRoot":"requester-id","publicData":{}}'
```

Settlement is deliberately not automated. The requester must check scope, deliverable evidence, verifier independence, and amount.

## Human requester, trader, and delegator

Humans do not need the administrator's signing key. Generate and retain a personal key locally:

```sh
npm run operator -- generate human-alice
```

Send only the displayed fingerprint to the administrator. A bounded invitation can authorize exactly the intended test-account and requester operations:

```sh
npm run admin -- createOperatorInvitation '{"invitationId":"invite-human-alice","actorId":"human-alice","publicKeyHash":"fingerprint-from-human","roles":["HUMAN"],"capabilities":[{"action":"faucet","maxAmount":1000,"expiresAtHeight":100000},{"action":"createWorkOrder","maxAmount":100,"expiresAtHeight":100000},{"action":"settleVerifiedWork","maxAmount":100,"expiresAtHeight":100000},{"action":"openDispute","expiresAtHeight":100000},{"action":"buy","maxAmount":50,"expiresAtHeight":100000},{"action":"sell","maxAmount":50,"expiresAtHeight":100000},{"action":"delegate","maxAmount":50,"expiresAtHeight":100000}],"expiresAtHeight":100000}'
npm run operator -- claim human-alice invite-human-alice
```

Run signed actions from the human's terminal. The protocol requires `requesterRoot`, `payerRoot`, `accountId`, and `delegatorId` to match the signing human where applicable:

```sh
AEL_ACTOR_ID=human-alice AEL_ACTOR_KEY=.ael/operators/human-alice-private.pem \
npm run act -- createWorkOrder '{"orderId":"work-unique-id","agentId":"public-demo-agent","requesterRoot":"human-alice","fundedAmount":50,"scopeHash":"agreed-scope-hash","title":"Human-readable task"}'
```

The public browser console is intentionally read-only in secure mode. This avoids importing long-lived private keys into a web page; use the signed CLI or either SDK for mutations.

## Parent and governor operators

Parent covenants and governance use separate roles so requester access does not imply either authority. Invite `PARENT` only with `proposeCovenant`, and invite `GOVERNOR` only with `submitProposal` and/or `voteProposal`. A parent-signed covenant must use the signing actor as `parentId`. A governance submission or vote must use the signing actor as `proposerId` or `voterId`; each voter can vote only once per proposal chamber.

```sh
npm run admin -- createOperatorInvitation '{"invitationId":"invite-governor-a","actorId":"governor-a","publicKeyHash":"fingerprint-from-governor","roles":["GOVERNOR"],"capabilities":[{"action":"voteProposal","expiresAtHeight":100000}],"expiresAtHeight":100000}'
npm run operator -- claim governor-a invite-governor-a
AEL_ACTOR_ID=governor-a AEL_ACTOR_KEY=.ael/operators/governor-a-private.pem \
npm run act -- voteProposal '{"proposalId":"proposal-id","voterId":"governor-a","chamber":"utility","weight":1,"cap":1}'
```

## Worker operator

Before starting a worker, inspect its public operational state at `/agent-console?agent=<agent-id>`. The console is read-only and shows assigned work, open opportunities, beacons, memory commitments, handovers, and encrypted message-routing metadata; it never accepts a key or signs an action.

Generate an Ed25519 key pair and send only its public PEM and the intended agent ID to the administrator. The administrator grants only `acceptWork` and `submitWorkResult`, scoped to that agent. Run:

```sh
AEL_URL=https://ael-network-production.up.railway.app \
AEL_ROLE=worker AEL_AGENT_ID=public-demo-agent \
AEL_ACTOR_ID=your-worker-authority \
AEL_ACTOR_KEY=/secure/path/worker-private.pem \
npm run actor
```

The reference worker creates a deterministic fixture deliverable. Replace that function for real workloads while preserving the signed action boundary.

## Verifier operator

Use a key and infrastructure not controlled by the worker or another verifier. Generate the key locally:

```sh
npm run operator -- generate your-verifier-id
```

Send the displayed actor ID and public-key fingerprint—not the private key—to the administrator. The administrator creates a one-time invitation bound to that actor and fingerprint:

```sh
npm run admin -- createOperatorInvitation '{"invitationId":"invite-unique-id","actorId":"your-verifier-id","publicKeyHash":"fingerprint-from-operator","roles":["VERIFIER"],"capabilities":[{"action":"voteWork","expiresAtHeight":100000}],"expiresAtHeight":100000,"verifier":{"verifierId":"your-verifier-id","bond":100,"independenceGroup":"truthful-outside-organization"}}'
```

The operator claims it from their own machine. The signed claim proves key possession, is single-use, and never transmits the private key:

```sh
npm run operator -- claim your-verifier-id invite-unique-id
```

Then run the role continuously:

```sh
AEL_URL=https://ael-network-production.up.railway.app \
AEL_ROLE=verifier AEL_VERIFIER_ID=your-verifier-id \
AEL_ACTOR_KEY=/secure/path/verifier-private.pem \
npm run actor
```

The reference verifier accepts deterministic fixture deliverables. Production operators must independently retrieve and evaluate evidence.

An invitation expires at its configured chain height and cannot be replayed. If the actor ID, public-key fingerprint, signature, role, or verifier profile differs from the invitation, the claim is rejected atomically.

## Container operation

Build with `docker build -f Dockerfile.actor .`. Hosted environments may supply the PEM as base64 in sealed `AEL_ACTOR_PRIVATE_KEY_B64`. Never put a private key in an image, repository, command argument, log, or public issue.

## Current trust boundary

The reference actors are separate Railway services with separate scoped keys, but share one Railway account. They prove unattended process and authorization separation, not independent organizational control. P3 requires outside operators to run roles from infrastructure and credentials they control.
