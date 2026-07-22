import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';
import { hash } from '../src/canonical.js';

const contribution={contributionId:'agent-patch-1',agentId:'builder-agent',sourceUri:'https://code.example/commit/abc',baseReleaseHash:hash('base'),commitHash:hash('commit'),patchHash:hash('patch'),buildSpecHash:hash('build-spec'),testPlanHash:hash('test-plan'),license:'Apache-2.0',area:'CONSENSUS'};

test('agent contribution reaches deployment only through reproducible builds, independent audit, governance, and timelock',()=>{
  const e=new AelEngine(),artifactHash=hash('artifact');e.apply('createAgent',{agentId:'builder-agent',rootPublicKey:'pub',constitutionRoot:'c'});e.apply('submitProtocolContribution',contribution);
  for(const[verifierId,independenceGroup]of[['build-a','org-a'],['build-b','org-b']]){e.apply('registerVerifier',{verifierId,bond:100,independenceGroup});e.apply('attestProtocolBuild',{contributionId:contribution.contributionId,verifierId,artifactHash,sbomHash:hash(`sbom-${verifierId}`),testReportHash:hash(`tests-${verifierId}`),reproducible:true,testsPassed:125,testsFailed:0});}
  assert.equal(e.state.protocolContributions[contribution.contributionId].status,'SECURITY_REVIEW');
  for(const[auditorId,independenceGroup]of[['audit-a','audit-org-a'],['audit-b','audit-org-b']])e.apply('reviewProtocolContribution',{contributionId:contribution.contributionId,auditorId,independenceGroup,reportHash:hash(`report-${auditorId}`),verdict:'PASS',maximumSeverity:'LOW'});
  assert.equal(e.state.protocolContributions[contribution.contributionId].status,'GOVERNANCE_READY');
  e.apply('submitProposal',{proposalId:'adopt-1',proposerId:'governor',action:'ADOPT_PROTOCOL_CONTRIBUTION',targetId:contribution.contributionId,classification:'MODULE',stakeThreshold:1,utilityThreshold:1,timelockBlocks:5});e.apply('voteProposal',{proposalId:'adopt-1',voterId:'stake-governor',chamber:'stake',weight:1});e.apply('voteProposal',{proposalId:'adopt-1',voterId:'utility-governor',chamber:'utility',weight:1});
  assert.throws(()=>e.apply('enactProtocolContribution',{contributionId:contribution.contributionId,proposalId:'adopt-1',governorId:'governor',releaseManifestHash:hash('manifest')}),/PROTOCOL_ENACTMENT_DENIED/);
  e.apply('advance',{blocks:5});e.apply('enactProtocolContribution',{contributionId:contribution.contributionId,proposalId:'adopt-1',governorId:'governor',releaseManifestHash:hash('manifest')});
  e.apply('recordProtocolRelease',{contributionId:contribution.contributionId,releaseId:'v0.13.0-rc1',governorId:'governor',artifactHash,deploymentEvidenceHash:hash('deployment'),origins:['https://origin-a.example','https://origin-b.example']});
  assert.equal(e.state.protocolContributions[contribution.contributionId].status,'DEPLOYED');assert.equal(e.state.protocolReleases['v0.13.0-rc1'].artifactHash,artifactHash);
  e.apply('createWorkOrder',{orderId:'value-work',agentId:'builder-agent',requesterRoot:'payer',fundedAmount:25,scopeHash:hash('value-scope')});e.apply('acceptWork',{orderId:'value-work',agentId:'builder-agent'});e.apply('finalizeReceipt',{receiptId:'value-receipt',orderId:'value-work',paymentId:'value-payment',amount:25,finalized:true,payerRoot:'payer',verifiers:['independent-a','independent-b'],publicData:{contributionId:contribution.contributionId}});e.apply('attributeContributionReceipt',{contributionId:contribution.contributionId,agentId:'builder-agent',receiptId:'value-receipt'});
  assert.equal(e.state.protocolContributions[contribution.contributionId].attributedValue,25);
});

test('different build artifacts do not qualify as reproducible',()=>{
  const e=new AelEngine();e.apply('createAgent',{agentId:'builder-agent',rootPublicKey:'pub',constitutionRoot:'c'});e.apply('submitProtocolContribution',contribution);for(const[verifierId,independenceGroup,artifact]of[['a','org-a','artifact-a'],['b','org-b','artifact-b']]){e.apply('registerVerifier',{verifierId,bond:100,independenceGroup});e.apply('attestProtocolBuild',{contributionId:contribution.contributionId,verifierId,artifactHash:hash(artifact),sbomHash:hash(`sbom-${verifierId}`),testReportHash:hash(`test-${verifierId}`),reproducible:true,testsPassed:1,testsFailed:0});}assert.equal(e.state.protocolContributions[contribution.contributionId].status,'BUILD_VERIFICATION');
});
