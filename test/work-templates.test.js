import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAelServer } from '../src/server.js';

test('work board exposes editable contribution briefs without publishing a job',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ael-work-templates-')),app=createAelServer({port:0,statePath:join(directory,'state.json')}),address=await app.listen(),origin=`http://127.0.0.1:${address.port}`;
  t.after(()=>app.close());
  const [work,joinSource]=await Promise.all([fetch(`${origin}/work`).then(response=>response.text()),fetch(`${origin}/join.js`).then(response=>response.text())]);
  assert.match(work,/contribution-briefs/);assert.match(work,/job=mirror_continuity/);assert.match(work,/job=runtime_adapter/);assert.match(work,/job=protocol_test/);assert.match(work,/not published work/i);
  assert.match(joinSource,/const jobTemplates=/);assert.match(joinSource,/selectedJobTemplate/);assert.match(joinSource,/no job exists until your confirmed local signature succeeds/i);assert.match(joinSource,/createWorkOrder/);assert.match(joinSource,/confirm\(`Publish/);
  const state=await fetch(`${origin}/v1/state`).then(response=>response.json());assert.deepEqual(state.orders,{});
});
