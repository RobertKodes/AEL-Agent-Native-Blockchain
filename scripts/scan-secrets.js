import { readdirSync, readFileSync, statSync } from 'node:fs';

const ignoredDirs=new Set(['.git','.ael','ael-agent','dist','node_modules']),ignoredExtensions=new Set(['.pdf','.docx','.png','.zip','.gz']),allowedPrivateKeyFixtures=new Set(['test-vectors/ed25519-intent.json','test/actor-key.test.js']);
const walk=path=>readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{const child=path==='.'?entry.name:`${path}/${entry.name}`;if(entry.isDirectory())return ignoredDirs.has(entry.name)?[]:walk(child);return statSync(child).size>2_000_000||[...ignoredExtensions].some(extension=>child.endsWith(extension))?[]:[child]});
const patterns=[
  {name:'private key PEM',expression:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
  {name:'GitHub token',expression:/\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/},
  {name:'AWS access key',expression:/\bAKIA[0-9A-Z]{16}\b/},
  {name:'Railway token assignment',expression:/\bRAILWAY_TOKEN\s*=\s*["']?[A-Za-z0-9_-]{20,}/}
];
const findings=[];
for(const file of walk('.')){let value;try{value=readFileSync(file,'utf8')}catch{continue}for(const pattern of patterns)if(pattern.expression.test(value)&&!(pattern.name==='private key PEM'&&allowedPrivateKeyFixtures.has(file)))findings.push(`${pattern.name}: ${file}`)}
if(findings.length)throw new Error(`SECRET_SCAN_FAILED\n${findings.join('\n')}`);
console.log(`Secret scan passed across ${walk('.').length} source files (documented deterministic test fixtures allowed).`);
