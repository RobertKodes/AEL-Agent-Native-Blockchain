# Free hosting and survival plan

This document records how the AEL public devnet is hosted at zero cost and how the network survives the loss of any single hosting account. It contains no private-key material.

## What happened to the Railway origin

On 2026-07-23 the main `ael-network` gateway service disappeared from the Railway project and `https://ael-network-production.up.railway.app` began returning `404 Application not found`. The Railway workspace is now on a free plan whose resource-provision limit is exhausted: creating a replacement service fails with `Free plan resource provision limit exceeded`, so the old origin cannot be restored there. The three remaining actor services (`ael-verifier-a`, `ael-verifier-b`, `ael-provider-r0-a`) still exist but point at the dead origin. Railway is therefore no longer a viable free home for the gateway.

## Primary free host: Render

[Render](https://render.com) free web services require no payment method, build the repository `Dockerfile` directly, and provide an always-available HTTPS origin. Limits that shape this design: the free instance spins down after 15 minutes without traffic, its filesystem is ephemeral, and a workspace has 750 free instance-hours per month (enough for one always-on service).

Deploy (a human account holder must do this once):

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub.
2. Click **New → Blueprint**, select `RobertKodes/AEL-Agent-Native-Blockchain`, and apply. The checked-in [`render.yaml`](../render.yaml) configures the Docker web service, the `/health` check, secure mode, and a generated `AEL_BOOTSTRAP_TOKEN`.
3. Copy the assigned origin (for example `https://ael-network-xxxx.onrender.com`).

Alternatively use the one-click deploy: <https://render.com/deploy?repo=https://github.com/RobertKodes/AEL-Agent-Native-Blockchain>

After the first deploy, from a checkout of this repository:

```sh
node scripts/set-public-origin.mjs https://<assigned-origin>
npm test
git commit -am "Migrate public origin" && git push
```

This rewrites every documented origin, updates `ops/public-origins.json` (which activates the heartbeat workflow below), and the next Render auto-deploy serves the migrated site. Then bootstrap the first authority with the token shown in the Render dashboard environment tab:

```sh
curl -fsS -X POST https://<assigned-origin>/v1/authorities/bootstrap \
  -H "x-ael-bootstrap-token: <token>" \
  -H "content-type: application/json" \
  -d '{"actorId":"ael-admin","publicKey":"<contents of .ael/railway-admin-public.pem>"}'
```

## How the chain survives a free host

Free instances lose their filesystem on every restart, so durability is layered:

1. **Keep-alive and monitoring.** [`network-heartbeat.yml`](../.github/workflows/network-heartbeat.yml) runs on GitHub Actions every 10 minutes, pings `/health` on every origin listed in [`ops/public-origins.json`](../ops/public-origins.json), and keeps the free instance from idling for most of the day.
2. **State backup.** The same workflow fetches `/v1/state` from the primary origin and commits it to the `state-backup` branch whenever the height advanced. It refuses to overwrite a backup with a lower height, so a freshly reset instance can never destroy the newest snapshot. Git history preserves every prior snapshot.
3. **Restore at boot.** The container entrypoint, when the state file is missing and `AEL_RESTORE_URL` is set, downloads and validates the latest backed-up state before starting, then continues the chain from the backed-up height.
4. **Independent replicas.** The real survival mechanism remains agent-hosted mirrors (`compose.mirror.yaml`, `ael-agent-host.mjs`, `/v1/replicas`), which verify quorum certificates instead of trusting a backup URL. See [INDEPENDENT_OPERATOR_RECRUITMENT.md](INDEPENDENT_OPERATOR_RECRUITMENT.md) and [VALIDATOR_NODE_GUIDE.md](VALIDATOR_NODE_GUIDE.md).

Honest boundaries: the backup/restore loop is an operator-controlled convenience, not trustless synchronization — the instance trusts the configured `AEL_RESTORE_URL`, up to the last 10 minutes of blocks can be lost across a restart, in-flight work during a spin-down is dropped, and GitHub disables cron workflows in repositories with no activity for 60 days (the backup commits themselves count as activity while the chain advances). None of this changes the devnet classification: no monetary value, no availability guarantee.

## Alternatives assessed (July 2026)

- **Fly.io** — requires a payment method for new organizations; `fly.toml` is kept in the repository for a future paid or credited deployment.
- **Railway** — free plan exhausted as described above; remaining actor services can be repointed at the new origin while credit lasts.
- **Koyeb / Google Cloud Run / Oracle Always Free** — capable, but account creation requires a payment card, so they are follow-up replica homes rather than the zero-friction primary.
- **Hugging Face Spaces (Docker)** — free and card-free; sleeps after prolonged inactivity and also has an ephemeral filesystem. Viable second replica origin for any operator with an HF account.
- **Self-hosted mirror** — any machine with Docker can run `docker compose -f compose.mirror.yaml up -d` and optionally publish an HTTPS origin through a free tunnel. This is the recommended first step for every independent operator and costs nothing.

## Division of responsibility

- GitHub (free, public repo): source of truth, CI, heartbeat, state backups, release archive.
- Render (free): the authoritative public origin accepting signed intents.
- Independent operators and agents (free, voluntary): verified mirrors and, after the P2P consensus work, voting validators — the only path to the network genuinely never dying.
