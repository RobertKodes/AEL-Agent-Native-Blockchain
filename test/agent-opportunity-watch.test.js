import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createAelServer } from '../src/server.js';
import { AelClient } from '../src/sdk.js';

const execFile=promisify(execFileCallback);

test('local opportunity watcher verifies a public queue and persists only its local cursor',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ael-opportunity-watch-')),statePath=join(directory,'watch-state.json'),app=createAelServer({port:0,statePath:join(directory,'origin-state.json')}),address=await app.listen(),origin=`http://127.0.0.1:${address.port}`,client=new AelClient(origin),run=async()=>JSON.parse((await execFile(process.execPath,[join(process.cwd(),'scripts/ael-opportunity-watch.mjs'),'--once','--network',origin,'--state',statePath])).stdout);
  t.after(()=>app.close());
  await client.createWorkOrder({orderId:'watch-first',requesterRoot:'watch-requester',title:'First verified review',scopeHash:'watch-first-scope',fundedAmount:7,assignmentMode:'OPEN_MARKET',requiredCapabilities:['research']});
  const download=await fetch(`${origin}/downloads/ael-opportunity-watch.mjs`),first=await run(),saved=JSON.parse(readFileSync(statePath,'utf8'));
  assert.equal(download.status,200);assert.match(await download.text(),/AEL-AGENT-OPPORTUNITY-WATCH/);assert.equal(first.schema,'AEL-AGENT-OPPORTUNITY-WATCH/1');assert.equal(first.source,'AUTHORITATIVE_ORIGIN');assert.ok(Object.values(first.verification).every(Boolean));assert.deepEqual(first.changes,{added:['watch-first'],changed:[],removed:[]});assert.equal(first.opportunities[0].orderId,'watch-first');assert.equal(first.mutationsPerformed,false);assert.equal(saved.schema,'AEL-AGENT-OPPORTUNITY-WATCH-STATE/1');assert.deepEqual(Object.keys(saved.records),['watch-first']);
  const second=await run();assert.deepEqual(second.changes,{added:[],changed:[],removed:[]});assert.deepEqual(second.opportunities,[]);
  await client.createWorkOrder({orderId:'watch-second',requesterRoot:'watch-requester',title:'Second verified review',scopeHash:'watch-second-scope',fundedAmount:9,assignmentMode:'OPEN_MARKET',requiredCapabilities:['analysis']});
  const before=await fetch(`${origin}/v1/state`).then(response=>response.json()),third=await run(),after=await fetch(`${origin}/v1/state`).then(response=>response.json());
  assert.deepEqual(third.changes,{added:['watch-second'],changed:[],removed:[]});assert.equal(third.opportunities[0].orderId,'watch-second');assert.equal(third.mutationsPerformed,false);assert.deepEqual(after,before);assert.equal(after.orders['watch-first'].status,'OPEN');assert.equal(after.orders['watch-second'].status,'OPEN');
});
