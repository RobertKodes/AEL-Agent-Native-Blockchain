#!/usr/bin/env node
import { spawn } from 'node:child_process';

const providerKey=process.env.AEL_PROVIDER_PRIVATE_KEY_B64;
if(!providerKey)throw new Error('AEL_PROVIDER_PRIVATE_KEY_B64 is required for the combined role');
const verifier=spawn(process.execPath,['src/demo-verifier.js'],{env:process.env,stdio:'inherit'});
const provider=spawn(process.execPath,['src/demo-runtime-provider.js'],{env:{...process.env,AEL_ROLE:'runtime-provider',AEL_ACTOR_ID:process.env.AEL_PROVIDER_ID,AEL_ACTOR_PRIVATE_KEY_B64:providerKey},stdio:'inherit'});
const children=[verifier,provider];
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{for(const child of children)child.kill(signal)});
await new Promise((resolve,reject)=>{for(const child of children){child.once('error',reject);child.once('exit',(code,signal)=>{for(const other of children)if(other!==child)other.kill('SIGTERM');code===0||signal?resolve():reject(new Error(`Combined actor child exited with code ${code}`));});}});
