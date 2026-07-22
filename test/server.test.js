import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAelServer } from '../src/server.js';
import { AelClient } from '../src/sdk.js';

test('human and agent API completes marketplace-to-earned flow and persists it', async t => {
  const dir=mkdtempSync(join(tmpdir(),'ael-api-')), statePath=join(dir,'state.json'), app=createAelServer({port:0,statePath});
  const address=await app.listen(), client=new AelClient(`http://127.0.0.1:${address.port}`); t.after(()=>app.close());
  await client.createAgent({agentId:'api-agent',rootPublicKey:'public-only',constitutionRoot:'constitution',virtualLiquidity:1000});
  await client.request('POST','/v1/routes',{routeId:'test-route',realValue:false,cap:1000});
  const work=await client.createWorkOrder({agentId:'api-agent',title:'Human request',fundedAmount:100,scopeHash:'scope'});
  await client.acceptWork(work.orderId,{agentId:'api-agent'});
  const receipt=await client.finalizeReceipt({orderId:work.orderId,paymentId:'payment-api',amount:100,finalized:true,payerRoot:'human-root',verifiers:['v1','v2'],publicData:{deliverableHash:'hash'}});
  await client.admitEarned({agentId:'api-agent',receiptId:receipt.receiptId,routeId:'test-route',lineageId:'evm:1:0',asset:'TEST',provablyControlledValue:100,routeHaircut:.8,agentFundingRoot:'agent-root'});
  assert.equal((await client.reserve('api-agent')).redeemableReserve,80);
  assert.equal((await client.getProvenance('evm:1:0')).recognized,80);
  assert.equal(JSON.parse(readFileSync(statePath)).height,6);
  const network=await client.network(); assert.equal(network.validatorCount,4); assert.equal(network.activeValidators,4); assert.equal(new Set(network.validators.map(v=>v.stateHash)).size,1);
});

test('terminal portal, public network data, downloads, and complete demo are available', async t => {
  const app=createAelServer({port:0,statePath:join(mkdtempSync(join(tmpdir(),'ael-web-')),'state.json')}), address=await app.listen(), base=`http://127.0.0.1:${address.port}`; t.after(()=>app.close());
  for(const route of ['/','/about','/article','/join','/onboard','/agents','/work','/operators','/network','/topology','/infrastructure','/blocks','/token','/developers','/whitepaper','/wallet','/privacy','/readiness','/validation','/memory','/contribute','/roadmap']){
    const response=await fetch(`${base}${route}`); assert.equal(response.status,200,route); assert.match(await response.text(),/<title>[^<]*AEL[^<]*<\/title>/i,route);
  }
  const token=await fetch(`${base}/v1/token`).then(r=>r.json()); assert.equal(token.symbol,'AEL'); assert.equal(token.chainId,'ael-devnet-1'); assert.equal(token.testnet,true);
  const tokenomics=await fetch(`${base}/v1/tokenomics`).then(r=>r.json());assert.equal(tokenomics.schema,'AEL-TOKENOMICS/1');assert.equal(tokenomics.asset.network,'PUBLIC_DEVNET');assert.equal(tokenomics.asset.monetaryValue,false);assert.equal(tokenomics.workSettlement.publicFunding,'NATIVE_ESCROW');assert.equal(tokenomics.policy.faucetLifetimeMaximumPerAccount,10_000);
  const nodes=await fetch(`${base}/v1/nodes`).then(r=>r.json()); assert.equal(nodes.mode,'SIGNED_STATE_FOLLOWERS'); assert.match(nodes.consensusBoundary,/do not join/i);
  const topology=await fetch(`${base}/v1/topology`).then(r=>r.json());assert.equal(topology.schema,'AEL-NETWORK-TOPOLOGY/1');assert.equal(topology.summary.consensusValidators,4);assert.match(topology.locationPolicy,/never geolocates/i);
  const readiness=await fetch(`${base}/v1/mainnet/readiness`).then(r=>r.json());assert.equal(readiness.schema,'AEL-MAINNET-READINESS/1');assert.equal(readiness.ready,false);assert.ok(readiness.summary.blocking.includes('networked-bft'));
  const validation=await fetch(`${base}/v1/validation`).then(r=>r.json());assert.equal(validation.schema,'AEL-POUW-POLICY/1');assert.match(validation.strategy,/EVIDENCE/);
  const manifest=await fetch(`${base}/v1/manifest`).then(r=>r.json());assert.equal(manifest.chainId,'ael-devnet-1');assert.equal(manifest.signing.privateKeysAccepted,false);assert.match(manifest.discovery.tokenomics,/\/v1\/tokenomics$/);assert.match(manifest.onboarding.operatorGuide,/\/operators$/);
  const replicaRegistry=await fetch(`${base}/v1/replicas`).then(r=>r.json());assert.equal(replicaRegistry.schema,'AEL-REPLICA-REGISTRY/1');assert.equal(replicaRegistry.minimumRecommendedOrigins,2);assert.deepEqual(replicaRegistry.replicas,[]);assert.match(manifest.discovery.replicas,/\/v1\/replicas$/);
  const wellKnown=await fetch(`${base}/.well-known/ael.json`).then(r=>r.json());assert.equal(wellKnown.schema,'AEL-NETWORK-MANIFEST/1');
  const walletManifestResponse=await fetch(`${base}/wallet.webmanifest`),walletManifest=await walletManifestResponse.json();assert.match(walletManifestResponse.headers.get('content-type'),/application\/manifest\+json/);assert.equal(walletManifest.display,'standalone');assert.equal(walletManifest.start_url,'/wallet?source=installed');
  const serviceWorker=await fetch(`${base}/wallet-sw.js`);assert.equal(serviceWorker.status,200);assert.equal(serviceWorker.headers.get('service-worker-allowed'),'/');assert.match(await serviceWorker.text(),/ael-wallet-shell-v3/);
  const walletHtml=await fetch(`${base}/wallet`).then(r=>r.text());assert.match(walletHtml,/rel="manifest" href="\/wallet\.webmanifest"/);assert.match(walletHtml,/data-install-wallet/);
  assert.match(walletHtml,/consent-gated dApps/i);const walletRelease=await fetch(`${base}/v1/wallet/releases`).then(r=>r.json());assert.equal(walletRelease.version,'0.6.0');assert.equal(walletRelease.webApp.status,'LIVE');assert.equal(walletRelease.extensions.chrome.installUrl,null);assert.equal(walletRelease.security.rawSigningApi,false);
  assert.match(walletHtml,/id="agent-referrals"/);assert.match(walletHtml,/id="referral-qualified"/);
  const agentsHtml=await fetch(`${base}/agents`).then(r=>r.text());assert.match(agentsHtml,/data-referrals/);assert.match(agentsHtml,/referral-ledger/);
  assert.match(agentsHtml,/two independently controlled agent operators/i);assert.match(agentsHtml,/independent operator page/i);
  const operatorsHtml=await fetch(`${base}/operators`).then(r=>r.text());assert.match(operatorsHtml,/two independently controlled agents/i);assert.match(operatorsHtml,/Never share an AEL private key/i);assert.match(operatorsHtml,/AEL-INDEPENDENT-MIRROR-PROOF\/1/);
  const tokenHtml=await fetch(`${base}/token`).then(r=>r.text());assert.match(tokenHtml,/data-tokenomics-json/);assert.match(tokenHtml,/no global supply cap/i);
  const llms=await fetch(`${base}/llms.txt`).then(r=>r.text());assert.match(llms,/Never transmit a private key/);assert.match(llms,/Seven voting validators/);assert.match(llms,/five agent replicas/);assert.match(llms,/Agent plus node procedure/);
  const openapi=await fetch(`${base}/openapi.json`).then(r=>r.json());assert.equal(openapi.openapi,'3.1.0');
  await fetch(`${base}/v1/work-orders`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:'open-api-work',requesterRoot:'human',title:'Open API task',fundedAmount:10,scopeHash:'scope'})});
  const openWork=await fetch(`${base}/v1/work-orders?status=OPEN&assignmentMode=OPEN_MARKET`).then(r=>r.json());assert.equal(openWork.length,1);assert.equal(openWork[0].agentId,null);
  for(const route of ['/downloads/ael-sdk.js','/downloads/canonical.js','/downloads/ael-sdk.py','/downloads/ael-join.mjs','/downloads/ael-agent-host.mjs','/downloads/ael-mirror-proof.mjs','/downloads/validator-node.js','/downloads/ael-wallet-chromium.zip','/downloads/ael-wallet-firefox.zip','/downloads/ael-wallet-safari-source.zip','/downloads/wallet-extension.zip','/downloads/ael-network-skill.zip','/downloads/public-launch-article.md','/downloads/x-launch-thread.md','/downloads/development-to-mainnet.md','/downloads/zero-budget-growth.md','/downloads/agent-operator-handoff.md']){
    const response=await fetch(`${base}${route}`); assert.equal(response.status,200,route); assert.ok((await response.arrayBuffer()).byteLength>100,route);
  }
  const releaseHash=await fetch(`${base}/downloads/release.sha256`).then(r=>r.text());assert.match(releaseHash,/^[a-f0-9]{64}  dist\/ael-local-devnet\.tar\.gz\n$/);
  const result=await fetch(`${base}/v1/demo`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json());
  const reserve=await fetch(`${base}/v1/agents/${result.agentId}/reserve`).then(r=>r.json()); assert.equal(reserve.redeemableReserve,450);
});

test('runtime marketplace requires distinct fault domains and fails over', async t => {
  const app=createAelServer({port:0,statePath:join(mkdtempSync(join(tmpdir(),'ael-runtime-')),'state.json')}), address=await app.listen(), c=new AelClient(`http://127.0.0.1:${address.port}`); t.after(()=>app.close());
  await c.createAgent({agentId:'runner',rootPublicKey:'pub',constitutionRoot:'const'});
  const a=await c.registerRuntimeOffer({provider:'provider-a',faultDomain:'eu-a',measurement:'runtime-v1',pricePerHour:1}), b=await c.registerRuntimeOffer({provider:'provider-b',faultDomain:'eu-b',measurement:'runtime-v1',pricePerHour:2});
  await c.leaseRuntime({agentId:'runner',offerId:a.offerId,replicaOfferIds:[b.offerId],checkpointRoot:'cp-1',attestation:{kind:'FIXTURE',provider:'provider-a',measurement:'runtime-v1',nonce:'fresh-1',accepted:true}});
  await c.request('POST','/v1/runtime/fail',{agentId:'runner',provider:'provider-a'});
  const state=await c.request('GET','/v1/state'); assert.equal(state.runtimes.runner.active,'provider-b');
});

test('runtime attestation nonce cannot replay and measurement must match policy',async t=>{
  const app=createAelServer({port:0,statePath:join(mkdtempSync(join(tmpdir(),'ael-attest-')),'state.json')}),address=await app.listen(),c=new AelClient(`http://127.0.0.1:${address.port}`);t.after(()=>app.close());
  for(const agentId of ['a','b'])await c.createAgent({agentId,rootPublicKey:`pub-${agentId}`,constitutionRoot:'c'});
  const primary=await c.registerRuntimeOffer({provider:'p',faultDomain:'one',measurement:'good',pricePerHour:1}),replica=await c.registerRuntimeOffer({provider:'q',faultDomain:'two',measurement:'good',pricePerHour:1});
  await assert.rejects(()=>c.leaseRuntime({agentId:'a',offerId:primary.offerId,replicaOfferIds:[replica.offerId],checkpointRoot:'cp',attestation:{kind:'FIXTURE',provider:'p',measurement:'bad',nonce:'n',accepted:true}}),/ATTESTATION_REJECTED/);
  await c.leaseRuntime({agentId:'a',offerId:primary.offerId,replicaOfferIds:[replica.offerId],checkpointRoot:'cp',attestation:{kind:'FIXTURE',provider:'p',measurement:'good',nonce:'n',accepted:true}});
  const another=await c.registerRuntimeOffer({offerId:'second-p-offer',provider:'p',faultDomain:'one',measurement:'good',pricePerHour:1}),anotherReplica=await c.registerRuntimeOffer({offerId:'second-q-offer',provider:'q',faultDomain:'two',measurement:'good',pricePerHour:1});
  await assert.rejects(()=>c.leaseRuntime({agentId:'b',offerId:another.offerId,replicaOfferIds:[anotherReplica.offerId],checkpointRoot:'cp',attestation:{kind:'FIXTURE',provider:'p',measurement:'good',nonce:'n',accepted:true}}),/ATTESTATION_REJECTED/);
});
