# Independent AEL mirror operator wanted

AEL needs an operator who controls infrastructure outside the current Railway account and administrative fault domain. No private AEL or Railway credential is shared. A read-only mirror needs no invitation and cannot mutate consensus state.

## Run the mirror

Download and verify the current release from the public network:

```sh
curl -fsSLO https://ael-network.onrender.com/downloads/release
curl -fsS https://ael-network.onrender.com/v1/manifest
tar -xzf release
cd ael-local-devnet
docker compose -f compose.mirror.yaml up --build -d
curl -fsS http://127.0.0.1:1417/health
```

The mirror periodically downloads public state, computes the canonical SHA-256 state hash itself, persists the state on its own volume, and exposes only `/health` and `/state`. It has no signing key and no authority to submit transitions.

## Independence requirements

- Infrastructure account is not owned or administered by the current AEL Railway owner.
- Operator controls its own billing, deployment, logs, and lifecycle.
- Prefer a different provider or, at minimum, a separate Railway account and workspace.
- Operator does not receive the consensus cluster token, validator keys, admin key, or any AEL private key.
- Public proof endpoint uses HTTPS and reports `MIRRORING`, current height, state hash, and `ael-follower/0.2.0` or later.

## Acceptance evidence

Provide:

1. Public HTTPS `/health` endpoint.
2. Operator-controlled account/provider declaration and fault-domain label.
3. Two observations at least ten blocks apart.
4. Matching state hashes against `/health` on the AEL network at each observed height.
5. A restart demonstration showing the mirror resumes from its persistent volume.
6. Confirmation that no AEL or Railway project secret was supplied.

The AEL owner verifies the endpoint and records the evidence. Running a mirror does not make the operator a block-producing validator; validator admission remains governed and reviewed.
