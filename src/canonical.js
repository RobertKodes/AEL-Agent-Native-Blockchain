import { createHash } from 'node:crypto';

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

export function hash(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function id(prefix, value) { return `${prefix}_${hash(value).slice(0, 24)}`; }
