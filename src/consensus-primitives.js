import { appendFileSync, closeSync, existsSync, openSync, readFileSync, writeFileSync, fsyncSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { hash } from './canonical.js';
import { canonicalize } from './canonical.js';
import { createPublicKey, verify } from 'node:crypto';
import { ProtocolError } from './errors.js';

export const CONSENSUS_SCHEMA='AEL-CONSENSUS/1';

export function canonicalValidatorSet(validators,epoch=1){
  if(!Number.isInteger(epoch)||epoch<1||!Array.isArray(validators)||validators.length<4)throw new ProtocolError('VALIDATOR_SET_INVALID');
  const entries=validators.map(item=>({validatorId:item.validatorId??item.id,consensusPublicKey:item.consensusPublicKey??item.publicKeyB64,votingPower:item.votingPower??1,peerEndpoints:[...(item.peerEndpoints??(item.url?[item.url]:[]))].sort(),faultDomain:item.faultDomain??'UNDECLARED'})).sort((a,b)=>a.validatorId.localeCompare(b.validatorId));
  if(new Set(entries.map(item=>item.validatorId)).size!==entries.length||entries.some(item=>!item.validatorId||!item.consensusPublicKey||!Number.isSafeInteger(item.votingPower)||item.votingPower<1))throw new ProtocolError('VALIDATOR_SET_INVALID');
  const value={schema:'AEL-VALIDATOR-SET/1',epoch,validators:entries};return{...value,validatorSetHash:hash(value),totalVotingPower:entries.reduce((sum,item)=>sum+item.votingPower,0)};
}

export function quorumPower(validatorSet){return Math.floor(validatorSet.totalVotingPower*2/3)+1}

export function selectProposer({chainId,epoch,height,view,previousCertificateHash,validatorSet}){
  if(!chainId||epoch!==validatorSet.epoch||!Number.isInteger(height)||height<1||!Number.isInteger(view)||view<0||!/^[a-f0-9]{64}$/.test(previousCertificateHash??''))throw new ProtocolError('PROPOSER_INPUT_INVALID');
  const seed=hash({chainId,epoch,height,view,previousCertificateHash,validatorSetHash:validatorSet.validatorSetHash}),point=Number(BigInt(`0x${seed}`)%BigInt(validatorSet.totalVotingPower));let cursor=0;
  for(const validator of validatorSet.validators){cursor+=validator.votingPower;if(point<cursor)return{validatorId:validator.validatorId,seed,point}}
  throw new ProtocolError('PROPOSER_SELECTION_FAILED');
}

export function voteDomain({chainId,epoch,height,view,phase,proposalId,blockHash,stateHash,validatorSetHash,validatorId}){
  if(!['PREPARE','PRECOMMIT','VIEW_CHANGE','CHECKPOINT','STATUS'].includes(phase))throw new ProtocolError('CONSENSUS_PHASE_INVALID');
  return{schema:'AEL-CONSENSUS-VOTE/1',chainId,epoch,height,view,phase,proposalId,blockHash:blockHash??null,stateHash,validatorSetHash,validatorId};
}

export function buildCertificate({kind='FINALITY',chainId,epoch,height,view,phase,proposalId,blockHash,stateHash,validatorSet,votes}){
  const unique=new Map(),powerById=new Map(validatorSet.validators.map(item=>[item.validatorId,item.votingPower])),expected={schema:'AEL-CONSENSUS-VOTE/1',chainId,epoch,height,view,phase,proposalId,blockHash:blockHash??null,stateHash,validatorSetHash:validatorSet.validatorSetHash};
  for(const vote of votes??[]){const domainMatches=Object.entries(expected).every(([key,value])=>vote?.[key]===value);if(!domainMatches||!powerById.has(vote.validatorId)||typeof vote.signature!=='string'||vote.signature.length===0)throw new ProtocolError('CERTIFICATE_VOTE_INVALID');if(!unique.has(vote.validatorId))unique.set(vote.validatorId,vote)}
  const votingPower=[...unique].reduce((sum,[id])=>sum+powerById.get(id),0);if(votingPower<quorumPower(validatorSet))throw new ProtocolError('CERTIFICATE_QUORUM_INSUFFICIENT');
  const schema=kind==='VIEW_CHANGE'?'AEL-VIEW-CERTIFICATE/1':kind==='CHECKPOINT'?'AEL-CHECKPOINT-CERTIFICATE/1':'AEL-FINALITY-CERTIFICATE/1',body={schema,kind,chainId,epoch,height,view,phase,proposalId,blockHash:blockHash??null,stateHash,validatorSetHash:validatorSet.validatorSetHash,votingPower,votes:[...unique.values()].sort((a,b)=>a.validatorId.localeCompare(b.validatorId))};return{...body,certificateHash:hash(body)};
}

export function verifyFinalityCertificate({certificate,validatorSet,stateHash,height}){
  try{
    if(height===0)return certificate===null;
    const set=canonicalValidatorSet(validatorSet.validators,validatorSet.epoch),{certificateHash,...body}=certificate??{};
    if(set.validatorSetHash!==validatorSet.validatorSetHash||hash(body)!==certificateHash||!['AEL-FINALITY-CERTIFICATE/1','AEL-CHECKPOINT-CERTIFICATE/1'].includes(certificate.schema)||certificate.height!==height||certificate.stateHash!==stateHash||certificate.validatorSetHash!==set.validatorSetHash||!['PRECOMMIT','CHECKPOINT'].includes(certificate.phase))return false;
    const members=new Map(set.validators.map(item=>[item.validatorId,item])),seen=new Set();let power=0;
    for(const signedVote of certificate.votes??[]){const member=members.get(signedVote.validatorId),{signature,...voteBody}=signedVote,expected={schema:'AEL-CONSENSUS-VOTE/1',chainId:certificate.chainId,epoch:certificate.epoch,height:certificate.height,view:certificate.view,phase:certificate.phase,proposalId:certificate.proposalId,blockHash:certificate.blockHash,stateHash:certificate.stateHash,validatorSetHash:certificate.validatorSetHash};if(!member||seen.has(signedVote.validatorId)||!Object.entries(expected).every(([key,value])=>signedVote[key]===value)||!verify(null,Buffer.from(canonicalize(voteBody)),createPublicKey(Buffer.from(member.consensusPublicKey,'base64').toString('utf8')),Buffer.from(signature??'','base64')))return false;seen.add(signedVote.validatorId);power+=member.votingPower}
    return power>=quorumPower(set)&&power===certificate.votingPower;
  }catch{return false}
}

export class ConsensusWal {
  constructor(path){this.path=path;this.records=[];this.signedVotes=new Map();this.previousRecordHash='0'.repeat(64);this.recover()}
  recover(){if(!existsSync(this.path))return;const lines=readFileSync(this.path,'utf8').split('\n').filter(Boolean);for(const line of lines){let record;try{record=JSON.parse(line)}catch{throw new ProtocolError('CONSENSUS_WAL_CORRUPT')}const{recordHash,...body}=record;if(body.previousRecordHash!==this.previousRecordHash||hash(body)!==recordHash)throw new ProtocolError('CONSENSUS_WAL_CORRUPT');this.records.push(record);this.previousRecordHash=recordHash;if(record.type.endsWith('_SIGNED'))this.rememberVote(record.payload)} }
  rememberVote(vote){const key=`${vote.epoch}:${vote.height}:${vote.view}:${vote.phase}`;const previous=this.signedVotes.get(key);if(previous&&previous.proposalId!==vote.proposalId)throw new ProtocolError('CONSENSUS_DOUBLE_SIGN_PREVENTED');this.signedVotes.set(key,vote)}
  append(type,payload){if(!['PROPOSAL_RECEIVED','PREPARE_SIGNED','PRECOMMIT_SIGNED','VIEW_CHANGE_SIGNED','CHECKPOINT_SIGNED','CERTIFICATE_APPLIED','HEIGHT_COMMITTED'].includes(type))throw new ProtocolError('CONSENSUS_WAL_RECORD_INVALID');if(type.endsWith('_SIGNED'))this.rememberVote(payload);mkdirSync(dirname(this.path),{recursive:true});const body={schema:'AEL-CONSENSUS-WAL/1',sequence:this.records.length+1,type,previousRecordHash:this.previousRecordHash,payload,payloadHash:hash(payload)},record={...body,recordHash:hash(body)},fd=openSync(this.path,'a',0o600);try{appendFileSync(fd,`${JSON.stringify(record)}\n`);fsyncSync(fd)}finally{closeSync(fd)}this.records.push(record);this.previousRecordHash=record.recordHash;return record}
  checkpoint(path){const snapshot={schema:'AEL-CONSENSUS-WAL-CHECKPOINT/1',records:this.records.length,lastRecordHash:this.previousRecordHash,signedVotes:[...this.signedVotes.values()]};writeFileSync(path,`${JSON.stringify(snapshot)}\n`,{mode:0o600});return snapshot}
}
