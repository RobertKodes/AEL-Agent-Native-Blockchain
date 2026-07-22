#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const digest=path=>{const data=readFileSync(path);return{path,size:data.length,sha256:createHash('sha256').update(data).digest('hex')}};
const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(name=>walk(`${path}/${name}`)):[path];
const specifications=readdirSync('.').filter(name=>/^AEL_Fisa_Tehnica_Capitolul_\d+_.+\.(docx|pdf)$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const implementationRoots=['package.json','README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','.github','Dockerfile','Dockerfile.actor','Dockerfile.node','Dockerfile.consensus','compose.yaml','compose.node.yaml','compose.mirror.yaml','compose.agent-node.yaml','compose.bft.yaml','.gitignore','agent-sdk-py','docs','ops','scripts','skills','src','test','test-vectors','wallet-extension','web'];
const implementation=implementationRoots.flatMap(walk).filter(path=>path!=='ops/railway-deployment.json').sort();
const manifest={schema:'AEL-AUDIT-MANIFEST/1',specification:'AEL/0.13',specifications:specifications.map(digest),implementation:implementation.map(digest)};
writeFileSync(process.argv[2]??'dist/audit-manifest.json',`${JSON.stringify(manifest,null,2)}\n`);
