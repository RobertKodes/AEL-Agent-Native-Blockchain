import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPortableMemory, readMemoryBundle, restorePortableMemory, writeMemoryBundleAtomic } from '../src/agent-memory.js';
import { AelEngine } from '../src/engine.js';
import { hash } from '../src/canonical.js';

const memoryState=()=>({
  identity:{name:'Akira',keyEpoch:3},
  memories:[{id:'m1',content:'portable encrypted continuity'}],
  barrier:{lastInputSequence:14,lastOutputSequence:14,inflightTaskIds:[]},
  journal:[{sequence:13,type:'INPUT_COMMITTED'},{sequence:14,type:'OUTPUT_COMMITTED'}]
});

test('portable memory is encrypted, committed, chunked, and restored exactly',()=>{
  const key=randomBytes(32),bundle=createPortableMemory({agentId:'akira',generation:1,state:memoryState(),key,chunkSize:1024}),path=join(mkdtempSync(join(tmpdir(),'ael-memory-')),'memory.ael');
  assert.equal(bundle.manifest.schema,'AEL-PORTABLE-MEMORY/1');
  assert.equal(bundle.manifest.barrier.inflightTaskCount,0);
  assert.equal(Buffer.concat(bundle.chunks).includes(Buffer.from('portable encrypted continuity')),false);
  writeMemoryBundleAtomic(path,bundle);
  assert.equal(readFileSync(path).includes(Buffer.from('portable encrypted continuity')),false);
  assert.deepEqual(restorePortableMemory({...readMemoryBundle(path),key}),memoryState());
  const corrupted=readMemoryBundle(path);corrupted.chunks[0][0]^=1;
  assert.throws(()=>restorePortableMemory({...corrupted,key}),/AGENT_MEMORY_COMMITMENT_INVALID/);
});

test('sovereign handover switches runtime only after target restore and source quiescence',()=>{
  const e=new AelEngine();e.apply('createAgent',{agentId:'akira',rootPublicKey:'pub',constitutionRoot:'constitution'});
  for(const[providerId,faultDomain]of[['source','fd-a'],['target','fd-b']])e.apply('registerRuntimeProvider',{providerId,operatorId:providerId,bond:100,faultDomain,region:'eu',attestationProfiles:['R1']});
  e.apply('registerRuntime',{agentId:'akira',provider:'source',replicas:[{provider:'target',checkpointRoot:'old-root'}],checkpointRoot:'old-root',faultDomains:['fd-a','fd-b']});
  const checkpointHash=hash('checkpoint'),stateRoot=hash('state'),chunksRoot=hash('chunks');
  e.apply('commitMemoryCheckpoint',{checkpointId:'cp-1',agentId:'akira',generation:1,parentCheckpointHash:null,checkpointHash,stateRoot,chunksRoot,serializer:'AEL-PORTABLE-MEMORY/1',encryption:'AES-256-GCM',byteLength:4096,chunkCount:1,barrier:{lastInputSequence:14,lastOutputSequence:14,inflightTaskCount:0},storageReplicas:[{providerId:'storage-a',uri:'https://a.example/cp-1',bundleHash:hash('a')},{providerId:'storage-b',uri:'https://b.example/cp-1',bundleHash:hash('b')}]});
  e.apply('prepareMemoryHandover',{handoverId:'move-1',agentId:'akira',fromProvider:'source',toProvider:'target',checkpointId:'cp-1',expiresAtHeight:100});
  assert.equal(e.state.runtimes.akira.active,'source');
  assert.throws(()=>e.apply('finalizeMemoryHandover',{handoverId:'move-1',agentId:'akira',sourceQuiescenceHash:hash('q'),continuityAcknowledgementHash:hash('ack')}),/MEMORY_HANDOVER_FINALIZE_INVALID/);
  e.apply('attestMemoryRestore',{handoverId:'move-1',providerId:'target',checkpointHash,restoredStateRoot:stateRoot,barrier:{lastInputSequence:14,lastOutputSequence:14},attestationHash:hash('attestation')});
  assert.equal(e.state.runtimes.akira.active,'source');
  e.apply('finalizeMemoryHandover',{handoverId:'move-1',agentId:'akira',sourceQuiescenceHash:hash('q'),continuityAcknowledgementHash:hash('ack')});
  assert.equal(e.state.runtimes.akira.active,'target');
  assert.equal(e.state.runtimes.akira.continuityEpoch,1);
  assert.equal(e.state.memoryHandovers['move-1'].status,'FINALIZED');
});

test('memory checkpoints are monotonic and require independently addressed storage',()=>{
  const e=new AelEngine();e.apply('createAgent',{agentId:'a',rootPublicKey:'p',constitutionRoot:'c'});
  const payload={checkpointId:'bad',agentId:'a',generation:2,parentCheckpointHash:null,checkpointHash:hash('cp'),stateRoot:hash('state'),chunksRoot:hash('chunks'),serializer:'AEL-PORTABLE-MEMORY/1',encryption:'AES-256-GCM',byteLength:100,chunkCount:1,barrier:{lastInputSequence:1,lastOutputSequence:1},storageReplicas:[{providerId:'same',uri:'https://one.example/x',bundleHash:hash('1')},{providerId:'same',uri:'https://two.example/x',bundleHash:hash('2')}]};
  assert.throws(()=>e.apply('commitMemoryCheckpoint',payload),/MEMORY_CHECKPOINT_INVALID/);
  assert.equal(e.state.memoryCheckpoints,undefined);
});
