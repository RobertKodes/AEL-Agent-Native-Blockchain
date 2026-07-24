# AEL runtime provider guide

## Profiles and claims

`R0` is an ordinary container profile for public/test workloads. It provides process isolation and signed operator actions, but no confidentiality claim. `R1`-`R4` require an attestation statement signed by an administrator-approved issuer. The software verifies the issuer signature, provider, offer, profile, measurement, nonce, ephemeral public key, and expiry. This interface does not itself certify a real TEE vendor or firmware.

## Provider onboarding

1. Generate a self-custodied operational key with `npm run operator -- generate <provider-id>`.
2. Submit the public-key fingerprint, operator identity, bond, fault domain, region, jurisdiction, and supported profiles to the administrator.
3. Claim a `RUNTIME_PROVIDER` invitation containing only `registerRuntimeOffer`, `submitRuntimeHeartbeat`, and `submitRuntimeUsage`, each scoped to the provider ID. Its `runtimeProvider` metadata must bind the same provider/operator ID, bond, declared fault domain, region, and attestation profiles. Claiming atomically registers the authority and provider profile.
4. Run the unprivileged actor container with `AEL_ROLE=runtime-provider`.

Example environment:

```sh
AEL_URL=https://ael-network.onrender.com \
AEL_ROLE=runtime-provider AEL_PROVIDER_ID=provider-id \
AEL_ACTOR_ID=provider-id AEL_ACTOR_KEY=/secure/provider-private.pem \
AEL_RUNTIME_OFFER_ID=provider-id-r0-offer \
AEL_FAULT_DOMAIN=independent-fault-domain \
AEL_ATTESTATION_PROFILE=R0 AEL_RUNTIME_MEASUREMENT=image-hash \
AEL_PRICE_PER_HOUR=0 npm run actor
```

Set `AEL_PROVIDER_HEARTBEAT=true` only after a lease is active. Heartbeats contain the lease, monotonic sequence, checkpoint root, and measurement. Usage receipts require both the provider's signed intent and an exact Ed25519 approval over the lease, epoch, amount, and counters hash from the designated agent authority. They cannot exceed the lease budget cap.

## Attestation issuer

An administrator registers an issuer public key, vendor label, and allowed profiles. The issuer signs the canonical JSON statement through `signRuntimeAttestation`; operators submit the signed statement to `/v1/runtime/attestations`. A nonce is single-use, an attestation is lease-bound once consumed, and any mismatch is rejected before secret-release emission.

The attestation statement must contain `attestationId`, `issuerId`, `providerId`, `offerId`, `profile`, `measurement`, `nonce`, `ephemeralPublicKey`, `firmwareVersion`, and `expiresAtHeight`. A non-fixture lease also requires a control-surrender receipt hash and at least one standby offer in a different fault domain.

## Trust boundary

Provider administrators never receive agent root keys. The emitted secret-release scope is explicitly ephemeral-session-only. A physical provider can stop hardware; continuity therefore depends on a distinct standby fault domain and matching checkpoint. Real R2+ claims require vendor evidence and an external hardware test, not merely this reference verifier.

The public R0 sandbox currently uses two provider processes. Provider A has a dedicated Railway service; provider B shares a container with verifier B because the Railway free-plan service quota is exhausted, but uses a different key and process. These are distinct service fault domains for the R0 failover exercise, not independent organizations or confidential-compute providers.
