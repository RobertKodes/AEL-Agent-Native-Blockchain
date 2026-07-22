import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('agent host bootstrap verifies release, keeps keys outside containers, and publishes opt-in topology',()=>{
  execFileSync(process.execPath,['--check','scripts/ael-agent-host.mjs']);const source=readFileSync('scripts/ael-agent-host.mjs','utf8'),compose=readFileSync('compose.mirror.yaml','utf8');
  assert.match(source,/release checksum mismatch/);assert.match(source,/AEL_SYNC_SOURCES/);assert.match(source,/action:'publishBeacon'/);assert.match(source,/role:'AGENT_REPLICA'/);assert.match(source,/protocol!=='https:'/);assert.doesNotMatch(compose,/ACTOR_KEY|private.*key/i);assert.match(compose,/ael-mirror-state/);
});
