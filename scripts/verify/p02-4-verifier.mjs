/** P02-4 verification. Runtime integration requires owner-started local services and USB Android. */
import { spawnSync } from 'node:child_process';
import { P02_4_STAGES, assertP02LocalEnvironment, executeP02Stages } from './p02-4-plan.mjs';

if (process.argv.includes('--list')) {
  P02_4_STAGES.forEach(([label, command], index) =>
    console.log(`${index + 1}. npm run ${command} — ${label}`));
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('P02-4: unknown argument. Use npm run verify:p02-4:plan for a read-only plan.');
  process.exit(2);
}

try { assertP02LocalEnvironment(process.env); }
catch {
  // Never echo .env values or secret-containing exception messages.
  console.error('P02-4 BLOCKED: expected owner-managed APP_ENV=local, loopback DB/API and a local development token.');
  console.error('Use docs/manual/P02_4_WINDOWS_FINAL_ACCEPTANCE_2026_11_16.md.');
  process.exit(2);
}
console.log('P02-4: verifying LOCAL-ONLY source, API/DB, Flutter and isolated Android; no cloud operations.');
const passed = executeP02Stages(
  P02_4_STAGES,
  (command) => spawnSync('npm', ['run', command], {
    stdio: 'inherit', shell: process.platform === 'win32',
  }),
  (message) => console.log(message),
);
if (!passed) {
  console.error('P02-4 NOT VERIFIED. Resolve the failing gate and rerun; never mark later stages PASS.');
  process.exit(1);
}
console.log('P02-4 AUTOMATED GATES PASSED for local development.');
console.log('NOT production release approval or P03 public discovery authorization.');
console.log('OWNER MANUAL GATE STILL REQUIRED: real Android system photo chooser, edge cases and approval.');
