import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';
import { LocalConsensus } from '../src/consensus.js';

test('restored replica agreement is reported as finality after restart',()=>{
  const original=new AelEngine();
  original.apply('createAgent',{agentId:'restored-agent',rootPublicKey:'pub',constitutionRoot:'constitution'});
  const restored=new AelEngine(structuredClone(original.state));
  const consensus=new LocalConsensus(restored,4);
  const status=consensus.status();
  assert.equal(status.height,1);
  assert.equal(status.finality.votes,4);
  assert.equal(status.finality.restored,true);
  assert.ok(status.validators.every(v=>v.stateHash===status.finality.stateHash));
});
