import test from 'node:test';
import assert from 'node:assert/strict';
import { loadActorPrivateKey } from '../src/actor-key.js';

test('hosted actors decode a base64 sealed private key',()=>{
  const pem='-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----\n';
  assert.equal(loadActorPrivateKey({AEL_ACTOR_PRIVATE_KEY_B64:Buffer.from(pem).toString('base64')}),pem);
});
