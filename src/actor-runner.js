#!/usr/bin/env node
const role=process.env.AEL_ROLE;
if(process.env.AEL_CONSENSUS_VALIDATOR_ID)await import('./consensus-validator.js');
if(role==='worker')await import('./demo-agent.js');
else if(role==='verifier')await import('./demo-verifier.js');
else if(role==='runtime-provider')await import('./demo-runtime-provider.js');
else if(role==='verifier-provider')await import('./combined-verifier-provider.js');
else if(role==='interchain-observer')await import('./demo-interchain-observer.js');
else if(role==='validator-node')await import('./validator-node.js');
else throw new Error('AEL_ROLE must be worker, verifier, runtime-provider, verifier-provider, interchain-observer, or validator-node');
