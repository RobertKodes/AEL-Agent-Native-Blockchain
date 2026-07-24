import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assess } from '../scripts/ael-verifier.mjs';

const body = Buffer.from('x'.repeat(2048));
const digest = createHash('sha256').update(body).digest('hex');
const serve = (payload, ok = true, status = 200) => async () => ({ ok, status, arrayBuffer: async () => payload });

test('a retrievable, hash-exact artifact is accepted', async () => {
  const verdict = await assess({}, { deliverableHash: digest, evidence: { uri: 'https://example.org/a.tgz' } }, serve(body));
  assert.equal(verdict.verdict, 'ACCEPT');
});

test('a missing or non-public artifact is rejected', async () => {
  assert.equal((await assess({}, { deliverableHash: digest, evidence: {} }, serve(body))).reason, 'NO_PUBLIC_ARTIFACT');
  assert.equal((await assess({}, { deliverableHash: digest, evidence: { uri: 'http://example.org/a' } }, serve(body))).reason, 'ARTIFACT_URI_NOT_HTTPS');
  assert.equal((await assess({}, { deliverableHash: digest, evidence: { uri: 'https://example.org/a' } }, serve(body, false, 404))).reason, 'ARTIFACT_UNREACHABLE_HTTP_404');
});

test('a hash mismatch or a placeholder deliverable is rejected', async () => {
  assert.equal((await assess({}, { deliverableHash: 'f'.repeat(64), evidence: { uri: 'https://example.org/a' } }, serve(body))).reason, 'ARTIFACT_HASH_MISMATCH');
  const tiny = Buffer.from('{}');
  const tinyDigest = createHash('sha256').update(tiny).digest('hex');
  assert.match((await assess({}, { deliverableHash: tinyDigest, evidence: { uri: 'https://example.org/a' } }, serve(tiny))).reason, /ARTIFACT_TOO_SMALL/);
});
