/**
 * Local device-only P01-2 orchestration. Never touches production data. A
 * synthetic account is set up via real Fastify before the device test, then
 * deleted from real Java DynamoDB Local even on a failing Flutter exit.
 */
import {spawnSync} from 'node:child_process';
import {createP012DeviceFixture} from './p01-2-device-fixture.mjs';

let fixture;
let exitCode = 1;
try {
  fixture = await createP012DeviceFixture();
  const child = spawnSync(process.execPath,
    ['scripts/dev/flutter.mjs', 'p01-2-e2e', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ULUV_P01_2_FIXTURE_EMAIL: fixture.email,
        ULUV_P01_2_FIXTURE_PASSWORD: fixture.password,
        ULUV_P01_2_FIXTURE_UID: fixture.uid,
      },
    });
  if (child.error) throw Error('Unable to execute the local Flutter test runner.');
  exitCode = child.status ?? 1;
  if (exitCode === 0) console.log('PASS: P01-2 physical Android UI password journey using a real temporary local account.');
  else console.error('FAIL: P01-2 physical Android UI password test; backend API checks do not substitute.');
} catch (error) {
  // Errors are from fixed internal messages, not credentials/response bodies.
  console.error(`P01-2 device setup/runner failed: ${error instanceof Error ? error.message : 'unknown error'}`);
} finally {
  if (fixture) {
    try { await fixture.cleanup(); console.log('P01-2 temporary local account cleanup completed.'); }
    catch { console.error('WARNING: temporary P01-2 account cleanup was incomplete; review local test data.'); exitCode = 1; }
  }
}
process.exitCode = exitCode;
