import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const build=()=>{try{execFileSync(process.execPath,['scripts/build.js'],{stdio:'pipe',maxBuffer:20_000_000})}catch(error){if(error.stdout)process.stderr.write(error.stdout);if(error.stderr)process.stderr.write(error.stderr);throw error}return createHash('sha256').update(readFileSync('dist/ael-local-devnet.tar.gz')).digest('hex')};
const first=build(),second=build();
if(first!==second)throw new Error(`RELEASE_NOT_REPRODUCIBLE ${first} ${second}`);
console.log(`Reproducible release verified: ${first}`);
