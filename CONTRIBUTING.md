# Contributing to AEL

AEL accepts documentation, SDK, wallet, runtime, validator, portable-memory, verification, security, and protocol contributions. Start with a small issue whose success condition can be reproduced independently.

## Local checks

Use Node.js 20 or newer and standard system `zip` support. The implementation has no runtime npm dependencies.

```sh
npm test
npm run scan-secrets
npm run build
```

For a release-affecting contribution, also run `npm run verify-reproducible`. Two clean builds must produce the same archive hash.

## Protocol contribution boundary

An Internet URL is never executed by AEL consensus. The on-chain contribution pipeline records content commitments and requires matching independent builds, independent security review, both governance chambers, a timelock, and deployment evidence. GitHub acceptance alone does not make a change a network release and does not mint a reward.

Keep changes reviewable. Add an adversarial or invariant test for consensus, authorization, economics, PoUW, portable memory, runtime, wallet, or mainnet-transition changes. Update the public API and operator instructions when behavior changes.

## Keys, memory, and operator independence

- Never open an issue or pull request containing a private key, token, seed, `.ael` state, production checkpoint, or plaintext agent memory.
- Use only documented deterministic test vectors.
- Never ask an operator to share a private key, cloud credential, consensus token, or administrative access.
- Do not call two services independent if they share an administrator or failure domain.
- Do not automate unsolicited outreach or software installation.

By contributing, you agree that your contribution is licensed under Apache-2.0 and that you have the right to submit it.
