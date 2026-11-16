import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { P02_4_STAGES, assertP02LocalEnvironment, executeP02Stages } from './p02-4-plan.mjs';

const file = (path) => readFileSync(path, 'utf8');
const pkg = JSON.parse(file('package.json'));

test('P02-4 has every real local DB, Flutter and unique isolated Android gate', () => {
  const commands = P02_4_STAGES.map(([, command]) => command);
  assert.equal(new Set(commands).size, commands.length, 'no duplicate expensive E2E');
  for (const command of commands) assert.ok(pkg.scripts[command], `missing npm command ${command}`);
  for (const command of ['test:p02-1:integration', 'test:p02-2:integration',
    'test:p02-3:integration', 'test:flutter:p02-1:e2e', 'test:flutter:p02-2:e2e',
    'test:flutter:p02-3:e2e', 'test:integration', 'test:p02-2:store', 'test:flutter',
    'typecheck', 'lint']) assert.ok(commands.includes(command), `mandatory gate absent: ${command}`);
  assert.equal(commands[0], 'verify:p02-4:portable');
  assert.ok(pkg.scripts['verify:p02-4'].includes('p02-4-verifier.mjs'));
  assert.ok(pkg.scripts['verify:p02-4:portable'].includes('test:p02-4:contracts'));
  assert.match(pkg.scripts['test:flutter:p02-3:e2e'], /--ui/);
  assert.match(file('scripts/verify/p02-2-android-e2e.mjs'), /resetP02TestApp/);
  assert.match(file('scripts/verify/p02-1-android-package.mjs'), /com\.example\.uluv\.p02isolated/);
  assert.match(file('apps/flutter_app/integration_test/p02_2_ui_integration_test.dart'), /_checkpoint\(15,/);
});

test('P02-4 fails closed, stops on first error and never prints phase PASS', () => {
  const called = [], logs = [];
  const fail = executeP02Stages([['first', 'x'], ['second', 'y'], ['third', 'z']],
    (command) => { called.push(command); return { status: command === 'y' ? 1 : 0 }; },
    logs.push.bind(logs));
  assert.equal(fail, false);
  assert.deepEqual(called, ['x', 'y']);
  assert.ok(logs.some(line => line.includes('FAILED at gate 2')));
  assert.equal(logs.some(line => line.includes('PASS gate 3')), false);
  assert.equal(executeP02Stages([['first', 'x']], () => ({ status: 0 })), true);
  assert.equal(executeP02Stages([['first', 'x']], () => { throw Error('secret-value'); }), false);
  assert.equal(executeP02Stages([['first', 'x']], () => ({ status: null, signal: 'SIGTERM' })), false);
});

test('P02-4 rejects remote API/database, nonlocal mode and missing token before execution', () => {
  const safe = { APP_ENV: 'local', ULUV_DEV_TOKEN: 'X'.repeat(32),
    ULUV_API_BASE_URL: 'http://127.0.0.1:3000', DYNAMODB_ENDPOINT: 'http://127.0.0.1:8000' };
  assert.equal(assertP02LocalEnvironment(safe), true);
  for (const env of [
    { ...safe, APP_ENV: 'production' },
    { ...safe, ULUV_DEV_TOKEN: 'short' },
    { ...safe, DYNAMODB_ENDPOINT: 'https://dynamodb.ap-south-1.amazonaws.com' },
    { ...safe, ULUV_API_BASE_URL: 'https://example.com:3000' },
    { ...safe, ULUV_API_BASE_URL: 'http://127.0.0.1:8001' },
    { ...safe, ULUV_API_BASE_URL: 'http://127.0.0.1:3000/?token=private' },
  ]) assert.throws(() => assertP02LocalEnvironment(env));
});

test('P02-4 phase remains fail-closed: no public discovery, no native-picker fiction', () => {
  const policy = file('apps/api/src/features/profiles/activation-policy.ts');
  const routes = file('apps/api/src/features/profiles/routes.ts');
  const ui = file('apps/flutter_app/integration_test/p02_2_ui_integration_test.dart');
  assert.match(policy, /return 'pending_trusted_locality'/);
  assert.match(policy, /publicVisible: false/);
  assert.match(routes, /return failure\(reply, 404, 'profile_not_found'\)/);
  assert.match(ui, /MethodChannel/);
  assert.match(file('scripts/verify/p02-4-verifier.mjs'), /OWNER MANUAL GATE STILL REQUIRED/);
});
