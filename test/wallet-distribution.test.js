import test from 'node:test';
import assert from 'node:assert/strict';
import { AelEngine } from '../src/engine.js';
import { canonicalWalletListingUrl, isInstallableWalletDistribution } from '../src/wallet-distribution.js';

const digest=character=>character.repeat(64);
const base={channel:'CHROME',auditorId:'audit-one',independenceGroup:'independent-one',version:'0.7.0',releaseHash:digest('a'),evidenceHash:digest('b')};

test('only official browser-store listing URLs are accepted',()=>{
  assert.equal(canonicalWalletListingUrl('CHROME','https://chromewebstore.google.com/detail/ael-wallet/abc?hl=en'),'https://chromewebstore.google.com/detail/ael-wallet/abc');
  assert.equal(canonicalWalletListingUrl('FIREFOX','https://addons.mozilla.org/en-US/firefox/addon/ael-wallet/'),'https://addons.mozilla.org/en-US/firefox/addon/ael-wallet/');
  assert.equal(canonicalWalletListingUrl('CHROME','https://evil.example/detail/ael'),null);
  assert.equal(canonicalWalletListingUrl('EDGE','http://microsoftedge.microsoft.com/addons/detail/ael/id'),null);
});

test('distribution evidence advances monotonically and LIVE is installable',()=>{
  const engine=new AelEngine();
  engine.apply('attestWalletDistribution',{...base,status:'SIGNED'});
  assert.throws(()=>engine.apply('attestWalletDistribution',{...base,status:'REVIEWED',listingUrl:'https://evil.example/ael'}),/WALLET_DISTRIBUTION_ATTESTATION_INVALID/);
  engine.apply('attestWalletDistribution',{...base,status:'REVIEWED',listingUrl:'https://chromewebstore.google.com/detail/ael-wallet/abc'});
  engine.apply('attestWalletDistribution',{...base,status:'LIVE',evidenceHash:digest('c'),listingUrl:'https://chromewebstore.google.com/detail/ael-wallet/abc'});
  const attestation=Object.values(engine.state.walletDistributionAttestations)[0];
  assert.equal(attestation.status,'LIVE');assert.equal(isInstallableWalletDistribution(attestation),true);
  assert.throws(()=>engine.apply('attestWalletDistribution',{...base,status:'REVIEWED',listingUrl:'https://chromewebstore.google.com/detail/ael-wallet/abc'}),/WALLET_DISTRIBUTION_ATTESTATION_INVALID/);
});
