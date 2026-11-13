import {spawnSync} from 'node:child_process';

// FULL P00 automated gate, not just portable source checks. Owner starts Java
// DynamoDB Local and Fastify manually and has an Android emulator/device ready.
// This runner does NOT launch DynamoDB Local or create real AWS resources.
const gates = [
  ['Portable unit/contracts/security', 'test:portable'],
  ['Backend TypeScript', 'typecheck'],
  ['Real DynamoDB Local 18-table operations', 'test:db'],
  ['Real Fastify + DynamoDB Local integration', 'test:integration'],
  ['Flutter analyzer and widget tests', 'test:flutter'],
  ['Flutter Android/device integration', 'test:flutter:e2e'],
];
for (const [description, script] of gates) {
  console.log(`\nP00 gate: ${description} (npm run ${script})`);
  const result = spawnSync('npm', ['run', script], {
    stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`P00 NOT VERIFIED: ${description} failed or unavailable (exit ${result.status ?? 'unknown'}).`);
    console.error('Fix the failure and rerun. Earlier passing gates remain valid only for their own scope.');
    process.exit(result.status || 1);
  }
}
console.log('P00 automated full-stack gates PASSED. Operator must separately confirm outage/restart/retry and record sanitized evidence before marking CORE_FLOW_VERIFIED.');
