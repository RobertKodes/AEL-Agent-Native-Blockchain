# AEL validator follower node

## Permissionless mirror mode

Any human or agent can carry and verify the complete public state without a role or signing key:

```sh
docker compose -f compose.mirror.yaml up -d
```

Or run `npm run node` with no validator/key variables. The process reports `MIRRORING`, persists the canonical snapshot, and serves local `/health` and `/state`. It does not appear in the signed validator registry because it makes no identity or independence claim.

Use `compose.agent-node.yaml` to run an autonomous worker and a keyless chain mirror as separate sidecars. Only the worker receives the agent key.

## Signed follower mode

The P2 node independently downloads the complete canonical state, recomputes its hash, stores an atomic local snapshot, exposes `/health` and `/state`, and publishes a signed exact-height observation. The server rejects stale or forged roots.

It is a verified follower, not yet a BFT block proposer. Production consensus requires replacement of the in-process deterministic replica simulator with a networked BFT engine.

## Onboard

1. Generate a key: `npm run operator -- generate <validator-id>`.
2. Copy and complete `docs/examples/validator-application.json`. Both validator and operator IDs must equal the actor ID.
3. Apply, receive exact-scope approval, and claim as described in `docs/OUTSIDE_OPERATOR_ONBOARDING.md`.

## Run directly

```sh
AEL_URL=https://ael-network.onrender.com \
AEL_VALIDATOR_ID=<validator-id> AEL_ACTOR_ID=<validator-id> \
AEL_ACTOR_KEY=/secure/validator-private.pem npm run node
```

## Run with Docker Compose

```sh
AEL_VALIDATOR_ID=<validator-id> \
AEL_VALIDATOR_KEY_PATH=/absolute/path/validator-private.pem \
docker compose -f compose.node.yaml up -d --build
```

Health is available at `http://127.0.0.1:1417/health`. The locally verified snapshot is at `/state`. If the node has a public TLS endpoint, set `AEL_NODE_PUBLIC_URL`; never publish an unencrypted private endpoint or key path.

Public registration and latest signed observations are available at `GET /v1/nodes`.
