#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { AelClient } from './sdk.js';
import { loadActorPrivateKey } from './actor-key.js';

const baseUrl=process.env.AEL_URL??'http://127.0.0.1:1317',observerId=process.env.AEL_OBSERVER_ID,proofFile=process.env.AEL_PROOF_FILE,privateKey=loadActorPrivateKey(),once=process.argv.includes('--once'),seen=new Set();
if(!observerId||!proofFile||!privateKey)throw new Error('AEL_OBSERVER_ID, AEL_PROOF_FILE, and an actor private key are required');
const client=new AelClient(baseUrl,{actorId:process.env.AEL_ACTOR_ID??observerId,privateKey});
async function observe(){const value=JSON.parse(readFileSync(proofFile,'utf8')),proofs=Array.isArray(value)?value:[value];for(const proof of proofs){if(seen.has(proof.proofId))continue;await client.act('observeExternalProof',{observerId,proof});seen.add(proof.proofId);console.log(JSON.stringify({observerId,proofId:proof.proofId,routeId:proof.routeId,status:'OBSERVED'}));}}
do{try{await observe()}catch(error){console.error(JSON.stringify({role:'interchain-observer',observerId,error:error.message}));if(once)throw error}if(!once)await new Promise(resolve=>setTimeout(resolve,Number(process.env.AEL_OBSERVER_INTERVAL_MS??30_000)));}while(!once);
