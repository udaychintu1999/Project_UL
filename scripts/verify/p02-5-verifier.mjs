/** P02-5 visual phase verifier. Never loads account data, media or secrets. */
import { spawnSync } from 'node:child_process';
import { P02_5_STAGES, executeP02_5 } from './p02-5-plan.mjs';

if (process.argv.includes('--list')) {
  P02_5_STAGES.forEach(([label, command], i) =>
    console.log(`${i + 1}. npm run ${command} — ${label}`));
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('P02-5: invalid argument. Use npm run verify:p02-5:plan.');
  process.exit(2);
}

// Gate two inherits P02-4's mandatory APP_ENV/loopback/token verification.
// Do not weaken, skip or re-implement that gate here.
console.log('P02-5: visual upgrade verification; no backend/cloud mutations.');
const passed = executeP02_5(
  P02_5_STAGES,
  (command) => spawnSync('npm', ['run', command], {
    stdio: 'inherit', shell: process.platform === 'win32',
  }),
  (message) => console.log(message),
);
if (!passed) {
  console.error('P02-5 NOT VERIFIED. Correct the failed gate and rerun.');
  process.exit(1);
}
console.log('P02-5 AUTOMATED GATES PASSED for LOCAL development.');
console.log('MANUAL GATE: inspect real 320–430 dp screenshots against the reference PNGs;');
console.log('check native Android picker, keyboard, larger fonts and screen reader.');
console.log('P03 discovery and any real cloud/payment use remain unauthorized.');
