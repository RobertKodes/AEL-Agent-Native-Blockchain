# Sandbox operations

The container defaults to four deterministic validator replicas, persistent `/data`, and port 1317. For any host reachable by other people, secure mode is mandatory.

```sh
export AEL_BOOTSTRAP_TOKEN='generate-a-long-random-value'
docker compose up --build -d
curl http://127.0.0.1:1317/health
```

Bootstrap exactly one admin authority by sending its Ed25519 public key to `/v1/authorities/bootstrap` with `x-ael-bootstrap-token`. Then delete the bootstrap token from the deployment environment and restart; existing state no longer needs it, but secure-mode startup currently still requires a nonempty placeholder. All subsequent writes go through signed `/v1/intents`.

Do not enable real-value routes. Back up the state volume, monitor `/health` and `/v1/network`, terminate TLS at a trusted reverse proxy, apply request-rate limits there, and rotate any authority suspected of compromise using a signed `revokeAuthority` intent.

The active sandbox identifiers and public URL are recorded in `ops/railway-deployment.json`. No Railway secret or actor private key is stored there.
