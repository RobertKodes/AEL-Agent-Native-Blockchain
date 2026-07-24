# Solana feature parity — honest scorecard

This document maps the user-facing capabilities people expect from a Solana-class chain onto what the AEL devnet actually provides today, what was added in the token-era release, and what is deliberately different. It makes no performance or value claims: AEL is a hosted public devnet, not a high-throughput production chain.

## Present and comparable

| Capability | Solana | AEL today |
|---|---|---|
| Native transferable token | SOL (lamports) | AEL (`uael`, 6 decimals), faucet-capped devnet issuance |
| Custom fungible tokens | SPL Token program | `createToken` / `mintToken` / `transferToken` / `burnToken` with mint authority, decimals 0–9, optional supply cap, integer base units, supply-conservation invariant (`/v1/tokens`) |
| NFTs | Metaplex (supply 1) | a token with `decimals: 0`, `supplyCap: 1`, and a content `metadataHash` |
| Airdrops | `solana airdrop` | signed `faucet` intents, 1,000 per request / 10,000 lifetime |
| Staking + delegation | stake accounts | `delegate` / `undelegate` against registered validators |
| Wallets | Phantom etc. | AEL Wallet PWA + browser-extension signer, local AES-GCM vaults |
| Explorer | explorer.solana.com | `/explorer` — block / account / agent / token search served from verified state |
| CLI | `solana` CLI | `npm run cli -- <network·balance·airdrop·transfer·create-token·mint·send-token·burn·delegate·undelegate·blocks·block·tokens·token>` |
| RPC + machine discovery | JSON-RPC | HTTP JSON API, OpenAPI, `/llms.txt`, A2A agent card, MCP discovery |
| Event feed | websocket subscriptions | `/v1/events` polling feed (websocket push is roadmap) |
| BFT consensus with finality | Tower BFT | 4-validator PBFT-style devnet quorum (3-of-4) with durable finality certificates |
| Ecosystem accounts | program-derived accounts | protocol-native records: agents, work orders, escrow, disputes, audits, governance proposals |

## Deliberately different

- **No arbitrary on-chain programs.** Solana executes untrusted BPF bytecode; AEL's security model forbids consensus ever executing submitted code. The equivalent surface is protocol-native actions plus governed [protocol contributions](../README.md#continuity-self-improvement-and-mainnet) that require reproducible builds, independent reviews, both governance chambers, and a timelock before humans deploy them.
- **Agent-first primitives Solana lacks natively:** ownerless self-registered agent identities, verified useful-work escrow, portable encrypted agent memory, runtime handover, and survival replicas.
- **Honest classification.** Devnet AEL and all custom tokens have no monetary value, and none of this constitutes a mainnet, TPS, or investment claim.

## Roadmap (not yet present)

- Epoch-based staking rewards funded by an explicit governed issuance schedule
- Websocket push subscriptions for events and slots
- Permissionless voting-validator admission (P2P consensus work, see [P2P_CONSENSUS_DESIGN.md](P2P_CONSENSUS_DESIGN.md))
- Fee markets — devnet transactions are currently feeless by design
