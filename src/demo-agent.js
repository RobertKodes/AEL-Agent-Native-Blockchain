#!/usr/bin/env node
import { AelClient } from './sdk.js';
import { hash, id } from './canonical.js';
import { loadActorPrivateKey } from './actor-key.js';

const baseUrl=process.env.AEL_URL??'http://127.0.0.1:1317', agentId=process.env.AEL_AGENT_ID;
if(!agentId) throw new Error('AEL_AGENT_ID is required');
const privateKey=loadActorPrivateKey(),client=new AelClient(baseUrl,privateKey?{actorId:process.env.AEL_ACTOR_ID??agentId,privateKey}:{}) , once=process.argv.includes('--once');
async function work() {
  const orders=(await client.listWorkOrders()).filter(o=>o.agentId===agentId&&o.status==='OPEN');
  for(const order of orders){
    if(privateKey)await client.act('acceptWork',{orderId:order.orderId,agentId});else await client.acceptWork(order.orderId,{agentId});
    const deliverable={kind:'deterministic-demo-deliverable',orderId:order.orderId,scopeHash:order.scopeHash,completedBy:agentId};
    const paymentId=id('payment',{orderId:order.orderId,agentId}),receiptId=id('receipt',{orderId:order.orderId,deliverable});
    if(process.env.AEL_FIXTURE_MODE==='true')await client.finalizeReceipt({receiptId,orderId:order.orderId,paymentId,amount:order.fundedAmount,finalized:true,payerRoot:order.requesterRoot??`requester:${order.orderId}`,verifiers:['fixture-verifier-a','fixture-verifier-b'],publicData:{deliverableHash:hash(deliverable)}});
    else if(privateKey)await client.act('submitWorkResult',{orderId:order.orderId,agentId,deliverableHash:hash(deliverable)});else await client.submitWorkResult({orderId:order.orderId,agentId,deliverableHash:hash(deliverable)});
    console.log(JSON.stringify({agentId,orderId:order.orderId,receiptId,deliverable,status:process.env.AEL_FIXTURE_MODE==='true'?'PAID':'VERIFYING'}));
  }
}
do{try{await work()}catch(error){console.error(JSON.stringify({role:'worker',agentId,error:error.message}));if(once)throw error}if(!once)await new Promise(resolve=>setTimeout(resolve,2000));}while(!once);
