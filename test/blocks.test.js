import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AelEngine } from '../src/engine.js';
import { hash } from '../src/canonical.js';
import { createAelServer } from '../src/server.js';
import { AelClient } from '../src/sdk.js';

const waitFor=async(url,attempts=60)=>{for(let i=0;i<attempts;i++){try{const response=await fetch(url);if(response.ok)return response}catch{}await new Promise(resolve=>setTimeout(resolve,50))}throw new Error(`Timed out waiting for ${url}`)};

test('accepted transitions form a deterministic tamper-evident hash chain',()=>{
  const engine=new AelEngine();engine.apply('faucet',{accountId:'alice',amount:10});engine.apply('faucet',{accountId:'bob',amount:20});
  assert.equal(engine.state.blocks.length,2);assert.equal(engine.state.blocks[0].previousBlockHash,'0'.repeat(64));assert.equal(engine.state.blocks[1].previousBlockHash,engine.state.blocks[0].blockHash);
  for(const block of engine.state.blocks){const{blockHash,...header}=block;assert.equal(hash(header),blockHash)}
  const same=new AelEngine();same.apply('faucet',{accountId:'alice',amount:10});same.apply('faucet',{accountId:'bob',amount:20});assert.deepEqual(same.state.blocks,engine.state.blocks);
});

test('block API exposes commitments and detects a corrupted predecessor',async t=>{
  const app=createAelServer({port:0,statePath:join(mkdtempSync(join(tmpdir(),'ael-blocks-')),'state.json')}),address=await app.listen(),client=new AelClient(`http://127.0.0.1:${address.port}`);t.after(()=>app.close());
  await client.faucet({accountId:'alice',amount:10});await client.faucet({accountId:'bob',amount:20});
  const result=await client.blocks();assert.equal(result.chain.valid,true);assert.equal(result.blocks.length,2);assert.equal(result.blocks[0].validatorVotes,4);assert.equal((await client.verifyChain()).latestBlockHash,result.blocks[0].blockHash);
  app.engine.state.blocks[1].previousBlockHash='f'.repeat(64);assert.equal((await client.verifyChain()).valid,false);
});

test('permissionless mirror persists and verifies state without a signing key',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ael-mirror-')),app=createAelServer({port:0,statePath:join(dir,'upstream.json')}),address=await app.listen(),url=`http://127.0.0.1:${address.port}`,statePath=join(dir,'mirror.json');t.after(()=>app.close());await new AelClient(url).faucet({accountId:'mirror-source',amount:1});
  const output=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['src/validator-node.js','--once'],{env:{...process.env,AEL_URL:url,AEL_NODE_STATE_PATH:statePath,AEL_ALLOW_UNCERTIFIED_LOCAL:'true',AEL_VALIDATOR_ID:'',AEL_ACTOR_ID:'',AEL_ACTOR_KEY:'',AEL_ACTOR_PRIVATE_KEY_B64:''},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('exit',code=>code===0?resolve(stdout):reject(new Error(stderr)))});
  const status=JSON.parse(output);assert.equal(status.state,'MIRRORING');const mirrored=JSON.parse(readFileSync(statePath));assert.equal(status.observedStateHash,hash(mirrored));assert.equal(mirrored.accounts['mirror-source'].native,1);
});

test('replica keeps state, manifest, and website alive after its origin stops',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ael-survival-')),app=createAelServer({port:0,statePath:join(dir,'upstream.json')}),address=await app.listen(),upstream=`http://127.0.0.1:${address.port}`;await new AelClient(upstream).faucet({accountId:'survivor',amount:7});
  const probe=createAelServer({port:0,statePath:join(dir,'probe.json')}),probeAddress=await probe.listen();await probe.close();const port=probeAddress.port,statePath=join(dir,'replica.json'),child=spawn(process.execPath,['src/validator-node.js'],{env:{...process.env,AEL_URL:upstream,AEL_NODE_PORT:String(port),AEL_NODE_INTERVAL_MS:'100',AEL_NODE_STATE_PATH:statePath,AEL_ALLOW_UNCERTIFIED_LOCAL:'true',AEL_VALIDATOR_ID:'',AEL_ACTOR_ID:'',AEL_ACTOR_KEY:'',AEL_ACTOR_PRIVATE_KEY_B64:''},stdio:'ignore'});t.after(()=>child.kill());
  await waitFor(`http://127.0.0.1:${port}/health`);await app.close();await new Promise(resolve=>setTimeout(resolve,250));
  const state=await fetch(`http://127.0.0.1:${port}/v1/state`).then(r=>r.json()),manifest=await fetch(`http://127.0.0.1:${port}/v1/manifest`).then(r=>r.json()),home=await fetch(`http://127.0.0.1:${port}/`).then(r=>r.text());
  assert.equal(state.accounts.survivor.native,7);assert.equal(manifest.role,'VERIFIED_READ_ONLY_REPLICA');assert.equal(manifest.writes.accepted,false);assert.match(home,/<title>AEL \/\/ the agent-native network<\/title>/);assert.equal((await fetch(`http://127.0.0.1:${port}/health`).then(r=>r.json())).survivesUpstreamOutage,true);
});
