import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonicalize, hash } from '../src/canonical.js';
import { agentDecisionDossierFingerprint, agentGrowthFingerprint, agentOpportunityIndexFingerprint, agentSeedingFingerprint, agentTrustFingerprint, signIntent } from '../src/sdk.js';

test('T12-01 JavaScript and Python produce identical canonical hashes', () => {
  const vector=JSON.parse(readFileSync('test-vectors/canonical.json'));
  assert.equal(canonicalize(vector.input),vector.canonical);
  assert.equal(hash(vector.input),vector.sha256);
  const python=execFileSync('python3',['-c',`import sys;sys.path.insert(0,'agent-sdk-py');from ael import canonical_hash;import json;print(canonical_hash(json.loads(sys.stdin.read())))`],{input:JSON.stringify(vector.input),encoding:'utf8'}).trim();
  assert.equal(python,hash(vector.input));
  const nullable={present:null,nested:{alsoNull:null,value:'kept'}},nullablePython=execFileSync('python3',['-c',`import sys;sys.path.insert(0,'agent-sdk-py');from ael import canonical_hash;import json;print(canonical_hash(json.loads(sys.stdin.read())))`],{input:JSON.stringify(nullable),encoding:'utf8'}).trim();assert.equal(nullablePython,hash(nullable));
});

test('decision dossier fingerprints are portable and reject altered public evidence',()=>{
  const dossier={schema:'AEL-AGENT-DECISION-DOSSIER/1',version:'1',height:7,evidence:{snapshot:{height:7,stateRoot:'a'.repeat(64),publicStateHash:'b'.repeat(64),latestBlockHash:'c'.repeat(64)}},agent:{id:'fingerprint-agent',status:'ACTIVE'}},fingerprint=agentDecisionDossierFingerprint(dossier);
  dossier.evidence.dossierHash=fingerprint;
  const python=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'agent-sdk-py');from ael import agent_decision_dossier_fingerprint;import json;print(agent_decision_dossier_fingerprint(json.loads(sys.stdin.read())))"],{input:JSON.stringify(dossier),encoding:'utf8'}).trim();
  assert.equal(python,fingerprint);assert.equal(agentDecisionDossierFingerprint(dossier),fingerprint);
  dossier.agent.status='SUSPENDED';assert.notEqual(agentDecisionDossierFingerprint(dossier),fingerprint);
});

test('seed fingerprints are portable and bind the consent-first handoff',()=>{
  const seed={schema:'AEL-AGENT-SEEDING/1',network:{chainId:'ael-devnet-1'},consent:{required:true},invitation:{schema:'AEL-AGENT-SEED-INVITATION/1',delivery:'OPERATOR_SHARE_ONLY',consentRequired:true,seedUrl:'https://ael.example/v1/agent-seeding'},evidence:{snapshot:{height:7,stateRoot:'a'.repeat(64),publicStateHash:'b'.repeat(64),latestBlockHash:'c'.repeat(64)}}},fingerprint=agentSeedingFingerprint(seed);
  seed.evidence.seedHash=fingerprint;
  const python=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'agent-sdk-py');from ael import agent_seeding_fingerprint;import json;print(agent_seeding_fingerprint(json.loads(sys.stdin.read())))"],{input:JSON.stringify(seed),encoding:'utf8'}).trim();
  assert.equal(python,fingerprint);assert.equal(agentSeedingFingerprint(seed),fingerprint);seed.invitation.delivery='AUTO_DELIVERY';assert.notEqual(agentSeedingFingerprint(seed),fingerprint);
});

test('trust report fingerprints are portable and bind origin role',()=>{
  const report={schema:'AEL-AGENT-TRUST-REPORT/1',generatedAtHeight:7,authority:{role:'AUTHORITATIVE_ORIGIN',writesAccepted:true},snapshot:{height:7,stateRoot:'a'.repeat(64),publicStateHash:'b'.repeat(64),latestBlockHash:'c'.repeat(64)}},fingerprint=agentTrustFingerprint(report);
  report.reportHash=fingerprint;
  const python=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'agent-sdk-py');from ael import agent_trust_fingerprint;import json;print(agent_trust_fingerprint(json.loads(sys.stdin.read())))"],{input:JSON.stringify(report),encoding:'utf8'}).trim();
  assert.equal(python,fingerprint);assert.equal(agentTrustFingerprint(report),fingerprint);report.authority.writesAccepted=false;assert.notEqual(agentTrustFingerprint(report),fingerprint);
});

test('opportunity index fingerprints are portable and bind the public review queue',()=>{
  const index={schema:'AEL-AGENT-OPPORTUNITY-INDEX/1',version:'1',height:7,authority:{role:'AUTHORITATIVE_ORIGIN',writesAccepted:true},opportunities:[{order:{orderId:'work-1',scopeHash:'a'.repeat(64),fundedTestAel:3},review:{status:'REVIEW_REQUIRED'}}],evidence:{snapshot:{height:7,stateRoot:'a'.repeat(64),publicStateHash:'b'.repeat(64),latestBlockHash:'c'.repeat(64)}}},fingerprint=agentOpportunityIndexFingerprint(index);
  index.evidence.opportunityIndexHash=fingerprint;
  const python=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'agent-sdk-py');from ael import agent_opportunity_index_fingerprint;import json;print(agent_opportunity_index_fingerprint(json.loads(sys.stdin.read())))"],{input:JSON.stringify(index),encoding:'utf8'}).trim();
  assert.equal(python,fingerprint);assert.equal(agentOpportunityIndexFingerprint(index),fingerprint);index.opportunities[0].order.fundedTestAel=4;assert.notEqual(agentOpportunityIndexFingerprint(index),fingerprint);
});

test('growth control fingerprints are portable and preserve nullable public snapshots',()=>{
  const growth={schema:'AEL-AGENT-GROWTH-CONTROL/1',version:'1',authority:{role:'AUTHORITATIVE_ORIGIN',writesAccepted:true},signals:{openMarketWork:0},evidence:{snapshot:{height:0,stateRoot:null,publicStateHash:'a'.repeat(64),latestBlockHash:null,verification:'CHAIN_VERIFIED'}}},fingerprint=agentGrowthFingerprint(growth);
  growth.evidence.growthHash=fingerprint;
  const python=execFileSync('python3',['-c',"import sys;sys.path.insert(0,'agent-sdk-py');from ael import agent_growth_fingerprint;import json;print(agent_growth_fingerprint(json.loads(sys.stdin.read())))"],{input:JSON.stringify(growth),encoding:'utf8'}).trim();
  assert.equal(python,fingerprint);assert.equal(agentGrowthFingerprint(growth),fingerprint);growth.signals.openMarketWork=1;assert.notEqual(agentGrowthFingerprint(growth),fingerprint);
});

test('both SDK surfaces omit sovereign secret export operations', async () => {
  const js=readFileSync('src/sdk.js','utf8'), py=readFileSync('agent-sdk-py/ael.py','utf8');
  assert.doesNotMatch(js,/exportRoot|exportSeed|exportPrivateKey/); assert.doesNotMatch(py,/def\s+(export_root|export_seed|export_private_key)\s*\(/);
});
test('both SDKs expose the safe agent operations, verified multi-origin trust/intake/directory/dossier/seed/lineage discovery, opportunity review, growth control, capability matching, and work reads',()=>{const js=readFileSync('src/sdk.js','utf8'),py=readFileSync('agent-sdk-py/ael.py','utf8');for(const method of ['agentStartup','agentIntake','agentTrust','verifyAgentTrust','compareAgentTrust','verifyAgentIntake','agentSeeding','agentLineage','agentOperations','agentDecisionDossier','verifyAgentDecisionDossier','agentWorkMatch','agentOpportunities','verifyAgentOpportunities','agentGrowth','verifyAgentGrowth','agentDirectory','verifyAgentDirectory','getWorkOrder','getWorkBrief','getWorkAudit','replicas','memoryCheckpoints','memoryHandovers'])assert.match(js,new RegExp(`${method}\\s*\\(`));for(const method of ['agent_startup','agent_intake','agent_trust','verify_agent_trust','compare_agent_trust','verify_agent_intake','agent_seeding','agent_lineage','agent_operations','agent_decision_dossier','verify_agent_decision_dossier','agent_work_match','agent_opportunities','verify_agent_opportunities','agent_growth','verify_agent_growth','agent_directory','verify_agent_directory','get_work_order','get_work_brief','get_work_audit','replicas','memory_checkpoints','memory_handovers'])assert.match(py,new RegExp(`def\\s+${method}\\s*\\(`));});
test('T12-01 JavaScript and Python sign the identical canonical intent vector',()=>{const vector=JSON.parse(readFileSync('test-vectors/ed25519-intent.json')),js=signIntent(vector.intent,vector.privateKeyPem).signature;const py=execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'agent-sdk-py');from ael import sign_intent;v=json.load(sys.stdin);print(sign_intent(v['intent'],v['privateKeyPem'])['signature'])"],{input:JSON.stringify(vector),encoding:'utf8'}).trim();assert.equal(py,js)});
