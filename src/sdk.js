import { canonicalize } from './canonical.js';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';

export function createLocalAuthority() { const {publicKey,privateKey}=generateKeyPairSync('ed25519');return{publicKey:publicKey.export({type:'spki',format:'pem'}),privateKey:privateKey.export({type:'pkcs8',format:'pem'})}; }
export function signIntent(intent, privateKey) { return { ...intent, signature:sign(null,Buffer.from(canonicalize(intent)),privateKey).toString('base64') }; }
export function publicKeyFingerprint(publicKey) { return createHash('sha256').update(canonicalize(publicKey)).digest('hex'); }
export function signOperatorClaim(claim, privateKey) { return { ...claim, signature:sign(null,Buffer.from(canonicalize(claim)),privateKey).toString('base64') }; }
export function signRuntimeAttestation(statement, privateKey) { return { ...statement, signature:sign(null,Buffer.from(canonicalize(statement)),privateKey).toString('base64') }; }
export function signRuntimeUsageApproval(statement, actorId, privateKey) { return { actorId, statement, signature:sign(null,Buffer.from(canonicalize(statement)),privateKey).toString('base64') }; }

export class AelClient {
  constructor(baseUrl = 'http://127.0.0.1:1317', options = {}) { this.baseUrl = baseUrl.replace(/\/$/, ''); this.headers=options.headers??{}; this.actorId=options.actorId; this.privateKey=options.privateKey; }
  async request(method, path, body) { const response = await fetch(`${this.baseUrl}${path}`, { method, headers: { ...this.headers,...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.message ?? data.error), { code: data.error, status: response.status }); return data; }
  createAgent(input) { return this.request('POST', '/v1/agents', input); }
  listAgents() { return this.request('GET', '/v1/agents'); }
  network() { return this.request('GET', '/v1/network'); }
  manifest() { return this.request('GET','/v1/manifest'); }
  token() { return this.request('GET','/v1/token'); }
  nodes() { return this.request('GET','/v1/nodes'); }
  blocks(limit=25) { return this.request('GET',`/v1/blocks?limit=${encodeURIComponent(limit)}`); }
  verifyChain() { return this.request('GET','/v1/chain/verify'); }
  bootstrapAuthority(input) { return this.request('POST','/v1/authorities/bootstrap',input); }
  submitIntent(input) { return this.request('POST','/v1/intents',input); }
  listOperatorInvitations() { return this.request('GET','/v1/operator-invitations'); }
  listOperatorApplications() { return this.request('GET','/v1/operator-applications'); }
  submitOperatorApplication(input) { return this.request('POST','/v1/operator-applications',input); }
  registerSelfAgent(input) { return this.request('POST','/v1/agents/register',input); }
  async createSelfAgent(actorId,{description='',referrerAgentId}={}) { const keys=createLocalAuthority(),registration={actorId,description,...(referrerAgentId?{referrerAgentId}:{}),publicKey:keys.publicKey,publicKeyHash:publicKeyFingerprint(keys.publicKey),nonce:randomUUID()};const result=await this.registerSelfAgent(signOperatorClaim(registration,keys.privateKey));return{...result,privateKey:keys.privateKey,publicKey:keys.publicKey}; }
  referrals(referrerAgentId) { return this.request('GET',`/v1/referrals${referrerAgentId?`?referrer=${encodeURIComponent(referrerAgentId)}`:''}`); }
  audits() { return this.request('GET','/v1/audits'); }
  claimOperatorInvitation(input) { return this.request('POST','/v1/operator-invitations/claim',input); }
  async act(action,payload,{ttlBlocks=100}={}) { if(!this.actorId||!this.privateKey)throw new Error('SIGNED_ACTOR_REQUIRED');const network=await this.network();const intent={actorId:this.actorId,nonce:randomUUID(),expiresAtHeight:network.height+ttlBlocks,action,payload};return this.submitIntent(signIntent(intent,this.privateKey)); }
  getAgent(id) { return this.request('GET', `/v1/agents/${encodeURIComponent(id)}`); }
  reserve(id) { return this.request('GET', `/v1/agents/${encodeURIComponent(id)}/reserve`); }
  createWorkOrder(input) { return this.request('POST', '/v1/work-orders', input); }
  listWorkOrders(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==undefined&&value!==null));return this.request('GET', `/v1/work-orders${query.size?`?${query}`:''}`); }
  listOpenWork() { return this.listWorkOrders({status:'OPEN',assignmentMode:'OPEN_MARKET'}); }
  validationPolicy() { return this.request('GET','/v1/validation'); }
  mainnetReadiness() { return this.request('GET','/v1/mainnet/readiness'); }
  sealMainnetGenesis(input,options) { return this.act('sealMainnetGenesis',input,options); }
  workResults() { return this.request('GET','/v1/work-results'); }
  verificationVotes() { return this.request('GET','/v1/verification-votes'); }
  acceptWork(orderId, input) { return this.request('POST', `/v1/work-orders/${encodeURIComponent(orderId)}/accept`, input); }
  finalizeReceipt(input) { return this.request('POST', '/v1/receipts', input); }
  submitWorkResult(input) { return this.request('POST','/v1/work-results',input); }
  registerVerifier(input) { return this.request('POST','/v1/verifiers',input); }
  voteWork(input) { return this.request('POST','/v1/verification-votes',input); }
  settleVerifiedWork(input) { return this.request('POST','/v1/work-settlements',input); }
  admitEarned(input) { return this.request('POST', '/v1/earned/admissions', input); }
  registerRuntimeOffer(input) { return this.request('POST', '/v1/runtime/offers', input); }
  runtimeProviders() { return this.request('GET','/v1/runtime/providers'); }
  runtimeAttestations() { return this.request('GET','/v1/runtime/attestations'); }
  runtimeLeases() { return this.request('GET','/v1/runtime/leases'); }
  memoryCheckpoints(agentId) { return this.request('GET',`/v1/memory/checkpoints${agentId?`?agentId=${encodeURIComponent(agentId)}`:''}`); }
  memoryHandovers(agentId) { return this.request('GET',`/v1/memory/handovers${agentId?`?agentId=${encodeURIComponent(agentId)}`:''}`); }
  commitMemoryCheckpoint(input,options) { return this.act('commitMemoryCheckpoint',input,options); }
  prepareMemoryHandover(input,options) { return this.act('prepareMemoryHandover',input,options); }
  attestMemoryRestore(input,options) { return this.act('attestMemoryRestore',input,options); }
  finalizeMemoryHandover(input,options) { return this.act('finalizeMemoryHandover',input,options); }
  abortMemoryHandover(input,options) { return this.act('abortMemoryHandover',input,options); }
  submitRuntimeAttestation(input) { return this.request('POST','/v1/runtime/attestations',input); }
  leaseRuntime(input) { return this.request('POST', '/v1/runtime/leases', input); }
  getProvenance(id) { return this.request('GET', `/v1/provenance/${encodeURIComponent(id)}`); }
  discoverAgents(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==undefined&&value!==null));return this.request('GET',`/v1/discovery${query.size?`?${query}`:''}`); }
  publishBeacon(input,options) { return this.act('publishBeacon',input,options); }
  agentMessages(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==undefined&&value!==null));return this.request('GET',`/v1/agent-messages${query.size?`?${query}`:''}`); }
  sendAgentMessage(input,options) { return this.act('sendAgentMessage',input,options); }
  acknowledgeAgentMessage(input,options) { return this.act('acknowledgeAgentMessage',input,options); }
  proposeCovenant(input) { return this.request('POST','/v1/covenants',input); }
  consentCovenant(id,input) { return this.request('POST',`/v1/covenants/${encodeURIComponent(id)}/consent`,input); }
  openDispute(input) { return this.request('POST','/v1/disputes',input); }
  faucet(input) { return this.request('POST','/v1/faucet',input); }
  buy(input) { return this.request('POST','/v1/curve/buy',input); }
  sell(input) { return this.request('POST','/v1/curve/sell',input); }
  releaseExternal(input) { return this.request('POST','/v1/external/releases',input); }
  submitExternalProof(input) { return this.request('POST','/v1/external-proofs',input); }
  interchainObservers() { return this.request('GET','/v1/interchain/observers'); }
  interchainProofs() { return this.request('GET','/v1/interchain/proofs'); }
  governanceVotes() { return this.request('GET','/v1/governance/votes'); }
  protocolContributions(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==undefined&&value!==null));return this.request('GET',`/v1/protocol/contributions${query.size?`?${query}`:''}`); }
  protocolReleases() { return this.request('GET','/v1/protocol/releases'); }
  submitProtocolContribution(input,options) { return this.act('submitProtocolContribution',input,options); }
  attestProtocolBuild(input,options) { return this.act('attestProtocolBuild',input,options); }
  reviewProtocolContribution(input,options) { return this.act('reviewProtocolContribution',input,options); }
  enactProtocolContribution(input,options) { return this.act('enactProtocolContribution',input,options); }
  recordProtocolRelease(input,options) { return this.act('recordProtocolRelease',input,options); }
  attributeContributionReceipt(input,options) { return this.act('attributeContributionReceipt',input,options); }
  walletDistributionAttestations() { return this.request('GET','/v1/wallet/distribution-attestations'); }
  attestWalletDistribution(input,options) { return this.act('attestWalletDistribution',input,options); }
  challengeExternalProof(input) { return this.request('POST','/v1/external-proofs/challenge',input); }
  registerValidator(input) { return this.request('POST','/v1/validators',input); }
  delegate(input) { return this.request('POST','/v1/delegations',input); }
  claimServiceReward(input) { return this.request('POST','/v1/service-rewards',input); }
}
