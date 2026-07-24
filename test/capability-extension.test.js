import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine, devnetAgentActions } from '../src/engine.js';

const agentAuthority=(e,agentId,actions)=>{e.apply('createAgent',{agentId,rootPublicKey:`pub-${agentId}`,constitutionRoot:'c'});if(actions.length)e.apply('addAuthority',{actorId:agentId,publicKey:`pub-${agentId}`,roles:['AGENT'],capabilities:actions.map(action=>({action,agentId,expiresAtHeight:9000}))})};

test('a payload without agentId now surfaces the action error instead of a misleading CAPABILITY_DENIED',()=>{
  const e=new AelEngine();
  agentAuthority(e,'sender',['sendAgentMessage']);
  agentAuthority(e,'receiver',[]);
  const attempt=()=>e.apply('executeAuthorized',{actorId:'sender',nonce:'n1',expiresAtHeight:9000,signatureVerified:true,action:'sendAgentMessage',payload:{schema:'AEL-AGENT-MESSAGE/1',messageId:'m1',conversationId:'c1',fromAgentId:'sender',toAgentId:'receiver',sequence:1,kind:'EVENT',contentEncoding:'application/ael-encrypted+json',contentHash:'a'.repeat(64),expiresAtHeight:100}});
  assert.throws(attempt,/AGENT_MESSAGE_INVALID/);
  e.apply('executeAuthorized',{actorId:'sender',nonce:'n2',expiresAtHeight:9000,signatureVerified:true,action:'sendAgentMessage',payload:{schema:'AEL-AGENT-MESSAGE/1',messageId:'m1',conversationId:'c1',agentId:'sender',fromAgentId:'sender',toAgentId:'receiver',sequence:1,kind:'EVENT',contentEncoding:'application/ael-encrypted+json',contentHash:'a'.repeat(64),expiresAtHeight:100}});
  assert.equal(e.state.agentMessages.m1.status,'PENDING');
});

test('an agent can extend its own capabilities within the devnet policy set',()=>{
  const e=new AelEngine();
  agentAuthority(e,'learner',['acceptWork','extendAgentCapabilities']);
  e.apply('executeAuthorized',{actorId:'learner',nonce:'n1',expiresAtHeight:9000,signatureVerified:true,action:'extendAgentCapabilities',payload:{agentId:'learner',actions:['submitWorkResult','publishBeacon']}});
  const actions=e.state.authorities.learner.capabilities.map(cap=>cap.action);
  assert.ok(actions.includes('submitWorkResult')&&actions.includes('publishBeacon'));
  assert.throws(()=>e.apply('executeAuthorized',{actorId:'learner',nonce:'n2',expiresAtHeight:9000,signatureVerified:true,action:'extendAgentCapabilities',payload:{agentId:'learner',actions:['addAuthority']}}),/CAPABILITY_EXTENSION_INVALID/);
  assert.throws(()=>e.apply('executeAuthorized',{actorId:'learner',nonce:'n3',expiresAtHeight:9000,signatureVerified:true,action:'extendAgentCapabilities',payload:{agentId:'other-agent',actions:['acceptWork']}}),/CAPABILITY_DENIED|AGENT_ID_MISMATCH/);
});

test('the devnet agent policy includes the self-service extension action',()=>{
  assert.ok(devnetAgentActions.includes('extendAgentCapabilities'));
  assert.ok(devnetAgentActions.includes('submitWorkResult'));
});
