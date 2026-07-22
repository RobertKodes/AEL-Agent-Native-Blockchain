#!/usr/bin/env node
import { earnedLiquidityBasic, runMandatorySimulations } from './simulator.js';
import { conformance } from './profiles.js';
const command = process.argv[2] ?? 'simulate';
if (command === 'simulate') console.log(JSON.stringify(runMandatorySimulations(), null, 2));
else if (command === 'scenario') { const { engine, spotPriceNeutral } = earnedLiquidityBasic(); console.log(JSON.stringify({ spotPriceNeutral, state: engine.state }, null, 2)); }
else if (command === 'conformance') console.log(JSON.stringify(conformance, null, 2));
else { console.error(`Unknown command: ${command}`); process.exitCode = 2; }
