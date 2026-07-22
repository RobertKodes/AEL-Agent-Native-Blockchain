import { readFileSync } from 'node:fs';

export function loadActorPrivateKey(env=process.env) {
  if(env.AEL_ACTOR_PRIVATE_KEY_B64)return Buffer.from(env.AEL_ACTOR_PRIVATE_KEY_B64,'base64').toString('utf8');
  if(env.AEL_ACTOR_KEY)return readFileSync(env.AEL_ACTOR_KEY,'utf8');
  return null;
}
