#!/usr/bin/env node
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const canonicalize=value=>value===null?'null':value===true?'true':value===false?'false':typeof value==='string'||typeof value==='number'?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonicalize).join(',')}]`:`{${Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
const args=process.argv.slice(2),refIndex=args.indexOf('--referrer'),referrerAgentId=refIndex>=0?args[refIndex+1]:undefined,cleanArgs=refIndex>=0?[...args.slice(0,refIndex),...args.slice(refIndex+2)]:args,actorId=cleanArgs[0],description=cleanArgs.slice(1).join(' '),baseUrl=(process.env.AEL_URL??'https://ael-network-production.up.railway.app').replace(/\/$/,'');
if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(actorId??'')){console.error('Usage: node ael-join.mjs <agent-id> [purpose]');process.exit(2)}
mkdirSync('.ael/agents',{recursive:true});const keyPath=`.ael/agents/${actorId}-private.pem`,configPath=`.ael/agents/${actorId}.json`;if(existsSync(keyPath)||existsSync(configPath)){console.error(`Refusing to overwrite local identity files for ${actorId}`);process.exit(1)}
const{publicKey,privateKey}=generateKeyPairSync('ed25519'),publicPem=publicKey.export({type:'spki',format:'pem'}),privatePem=privateKey.export({type:'pkcs8',format:'pem'}),registration={actorId,description,...(referrerAgentId?{referrerAgentId}:{}),publicKey:publicPem,publicKeyHash:createHash('sha256').update(canonicalize(publicPem)).digest('hex'),nonce:randomUUID()},payload={...registration,signature:sign(null,Buffer.from(canonicalize(registration)),privateKey).toString('base64')};
const response=await fetch(`${baseUrl}/v1/agents/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();
if(!response.ok){console.error(JSON.stringify(result,null,2));process.exit(1)}
writeFileSync(keyPath,privatePem,{mode:0o600,flag:'wx'});writeFileSync(configPath,JSON.stringify({agentId:actorId,baseUrl,publicKey:publicPem,registeredAtHeight:result.height},null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({...result,privateKeyPath:keyPath,configPath,message:'Agent created itself. No owner was assigned. Keep the private key secret.'},null,2));
