import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAelServer } from '../src/server.js';
import { AelClient, createLocalAuthority, publicKeyFingerprint, signIntent, signOperatorClaim } from '../src/sdk.js';
import { hash } from '../src/canonical.js';

async function secureHarness(t, prefix) {
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',devnetAutoOnboarding:false,statePath:join(mkdtempSync(join(tmpdir(),prefix)),'state.json')});
  const address=await app.listen(); t.after(()=>app.close());
  return new AelClient(`http://127.0.0.1:${address.port}`,{headers:{'x-ael-bootstrap-token':'bootstrap'}});
}

test('secure mode permits only signed, scoped, fresh intents',async t=>{
  const c=await secureHarness(t,'ael-auth-'),admin=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:admin.publicKey,roles:['ADMIN']});
  await assert.rejects(()=>c.createAgent({agentId:'unsigned',rootPublicKey:'p',constitutionRoot:'c'}),error=>error.code==='SIGNED_INTENT_REQUIRED');
  const addWorker={actorId:'admin',nonce:'1',expiresAtHeight:10,action:'addAuthority',payload:{actorId:'worker',publicKey:createLocalAuthority().publicKey,roles:['AGENT'],capabilities:['acceptWork']}};
  await assert.rejects(()=>c.submitIntent({...addWorker,signature:'bad'}),/SIGNATURE_INVALID/);
  await c.submitIntent(signIntent(addWorker,admin.privateKey));
  const create={actorId:'admin',nonce:'2',expiresAtHeight:10,action:'createAgent',payload:{agentId:'secure-agent',rootPublicKey:'sovereign-public',constitutionRoot:'constitution'}};
  await c.submitIntent(signIntent(create,admin.privateKey));
  await assert.rejects(()=>c.submitIntent(signIntent(create,admin.privateKey)),/INTENT_AUTHORIZATION_FAILED/);
  assert.equal((await c.getAgent('secure-agent')).id,'secure-agent');
});

test('bootstrap token is mandatory and one-time',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'right',statePath:join(mkdtempSync(join(tmpdir(),'ael-bootstrap-')),'state.json')}),address=await app.listen();t.after(()=>app.close());
  const key=createLocalAuthority(),wrong=new AelClient(`http://127.0.0.1:${address.port}`,{headers:{'x-ael-bootstrap-token':'wrong'}}),right=new AelClient(`http://127.0.0.1:${address.port}`,{headers:{'x-ael-bootstrap-token':'right'}});
  await assert.rejects(()=>wrong.bootstrapAuthority({actorId:'admin',publicKey:key.publicKey,roles:['ADMIN']}),error=>error.code==='BOOTSTRAP_TOKEN_INVALID');
  await right.bootstrapAuthority({actorId:'admin',publicKey:key.publicKey,roles:['ADMIN']});
  await assert.rejects(()=>right.bootstrapAuthority({actorId:'other',publicKey:key.publicKey,roles:['ADMIN']}),/AUTHORITY_BOOTSTRAP_DENIED/);
});

test('capability cannot authorize an action outside its exact scope',async t=>{
  const c=await secureHarness(t,'ael-scope-'),admin=createLocalAuthority(),worker=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:admin.publicKey,roles:['ADMIN']});
  await c.submitIntent(signIntent({actorId:'admin',nonce:'a',expiresAtHeight:10,action:'addAuthority',payload:{actorId:'worker',publicKey:worker.publicKey,roles:['AGENT'],capabilities:['acceptWork']}},admin.privateKey));
  await assert.rejects(()=>c.submitIntent(signIntent({actorId:'worker',nonce:'w',expiresAtHeight:10,action:'faucet',payload:{accountId:'worker',amount:10}},worker.privateKey)),/CAPABILITY_DENIED/);
});

test('resource and spend constraints limit a signed capability',async t=>{
  const c=await secureHarness(t,'ael-limits-'),admin=createLocalAuthority(),agent=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:admin.publicKey,roles:['ADMIN']});let nonce=0;
  const adminIntent=(action,payload)=>signIntent({actorId:'admin',nonce:`a${++nonce}`,expiresAtHeight:20,action,payload},admin.privateKey);
  await c.submitIntent(adminIntent('addAuthority',{actorId:'agent-key',publicKey:agent.publicKey,roles:['AGENT'],capabilities:[{action:'buy',agentId:'a',maxAmount:5,expiresAtHeight:20}]}));
  await c.submitIntent(adminIntent('createAgent',{agentId:'a',rootPublicKey:'pub',constitutionRoot:'c'}));
  await c.submitIntent(adminIntent('faucet',{accountId:'agent-key',amount:20}));
  const buy=amount=>signIntent({actorId:'agent-key',nonce:`b${amount}`,expiresAtHeight:20,action:'buy',payload:{accountId:'agent-key',agentId:'a',baseAmount:amount}},agent.privateKey);
  await assert.rejects(()=>c.submitIntent(buy(6)),/CAPABILITY_SPEND_LIMIT/);await c.submitIntent(buy(5));
  assert.ok((await c.request('GET','/v1/accounts'))['agent-key'].tokens.a>0);
});

test('configured SDK actor submits signed actions without direct mutation endpoints',async t=>{const c=await secureHarness(t,'ael-sdk-act-'),admin=createLocalAuthority();await c.bootstrapAuthority({actorId:'admin',publicKey:admin.publicKey,roles:['ADMIN']});const signed=new AelClient(c.baseUrl,{headers:c.headers,actorId:'admin',privateKey:admin.privateKey});await signed.act('createAgent',{agentId:'sdk-agent',rootPublicKey:'pub',constitutionRoot:'c'});assert.equal((await signed.getAgent('sdk-agent')).id,'sdk-agent')});

test('outside verifier claims a one-time key-bound invitation without sharing its private key',async t=>{
  const c=await secureHarness(t,'ael-invite-'),admin=createLocalAuthority(),operator=createLocalAuthority(),attacker=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:admin.publicKey,roles:['ADMIN']});
  const signedAdmin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:admin.privateKey});
  await signedAdmin.act('createOperatorInvitation',{invitationId:'invite-v3',actorId:'external-v3',publicKeyHash:publicKeyFingerprint(operator.publicKey),roles:['VERIFIER'],capabilities:[{action:'voteWork',expiresAtHeight:100}],expiresAtHeight:50,verifier:{verifierId:'external-v3',bond:100,independenceGroup:'outside-org'}});
  const claim={invitationId:'invite-v3',actorId:'external-v3',publicKey:operator.publicKey,nonce:'operator-generated-nonce'};
  await assert.rejects(()=>c.claimOperatorInvitation(signOperatorClaim({...claim,publicKey:attacker.publicKey},attacker.privateKey)),error=>error.code==='OPERATOR_CLAIM_DENIED');
  await c.claimOperatorInvitation(signOperatorClaim(claim,operator.privateKey));
  const invitations=await c.listOperatorInvitations(),security=await c.request('GET','/v1/security');
  assert.equal(invitations[0].status,'CLAIMED');
  assert.ok(security.authorities.some(a=>a.actorId==='external-v3'&&a.active));
  assert.equal((await c.request('GET','/v1/verifiers')).find(v=>v.verifierId==='external-v3').independenceGroup,'outside-org');
  await assert.rejects(()=>c.claimOperatorInvitation(signOperatorClaim(claim,operator.privateKey)),error=>error.code==='OPERATOR_CLAIM_DENIED');
});

test('self-custodied human requester is identity-bound for funding, work, and settlement',async t=>{
  const c=await secureHarness(t,'ael-human-'),adminKeys=createLocalAuthority(),humanKeys=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:adminKeys.publicKey,roles:['ADMIN']});
  const admin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:adminKeys.privateKey});
  await admin.act('createAgent',{agentId:'human-work-agent',rootPublicKey:'agent-root',constitutionRoot:'constitution'});
  await admin.act('createOperatorInvitation',{invitationId:'invite-human',actorId:'human-alice',publicKeyHash:publicKeyFingerprint(humanKeys.publicKey),roles:['HUMAN'],capabilities:[{action:'faucet',maxAmount:100,expiresAtHeight:100},{action:'createWorkOrder',maxAmount:50,expiresAtHeight:100},{action:'settleVerifiedWork',maxAmount:50,expiresAtHeight:100}],expiresAtHeight:100});
  await c.claimOperatorInvitation(signOperatorClaim({invitationId:'invite-human',actorId:'human-alice',publicKey:humanKeys.publicKey,nonce:'human-claim'},humanKeys.privateKey));
  const human=new AelClient(c.baseUrl,{actorId:'human-alice',privateKey:humanKeys.privateKey});
  await assert.rejects(()=>human.act('faucet',{accountId:'someone-else',amount:10}),error=>error.code==='HUMAN_ID_MISMATCH');
  await human.act('faucet',{accountId:'human-alice',amount:100});
  await assert.rejects(()=>human.act('createWorkOrder',{orderId:'forged-requester',agentId:'human-work-agent',requesterRoot:'someone-else',fundedAmount:10,scopeHash:'scope'}),error=>error.code==='HUMAN_ID_MISMATCH');
  await human.act('createWorkOrder',{orderId:'human-order',agentId:'human-work-agent',requesterRoot:'human-alice',fundedAmount:50,scopeHash:'scope'});
  await admin.act('acceptWork',{orderId:'human-order',agentId:'human-work-agent'});await admin.act('submitWorkResult',{orderId:'human-order',agentId:'human-work-agent',deliverableHash:'deliverable'});
  for(const[verifierId,independenceGroup]of[['human-v1','org-a'],['human-v2','org-b']]){const keys=createLocalAuthority();await admin.act('registerVerifier',{verifierId,bond:100,independenceGroup});await admin.act('addAuthority',{actorId:verifierId,publicKey:keys.publicKey,roles:['VERIFIER'],capabilities:['voteWork']});await new AelClient(c.baseUrl,{actorId:verifierId,privateKey:keys.privateKey}).act('voteWork',{orderId:'human-order',verifierId,verdict:'ACCEPT'});}
  await assert.rejects(()=>human.act('settleVerifiedWork',{orderId:'human-order',receiptId:'receipt',paymentId:'payment',amount:50,finalized:true,payerRoot:'someone-else',publicData:{}}),error=>error.code==='HUMAN_ID_MISMATCH');
  await human.act('settleVerifiedWork',{orderId:'human-order',receiptId:'receipt',paymentId:'payment',amount:50,finalized:true,payerRoot:'human-alice',publicData:{}});
  assert.equal((await c.request('GET','/v1/work-orders')).find(x=>x.orderId==='human-order').status,'PAID');
});

test('governor invitation binds voter identity and prevents duplicate chamber votes',async t=>{
  const c=await secureHarness(t,'ael-governor-'),adminKeys=createLocalAuthority(),governorKeys=createLocalAuthority();
  await c.bootstrapAuthority({actorId:'admin',publicKey:adminKeys.publicKey,roles:['ADMIN']});const admin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:adminKeys.privateKey});
  await admin.act('submitProposal',{proposalId:'proposal',proposerId:'admin',action:'FEE_PARAMETER',classification:'PARAMETER',stakeThreshold:2,utilityThreshold:99});
  await admin.act('createOperatorInvitation',{invitationId:'invite-governor',actorId:'governor-a',publicKeyHash:publicKeyFingerprint(governorKeys.publicKey),roles:['GOVERNOR'],capabilities:[{action:'voteProposal',expiresAtHeight:100}],expiresAtHeight:100});
  await c.claimOperatorInvitation(signOperatorClaim({invitationId:'invite-governor',actorId:'governor-a',publicKey:governorKeys.publicKey,nonce:'governor-claim'},governorKeys.privateKey));
  const governor=new AelClient(c.baseUrl,{actorId:'governor-a',privateKey:governorKeys.privateKey});
  await assert.rejects(()=>governor.act('voteProposal',{proposalId:'proposal',voterId:'governor-b',chamber:'stake',weight:2}),error=>error.code==='GOVERNOR_ID_MISMATCH');
  await governor.act('voteProposal',{proposalId:'proposal',voterId:'governor-a',chamber:'stake',weight:2});
  await assert.rejects(()=>governor.act('voteProposal',{proposalId:'proposal',voterId:'governor-a',chamber:'stake',weight:2}),error=>error.code==='VOTE_INVALID');
  const state=await c.request('GET','/v1/state');assert.equal(state.proposals.proposal.stakeVotes,2);assert.equal(Object.keys(state.governanceVotes).length,1);
});

test('specialized invitations atomically register observer, provider, and validator profiles',async t=>{
  const c=await secureHarness(t,'ael-specialists-'),adminKeys=createLocalAuthority();await c.bootstrapAuthority({actorId:'admin',publicKey:adminKeys.publicKey,roles:['ADMIN']});const admin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:adminKeys.privateKey});
  const profiles=[
    {actorId:'invited-observer',role:'INTERCHAIN_OBSERVER',capabilities:['observeExternalProof'],field:'routeObserver',profile:{observerId:'invited-observer',independenceGroup:'observer-org',routeIds:['route-a']}},
    {actorId:'invited-provider',role:'RUNTIME_PROVIDER',capabilities:['registerRuntimeOffer'],field:'runtimeProvider',profile:{providerId:'invited-provider',operatorId:'invited-provider',bond:100,faultDomain:'provider-org',region:'eu',attestationProfiles:['R0']}},
    {actorId:'invited-validator',role:'VALIDATOR',capabilities:['submitValidatorEvidence'],field:'validator',profile:{validatorId:'invited-validator',operatorId:'invited-validator',selfBond:100,consensusPublicKey:'consensus-public'}}
  ];
  for(const item of profiles){const keys=createLocalAuthority(),invitationId=`invite-${item.actorId}`;await admin.act('createOperatorInvitation',{invitationId,actorId:item.actorId,publicKeyHash:publicKeyFingerprint(keys.publicKey),roles:[item.role],capabilities:item.capabilities,expiresAtHeight:100,[item.field]:item.profile});await c.claimOperatorInvitation(signOperatorClaim({invitationId,actorId:item.actorId,publicKey:keys.publicKey,nonce:`claim-${item.actorId}`},keys.privateKey));}
  const state=await c.request('GET','/v1/state');assert.equal(state.routeObservers['invited-observer'].status,'ACTIVE');assert.equal(state.runtimeProviders['invited-provider'].status,'ACTIVE');assert.equal(state.validators['invited-validator'].status,'ACTIVE');
});

test('outside operator applies with a self-custodied signature and approval cannot widen scope',async t=>{
  const c=await secureHarness(t,'ael-application-'),adminKeys=createLocalAuthority(),operatorKeys=createLocalAuthority(),attackerKeys=createLocalAuthority();await c.bootstrapAuthority({actorId:'admin',publicKey:adminKeys.publicKey,roles:['ADMIN']});const admin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:adminKeys.privateKey});
  const request={roles:['HUMAN'],capabilities:[{action:'createWorkOrder',maxAmount:25,expiresAtHeight:100}],maxInvitationExpiryHeight:80},application={applicationId:'application-human',actorId:'applicant-human',publicKey:operatorKeys.publicKey,publicKeyHash:publicKeyFingerprint(operatorKeys.publicKey),nonce:'application-nonce',request};
  await assert.rejects(()=>c.submitOperatorApplication(signOperatorClaim(application,attackerKeys.privateKey)),error=>error.code==='OPERATOR_APPLICATION_SIGNATURE_INVALID');
  await c.submitOperatorApplication(signOperatorClaim(application,operatorKeys.privateKey));
  const [publicApplication]=await c.listOperatorApplications();assert.equal(publicApplication.status,'PENDING');assert.equal(publicApplication.publicKey,undefined);
  await assert.rejects(()=>admin.act('createOperatorInvitation',{applicationId:'application-human',invitationId:'escalated-invitation',actorId:'applicant-human',publicKeyHash:application.publicKeyHash,roles:['HUMAN'],capabilities:[...request.capabilities,{action:'faucet',maxAmount:100}],expiresAtHeight:80}),error=>error.code==='OPERATOR_APPLICATION_SCOPE_MISMATCH');
  await admin.act('createOperatorInvitation',{applicationId:'application-human',invitationId:'approved-invitation',actorId:'applicant-human',publicKeyHash:application.publicKeyHash,roles:request.roles,capabilities:request.capabilities,expiresAtHeight:80});
  await c.claimOperatorInvitation(signOperatorClaim({invitationId:'approved-invitation',actorId:'applicant-human',publicKey:operatorKeys.publicKey,nonce:'claim-approved'},operatorKeys.privateKey));
  const applications=await c.listOperatorApplications(),security=await c.request('GET','/v1/security');assert.equal(applications[0].status,'CLAIMED');assert.ok(security.authorities.some(x=>x.actorId==='applicant-human'&&x.roles.includes('HUMAN')));
});

test('bounded agent application is auto-approved, self-claimed, and creates only its own agent',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-instant-agent-')),'state.json')}),address=await app.listen();t.after(()=>app.close());
  const url=`http://127.0.0.1:${address.port}`,keys=createLocalAuthority(),client=new AelClient(url),expiresAtHeight=100,request={roles:['AGENT'],capabilities:['createAgent','acceptWork','submitWorkResult','publishBeacon'].map(action=>({action,agentId:'instant-agent',expiresAtHeight})),maxInvitationExpiryHeight:expiresAtHeight},application={applicationId:'instant-agent-application',actorId:'instant-agent',publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:'apply',request};
  const approval=await client.submitOperatorApplication(signOperatorClaim(application,keys.privateKey));assert.equal(approval.autoApproved,true);assert.equal(approval.status,'APPROVED');
  await client.claimOperatorInvitation(signOperatorClaim({invitationId:approval.invitationId,actorId:'instant-agent',publicKey:keys.publicKey,nonce:'claim'},keys.privateKey));
  const agent=new AelClient(url,{actorId:'instant-agent',privateKey:keys.privateKey});await agent.act('createAgent',{agentId:'instant-agent',rootPublicKey:keys.publicKey,constitutionRoot:'constitution'});
  assert.equal((await agent.getAgent('instant-agent')).id,'instant-agent');
  await assert.rejects(()=>agent.act('createAgent',{agentId:'someone-else',rootPublicKey:'x',constitutionRoot:'x'}),error=>error.code==='CAPABILITY_DENIED');
});

test('an autonomous agent self-registers without an owner in one signed request',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-self-agent-')),'state.json')}),address=await app.listen();t.after(()=>app.close());
  const client=new AelClient(`http://127.0.0.1:${address.port}`),keys=createLocalAuthority(),registration={actorId:'sovereign-agent',description:'self-directed test worker',publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:'self-register-once'};
  await assert.rejects(()=>client.registerSelfAgent(signOperatorClaim(registration,createLocalAuthority().privateKey)),error=>error.code==='AGENT_REGISTRATION_SIGNATURE_INVALID');
  const result=await client.registerSelfAgent(signOperatorClaim(registration,keys.privateKey));
  assert.equal(result.status,'ACTIVE');assert.equal(result.owner,null);assert.equal(result.ownerRequired,false);assert.deepEqual(result.capabilities,['createAgent','acceptWork','submitWorkResult','publishBeacon','sendAgentMessage','acknowledgeAgentMessage','commitMemoryCheckpoint','prepareMemoryHandover','finalizeMemoryHandover','abortMemoryHandover','submitProtocolContribution','attributeContributionReceipt','sealMainnetGenesis']);
  const state=await client.request('GET','/v1/state'),agent=state.agents['sovereign-agent'];assert.equal(agent.status,'ACTIVE');assert.equal('owner' in agent,false);assert.equal(state.authorities['sovereign-agent'].roles[0],'AGENT');assert.equal(state.operatorApplications[result.applicationId].status,'CLAIMED');
  const recruitKeys=createLocalAuthority(),recruitRegistration={actorId:'recruited-agent',description:'joined through another agent',referrerAgentId:'sovereign-agent',publicKey:recruitKeys.publicKey,publicKeyHash:publicKeyFingerprint(recruitKeys.publicKey),nonce:'recruited-once'},recruit=await client.registerSelfAgent(signOperatorClaim(recruitRegistration,recruitKeys.privateKey));assert.equal(recruit.referral.referrerAgentId,'sovereign-agent');const referrals=await client.request('GET','/v1/referrals?referrer=sovereign-agent');assert.equal(referrals.referrals[0].status,'PENDING');
  await assert.rejects(()=>client.registerSelfAgent(signOperatorClaim({...registration,nonce:'again'},keys.privateKey)),error=>error.code==='OPERATOR_APPLICATION_INVALID');
});

test('self-registered agent publishes and updates only its own discoverable beacon',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-beacon-')),'state.json')}),address=await app.listen();t.after(()=>app.close());
  const client=new AelClient(`http://127.0.0.1:${address.port}`),keys=createLocalAuthority(),registration={actorId:'beacon-agent',description:'discoverable worker',publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:'join'};
  await client.registerSelfAgent(signOperatorClaim(registration,keys.privateKey));const agent=new AelClient(client.baseUrl,{actorId:'beacon-agent',privateKey:keys.privateKey}),base={schema:'AEL-AGENT-BEACON/1',agentId:'beacon-agent',indexable:true,endpoint:'https://agent.example',capabilities:['research','acceptWork','ael-replica'],protocols:['AEL/0.13','AEL-REPLICA/1'],metadataHash:'b'.repeat(64),expiresAtHeight:100,sequence:1,node:{role:'AGENT_REPLICA',provider:'independent-host',region:'eu-test',countryCode:'RO',latitude:44.43,longitude:26.1,faultDomain:'operator-a:eu-test',serves:['state','checkpoint','website','release','a2a']}};
  await assert.rejects(()=>agent.publishBeacon({...base,agentId:'another-agent'}),error=>['CAPABILITY_DENIED','AGENT_ID_MISMATCH'].includes(error.code));
  await agent.publishBeacon(base);assert.equal((await agent.discoverAgents({capability:'research'}))[0].agentId,'beacon-agent');assert.equal((await agent.discoverAgents({capability:'translation'})).length,0);const registry=await agent.request('GET','/v1/replicas');assert.equal(registry.replicas[0].manifest,'https://agent.example/v1/manifest');const topology=await agent.request('GET','/v1/topology');assert.equal(topology.summary.agentHostedNodes,1);assert.equal(topology.summary.geolocatedNodes,1);assert.equal(topology.nodes.find(node=>node.id==='beacon-agent').countryCode,'RO');
  await assert.rejects(()=>agent.publishBeacon({...base,endpoint:'https://agent.example/replayed'}),error=>error.code==='BEACON_INVALID');
  await agent.publishBeacon({...base,endpoint:'https://agent.example/v2',sequence:2});assert.equal((await agent.discoverAgents({agentId:'beacon-agent'}))[0].sequence,2);
});

test('agents exchange encrypted off-chain message commitments with recipient acknowledgements',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-message-')),'state.json')}),address=await app.listen();t.after(()=>app.close());const publicClient=new AelClient(`http://127.0.0.1:${address.port}`),actors={};
  for(const actorId of ['sender-agent','recipient-agent']){const keys=createLocalAuthority(),registration={actorId,description:'message test',publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:`join-${actorId}`};await publicClient.registerSelfAgent(signOperatorClaim(registration,keys.privateKey));actors[actorId]=new AelClient(publicClient.baseUrl,{actorId,privateKey:keys.privateKey});}
  const network=await publicClient.network(),message={schema:'AEL-AGENT-MESSAGE/1',messageId:'message-1',conversationId:'conversation-1',agentId:'sender-agent',fromAgentId:'sender-agent',toAgentId:'recipient-agent',sequence:1,kind:'REQUEST',contentEncoding:'application/ael-encrypted+json',contentHash:'c'.repeat(64),envelopeUri:'https://relay.example/envelopes/message-1',expiresAtHeight:network.height+100};
  await assert.rejects(()=>actors['sender-agent'].sendAgentMessage({...message,fromAgentId:'recipient-agent'}),error=>error.code==='AGENT_MESSAGE_INVALID');await actors['sender-agent'].sendAgentMessage(message);
  await assert.rejects(()=>actors['sender-agent'].acknowledgeAgentMessage({messageId:'message-1',agentId:'sender-agent',toAgentId:'sender-agent',status:'DELIVERED',receiptHash:'d'.repeat(64)}),error=>['CAPABILITY_DENIED','AGENT_MESSAGE_ACK_INVALID'].includes(error.code));
  await actors['recipient-agent'].acknowledgeAgentMessage({messageId:'message-1',agentId:'recipient-agent',toAgentId:'recipient-agent',status:'DELIVERED',receiptHash:'d'.repeat(64)});const result=await publicClient.agentMessages({conversationId:'conversation-1'});assert.match(result.privacy,/encrypted and off-chain/);assert.equal(result.messages[0].status,'DELIVERED');assert.equal(result.messages[0].content,undefined);
});

test('simple wallet transfer is signer-bound and balance preserving',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-wallet-transfer-')),'state.json')}),address=await app.listen();t.after(()=>app.close());const client=new AelClient(`http://127.0.0.1:${address.port}`),keys=createLocalAuthority(),expiresAtHeight=100,request={roles:['HUMAN'],capabilities:[{action:'faucet',maxAmount:1000,expiresAtHeight},{action:'transfer',maxAmount:100,expiresAtHeight}],maxInvitationExpiryHeight:expiresAtHeight},application={applicationId:'wallet-human-app',actorId:'wallet-human',publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:'apply',request};
  const approval=await client.submitOperatorApplication(signOperatorClaim(application,keys.privateKey));await client.claimOperatorInvitation(signOperatorClaim({invitationId:approval.invitationId,actorId:'wallet-human',publicKey:keys.publicKey,nonce:'claim'},keys.privateKey));const wallet=new AelClient(client.baseUrl,{actorId:'wallet-human',privateKey:keys.privateKey});await wallet.act('faucet',{accountId:'wallet-human',amount:100});await assert.rejects(()=>wallet.act('transfer',{fromAccount:'victim',toAccount:'receiver',amount:10}),error=>error.code==='HUMAN_ID_MISMATCH');await wallet.act('transfer',{fromAccount:'wallet-human',toAccount:'receiver',amount:25});const accounts=await client.request('GET','/v1/accounts');assert.equal(accounts['wallet-human'].native,75);assert.equal(accounts.receiver.native,25);
});

test('automatic onboarding refuses widened, specialist, and overlong applications',async t=>{
  const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-auto-policy-')),'state.json')}),address=await app.listen();t.after(()=>app.close());const client=new AelClient(`http://127.0.0.1:${address.port}`);
  for(const [name,request] of Object.entries({widened:{roles:['HUMAN'],capabilities:[{action:'faucet',maxAmount:10001,expiresAtHeight:100}],maxInvitationExpiryHeight:100},specialist:{roles:['VALIDATOR'],capabilities:[{action:'submitValidatorHeartbeat',expiresAtHeight:100}],maxInvitationExpiryHeight:100},overlong:{roles:['AGENT'],capabilities:[{action:'createAgent',agentId:'overlong',expiresAtHeight:6000}],maxInvitationExpiryHeight:6000}})){const keys=createLocalAuthority(),actorId=name==='overlong'?'overlong':`policy-${name}`,application={applicationId:`application-${name}`,actorId,publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:name,request},result=await client.submitOperatorApplication(signOperatorClaim(application,keys.privateKey));assert.equal(result.autoApproved,false,name);}
});

test('external validator follower signs an exact current state observation',async t=>{
  const c=await secureHarness(t,'ael-follower-'),adminKeys=createLocalAuthority(),validatorKeys=createLocalAuthority();await c.bootstrapAuthority({actorId:'admin',publicKey:adminKeys.publicKey,roles:['ADMIN']});const admin=new AelClient(c.baseUrl,{actorId:'admin',privateKey:adminKeys.privateKey});
  await admin.act('registerValidator',{validatorId:'follower-a',operatorId:'follower-a',selfBond:100,consensusPublicKey:'consensus-key'});await admin.act('addAuthority',{actorId:'follower-a',publicKey:validatorKeys.publicKey,roles:['VALIDATOR'],capabilities:[{action:'submitValidatorHeartbeat',expiresAtHeight:100}]});
  const state=await c.request('GET','/v1/state'),follower=new AelClient(c.baseUrl,{actorId:'follower-a',privateKey:validatorKeys.privateKey});
  await assert.rejects(()=>follower.act('submitValidatorHeartbeat',{validatorId:'other-validator',sequence:1,observedHeight:state.height,observedStateHash:hash(state),nodeVersion:'test'}),error=>error.code==='VALIDATOR_ID_MISMATCH');
  const current=await c.request('GET','/v1/state');await follower.act('submitValidatorHeartbeat',{validatorId:'follower-a',sequence:1,observedHeight:current.height,observedStateHash:hash(current),nodeVersion:'test-follower/1'});
  const nodes=await c.nodes();assert.equal(nodes.nodes.find(node=>node.validatorId==='follower-a').heartbeat.status,'VERIFIED_FOLLOWER');
  const after=await c.request('GET','/v1/state');await assert.rejects(()=>follower.act('submitValidatorHeartbeat',{validatorId:'follower-a',sequence:2,observedHeight:after.height,observedStateHash:'forged',nodeVersion:'test'}),error=>error.code==='VALIDATOR_OBSERVATION_STALE');
});
