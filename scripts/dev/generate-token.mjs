/** OWNER-ONLY LOCAL UTILITY. Never run from an AI agent or Chat tool. Does not print the token. */
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';

const target = new URL('../../apps/api/.env', import.meta.url);
const template = new URL('../../apps/api/.env.example', import.meta.url);

// Idempotent and privacy-preserving: do not even open an existing owner's .env.
// This command is for initial creation only. Never rotate or overwrite a token here.
if (existsSync(target)) {
  console.log('apps/api/.env already exists; kept unchanged. Skip env:init on later runs.');
  process.exit(0);
}

const text = await readFile(template, 'utf8');
const placeholder = /^ULUV_DEV_TOKEN=REPLACE_[^\r\n]*$/gm;
const matches = [...text.matchAll(placeholder)];
if (matches.length !== 1) {
  throw new Error('Invalid .env.example: expected exactly one ULUV_DEV_TOKEN placeholder. No file created.');
}
const result = text.replace(placeholder, `ULUV_DEV_TOKEN=${randomBytes(32).toString('hex')}`);
// wx prevents overwriting a file created by another process since the existence check.
await writeFile(target, result, {encoding:'utf8', mode:0o600, flag:'wx'});
try {await chmod(target, 0o600);} catch {} // Windows access governed by NTFS ACLs.
console.log('Created apps/api/.env with a private local development token; token not printed.');
