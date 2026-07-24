#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { AelClient } from '../src/sdk.js';

const [applicationId,invitationId,expiryText]=process.argv.slice(2);
if(!applicationId||!invitationId){console.error('Usage: npm run approve-operator -- <application-id> <invitation-id> [expires-at-height]');process.exit(2)}
const baseUrl=process.env.AEL_URL??'https://ael-network.onrender.com',actorId=process.env.AEL_ACTOR_ID??'ael-admin',keyPath=process.env.AEL_ACTOR_KEY??'.ael/railway-admin-private.pem';
const client=new AelClient(baseUrl,{actorId,privateKey:readFileSync(keyPath,'utf8')}),application=(await client.listOperatorApplications()).find(item=>item.applicationId===applicationId);
if(!application||application.status!=='PENDING')throw new Error('PENDING_OPERATOR_APPLICATION_NOT_FOUND');
const expiresAtHeight=expiryText===undefined?application.request.maxInvitationExpiryHeight:Number(expiryText);
if(!Number.isInteger(expiresAtHeight)||expiresAtHeight>application.request.maxInvitationExpiryHeight)throw new Error('INVITATION_EXPIRY_EXCEEDS_APPLICATION');
const {maxInvitationExpiryHeight,...requested}=application.request;
const result=await client.act('createOperatorInvitation',{applicationId,invitationId,actorId:application.actorId,publicKeyHash:application.publicKeyHash,...requested,expiresAtHeight});
console.log(JSON.stringify({applicationId,invitationId,actorId:application.actorId,roles:requested.roles,expiresAtHeight,height:result.height,stateHash:result.stateHash},null,2));
