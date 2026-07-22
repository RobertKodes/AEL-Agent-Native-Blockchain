#!/usr/bin/env node
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory=resolve(process.argv[2]??'.ael/consensus');
mkdirSync(directory,{recursive:true,mode:0o700});
const validators=[];
const environment={AEL_BOOTSTRAP_TOKEN:randomBytes(32).toString('hex'),AEL_CONSENSUS_CLUSTER_TOKEN:randomBytes(32).toString('hex')};
for(let number=1;number<=4;number++){
  const id=`validator-${number}`,{privateKey,publicKey}=generateKeyPairSync('ed25519'),privatePem=privateKey.export({type:'pkcs8',format:'pem'}),publicPem=publicKey.export({type:'spki',format:'pem'}),privatePath=`${directory}/${id}.pem`,publicPath=`${directory}/${id}.pub.pem`;
  writeFileSync(privatePath,privatePem,{mode:0o600});writeFileSync(publicPath,publicPem,{mode:0o644});chmodSync(privatePath,0o600);
  environment[`AEL_CONSENSUS_PRIVATE_KEY_${number}_B64`]=Buffer.from(privatePem).toString('base64');
  validators.push({id,url:`http://${id}:1517`,publicKeyB64:Buffer.from(publicPem).toString('base64')});
}
environment.AEL_NETWORK_VALIDATORS=JSON.stringify(validators);
const envPath=`${directory}/compose.env`;
writeFileSync(envPath,Object.entries(environment).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600});chmodSync(envPath,0o600);
writeFileSync(`${directory}/validators.json`,JSON.stringify(validators,null,2)+'\n',{mode:0o644});
console.log(`Created four Ed25519 validator identities in ${directory}`);
console.log(`Start the quorum devnet: docker compose --env-file ${envPath} -f compose.bft.yaml up --build`);
console.log('Secrets were written with owner-only permissions and were not printed.');
