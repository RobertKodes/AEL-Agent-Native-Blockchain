import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { resolve } from 'node:path';

const source=resolve('skills/ael-network'),target=resolve('web/downloads/ael-network-skill.zip'),fixedTime=new Date('2020-01-01T00:00:00.000Z');
const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(name=>walk(`${path}/${name}`)):[path];
mkdirSync(resolve('web/downloads'),{recursive:true});
const entries=walk(source).map(path=>path.slice(source.length+1));
for(const file of walk(source))utimesSync(file,fixedTime,fixedTime);
rmSync(target,{force:true});
execFileSync('zip',['-q','-X',target,...entries],{cwd:source});
console.log('Built deterministic AEL agent skill package.');
