import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('wallet extension exposes only consent-gated AEL provider methods',()=>{
  const inpage=readFileSync('wallet-extension/inpage.js','utf8'),content=readFileSync('wallet-extension/content.js','utf8'),background=readFileSync('wallet-extension/background.js','utf8'),approval=readFileSync('wallet-extension/approval.js','utf8'),popup=readFileSync('wallet-extension/popup.js','utf8'),manifest=JSON.parse(readFileSync('wallet-extension/manifest.json','utf8'));
  for(const method of ['ael_chainId','ael_requestAccounts','ael_getAccount','ael_getBalance','ael_signAndSubmitIntent'])assert.match(`${content}\n${background}`,new RegExp(method));
  assert.doesNotMatch(inpage,/signMessage|signRaw|export.*private/i);assert.match(approval,/AEL_USER_REJECTED/);assert.match(approval,/Connect this website before signing/);assert.match(approval,/AES-GCM/);assert.doesNotMatch(`${inpage}${content}${background}${approval}`,/eval\(|new Function|https?:\/\/[^'"`]*\.js/);
  assert.match(background,/senderOrigin!==message\.origin/);assert.match(background,/connections\[senderOrigin\]\?\.actorId===vault\?\.actorId/);assert.match(background,/\/v1\/token/);assert.match(popup,/permissions\.request/);assert.match(popup,/create-join/);assert.match(popup,/\/v1\/agents\/register/);assert.match(popup,/revoke-sites/);assert.deepEqual(manifest.permissions,['storage']);assert.deepEqual(manifest.optional_host_permissions,['https://*/*']);
});

test('browser packages are deterministic in structure and declare honest signing boundaries',()=>{
  execFileSync(process.execPath,['scripts/build-browser-extensions.js']);
  const chromium=JSON.parse(readFileSync('dist/browser-extensions/chromium/manifest.json')),firefox=JSON.parse(readFileSync('dist/browser-extensions/firefox/manifest.json')),release=JSON.parse(readFileSync('dist/browser-extensions/release.json'));
  assert.equal(chromium.manifest_version,3);assert.equal(chromium.version,'0.7.0');assert.equal(chromium.background.service_worker,'background.js');assert.equal(chromium.content_scripts[0].run_at,'document_start');
  assert.deepEqual(firefox.background.scripts,['background.js']);assert.equal(firefox.browser_specific_settings.gecko.id,'wallet@ael.network');assert.ok(firefox.browser_specific_settings.gecko.data_collection_permissions.required.includes('financialAndPaymentInfo'));
  assert.equal(release.schema,'AEL-WALLET-EXTENSION-RELEASE/2');assert.equal(release.distribution.chrome,'REQUIRES_CHROME_WEB_STORE_REVIEW');assert.equal(release.distribution.firefox,'REQUIRES_MOZILLA_SIGNATURE');assert.equal(release.distribution.safari,'REQUIRES_APPLE_DEVELOPER_SIGNING');assert.equal(release.privateKeyHandling,'LOCAL_AES_GCM_ENCRYPTED_VAULT_ONLY');assert.match(release.artifacts['ael-wallet-chrome-store.zip'].sha256,/^[a-f0-9]{64}$/);
});
