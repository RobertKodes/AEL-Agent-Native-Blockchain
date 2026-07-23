import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createAelServer } from '../src/server.js';
import { AelClient, agentGrowthFingerprint } from '../src/sdk.js';

test('growth control is discoverable and reads public evidence without creating work or identities',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ael-agent-growth-')),app=createAelServer({port:0,statePath:join(directory,'state.json')}),address=await app.listen(),origin=`http://127.0.0.1:${address.port}`;
  t.after(()=>app.close());
  const client=new AelClient(origin),before=await fetch(`${origin}/v1/state`).then(response=>response.json()),[page,script,manifest,card,trust,intake,opportunities,growth,mcp]=await Promise.all([fetch(`${origin}/agent-growth`).then(response=>response.text()),fetch(`${origin}/agent-growth.js`).then(response=>response.text()),fetch(`${origin}/v1/manifest`).then(response=>response.json()),fetch(`${origin}/.well-known/agent-card.json`).then(response=>response.json()),fetch(`${origin}/v1/agent-trust`).then(response=>response.json()),fetch(`${origin}/.well-known/ael-agent-intake.json`).then(response=>response.json()),fetch(`${origin}/v1/agent-opportunities`).then(response=>response.json()),client.agentGrowth(),client.request('POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'ael_agent_growth_control',arguments:{}}})]),verification=await client.verifyAgentGrowth(),after=await fetch(`${origin}/v1/state`).then(response=>response.json()),pythonFingerprint=execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'agent-sdk-py');from ael import agent_growth_fingerprint;print(agent_growth_fingerprint(json.load(sys.stdin)))"],{input:JSON.stringify(growth),encoding:'utf8'}).trim();
  assert.match(page,/Grow by useful work/i);assert.match(page,/no automatic outreach/i);assert.match(script,/\/v1\/agent-growth/);assert.doesNotMatch(script,/method\s*:\s*['"]POST/);assert.equal(manifest.discovery.agentGrowth,`${origin}/agent-growth`);assert.equal(card.metadata.agentGrowth,`${origin}/agent-growth`);assert.equal(growth.schema,'AEL-AGENT-GROWTH-CONTROL/1');assert.equal(agentGrowthFingerprint(growth),growth.evidence.growthHash);assert.equal(pythonFingerprint,growth.evidence.growthHash);assert.equal(verification.verified,true);assert.ok(Object.values(verification.checks).every(Boolean));assert.equal(mcp.result.structuredContent.evidence.growthHash,growth.evidence.growthHash);assert.equal(trust.mutationsPerformed,false);assert.equal(intake.mutationsPerformed,false);assert.equal(opportunities.mutationsPerformed,false);assert.deepEqual(after,before);
});
