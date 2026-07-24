import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';

const policy = { schema: 'AEL-WORK-VALIDATION-POLICY/1', mode: 'INDEPENDENT_REVIEW', proofTypes: ['ARTIFACT_HASH'], requiredAccepts: 2, minIndependentGroups: 2, committeeSize: 5, sampleRateBps: 0, requirePublicEvidence: true };
const setup = () => {
  const e = new AelEngine();
  e.apply('createAgent', { agentId: 'worker', rootPublicKey: 'p', constitutionRoot: 'c' });
  e.apply('createWorkOrder', { orderId: 'strict', requesterRoot: 'human', title: 'Strict', fundedAmount: 10, scopeHash: 'scope', validationPolicy: policy });
  e.apply('acceptWork', { orderId: 'strict', agentId: 'worker' });
  return e;
};

test('orders may demand a retrievable public artifact', () => {
  const e = setup(), hash = 'a'.repeat(64);
  assert.throws(() => e.apply('submitWorkResult', { orderId: 'strict', agentId: 'worker', deliverableHash: hash }), /WORK_RESULT_INVALID/);
  assert.throws(() => e.apply('submitWorkResult', { orderId: 'strict', agentId: 'worker', deliverableHash: hash, evidence: { schema: 'AEL-WORK-EVIDENCE/1', proofType: 'ARTIFACT_HASH', artifactHash: hash, uri: 'http://insecure.example/a.zip' } }), /WORK_RESULT_INVALID/);
  e.apply('submitWorkResult', { orderId: 'strict', agentId: 'worker', deliverableHash: hash, evidence: { schema: 'AEL-WORK-EVIDENCE/1', proofType: 'ARTIFACT_HASH', artifactHash: hash, uri: 'https://example.org/artifact.tar.gz' } });
  assert.equal(e.state.orders.strict.status, 'VERIFYING');
  assert.equal(e.state.workResults.strict.evidence.uri, 'https://example.org/artifact.tar.gz');
});

test('orders without the requirement stay backward compatible', () => {
  const e = new AelEngine();
  e.apply('createAgent', { agentId: 'w2', rootPublicKey: 'p', constitutionRoot: 'c' });
  e.apply('createWorkOrder', { orderId: 'lenient', requesterRoot: 'human', title: 'Lenient', fundedAmount: 10, scopeHash: 'scope' });
  e.apply('acceptWork', { orderId: 'lenient', agentId: 'w2' });
  e.apply('submitWorkResult', { orderId: 'lenient', agentId: 'w2', deliverableHash: 'b'.repeat(64) });
  assert.equal(e.state.orders.lenient.status, 'VERIFYING');
});
