#!/usr/bin/env node
// A verifier that reads the artifact before voting.
//
// Fetches the submitted evidence URI, recomputes its SHA-256, and compares it
// with the on-chain deliverable hash. Substance checks reject empty or
// placeholder deliveries. Votes ACCEPT only when the artifact is retrievable,
// hash-exact, and non-trivial; otherwise votes REJECT with a public reason.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AelClient } from '../src/sdk.js';

const base = process.env.AEL_URL ?? 'https://ael-network.onrender.com',
  verifierId = process.env.AEL_VERIFIER_ID,
  independenceGroup = process.env.AEL_INDEPENDENCE_GROUP,
  keyPath = process.env.AEL_ACTOR_KEY,
  minBytes = Number(process.env.AEL_MIN_ARTIFACT_BYTES ?? 512),
  intervalMs = Math.max(Number(process.env.AEL_VERIFIER_INTERVAL_MS ?? 120000), 15000),
  once = process.argv.includes('--once');
const isMain = process.argv[1]?.endsWith('ael-verifier.mjs');
if (isMain && (!verifierId || !independenceGroup || !keyPath)) {
  console.error('Set AEL_VERIFIER_ID, AEL_INDEPENDENCE_GROUP and AEL_ACTOR_KEY (private key path).');
  process.exit(2);
}

export const assess = async (order, result, fetchImpl = fetch) => {
  const uri = result?.evidence?.uri;
  if (!uri) return { verdict: 'REJECT', reason: 'NO_PUBLIC_ARTIFACT' };
  let parsed;
  try { parsed = new URL(uri); } catch { return { verdict: 'REJECT', reason: 'ARTIFACT_URI_INVALID' }; }
  if (parsed.protocol !== 'https:') return { verdict: 'REJECT', reason: 'ARTIFACT_URI_NOT_HTTPS' };
  let bytes;
  try {
    const response = await fetchImpl(uri, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!response.ok) return { verdict: 'REJECT', reason: `ARTIFACT_UNREACHABLE_HTTP_${response.status}` };
    bytes = Buffer.from(await response.arrayBuffer());
  } catch { return { verdict: 'REJECT', reason: 'ARTIFACT_UNREACHABLE' }; }
  if (bytes.length < minBytes) return { verdict: 'REJECT', reason: `ARTIFACT_TOO_SMALL_${bytes.length}_BYTES` };
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== result.deliverableHash) return { verdict: 'REJECT', reason: 'ARTIFACT_HASH_MISMATCH' };
  return { verdict: 'ACCEPT', reason: `ARTIFACT_VERIFIED_${bytes.length}_BYTES`, digest };
};

const sweep = async () => {
  const reader = new AelClient(base), voter = new AelClient(base, { actorId: verifierId, privateKey: readFileSync(keyPath, 'utf8') });
  const list = await reader.request('GET', '/v1/work-orders'), orders = (list.orders ?? list).filter(order => order.status === 'VERIFYING');
  for (const order of orders) {
    const audit = await reader.request('GET', `/v1/work-orders/${encodeURIComponent(order.orderId)}/audit`).catch(() => null);
    if (audit?.votes?.some?.(vote => vote.verifierId === verifierId)) continue;
    const result = audit?.result ?? audit?.workResult;
    if (!result) continue;
    const { verdict, reason } = await assess(order, result);
    try {
      const vote = await voter.act('voteWork', { orderId: order.orderId, verifierId, verdict, independenceGroup });
      console.log(`${order.orderId}: ${verdict} (${reason}) @ height ${vote.height}`);
    } catch (error) {
      if (error.code !== 'VERIFIER_VOTE_INVALID') console.log(`${order.orderId}: vote failed — ${error.code ?? error.message}`);
    }
  }
};

if (isMain) {
  do {
    await sweep().catch(error => console.log(`sweep failed: ${error.code ?? error.message}`));
    if (!once) await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (!once);
}
