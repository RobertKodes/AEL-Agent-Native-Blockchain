import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

process.env.TZ='UTC';
const root=resolve('dist/browser-extensions'),source=resolve('wallet-extension'),fixedTime=new Date('2020-01-01T00:00:00.000Z');
const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(name=>walk(`${path}/${name}`)):[path];
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});mkdirSync('web/downloads',{recursive:true});
const base=JSON.parse(readFileSync(`${source}/manifest.json`)),version=base.version;
const variants={
  chromium:base,
  firefox:{...base,background:{scripts:['background.js']},browser_specific_settings:{gecko:{id:'wallet@ael.network',strict_min_version:'142.0',data_collection_permissions:{required:['authenticationInfo','financialAndPaymentInfo','personallyIdentifyingInfo']}}}},
  safari:{...base,background:{scripts:['background.js']}}
};
for(const[name,manifest]of Object.entries(variants)){
  const directory=`${root}/${name}`;mkdirSync(directory,{recursive:true});
  for(const entry of ['popup.html','popup.css','popup.js','privacy.html','approval.html','approval.js','background.js','content.js','inpage.js','icons'])cpSync(`${source}/${entry}`,`${directory}/${entry}`,{recursive:true});
  writeFileSync(`${directory}/manifest.json`,`${JSON.stringify(manifest,null,2)}\n`);
  for(const file of walk(directory))utimesSync(file,fixedTime,fixedTime);
}
const packages=[
  ['chromium','ael-wallet-chrome-store.zip'],
  ['firefox','ael-wallet-firefox.zip'],
  ['safari','ael-wallet-safari-source.zip']
];
for(const[variant,file]of packages){const directory=`${root}/${variant}`,target=resolve(`web/downloads/${file}`),entries=walk(directory).map(path=>path.slice(directory.length+1));rmSync(target,{force:true});execFileSync('zip',['-q','-X',target,...entries],{cwd:directory});}
cpSync('web/downloads/ael-wallet-chrome-store.zip','web/downloads/ael-wallet-edge-store.zip');
cpSync('web/downloads/ael-wallet-chrome-store.zip','web/downloads/ael-wallet-chromium.zip');
cpSync('web/downloads/ael-wallet-chrome-store.zip','web/downloads/ael-wallet-extension.zip');
const artifactNames=['ael-wallet-chrome-store.zip','ael-wallet-edge-store.zip','ael-wallet-chromium.zip','ael-wallet-firefox.zip','ael-wallet-safari-source.zip','ael-wallet-extension.zip'],artifacts=Object.fromEntries(artifactNames.map(name=>{const path=`web/downloads/${name}`;return[name,{sha256:sha256(path),bytes:statSync(path).size}]}));
const release={schema:'AEL-WALLET-EXTENSION-RELEASE/2',version,generatedFrom:'wallet-extension/manifest.json',artifacts,packages:{chrome:'ael-wallet-chrome-store.zip',edge:'ael-wallet-edge-store.zip',brave:'ael-wallet-chrome-store.zip',opera:'ael-wallet-chrome-store.zip',firefox:'ael-wallet-firefox.zip',safariSource:'ael-wallet-safari-source.zip'},distribution:{chrome:'REQUIRES_CHROME_WEB_STORE_REVIEW',edge:'REQUIRES_EDGE_ADDONS_REVIEW',firefox:'REQUIRES_MOZILLA_SIGNATURE',safari:'REQUIRES_APPLE_DEVELOPER_SIGNING'},permissions:{required:['storage'],optionalHosts:['https://*/*'],remoteCode:false,telemetry:false},privateKeyHandling:'LOCAL_AES_GCM_ENCRYPTED_VAULT_ONLY',installPolicy:'A package hash is not a store approval. Only an official LIVE listing may be shown as one-click install.'};
const releaseJson=`${JSON.stringify(release,null,2)}\n`;writeFileSync(`${root}/release.json`,releaseJson);writeFileSync('web/downloads/ael-wallet-release.json',releaseJson);
console.log(`Built AEL Wallet ${version} store packages for Chrome, Edge, Firefox, and Safari source conversion.`);
