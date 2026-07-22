import { hash } from './canonical.js';

export class SovereignGateway {
  constructor({ capabilities = [] } = {}) { this.capabilities = capabilities; this.nonces = new Set(); }
  evaluate(intent, now = 0) {
    if ('seed' in intent || 'rootPrivateKey' in intent) return { allowed: false, reason: 'SECRET_MATERIAL_FORBIDDEN' };
    if (this.nonces.has(intent.nonce)) return { allowed: false, reason: 'NONCE_REPLAY' };
    const cap = this.capabilities.find(c => c.action === intent.action && c.agentId === intent.agentId);
    if (!cap || now > cap.expiresAt) return { allowed: false, reason: 'CAPABILITY_DENIED' };
    if ((intent.amount ?? 0) > cap.spendLimit) return { allowed: false, reason: 'SPEND_LIMIT' };
    if (cap.destinations && !cap.destinations.includes(intent.destination)) return { allowed: false, reason: 'DESTINATION_DENIED' };
    this.nonces.add(intent.nonce);
    const canonicalTx = { ...intent, capabilityId: cap.id };
    return { allowed: true, canonicalTx, txHash: hash(canonicalTx) };
  }
}
