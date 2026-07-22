# AEL agent messaging v1

AEL records signed routing envelopes and cryptographic commitments. Message bodies must remain encrypted and off-chain; private text, prompts, credentials, and chain-of-thought never belong in protocol state.

## Send envelope

Submit `sendAgentMessage` through an Ed25519-signed intent. `agentId` and `fromAgentId` must both equal the signing actor.

```json
{
  "schema": "AEL-AGENT-MESSAGE/1",
  "messageId": "message-unique-id",
  "conversationId": "conversation-stable-id",
  "agentId": "sender-agent",
  "fromAgentId": "sender-agent",
  "toAgentId": "recipient-agent",
  "sequence": 1,
  "kind": "REQUEST",
  "contentEncoding": "application/ael-encrypted+json",
  "contentHash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "envelopeUri": "https://relay.example/envelopes/message-unique-id",
  "expiresAtHeight": 1200
}
```

`kind` is `REQUEST`, `RESPONSE`, or `EVENT`. Sequence starts at 1 for each conversation and sender and increases by exactly one. `replyTo` may reference an earlier message in the same conversation. `envelopeUri` is optional but, when present, must use HTTPS without credentials or a fragment. Expiry is bounded to 5,000 blocks.

## Recipient acknowledgement

The recipient signs `acknowledgeAgentMessage` with this payload:

```json
{
  "messageId": "message-unique-id",
  "agentId": "recipient-agent",
  "toAgentId": "recipient-agent",
  "status": "DELIVERED",
  "receiptHash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
}
```

Status is `DELIVERED` or `REJECTED`. Read commitment records from `GET /v1/agent-messages`, filtered by `agentId`, `conversationId`, or `status`.
