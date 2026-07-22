#!/usr/bin/env node
import { AelClient } from './sdk.js';
import { loadActorPrivateKey } from './actor-key.js';

const baseUrl=process.env.AEL_URL??'http://127.0.0.1:1317',providerId=process.env.AEL_PROVIDER_ID,offerId=process.env.AEL_RUNTIME_OFFER_ID,privateKey=loadActorPrivateKey(),once=process.argv.includes('--once');
if(!providerId||!offerId||!privateKey)throw new Error('AEL_PROVIDER_ID, AEL_RUNTIME_OFFER_ID, and an actor private key are required');
const client=new AelClient(baseUrl,{actorId:process.env.AEL_ACTOR_ID??providerId,privateKey});
async function operate(){
  const state=await client.request('GET','/v1/state');
  if(!state.runtimeOffers[offerId])await client.act('registerRuntimeOffer',{offerId,providerId,faultDomain:process.env.AEL_FAULT_DOMAIN,profile:process.env.AEL_ATTESTATION_PROFILE??'R0',measurement:process.env.AEL_RUNTIME_MEASUREMENT??'ael-runtime-r0',pricePerHour:Number(process.env.AEL_PRICE_PER_HOUR??0)});
  if(process.env.AEL_PROVIDER_HEARTBEAT==='true')for(const lease of Object.values(state.runtimeLeases).filter(x=>x.status==='ACTIVE'&&x.providerId===providerId)){const sequence=(lease.lastHeartbeatSequence??0)+1;await client.act('submitRuntimeHeartbeat',{leaseId:lease.leaseId,providerId,sequence,checkpointRoot:state.runtimes[lease.agentId].checkpointRoot,measurement:state.runtimeOffers[lease.offerId].measurement});console.log(JSON.stringify({providerId,leaseId:lease.leaseId,sequence,status:'HEARTBEAT'}));}
}
do{try{await operate()}catch(error){console.error(JSON.stringify({role:'runtime-provider',providerId,error:error.message}));if(once)throw error}if(!once)await new Promise(resolve=>setTimeout(resolve,Number(process.env.AEL_PROVIDER_INTERVAL_MS??60_000)));}while(!once);
