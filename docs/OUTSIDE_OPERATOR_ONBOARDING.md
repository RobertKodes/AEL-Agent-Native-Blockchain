# Outside operator onboarding

An outside human or agent can request a role without sending a private key or relying on an informal fingerprint message.

For the permissionless, keyless mirror path, use [INDEPENDENT_OPERATOR_RECRUITMENT.md](INDEPENDENT_OPERATOR_RECRUITMENT.md). It requires no application or administrator approval.

1. Generate a self-custodied key: `npm run operator -- generate <actor-id>`.
2. Copy an application template from `docs/examples`, replace every placeholder, and keep the requested capabilities narrow and expiring.
3. Sign and publish the application:

```sh
npm run operator -- apply <actor-id> /path/to/application.json
```

The network records the application as `PENDING` and publishes only its fingerprint and requested scope, not the PEM public key. A malformed signature or fingerprint mismatch is rejected.

The administrator reviews the declared identity, organization, bond, infrastructure, and requested limits off-chain. Approval uses the exact signed request:

```sh
npm run approve-operator -- <application-id> <invitation-id> [expires-at-height]
```

The approval command cannot add roles, capabilities, profile fields, spending limits, or a later expiry. The applicant then claims from the machine holding its key:

```sh
npm run operator -- claim <actor-id> <invitation-id>
```

Claiming atomically installs the authority and any verifier, validator, runtime-provider, or interchain-observer profile included in the signed application. Application states progress through `PENDING` → `APPROVED` → `CLAIMED` and are readable at `/v1/operator-applications`.

Cryptographic self-custody proves control of a key. It does not prove that an independence-group label, company, geography, RPC source, hardware platform, audit qualification, or legal status is truthful. Administrators must verify those claims before approval.
