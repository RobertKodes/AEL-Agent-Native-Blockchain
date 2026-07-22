import { AelEngine } from './engine.js';
import { hash } from './canonical.js';
import { ProtocolError } from './errors.js';

export class LocalConsensus {
  constructor(canonical, validatorCount = 4) {
    if (!Number.isInteger(validatorCount) || validatorCount < 1) throw new ProtocolError('INVALID_VALIDATOR_COUNT');
    this.canonical=canonical;
    this.validators=Array.from({length:validatorCount},(_,i)=>({id:`validator-${i+1}`,engine:new AelEngine(canonical.state),status:'ACTIVE'}));
    this.lastCommit=null;
  }
  apply(type,payload) {
    const results=this.validators.filter(v=>v.status==='ACTIVE').map(v=>({id:v.id,stateHash:v.engine.apply(type,payload)}));
    const roots=new Set(results.map(x=>x.stateHash));
    if(roots.size!==1) throw new ProtocolError('CONSENSUS_STATE_ROOT_MISMATCH');
    const canonicalHash=this.canonical.apply(type,payload);
    if(canonicalHash!==results[0]?.stateHash) throw new ProtocolError('CANONICAL_STATE_ROOT_MISMATCH');
    this.lastCommit={height:this.canonical.state.height,stateHash:canonicalHash,votes:results};
    return canonicalHash;
  }
  status() {
    const validators=this.validators.map(v=>({id:v.id,status:v.status,height:v.engine.state.height,stateHash:hash(v.engine.state)}));
    const active=validators.filter(v=>v.status==='ACTIVE'),canonicalHash=hash(this.canonical.state);
    const restoredAgreement=active.length>0&&active.every(v=>v.height===this.canonical.state.height&&v.stateHash===canonicalHash);
    const finality=this.lastCommit
      ? {stateHash:this.lastCommit.stateHash,votes:this.lastCommit.votes.length}
      : restoredAgreement ? {stateHash:canonicalHash,votes:active.length,restored:true} : null;
    return {height:this.canonical.state.height,validatorCount:validators.length,activeValidators:active.length,latestBlockHash:this.canonical.state.blocks.at(-1)?.blockHash??null,chainHistoryStart:this.canonical.state.blocks[0]?.height??null,finality,validators};
  }
}
