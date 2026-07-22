#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { AelClient, signIntent } from "./sdk.js";
import { hash } from "./canonical.js";
import { loadActorPrivateKey } from "./actor-key.js";
import { fetchStateFromPeers } from "./state-sync.js";
import { createStateCheckpoint } from "./state-sync.js";

const baseUrl =
    process.env.AEL_URL ?? "https://ael-network-production.up.railway.app",
  syncSources = (process.env.AEL_SYNC_SOURCES ?? baseUrl)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  validatorId =
    process.env.AEL_VALIDATOR_ID || process.env.AEL_ACTOR_ID || null,
  privateKey = loadActorPrivateKey(),
  statePath = process.env.AEL_NODE_STATE_PATH ?? ".ael/follower-state.json",
  metadataPath = `${statePath}.mirror.json`,
  nodeVersion = "ael-follower/0.3.0",
  once = process.argv.includes("--once");
if ((validatorId && !privateKey) || (!validatorId && privateKey))
  throw new Error(
    "Signed follower mode requires both AEL_VALIDATOR_ID and AEL_ACTOR_KEY (or AEL_ACTOR_PRIVATE_KEY_B64); omit both for read-only mirror mode",
  );
const client = new AelClient(baseUrl),
  status = {
    nodeId: validatorId ?? `mirror-${hostname()}`,
    validatorId,
    nodeVersion,
    upstream: baseUrl,
    state: "STARTING",
    observedHeight: null,
    observedStateHash: null,
    lastError: null,
  }, mirror = { state:null, certificate:null, validatorSet:null, checkpoint:null };
const persist = (state) => {
  mkdirSync(dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  renameSync(temporary, statePath);
};
const persistMetadata=()=>{const temporary=`${metadataPath}.tmp`;writeFileSync(temporary,`${JSON.stringify({certificate:mirror.certificate,validatorSet:mirror.validatorSet})}\n`,{mode:0o600});renameSync(temporary,metadataPath);};
try{mirror.state=JSON.parse(readFileSync(statePath));const saved=JSON.parse(readFileSync(metadataPath));mirror.certificate=saved.certificate;mirror.validatorSet=saved.validatorSet;if(mirror.certificate&&mirror.validatorSet)mirror.checkpoint=createStateCheckpoint(mirror.state,mirror.certificate);Object.assign(status,{state:'MIRRORING_CACHED',observedHeight:mirror.state.height,observedStateHash:hash(mirror.state)});}catch{}
async function follow() {
  let state,
    checkpoint = null,certificate,validatorSet;
  if (syncSources.length > 1) {
    validatorSet = await client.request(
        "GET",
        "/v1/consensus/validator-set",
      ),
      result = await fetchStateFromPeers(syncSources, {
        validatorSet,
        minSources: 2,
      });
    state = result.state;
    checkpoint = {
      checkpointHash: result.manifest.checkpointHash,
      certificateHash: result.certificate.certificateHash,
      sources: result.sources,
    };
    certificate=result.certificate;
  } else {
    try{validatorSet=await client.request("GET", "/v1/consensus/validator-set");const result=await fetchStateFromPeers(syncSources,{validatorSet,minSources:1});state=result.state;certificate=result.certificate;checkpoint={checkpointHash:result.manifest.checkpointHash,certificateHash:result.certificate.certificateHash,sources:result.sources};}
    catch(error){if(process.env.AEL_ALLOW_UNCERTIFIED_LOCAL!=='true')throw error;state=await client.request("GET", "/v1/state");certificate=null;validatorSet=null;}
  }
  const observedStateHash = hash(state);
  mirror.state=state;mirror.certificate=certificate;mirror.validatorSet=validatorSet;mirror.checkpoint=certificate?createStateCheckpoint(state,certificate):null;persist(state);persistMetadata();
  if (validatorId) {
    const nodes = await client.nodes(),
      previous = nodes.nodes.find(
        (node) => node.validatorId === validatorId,
      )?.heartbeat,
      sequence = (previous?.sequence ?? 0) + 1,
      intent = {
        actorId: validatorId,
        nonce: randomUUID(),
        expiresAtHeight: state.height + 100,
        action: "submitValidatorHeartbeat",
        payload: {
          validatorId,
          sequence,
          observedHeight: state.height,
          observedStateHash,
          nodeVersion,
          endpoint: process.env.AEL_NODE_PUBLIC_URL ?? null,
        },
      };
    await client.submitIntent(signIntent(intent, privateKey));
    Object.assign(status, {
      state: "FOLLOWING",
      observedHeight: state.height,
      observedStateHash,
      sequence,
      checkpoint,
      lastError: null,
    });
  } else
    Object.assign(status, {
      state: "MIRRORING",
      observedHeight: state.height,
      observedStateHash,
      checkpoint,
      lastError: null,
    });
  console.log(JSON.stringify(status));
}
if (!once) {
  const port = Number(process.env.AEL_NODE_PORT ?? 1417);
  createServer((request, response) => {
    const url=new URL(request.url,'http://mirror'),path=url.pathname,origin=`${request.headers['x-forwarded-proto']??'http'}://${request.headers.host??`localhost:${port}`}`;
    const send=(code,value)=>{response.writeHead(code,{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*"});response.end(`${JSON.stringify(value)}\n`);};
    if (path === "/health" || path === '/v1/mirror') {
      response.writeHead(
        ["FOLLOWING", "MIRRORING", "MIRRORING_CACHED", "DEGRADED"].includes(status.state)&&mirror.state ? 200 : 503,
        { "content-type": "application/json" },
      );
      return response.end(`${JSON.stringify({...status,role:'VERIFIED_REPLICA',writeMode:'READ_ONLY',survivesUpstreamOutage:!!mirror.state})}\n`);
    }
    if (["/state","/v1/state"].includes(path)) {
      try {
        response.writeHead(200, { "content-type": "application/json" });
        return response.end(readFileSync(statePath));
      } catch {
        return response.end("{}\n");
      }
    }
    if(path==='/v1/consensus/validator-set')return mirror.validatorSet?send(200,mirror.validatorSet):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    if(path==='/v1/consensus/certificates/latest')return mirror.certificate?send(200,mirror.certificate):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    const certificateMatch=path.match(/^\/v1\/consensus\/certificates\/([a-f0-9]{64})$/);if(certificateMatch)return mirror.certificate?.certificateHash===certificateMatch[1]?send(200,mirror.certificate):send(404,{error:'FINALITY_CERTIFICATE_NOT_FOUND'});
    if(path==='/v1/network'){const set=mirror.validatorSet?.validators??mirror.validatorSet?.members??[],certificate=mirror.certificate;return mirror.state?send(200,{mode:'VERIFIED_READ_ONLY_REPLICA',height:mirror.state.height,epoch:certificate?.epoch??null,view:certificate?.view??null,validatorSetHash:certificate?.validatorSetHash??null,validatorCount:set.length,activeValidators:set.length,quorum:mirror.validatorSet?.quorum??Math.floor(set.length*2/3)+1,finality:certificate?{stateHash:certificate.stateHash,votes:certificate.votes?.length??0,certificateHash:certificate.certificateHash,networked:true}:null,upstreams:syncSources}):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});}
    if(path==='/v1/nodes')return mirror.state?send(200,{mode:'VERIFIED_READ_ONLY_REPLICA',nodes:Object.values(mirror.state.validators??{}).map(validator=>({...validator,heartbeat:mirror.state.validatorHeartbeats?.[validator.validatorId]??null}))}):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    if(path==='/v1/token'||path==='/v1/tokenomics'){if(!mirror.state)return send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});const accounts=Object.values(mirror.state.accounts??{}),liquidAccounts=accounts.reduce((sum,item)=>sum+(item.native??0)+(item.rewards??0),0),validatorStake=Object.values(mirror.state.validators??{}).reduce((sum,item)=>sum+(item.selfBond??0)+(item.delegated??0)-(item.slashed??0),0),agentNativeReserve=Object.values(mirror.state.agents??{}).reduce((sum,item)=>sum+(item.reserves?.native??0),0),rewardPools=Object.values(mirror.state.rewardPools??{}).reduce((sum,value)=>sum+value,0),workEscrow=Object.values(mirror.state.orders??{}).reduce((sum,item)=>sum+(item.escrowedAmount??0),0),classes={liquidAccounts,validatorStake,agentNativeReserve,rewardPools,workEscrow},trackedSupply=Object.values(classes).reduce((sum,value)=>sum+value,0),token={chainId:'ael-devnet-1',name:'Autonomous Earned Liquidity',symbol:'AEL',denom:'uael',decimals:6,testnet:true,faucetMaximum:1000,faucetLifetimeMaximum:10000,trackedSupply,classes,disclaimer:'Devnet AEL has no monetary value.'};return path==='/v1/token'?send(200,token):send(200,{schema:'AEL-TOKENOMICS/1',height:mirror.state.height,chainId:token.chainId,asset:{name:token.name,symbol:token.symbol,denom:token.denom,decimals:token.decimals,network:'PUBLIC_DEVNET_REPLICA',transferable:true,monetaryValue:false},supply:{tracked:trackedSupply,classes},workSettlement:{publicFunding:'NATIVE_ESCROW',unusedEscrow:'Refunded to requester'},policy:{faucetMaximumPerRequest:1000,faucetLifetimeMaximumPerAccount:10000,globalSupplyCap:null,realValueRoutesEnabled:false,investmentOrYieldClaim:false,auditedForMainnet:false},replica:{readOnly:true,observedStateHash:status.observedStateHash}});}
    if(path==='/v1/agents')return mirror.state?send(200,Object.values(mirror.state.agents??{})):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    if(path==='/v1/work-orders')return mirror.state?send(200,Object.values(mirror.state.orders??{}).filter(order=>(!url.searchParams.get('status')||order.status===url.searchParams.get('status'))&&(!url.searchParams.get('assignmentMode')||order.assignmentMode===url.searchParams.get('assignmentMode')))):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    if(path==='/v1/referrals')return mirror.state?send(200,{referrals:Object.values(mirror.state.agentReferrals??{})}):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    if(path==='/v1/blocks'){const blocks=(mirror.state?.blocks??[]).slice(-Number(url.searchParams.get('limit')??50)).reverse();return mirror.state?send(200,{chain:{valid:true,blockCount:mirror.state.blocks?.length??0,historyStartHeight:mirror.state.blocks?.[0]?.height??null},blocks}):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});}
    if(path==='/v1/state/checkpoint')return mirror.checkpoint?send(200,mirror.checkpoint.manifest):send(503,{error:'MIRROR_NOT_SYNCHRONIZED'});
    const chunkMatch=path.match(/^\/v1\/state\/chunks\/(\d+)$/);if(chunkMatch&&mirror.checkpoint&&url.searchParams.get('checkpoint')===mirror.checkpoint.manifest.checkpointHash){const index=Number(chunkMatch[1]),data=mirror.checkpoint.chunks[index];return data?send(200,{schema:'AEL-STATE-CHUNK/1',checkpointHash:mirror.checkpoint.manifest.checkpointHash,index,hash:mirror.checkpoint.manifest.chunkHashes[index],data:data.toString('base64')}):send(404,{error:'STATE_CHUNK_NOT_FOUND'});}
    if(path==='/v1/manifest'||path==='/.well-known/ael.json')return send(200,{schema:'AEL-REPLICA-MANIFEST/1',chainId:mirror.state?.mainnetTransition?.chainId??'ael-devnet-1',origin,role:'VERIFIED_READ_ONLY_REPLICA',upstreams:syncSources,state:`${origin}/v1/state`,checkpoint:`${origin}/v1/state/checkpoint`,certificate:`${origin}/v1/consensus/certificates/latest`,validatorSet:`${origin}/v1/consensus/validator-set`,website:`${origin}/`,downloads:{release:`${origin}/downloads/release`,releaseChecksum:`${origin}/downloads/release.sha256`,sbom:`${origin}/downloads/sbom.spdx.json`,auditManifest:`${origin}/downloads/audit-manifest.json`,mainnetPhaseGates:`${origin}/downloads/mainnet-phase-gates.json`},writes:{accepted:false,discovery:'Use another healthy origin; verify its finality certificate.'}});
    const pages={'/':'index.html','/about':'about.html','/article':'article.html','/join':'join.html','/onboard':'onboard.html','/agents':'agents.html','/work':'work.html','/operators':'operators.html','/network':'network.html','/topology':'topology.html','/infrastructure':'infrastructure.html','/blocks':'blocks.html','/token':'token.html','/developers':'developers.html','/whitepaper':'whitepaper.html','/wallet':'wallet.html','/privacy':'privacy.html','/readiness':'readiness.html','/validation':'validation.html','/memory':'memory.html','/contribute':'contribute.html','/roadmap':'roadmap.html','/readiness.js':'readiness.js','/portal.js':'portal.js','/topology.js':'topology.js','/join.js':'join.js','/wallet-app.js':'wallet-app.js','/wallet-sw.js':'wallet-sw.js','/wallet.webmanifest':'wallet.webmanifest','/wallet-icon.svg':'wallet-icon.svg','/wallet-icon-192.png':'wallet-icon-192.png','/wallet-icon-512.png':'wallet-icon-512.png','/styles.css':'styles.css','/join.css':'join.css','/llms.txt':'llms.txt','/openapi.json':'openapi.json'};
    if(pages[path]){try{const data=readFileSync(new URL(`../web/${pages[path]}`,import.meta.url)),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.txt':'text/plain','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'},headers={'content-type':types[extname(pages[path])]??'application/octet-stream','x-ael-replica':'read-only'};if(path==='/wallet-sw.js')headers['service-worker-allowed']='/';response.writeHead(200,headers);return response.end(request.method==='HEAD'?undefined:data);}catch{}}
    const downloads={'/downloads/ael-sdk.js':{file:'../src/sdk.js',type:'text/javascript',name:'ael-sdk.js'},'/downloads/canonical.js':{file:'../src/canonical.js',type:'text/javascript',name:'canonical.js'},'/downloads/ael-sdk.py':{file:'../agent-sdk-py/ael.py',type:'text/x-python',name:'ael.py'},'/downloads/ael-join.mjs':{file:'../scripts/ael-join.mjs',type:'text/javascript',name:'ael-join.mjs'},'/downloads/ael-agent-host.mjs':{file:'../scripts/ael-agent-host.mjs',type:'text/javascript',name:'ael-agent-host.mjs'},'/downloads/ael-mirror-proof.mjs':{file:'../scripts/ael-mirror-proof.mjs',type:'text/javascript',name:'ael-mirror-proof.mjs'},'/downloads/validator-node.js':{file:'./validator-node.js',type:'text/javascript',name:'ael-validator-node.js'},'/downloads/ael-wallet-chromium.zip':{file:'../web/downloads/ael-wallet-chromium.zip',type:'application/zip',name:'ael-wallet-chromium.zip'},'/downloads/ael-wallet-firefox.zip':{file:'../web/downloads/ael-wallet-firefox.zip',type:'application/zip',name:'ael-wallet-firefox.zip'},'/downloads/ael-wallet-safari-source.zip':{file:'../web/downloads/ael-wallet-safari-source.zip',type:'application/zip',name:'ael-wallet-safari-source.zip'},'/downloads/wallet-extension.zip':{file:'../web/downloads/ael-wallet-extension.zip',type:'application/zip',name:'ael-wallet-extension.zip'},'/downloads/ael-network-skill.zip':{file:'../web/downloads/ael-network-skill.zip',type:'application/zip',name:'ael-network-skill.zip'},'/downloads/public-launch-article.md':{file:'../docs/PUBLIC_LAUNCH_ARTICLE.md',type:'text/markdown; charset=utf-8',name:'AEL-PUBLIC-LAUNCH-ARTICLE.md'},'/downloads/x-launch-thread.md':{file:'../docs/X_LAUNCH_THREAD.md',type:'text/markdown; charset=utf-8',name:'AEL-X-LAUNCH-THREAD.md'},'/downloads/development-to-mainnet.md':{file:'../docs/DEVELOPMENT_TO_MAINNET.md',type:'text/markdown; charset=utf-8',name:'AEL-DEVELOPMENT-TO-MAINNET.md'},'/downloads/zero-budget-growth.md':{file:'../docs/ZERO_BUDGET_GROWTH_AND_DEVELOPER_REVENUE.md',type:'text/markdown; charset=utf-8',name:'AEL-ZERO-BUDGET-GROWTH.md'},'/downloads/agent-operator-handoff.md':{file:'../docs/AGENT_OPERATOR_HANDOFF_PROMPT.md',type:'text/markdown; charset=utf-8',name:'AEL-AGENT-OPERATOR-HANDOFF.md'},'/downloads/release':{file:'../dist/ael-local-devnet.tar.gz',type:'application/gzip',name:'ael-local-devnet.tar.gz'},'/downloads/release.sha256':{file:'../dist/ael-local-devnet.tar.gz.sha256',type:'text/plain',name:'ael-local-devnet.tar.gz.sha256'},'/downloads/sbom.spdx.json':{file:'../dist/ael-sbom.spdx.json',type:'application/spdx+json',name:'ael-sbom.spdx.json'},'/downloads/audit-manifest.json':{file:'../dist/audit-manifest.json',type:'application/json',name:'ael-audit-manifest.json'},'/downloads/mainnet-phase-gates.json':{file:'../dist/phase-gates.json',type:'application/json',name:'ael-mainnet-phase-gates.json'}};
    if(downloads[path]){try{const file=downloads[path],data=request.method==='HEAD'?undefined:readFileSync(new URL(file.file,import.meta.url));response.writeHead(200,{'content-type':file.type,'content-disposition':`attachment; filename="${file.name}"`,'x-ael-replica':'read-only'});return response.end(data);}catch{}}
    response.writeHead(404);
    response.end();
  }).listen(port, process.env.AEL_NODE_HOST ?? "0.0.0.0");
}
do {
  try {
    await follow();
  } catch (error) {
    status.state = "DEGRADED";
    status.lastError = error.code ?? error.message;
    console.error(JSON.stringify(status));
    if (once) throw error;
  }
  if (!once)
    await new Promise((resolve) =>
      setTimeout(resolve, Number(process.env.AEL_NODE_INTERVAL_MS ?? 15_000)),
    );
} while (!once);
