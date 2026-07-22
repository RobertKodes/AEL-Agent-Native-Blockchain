import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';
import { hash } from '../src/canonical.js';

const setup=()=>{const e=new AelEngine(),deliverableHash=hash('artifact'),evidence={schema:'AEL-WORK-EVIDENCE/1',proofType:'DETERMINISTIC_REPLAY',artifactHash:deliverableHash,claimHash:hash('claim'),traceRoot:hash('trace'),reproductionHash:hash('environment-and-output'),uri:'https://evidence.example/bundle'};e.apply('createAgent',{agentId:'worker',rootPublicKey:'p',constitutionRoot:'c'});for(const[verifierId,independenceGroup,bond]of[['v1','org-a',100],['v2','org-b',400],['v3','org-c',900]])e.apply('registerVerifier',{verifierId,independenceGroup,bond});e.apply('createWorkOrder',{orderId:'hybrid',agentId:'worker',requesterRoot:'human',fundedAmount:100,scopeHash:hash('scope'),validationPolicy:{schema:'AEL-WORK-VALIDATION-POLICY/1',mode:'HYBRID',proofTypes:['DETERMINISTIC_REPLAY'],requiredAccepts:3,minIndependentGroups:3,committeeSize:3,sampleRateBps:10_000}});e.apply('acceptWork',{orderId:'hybrid',agentId:'worker'});e.apply('submitWorkResult',{orderId:'hybrid',agentId:'worker',deliverableHash,evidence});return{e,evidence};};

test('hybrid PoUW requires evidence-bound votes from a deterministic bonded committee',()=>{
  const{e,evidence}=setup(),commitment=hash(evidence);
  assert.throws(()=>e.apply('voteWork',{orderId:'hybrid',verifierId:'v1',verdict:'ACCEPT',observedEvidenceHash:commitment,reproductionHash:evidence.reproductionHash}),/WORK_EVIDENCE_NOT_REPRODUCED/);
  for(const verifierId of ['v1','v2','v3'])e.apply('voteWork',{orderId:'hybrid',verifierId,verdict:'ACCEPT',observedEvidenceHash:commitment,reproductionHash:evidence.reproductionHash,reexecuted:true});
  e.apply('settleVerifiedWork',{orderId:'hybrid',receiptId:'receipt',paymentId:'payment',amount:100,finalized:true,payerRoot:'human',publicData:{}});
  const verification=e.state.receipts.receipt.publicData.verification;
  assert.equal(verification.mode,'HYBRID');assert.equal(verification.accepts,3);assert.equal(verification.independentGroups,3);assert.equal(verification.sampledReexecutions,3);assert.equal(verification.evidenceCommitment,commitment);assert.ok(verification.bondWeight>3);
});

test('strict work rejects declarations without reproducible proof commitments',()=>{
  const e=new AelEngine();e.apply('createAgent',{agentId:'worker',rootPublicKey:'p',constitutionRoot:'c'});e.apply('createWorkOrder',{orderId:'strict',agentId:'worker',fundedAmount:1,scopeHash:hash('scope'),validationPolicy:{schema:'AEL-WORK-VALIDATION-POLICY/1',mode:'DETERMINISTIC_REPLAY',proofTypes:['DETERMINISTIC_REPLAY'],requiredAccepts:2,minIndependentGroups:2,committeeSize:2,sampleRateBps:1000}});e.apply('acceptWork',{orderId:'strict',agentId:'worker'});
  assert.throws(()=>e.apply('submitWorkResult',{orderId:'strict',agentId:'worker',deliverableHash:hash('artifact'),evidence:{schema:'AEL-WORK-EVIDENCE/1',proofType:'DETERMINISTIC_REPLAY',artifactHash:hash('artifact')}}),/WORK_RESULT_INVALID/);
});
