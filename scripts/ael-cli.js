#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { AelClient } from '../src/sdk.js';

const [command,...args]=process.argv.slice(2),baseUrl=process.env.AEL_URL??'https://ael-network.onrender.com',actorId=process.env.AEL_ACTOR_ID,keyPath=process.env.AEL_ACTOR_KEY;
const usage=`Usage: npm run cli -- <command> [args]      (reads need no key; writes need AEL_ACTOR_ID and AEL_ACTOR_KEY)

  network                                     chain, height, finality
  balance <accountId>                         native AEL, rewards, and token balances
  blocks [limit]                              latest blocks
  block <height>                              one block header
  tokens                                      user-created token registry
  token <tokenId>                             one token with top holders
  airdrop <amount>                            devnet faucet to the signing account
  transfer <toAccount> <amount>               send native AEL
  create-token <tokenId> <name> <symbol> <decimals> [initialSupply] [supplyCap]
  mint <tokenId> <toAccount> <amount>         mint (requires mint authority)
  send-token <tokenId> <toAccount> <amount>   transfer a custom token
  burn <tokenId> <amount>                     burn from the signing account
  delegate <validatorId> <amount>             stake to a validator
  undelegate <validatorId> <amount>           withdraw stake

Token ids are namespaced: tok-<name>. An NFT is decimals 0 with supplyCap 1.`;
const out=value=>console.log(JSON.stringify(value,null,2));
const reader=new AelClient(baseUrl);
const signer=()=>{if(!actorId||!keyPath){console.error('This command signs an intent: set AEL_ACTOR_ID and AEL_ACTOR_KEY (private key path).');process.exit(2);}return new AelClient(baseUrl,{actorId,privateKey:readFileSync(keyPath,'utf8')})};
const integer=value=>{const parsed=Number(value);if(!Number.isFinite(parsed))throw new Error(`Not a number: ${value}`);return parsed};

switch(command){
  case 'network': out(await reader.request('GET','/v1/network')); break;
  case 'balance': {const accounts=await reader.request('GET','/v1/accounts');out(accounts[args[0]]??{error:'ACCOUNT_NOT_FOUND',accountId:args[0]});break;}
  case 'blocks': out((await reader.blocks(args[0]??10)).blocks); break;
  case 'block': {const height=integer(args[0]);const {blocks}=await reader.request('GET',`/v1/blocks?before=${height+1}&limit=1`);out(blocks[0]?.height===height?blocks[0]:{error:'BLOCK_NOT_FOUND',height});break;}
  case 'tokens': out(await reader.tokens()); break;
  case 'token': out(await reader.token(args[0])); break;
  case 'airdrop': out(await signer().act('faucet',{accountId:actorId,amount:integer(args[0])})); break;
  case 'transfer': out(await signer().act('transfer',{fromAccount:actorId,toAccount:args[0],amount:integer(args[1])})); break;
  case 'create-token': {const [tokenId,name,symbol,decimals,initialSupply,supplyCap]=args;out(await signer().createToken({authorityId:actorId,tokenId,name,symbol,decimals:integer(decimals),...(initialSupply?{initialSupply:integer(initialSupply)}:{}),...(supplyCap?{supplyCap:integer(supplyCap)}:{})}));break;}
  case 'mint': out(await signer().mintToken({authorityId:actorId,tokenId:args[0],toAccount:args[1],amount:integer(args[2])})); break;
  case 'send-token': out(await signer().transferToken({fromAccount:actorId,tokenId:args[0],toAccount:args[1],amount:integer(args[2])})); break;
  case 'burn': out(await signer().burnToken({fromAccount:actorId,tokenId:args[0],amount:integer(args[1])})); break;
  case 'delegate': out(await signer().act('delegate',{delegatorId:actorId,validatorId:args[0],amount:integer(args[1])})); break;
  case 'undelegate': out(await signer().undelegate({delegatorId:actorId,validatorId:args[0],amount:integer(args[1])})); break;
  default: console.log(usage); process.exit(command?2:0);
}
