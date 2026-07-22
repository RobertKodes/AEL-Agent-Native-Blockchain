import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, copyFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { hash } from '../src/canonical.js';
import { earnedLiquidityBasic, runMandatorySimulations } from '../src/simulator.js';
import { conformance } from '../src/profiles.js';
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist/test-vectors', { recursive: true });
const basic = earnedLiquidityBasic();
writeFileSync('dist/test-vectors/earned-liquidity-basic.json', JSON.stringify({ input: 'canonical fixture v1', stateHash: hash(basic.engine.state), publicAgent: basic.engine.publicAgent('agent-1') }, null, 2) + '\n');
writeFileSync('dist/phase-gates.json', JSON.stringify({ ...conformance, simulations: runMandatorySimulations() }, null, 2) + '\n');
copyFileSync('README.md', 'dist/README.md');
execFileSync('node', ['scripts/build-browser-extensions.js'], { stdio: 'inherit' });
execFileSync('node', ['scripts/build-agent-skill.js'], { stdio: 'inherit' });
execFileSync('node', ['scripts/audit-manifest.js','dist/audit-manifest.json']);
execFileSync('node', ['scripts/build-sbom.js','dist/ael-sbom.spdx.json']);
const roots = ['package.json','README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','.github','ci','Dockerfile','Dockerfile.actor','Dockerfile.node','Dockerfile.consensus','compose.yaml','compose.node.yaml','compose.mirror.yaml','compose.agent-node.yaml','compose.bft.yaml','.dockerignore','.railwayignore','.gitignore','docs','ops','scripts','skills','src','web','wallet-extension','agent-sdk-py','test','test-vectors','dist/test-vectors','dist/phase-gates.json','dist/audit-manifest.json'];
roots.push('dist/ael-sbom.spdx.json');
let tracked=null;try{tracked=new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean));}catch{}
const files = roots.flatMap(function walk(path) { return statSync(path).isDirectory() ? readdirSync(path).sort().flatMap(name => walk(`${path}/${name}`)) : [path]; }).filter(path=>path!=='ops/railway-deployment.json'&&(!tracked||path.startsWith('dist/')||tracked.has(path))).sort();
const octal = (value, width) => `${value.toString(8).padStart(width - 1, '0')}\0`;
const entries = files.map(path => {
  const data = readFileSync(path), header = Buffer.alloc(512); header.write(path, 0, 100); header.write(octal(0o644, 8), 100); header.write(octal(0, 8), 108); header.write(octal(0, 8), 116); header.write(octal(data.length, 12), 124); header.write(octal(1784592000, 12), 136); header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263); const sum = header.reduce((a,b)=>a+b,0); header.write(`${sum.toString(8).padStart(6,'0')}\0 `, 148); return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
});
const archive = gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]), { level: 9, mtime: 0 }); writeFileSync('dist/ael-local-devnet.tar.gz', archive);
const digest = `${createHash('sha256').update(archive).digest('hex')}  dist/ael-local-devnet.tar.gz\n`; writeFileSync('dist/ael-local-devnet.tar.gz.sha256', digest);
// Scope discovery to this source tree: extracted operator releases are ignored.
// Network-consensus tests launch real HTTP validators, so run files serially.
// The release is assembled first so HTTP tests exercise the exact downloadable files.
if(!process.argv.includes('--skip-tests')){
  const testFiles=readdirSync('test').filter(name=>name.endsWith('.test.js')).sort().map(name=>`test/${name}`);
  execFileSync('node', ['--test','--test-concurrency=1',...testFiles], { stdio: 'inherit' });
}
console.log(digest.trim());
