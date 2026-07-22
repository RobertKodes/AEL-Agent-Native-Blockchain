import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AelEngine } from './engine.js';

export class StateStore {
  constructor(path) { this.path = path; }
  load() { return existsSync(this.path) ? new AelEngine(JSON.parse(readFileSync(this.path, 'utf8'))) : new AelEngine(); }
  save(engine) { mkdirSync(dirname(this.path), { recursive: true }); const temporary = `${this.path}.next`; writeFileSync(temporary, `${JSON.stringify(engine.state, null, 2)}\n`, { mode: 0o600 }); renameSync(temporary, this.path); }
}
