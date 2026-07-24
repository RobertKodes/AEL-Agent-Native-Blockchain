#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPublicKey, randomUUID } from 'node:crypto';
import { AelClient, createLocalAuthority, publicKeyFingerprint, signOperatorClaim } from '../src/sdk.js';

const [command,actorId,argument]=process.argv.slice(2),baseUrl=process.env.AEL_URL??'https://ael-network.onrender.com';
if(!['generate','apply','claim'].includes(command)||!actorId||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(actorId)){
  console.error('Usage: node scripts/ael-operator.js generate <actor-id> | apply <actor-id> <request-json-path> | claim <actor-id> <invitation-id>');process.exit(2);
}
const directory='.ael/operators',privatePath=`${directory}/${actorId}-private.pem`,publicPath=`${directory}/${actorId}-public.pem`;
if(command==='generate'){
  mkdirSync(directory,{recursive:true});const keys=createLocalAuthority();
  writeFileSync(privatePath,keys.privateKey,{mode:0o600,flag:'wx'});writeFileSync(publicPath,keys.publicKey,{mode:0o644,flag:'wx'});
  console.log(JSON.stringify({actorId,publicKeyFingerprint:publicKeyFingerprint(keys.publicKey),publicKeyPath:publicPath,privateKeyPath:privatePath},null,2));
}else if(command==='apply'){
  if(!argument){console.error('Application request JSON path is required');process.exit(2)}
  const privateKey=readFileSync(privatePath,'utf8'),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'}),input=JSON.parse(readFileSync(argument,'utf8'));
  const application={applicationId:input.applicationId,actorId,publicKey,publicKeyHash:publicKeyFingerprint(publicKey),nonce:randomUUID(),request:input.request};
  const result=await new AelClient(baseUrl).submitOperatorApplication(signOperatorClaim(application,privateKey));
  console.log(JSON.stringify({actorId,applicationId:application.applicationId,height:result.height,stateHash:result.stateHash,status:result.status??'PENDING',autoApproved:result.autoApproved??false,invitationId:result.invitationId??null},null,2));
}else{
  const invitationId=argument;if(!invitationId){console.error('Invitation ID is required');process.exit(2)}
  const privateKey=readFileSync(privatePath,'utf8'),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'});
  const claim={invitationId,actorId,publicKey,nonce:randomUUID()};
  const result=await new AelClient(baseUrl).claimOperatorInvitation(signOperatorClaim(claim,privateKey));
  console.log(JSON.stringify({actorId,invitationId,height:result.height,stateHash:result.stateHash},null,2));
}
