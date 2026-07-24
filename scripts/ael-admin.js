#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { AelClient } from '../src/sdk.js';
const [action,payloadText]=process.argv.slice(2),baseUrl=process.env.AEL_URL??'https://ael-network.onrender.com',actorId=process.env.AEL_ACTOR_ID??'ael-admin',keyPath=process.env.AEL_ACTOR_KEY??'.ael/railway-admin-private.pem';
if(!action||!payloadText){console.error("Usage: node scripts/ael-admin.js <engine-action> '<payload-json>'");process.exit(2)}
const client=new AelClient(baseUrl,{actorId,privateKey:readFileSync(keyPath,'utf8')});console.log(JSON.stringify(await client.act(action,JSON.parse(payloadText)),null,2));
