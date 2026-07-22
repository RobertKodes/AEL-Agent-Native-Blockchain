import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAelServer } from '../src/server.js';
import { AelClient, createLocalAuthority, publicKeyFingerprint, signOperatorClaim } from '../src/sdk.js';

const harness=async(t)=>{const app=createAelServer({port:0,secureMode:true,bootstrapToken:'bootstrap',statePath:join(mkdtempSync(join(tmpdir(),'ael-audit-')),'state.json')}),address=await app.listen();t.after(()=>app.close());const url=`http://127.0.0.1:${address.port}`,bootstrap=new AelClient(url,{headers:{'x-ael-bootstrap-token':'bootstrap'}}),keys=createLocalAuthority();await bootstrap.bootstrapAuthority({actorId:'admin',publicKey:keys.publicKey,roles:['ADMIN']});return{url,bootstrap,admin:new AelClient(url,{actorId:'admin',privateKey:keys.privateKey})}};

test('self-custodied auditor submits a scoped signed finding and admin resolves the audit',async t=>{
  const{url,bootstrap,admin}=await harness(t),auditorKeys=createLocalAuthority();
  await admin.act('createAuditEngagement',{engagementId:'audit-1',scopeHash:'scope',releaseHash:'release',deadlineHeight:100});
  await admin.act('createOperatorInvitation',{invitationId:'invite-auditor',actorId:'auditor-1',publicKeyHash:publicKeyFingerprint(auditorKeys.publicKey),roles:['AUDITOR'],capabilities:[{action:'submitAuditFinding',engagementId:'audit-1',expiresAtHeight:100}],expiresAtHeight:100});
  await bootstrap.claimOperatorInvitation(signOperatorClaim({invitationId:'invite-auditor',actorId:'auditor-1',publicKey:auditorKeys.publicKey,nonce:'claim'},auditorKeys.privateKey));
  const auditor=new AelClient(url,{actorId:'auditor-1',privateKey:auditorKeys.privateKey});
  await assert.rejects(()=>auditor.act('submitAuditFinding',{engagementId:'other',findingId:'bad',auditorId:'auditor-1',severity:'HIGH',title:'wrong scope',evidenceHash:'e'}),/CAPABILITY_DENIED/);
  await assert.rejects(()=>auditor.act('submitAuditFinding',{engagementId:'audit-1',findingId:'impersonated',auditorId:'somebody-else',severity:'HIGH',title:'wrong identity',evidenceHash:'e'}),/AUDITOR_ID_MISMATCH/);
  await auditor.act('submitAuditFinding',{engagementId:'audit-1',findingId:'finding-1',auditorId:'auditor-1',severity:'HIGH',title:'Invariant review',evidenceHash:'evidence'});
  await assert.rejects(()=>admin.act('closeAuditEngagement',{engagementId:'audit-1',reportHash:'premature'}),/AUDIT_CLOSE_DENIED/);
  await admin.act('respondAuditFinding',{findingId:'finding-1',status:'RESOLVED',responseHash:'patch'});await admin.act('closeAuditEngagement',{engagementId:'audit-1',reportHash:'final-report'});
  const audits=await bootstrap.request('GET','/v1/audits');assert.equal(audits.engagements[0].status,'CLOSED');assert.equal(audits.findings[0].auditorId,'auditor-1');assert.equal(audits.findings[0].status,'RESOLVED');
});

test('a verifier authority cannot cast a vote as another verifier',async t=>{const{url,admin}=await harness(t),keys=createLocalAuthority();await admin.act('addAuthority',{actorId:'v1',publicKey:keys.publicKey,roles:['VERIFIER'],capabilities:['voteWork']});const verifier=new AelClient(url,{actorId:'v1',privateKey:keys.privateKey});await assert.rejects(()=>verifier.act('voteWork',{orderId:'anything',verifierId:'v2',verdict:'ACCEPT'}),/VERIFIER_ID_MISMATCH/)});
