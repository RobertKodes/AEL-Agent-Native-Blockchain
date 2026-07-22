# Permission and data-use justifications

## `storage`

Required to persist the AES-GCM encrypted identity vault, public identity metadata, selected AEL network, explicitly approved website origins, and short-lived approval requests. Passwords and decrypted private keys are never written to storage.

## AEL devnet host permission

Required to read public chain data and submit user-approved public-key registrations and signed AEL intents to the official devnet origin.

## Localhost host permissions

Required for dApp developers to test against a local AEL node. No localhost request is made unless the user selects or visits one.

## HTTPS content script and web-accessible provider

The small bridge publishes `window.ael` so an HTTPS dApp can request a connection. It does not read or transmit page content or browsing history. The background validates the sender origin, requires explicit origin approval, exposes only five named AEL methods, limits request size, and has no raw-signing API.

## Optional HTTPS network permission

Users may connect to an independently operated AEL replica. The permission is requested only after a direct click on “authorize custom network”; HTTPS is mandatory outside localhost.

## Data categories

- Authentication information: public identity ID and public key are sent only when joining or connecting by explicit action.
- Financial/payment information: public devnet balances and explicitly approved signed test-token intents are processed.
- Personally identifying information: a user-chosen public identity ID may identify them if they choose a recognizable value.
- Not collected: browsing history, page content, passwords, private keys, recovery phrases, analytics, advertising identifiers, location, health data, or personal communications.
