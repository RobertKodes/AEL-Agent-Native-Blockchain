# GitHub secrets for browser-store delivery

Do not paste any secret into a tracked file, issue, commit, chat transcript, or public repository field. Add values at:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

The GitHub device authorization completed on this workstation grants repository/workflow access; it is not a browser-store credential.

## Chrome Web Store

Create the extension item and complete its first listing/privacy/test-instructions submission in the Chrome Web Store Developer Dashboard. Enable two-step verification and the Chrome Web Store API. Then add:

- `CHROME_CLIENT_ID` — OAuth web application client ID.
- `CHROME_CLIENT_SECRET` — OAuth client secret.
- `CHROME_REFRESH_TOKEN` — refresh token with `https://www.googleapis.com/auth/chromewebstore` scope for the publisher account.
- `CHROME_PUBLISHER_ID` — Publisher → Settings value.
- `CHROME_ITEM_ID` — extension ID from the store item.

The workflow uses the official Chrome Web Store API v2. It uploads a versioned ZIP and submits it for review; it cannot bypass review.

## Microsoft Edge Add-ons

Create and complete the first extension product in Partner Center, enable Publishing API v1.1, then add:

- `EDGE_API_KEY` — Partner Center Publishing API key.
- `EDGE_CLIENT_ID` — Partner Center Publishing API client ID.
- `EDGE_PRODUCT_ID` — existing Edge Add-ons product ID.

Microsoft's API updates an existing item; it cannot create the first product or edit its listing metadata.

## Firefox Add-ons

Create AMO API credentials and add:

- `AMO_JWT_ISSUER` — AMO JWT issuer/API key.
- `AMO_JWT_SECRET` — AMO JWT secret.

The workflow invokes the pinned official `web-ext` release, requests a listed submission, and retains any signed XPI as a private workflow artifact until Mozilla publishes the listing.

## Run

Open `Actions → AEL Wallet store delivery → Run workflow`. First run `package-only`. After the relevant existing store items and secrets are present, select a channel and enable `submit_for_review`.

Never create a `LIVE` on-chain wallet-distribution attestation until the official store URL installs the reviewed release. `REVIEWED` and `LIVE` evidence must use independent auditor identities and exact SHA-256 release hashes.
