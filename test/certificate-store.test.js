import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CertificateStore } from '../src/certificate-store.js';
import { buildCertificate, canonicalValidatorSet, voteDomain } from '../src/consensus-primitives.js';

const validators=[1,2,3,4].map(index=>({id:`cert-v${index}`,publicKeyB64:`key-${index}`,votingPower:1}));
const makeCertificate=()=>{const set=canonicalValidatorSet(validators,1),base={chainId:'ael-devnet-1',epoch:1,height:1,view:0,phase:'PRECOMMIT',proposalId:'proposal-1',blockHash:'a'.repeat(64),stateHash:'b'.repeat(64),validatorSetHash:set.validatorSetHash},votes=validators.slice(0,3).map(item=>({...voteDomain({...base,validatorId:item.id}),signature:`signature-${item.id}`}));return buildCertificate({...base,validatorSet:set,votes})};

test('certificate store fsyncs, reloads, indexes by height and rejects corruption',()=>{const path=join(mkdtempSync(join(tmpdir(),'ael-cert-store-')),'certificates.jsonl'),certificate=makeCertificate(),store=new CertificateStore(path);store.append(certificate);store.append(certificate);const restored=new CertificateStore(path);assert.deepEqual(restored.latest(),certificate);assert.deepEqual(restored.atHeight(1),certificate);assert.deepEqual(restored.get(certificate.certificateHash),certificate);appendFileSync(path,'{"broken":true}\n');assert.throws(()=>new CertificateStore(path),/CERTIFICATE_STORE_CORRUPT/)});
