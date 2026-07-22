# AEL wallet interoperability

Updated: 2026-07-22

## Current decision

Native AEL is a non-EVM Ed25519 protocol. AEL Wallet 0.7.0 is therefore the supported browser wallet. It exposes only named AEL methods, keeps the private key in a local AES-GCM encrypted vault, and requires explicit approval for website connection and signed intent submission.

| Wallet or transport | Native AEL today | Correct path |
| --- | --- | --- |
| AEL Wallet browser extension | Yes | Chrome, Edge, Firefox, and Safari store packages; installation is advertised only after an official listing is independently attested `LIVE`. |
| Phantom | No | Phantom must integrate AEL itself. Phantom currently does not permit manual custom-network imports. Submit a chain feature request; never paste an AEL key into Phantom. |
| MetaMask “Add network” | No | That flow is for EVM JSON-RPC networks. Do not fabricate an EVM chain ID. |
| MetaMask Snap | Technically possible, not implemented | Build a non-EVM Snap, use isolated key derivation, commission the required security audit, and complete MetaMask allowlisting/publication. |
| WalletConnect | Standards path, not wallet support by itself | Define an AEL CAIP-2 namespace/profile and RPC methods, register the chain, then implement those methods in AEL Wallet and participating wallets. |
| Wrapped AEL token | Not the native chain | Only after a separately governed, capped, independently audited bridge with reserve proofs and failure controls. |

## Security boundary

- Never import an AEL private key, encrypted vault, or password into Phantom, MetaMask, a web form, or a support chat.
- A package download is not equivalent to browser-store review or signing.
- The public API exposes a store installation URL only when a consensus-recorded `LIVE` attestation contains a URL on the official store host for that channel.
- `REVIEWED` and `LIVE` distribution evidence must name an independent group, wallet version, release hash, evidence hash, and official listing URL. Status can advance but cannot be downgraded.
- Devnet AEL is a test asset with no monetary value.

## Standards sequence

1. Stabilize the native `window.ael` provider and versioned AEL JSON-RPC method semantics.
2. Publish AEL Wallet in browser stores and complete an independent wallet security audit.
3. Propose the AEL CAIP namespace and CAIP-2 chain identifiers for devnet and mainnet.
4. Implement WalletConnect sessions for the AEL namespace in AEL Wallet.
5. Build and audit a non-EVM MetaMask Snap without exposing raw signing.
6. Request direct integration from wallets such as Phantom only after the protocol, audits, validator diversity, and mainnet identifier are stable.

## Primary references

- Phantom custom networks: <https://help.phantom.com/hc/en-us/articles/46595961428627-Can-I-manually-add-networks-to-Phantom>
- MetaMask Snaps: <https://docs.metamask.io/snaps/learn/about-snaps/>
- MetaMask EVM network management: <https://docs.metamask.io/metamask-connect/evm/guides/manage-networks/>
- WalletConnect chain onboarding: <https://docs.walletconnect.network/walletguide/chains/overview>
