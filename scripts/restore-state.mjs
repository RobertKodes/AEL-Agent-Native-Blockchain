#!/usr/bin/env node
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const [url, target] = process.argv.slice(2);
if (!url || !target) { console.error('Usage: node scripts/restore-state.mjs <state-url> <target-file>'); process.exit(2); }
const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
if (!response.ok) { console.error(`State restore source returned HTTP ${response.status}`); process.exit(1); }
const text = await response.text();
let state;
try { state = JSON.parse(text); } catch { console.error('State restore source is not valid JSON'); process.exit(1); }
if (!Number.isInteger(state?.height) || state.height < 1 || typeof state.authorities !== 'object' || typeof state.agents !== 'object') {
  console.error('State restore source does not look like an AEL state file'); process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
const temporary = `${target}.restore-tmp`;
writeFileSync(temporary, text);
renameSync(temporary, target);
console.log(`Restored AEL state at height ${state.height} from ${url}`);
