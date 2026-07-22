import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root=resolve('dist/browser-extensions'),source=resolve('wallet-extension'),version='0.6.0';
const fixedTime=new Date('2020-01-01T00:00:00.000Z');
const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(name=>walk(`${path}/${name}`)):[path];
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});mkdirSync('web/downloads',{recursive:true});
const base=JSON.parse(readFileSync(`${source}/manifest.json`));
const variants={
  chromium:base,
  firefox:{...base,background:{scripts:['background.js']},browser_specific_settings:{gecko:{id:'wallet@ael.network',strict_min_version:'128.0'},gecko_android:{} }},
  safari:{...base,background:{scripts:['background.js']}}
};
for(const[name,manifest]of Object.entries(variants)){
  const directory=`${root}/${name}`;mkdirSync(directory,{recursive:true});
  for(const entry of ['popup.html','popup.css','popup.js','approval.html','approval.js','background.js','content.js','inpage.js','icons'])cpSync(`${source}/${entry}`,`${directory}/${entry}`,{recursive:true});
  writeFileSync(`${directory}/manifest.json`,`${JSON.stringify(manifest,null,2)}\n`);
  for(const file of walk(directory))utimesSync(file,fixedTime,fixedTime);
}
const packages=[
  ['chromium','ael-wallet-chromium.zip'],
  ['firefox','ael-wallet-firefox.zip'],
  ['safari','ael-wallet-safari-source.zip']
];
for(const[variant,file]of packages){const directory=`${root}/${variant}`,target=resolve(`web/downloads/${file}`),entries=walk(directory).map(path=>path.slice(directory.length+1));rmSync(target,{force:true});execFileSync('zip',['-q','-X',target,...entries],{cwd:directory});}
cpSync('web/downloads/ael-wallet-chromium.zip','web/downloads/ael-wallet-extension.zip');
writeFileSync(`${root}/release.json`,`${JSON.stringify({schema:'AEL-WALLET-EXTENSION-RELEASE/1',version,packages:{chrome:'ael-wallet-chromium.zip',edge:'ael-wallet-chromium.zip',brave:'ael-wallet-chromium.zip',opera:'ael-wallet-chromium.zip',firefox:'ael-wallet-firefox.zip',safariSource:'ael-wallet-safari-source.zip'},distribution:{chrome:'REQUIRES_CHROME_WEB_STORE_REVIEW',edge:'REQUIRES_EDGE_ADDONS_REVIEW',firefox:'REQUIRES_MOZILLA_SIGNATURE',safari:'REQUIRES_APPLE_DEVELOPER_SIGNING'},privateKeyHandling:'LOCAL_ENCRYPTED_VAULT_ONLY'},null,2)}\n`);
console.log(`Built AEL Wallet ${version} packages for Chromium, Firefox, and Safari source conversion.`);
