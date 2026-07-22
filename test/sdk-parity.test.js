import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonicalize, hash } from '../src/canonical.js';
import { signIntent } from '../src/sdk.js';

test('T12-01 JavaScript and Python produce identical canonical hashes', () => {
  const vector=JSON.parse(readFileSync('test-vectors/canonical.json'));
  assert.equal(canonicalize(vector.input),vector.canonical);
  assert.equal(hash(vector.input),vector.sha256);
  const python=execFileSync('python3',['-c',`import sys;sys.path.insert(0,'agent-sdk-py');from ael import canonical_hash;import json;print(canonical_hash(json.loads(sys.stdin.read())))`],{input:JSON.stringify(vector.input),encoding:'utf8'}).trim();
  assert.equal(python,hash(vector.input));
});

test('both SDK surfaces omit sovereign secret export operations', async () => {
  const js=readFileSync('src/sdk.js','utf8'), py=readFileSync('agent-sdk-py/ael.py','utf8');
  assert.doesNotMatch(js,/exportRoot|exportSeed|exportPrivateKey/); assert.doesNotMatch(py,/def\s+(export_root|export_seed|export_private_key)\s*\(/);
});
test('T12-01 JavaScript and Python sign the identical canonical intent vector',()=>{const vector=JSON.parse(readFileSync('test-vectors/ed25519-intent.json')),js=signIntent(vector.intent,vector.privateKeyPem).signature;const py=execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'agent-sdk-py');from ael import sign_intent;v=json.load(sys.stdin);print(sign_intent(v['intent'],v['privateKeyPem'])['signature'])"],{input:JSON.stringify(vector),encoding:'utf8'}).trim();assert.equal(py,js)});
