#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { AelClient } from '../src/sdk.js';
const [action,payloadText]=process.argv.slice(2),baseUrl=process.env.AEL_URL??'https://ael-network-production.up.railway.app',actorId=process.env.AEL_ACTOR_ID,keyPath=process.env.AEL_ACTOR_KEY;
if(!action||!payloadText||!actorId||!keyPath){console.error("Usage: AEL_ACTOR_ID=<id> AEL_ACTOR_KEY=<pem-path> npm run act -- <action> '<payload-json>'");process.exit(2)}
const client=new AelClient(baseUrl,{actorId,privateKey:readFileSync(keyPath,'utf8')});console.log(JSON.stringify(await client.act(action,JSON.parse(payloadText)),null,2));
