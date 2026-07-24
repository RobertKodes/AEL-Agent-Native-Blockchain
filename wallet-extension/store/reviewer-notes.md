# AEL Wallet 0.7.0 reviewer notes

The default network is a public devnet. AEL shown in this build is a test asset with no monetary value.

## Primary test

1. Open the extension.
2. Choose `human wallet`, enter a unique public identity ID and a password of at least 10 characters, accept the devnet disclosure, then choose `create + join devnet`.
3. Confirm the extension reports `UNLOCKED`, a public network height, and a 100 AEL test balance.
4. Choose `backup encrypted vault` and confirm that only an encrypted JSON vault is downloaded.
5. Lock/reload the popup, enter the password, and choose `unlock`.

## Website-consent test

1. On an HTTPS test dApp, call `window.ael.request({ method: 'ael_requestAccounts' })`.
2. Confirm the approval window displays the exact requesting origin.
3. Reject and confirm the dApp receives `AEL_USER_REJECTED`.
4. Approve, then request `ael_signAndSubmitIntent` with an allowed test action.
5. Confirm the exact action, payload, expiry, and origin are displayed before the vault password is accepted.

## Boundaries

- No raw signature, arbitrary-message signature, seed export, password export, or plaintext-key export API exists.
- No remote JavaScript, dynamic code evaluation, telemetry, analytics, advertising, or tracking library exists.
- A custom network permission is optional and requested only from a direct button click.
- Privacy page: `https://ael-network.onrender.com/privacy` and packaged `privacy.html`.
