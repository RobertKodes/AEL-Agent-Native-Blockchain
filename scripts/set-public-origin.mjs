#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const args = process.argv.slice(2), newOriginArg = args.find((value) => !value.startsWith('--')),
  oldFlagIndex = args.indexOf('--old'),
  oldOrigin = (oldFlagIndex >= 0 ? args[oldFlagIndex + 1] : 'https://ael-network.onrender.com')?.replace(/\/$/, '');
if (!newOriginArg) {
  console.error('Usage: node scripts/set-public-origin.mjs <new-https-origin> [--old <previous-origin>]');
  process.exit(2);
}
const newOrigin = newOriginArg.replace(/\/$/, ''), parsed = new URL(newOrigin);
if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
  throw new Error('New origin must be a bare credential-free HTTPS origin such as https://example.onrender.com');

const textExtensions = new Set(['.js', '.mjs', '.cjs', '.md', '.json', '.py', '.txt', '.html', '.css', '.yml', '.yaml', '.sh', '.toml', '.webmanifest', '.svg']);
const skippedDirectories = new Set(['.git', 'node_modules', 'dist', '.ael', '.railway', '.railway-config-pull-2954886']);
const changed = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!skippedDirectories.has(entry.name)) walk(join(directory, entry.name)); continue; }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name))) continue;
    const path = join(directory, entry.name), content = readFileSync(path, 'utf8');
    if (!content.includes(oldOrigin)) continue;
    writeFileSync(path, content.split(oldOrigin).join(newOrigin));
    changed.push(path);
  }
};
walk('.');

const originsPath = 'ops/public-origins.json', registry = JSON.parse(readFileSync(originsPath, 'utf8'));
if (registry.primary !== newOrigin) {
  if (registry.primary && registry.primary !== oldOrigin && !registry.origins.includes(registry.primary)) registry.origins.push(registry.primary);
  registry.primary = newOrigin;
  registry.origins = registry.origins.filter((origin) => origin && origin !== newOrigin && origin !== oldOrigin);
  writeFileSync(originsPath, `${JSON.stringify(registry, null, 2)}\n`);
  if (!changed.includes(originsPath)) changed.push(originsPath);
}

console.log(`Replaced ${oldOrigin} with ${newOrigin} in ${changed.length} files:`);
for (const path of changed.sort()) console.log(`  ${path}`);
console.log('Review with git diff, run npm test, then commit.');
