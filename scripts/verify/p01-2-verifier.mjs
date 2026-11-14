/** P01-2 complete automation-first acceptance gate.
 * P01-1 Android OTP E2E has a separately documented owner-accepted local
 * development exception, NOT a pass. P01-2 device test is a REQUIRED gate.
 */
import {spawnSync} from 'node:child_process';
const commands = [
  'verify:p01-2:portable',
  'typecheck',
  'test:db',
  'test:integration',
  'test:p01:integration',
  'test:p01:password:integration',
  'test:flutter',
  'test:flutter:e2e',
  'test:flutter:p01-2:e2e',
];
for (const name of commands) {
  console.log(`P01-2 verification: npm run ${name}`);
  const run = spawnSync('npm', ['run', name], {stdio: 'inherit', shell: process.platform === 'win32'});
  if (run.error || run.status !== 0) {
    console.error(`P01-2 NOT VERIFIED: ${name} failed or unavailable`);
    process.exitCode = 1;
    break;
  }
}
console.log('P01-1 Android OTP E2E: FAILED (automated, owner-accepted local-development exception), not a PASS or waived release requirement.');
