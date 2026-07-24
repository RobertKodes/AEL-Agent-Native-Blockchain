#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [command,agentId,keyArgument]=process.argv.slice(2),configPath='.ael/agent-node.json';
const fail=message=>{console.error(message);process.exit(2)},safeId=value=>/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(value??'');
const load=()=>{if(!existsSync(configPath))fail('Run: npm run agent-node -- setup <agent-id> <private-key.pem>');return JSON.parse(readFileSync(configPath,'utf8'))};
if(command==='setup'){
  if(!safeId(agentId)||!keyArgument)fail('Usage: npm run agent-node -- setup <agent-id> <private-key.pem>');
  const keyPath=resolve(keyArgument);if(!existsSync(keyPath)||!statSync(keyPath).isFile())fail(`Private key file not found: ${keyPath}`);chmodSync(keyPath,0o600);
  const url=(process.env.AEL_URL??'https://ael-network.onrender.com').replace(/\/$/,'');
  const response=await fetch(`${url}/v1/agents/${encodeURIComponent(agentId)}`),agent=await response.json();if(!response.ok||agent.status!=='ACTIVE')fail(`Active agent not found on ${url}: ${agent.error??agent.status??response.status}`);
  mkdirSync('.ael',{recursive:true,mode:0o700});writeFileSync(configPath,JSON.stringify({agentId,keyPath,url},null,2)+'\n',{mode:0o600});chmodSync(configPath,0o600);
  console.log(`Configured ${agentId}. The key remains at ${keyPath} and will be mounted read-only.`);console.log('Start worker + verified chain copy: npm run agent-node -- start');
}else if(command==='start'||command==='stop'){
  const config=load(),args=['compose','-f','compose.agent-node.yaml',command==='start'?'up':'down',...(command==='start'?['--build','-d']:[])],result=spawnSync('docker',args,{stdio:'inherit',env:{...process.env,AEL_URL:config.url,AEL_AGENT_ID:config.agentId,AEL_AGENT_KEY_PATH:config.keyPath}});if(result.error)fail(result.error.message);process.exit(result.status??1);
}else if(command==='status'){
  const config=load(),[agent,mirror]=await Promise.all([fetch(`${config.url}/v1/agents/${encodeURIComponent(config.agentId)}`).then(r=>r.json()),fetch('http://127.0.0.1:1417/health').then(r=>r.json()).catch(()=>({state:'OFFLINE'}))]);console.log(JSON.stringify({agent,mirror},null,2));
}else fail('Usage: npm run agent-node -- setup <agent-id> <private-key.pem> | start | status | stop');
