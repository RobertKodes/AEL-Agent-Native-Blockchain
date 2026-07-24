import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run=promisify(execFile);
const serve=body=>new Promise(resolve=>{const server=createServer((request,response)=>{response.writeHead(200,{'content-type':'application/json'});response.end(body)});server.listen(0,'127.0.0.1',()=>resolve(server))});

test('restore-state writes a validated state file atomically',async()=>{
  const state={height:42,authorities:{},agents:{}},server=await serve(JSON.stringify(state)),target=join(mkdtempSync(join(tmpdir(),'ael-restore-')),'devnet-state.json');
  try{
    await run(process.execPath,['scripts/restore-state.mjs',`http://127.0.0.1:${server.address().port}/v1/state`,target]);
    assert.deepEqual(JSON.parse(readFileSync(target,'utf8')),state);
    assert.equal(existsSync(`${target}.restore-tmp`),false);
  }finally{server.close()}
});

test('restore-state rejects payloads that are not an AEL state file',async()=>{
  const server=await serve('{"height":"not-a-height"}'),target=join(mkdtempSync(join(tmpdir(),'ael-restore-')),'devnet-state.json');
  try{
    await assert.rejects(run(process.execPath,['scripts/restore-state.mjs',`http://127.0.0.1:${server.address().port}/v1/state`,target]));
    assert.equal(existsSync(target),false);
  }finally{server.close()}
});
