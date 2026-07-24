import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';
import { hash } from '../src/canonical.js';

const funded=(accountId,amount=1000)=>{const e=new AelEngine();e.apply('faucet',{accountId,amount});return e};

test('custom token lifecycle: create, mint, transfer, burn conserve supply',()=>{
  const e=funded('alice');
  e.apply('createToken',{authorityId:'alice',tokenId:'tok-compute',name:'Compute Credit',symbol:'CMP',decimals:6,initialSupply:1_000_000,supplyCap:10_000_000});
  assert.equal(e.state.tokens['tok-compute'].supply,1_000_000);
  assert.equal(e.state.accounts.alice.tokens['tok-compute'],1_000_000);
  e.apply('mintToken',{authorityId:'alice',tokenId:'tok-compute',toAccount:'bob',amount:250_000});
  e.apply('transferToken',{fromAccount:'alice',toAccount:'bob',tokenId:'tok-compute',amount:100_000});
  assert.equal(e.state.accounts.bob.tokens['tok-compute'],350_000);
  e.apply('burnToken',{fromAccount:'bob',tokenId:'tok-compute',amount:50_000});
  assert.equal(e.state.tokens['tok-compute'].supply,1_200_000);
  e.assertInvariants();
});

test('token ids are namespaced, unique, and cannot collide with agents',()=>{
  const e=funded('alice');
  assert.throws(()=>e.apply('createToken',{authorityId:'alice',tokenId:'no-prefix',name:'X',symbol:'X',decimals:0}),/TOKEN_ID_INVALID/);
  e.apply('createAgent',{agentId:'tok-agent',rootPublicKey:'p',constitutionRoot:'c'});
  assert.throws(()=>e.apply('createToken',{authorityId:'alice',tokenId:'tok-agent',name:'X',symbol:'X',decimals:0}),/TOKEN_ID_INVALID/);
  e.apply('createToken',{authorityId:'alice',tokenId:'tok-unique',name:'X',symbol:'X',decimals:0});
  assert.throws(()=>e.apply('createToken',{authorityId:'alice',tokenId:'tok-unique',name:'X',symbol:'X',decimals:0}),/TOKEN_ID_INVALID/);
  assert.throws(()=>e.apply('createAgent',{agentId:'tok-unique',rootPublicKey:'p2',constitutionRoot:'c'}),/AGENT_ID_COLLIDES_TOKEN/);
});

test('mint authority and supply cap are enforced',()=>{
  const e=funded('alice');
  e.apply('createToken',{authorityId:'alice',tokenId:'tok-capped',name:'Capped',symbol:'CAP',decimals:0,initialSupply:5,supplyCap:10});
  assert.throws(()=>e.apply('mintToken',{authorityId:'mallory',tokenId:'tok-capped',toAccount:'mallory',amount:1}),/TOKEN_MINT_INVALID/);
  assert.throws(()=>e.apply('mintToken',{authorityId:'alice',tokenId:'tok-capped',toAccount:'alice',amount:6}),/TOKEN_MINT_INVALID/);
  e.apply('mintToken',{authorityId:'alice',tokenId:'tok-capped',toAccount:'alice',amount:5});
  assert.equal(e.state.tokens['tok-capped'].supply,10);
});

test('token transfers require integer balances and reject overdrafts atomically',()=>{
  const e=funded('alice');
  e.apply('createToken',{authorityId:'alice',tokenId:'tok-xyz',name:'X',symbol:'X',decimals:2,initialSupply:100});
  const before=hash(e.state);
  assert.throws(()=>e.apply('transferToken',{fromAccount:'alice',toAccount:'bob',tokenId:'tok-xyz',amount:101}),/TOKEN_TRANSFER_INVALID/);
  assert.throws(()=>e.apply('transferToken',{fromAccount:'alice',toAccount:'bob',tokenId:'tok-xyz',amount:0.5}),/TOKEN_TRANSFER_INVALID/);
  assert.throws(()=>e.apply('burnToken',{fromAccount:'alice',tokenId:'tok-xyz',amount:101}),/TOKEN_BURN_INVALID/);
  assert.equal(hash(e.state),before);
});

test('an NFT is a token with zero decimals and a supply cap of one',()=>{
  const e=funded('artist');
  e.apply('createToken',{authorityId:'artist',tokenId:'tok-genesis-plate',name:'Genesis Plate',symbol:'PLATE',decimals:0,initialSupply:1,supplyCap:1,metadataHash:'a'.repeat(64)});
  assert.throws(()=>e.apply('mintToken',{authorityId:'artist',tokenId:'tok-genesis-plate',toAccount:'artist',amount:1}),/TOKEN_MINT_INVALID/);
  e.apply('transferToken',{fromAccount:'artist',toAccount:'collector',tokenId:'tok-genesis-plate',amount:1});
  assert.equal(e.state.accounts.collector.tokens['tok-genesis-plate'],1);
  assert.equal(e.state.accounts.artist.tokens['tok-genesis-plate'],undefined);
});

test('undelegate returns stake to the delegator and updates validator weight',()=>{
  const e=funded('staker',500);
  e.apply('registerValidator',{validatorId:'val-1',operatorId:'val-1',selfBond:1,consensusPublicKey:'val-pub'});
  e.apply('delegate',{delegatorId:'staker',validatorId:'val-1',amount:200});
  assert.equal(e.state.accounts.staker.native,300);
  e.apply('undelegate',{delegatorId:'staker',validatorId:'val-1',amount:150});
  assert.equal(e.state.accounts.staker.native,450);
  assert.equal(e.state.delegations['staker:val-1'],50);
  assert.throws(()=>e.apply('undelegate',{delegatorId:'staker',validatorId:'val-1',amount:100}),/UNDELEGATION_INVALID/);
});

test('secure intents bind token actions to the signing human',()=>{
  const e=funded('alice');
  e.apply('bootstrapAuthority',{actorId:'admin',publicKey:'admin-pub',roles:['GOVERNOR']});
  e.apply('addAuthority',{actorId:'alice',publicKey:'alice-pub',roles:['HUMAN'],capabilities:[{action:'createToken',expiresAtHeight:9999},{action:'transferToken',maxAmount:1000,expiresAtHeight:9999}]});
  e.apply('executeAuthorized',{actorId:'alice',nonce:'n1',expiresAtHeight:9999,signatureVerified:true,action:'createToken',payload:{authorityId:'alice',tokenId:'tok-signed',name:'Signed',symbol:'SGN',decimals:0,initialSupply:10}});
  assert.equal(e.state.tokens['tok-signed'].supply,10);
  assert.throws(()=>e.apply('executeAuthorized',{actorId:'alice',nonce:'n2',expiresAtHeight:9999,signatureVerified:true,action:'transferToken',payload:{fromAccount:'someone-else',toAccount:'alice',tokenId:'tok-signed',amount:1}}),/HUMAN_ID_MISMATCH/);
});
