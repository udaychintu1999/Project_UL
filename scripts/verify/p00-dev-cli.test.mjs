import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync} from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// These tests use no real .env or Flutter CLI; all tokens below are synthetic.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = {...process.env, ULUV_DEV_TOKEN: 'fixture_' + 'x'.repeat(56), APP_ENV: 'local'};
function run(...args) {
  return spawnSync(process.execPath, ['scripts/dev/flutter.mjs', ...args], {
    cwd: project, encoding: 'utf8', env,
  });
}

test('named npm commands are available and none launches DynamoDB Local automatically', () => {
  const scripts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
  for (const name of ['env:init', 'db:provision', 'dev:api', 'flutter:setup', 'dev:flutter',
    'test:flutter', 'test:flutter:e2e', 'test:db', 'test:integration', 'verify:p00',
    'verify:p00:portable']) {
    assert.equal(typeof scripts[name], 'string', `${name} is missing`);
  }
  for (const name of ['dev:api', 'dev:flutter', 'flutter:setup', 'verify:p00', 'test:db',
    'test:integration', 'test:flutter']) {
    assert.doesNotMatch(scripts[name], /start-local\.ps1|docker|java\s+-jar/i);
    assert.doesNotMatch(scripts[name], /\.ps1\b/i);
  }
  assert.match(scripts['test:integration'], /--env-file=apps\/api\/\.env/);
  assert.match(scripts['dev:flutter'], /--env-file=apps\/api\/\.env/);
});

test('the local Flutter CLI rejects invalid actions without launching a runtime', () => {
  const result = run('not-an-action');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('the Flutter CLI rejects remote/HTTPS/token-bearing URLs before launching', () => {
  for (const invalid of ['https://127.0.0.1:3000', 'http://example.com:3000',
    'http://192.168.1.7:3000', 'http://user:password@localhost:3000',
    'http://10.0.2.2:3000/bad', 'http://127.0.0.1:3000?token=foo',
    'http://localhost']) {
    const result = run('run', '--api-base-url', invalid);
    assert.equal(result.status, 2, `Unexpected acceptance of ${invalid}`);
    assert.match(result.stderr, /local HTTP API hosts\/ports/);
  }
});

test('the Flutter CLI rejects unsafe device IDs and missing tokens', () => {
  const unsafe = run('run', '--device', 'emulator & echo unsafe');
  assert.equal(unsafe.status, 2);
  assert.match(unsafe.stderr, /Device ID/);
  const noToken = spawnSync(process.execPath, ['scripts/dev/flutter.mjs', 'run'], {
    cwd: project, encoding: 'utf8', env: {...env, ULUV_DEV_TOKEN: ''},
  });
  assert.equal(noToken.status, 2);
  assert.match(noToken.stderr, /Local token unavailable/);
});


function createFakeSdk(dir, {flutterStatus = 0, adbStatus = 0} = {}) {
  const flutterPath = path.join(dir, process.platform === 'win32' ? 'flutter.bat' : 'flutter');
  const adbPath = path.join(dir, process.platform === 'win32' ? 'adb.bat' : 'adb');
  if (process.platform === 'win32') {
    writeFileSync(flutterPath, `@echo off\r\necho %* > "%ULUV_TEST_FLUTTER_ARGS%"\r\nexit /b ${flutterStatus}\r\n`);
    writeFileSync(adbPath, `@echo off\r\necho %* > "%ULUV_TEST_ADB_ARGS%"\r\nexit /b ${adbStatus}\r\n`);
  } else {
    writeFileSync(flutterPath, `#!/bin/sh\nprintf '%s\\n' "$*" > "$ULUV_TEST_FLUTTER_ARGS"\nexit ${flutterStatus}\n`, {mode: 0o700});
    writeFileSync(adbPath, `#!/bin/sh\nprintf '%s\\n' "$*" > "$ULUV_TEST_ADB_ARGS"\nexit ${adbStatus}\n`, {mode: 0o700});
    chmodSync(flutterPath, 0o700);
    chmodSync(adbPath, 0o700);
  }
  return {
    ...env,
    PATH: dir + path.delimiter + (env.PATH || ''),
    ULUV_TEST_FLUTTER_ARGS: path.join(dir, 'flutter.args'),
    ULUV_TEST_ADB_ARGS: path.join(dir, 'adb.args'),
    ULUV_API_BASE_URL: '',
  };
}

function runWithFakeSdk(stubEnv, ...args) {
  return spawnSync(process.execPath, ['scripts/dev/flutter.mjs', ...args], {
    cwd: project, encoding: 'utf8', env: stubEnv,
  });
}

test('P00 connection settings default to safe USB host and explain the emulator', () => {
  const config = readFileSync(new URL('../../apps/flutter_app/dev_connection.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /target: 'usb'/);
  assert.match(config, /usbApiBaseUrl: 'http:\/\/127\.0\.0\.1:3000'/);
  assert.match(config, /emulatorApiBaseUrl: 'http:\/\/10\.0\.2\.2:3000'/);
  assert.match(config, /adb reverse/);
});

test('USB mode auto-configures adb reverse before invoking Flutter (synthetic SDK only)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uluv-usb-stub-'));
  try {
    const stubEnv = createFakeSdk(dir);
    const runResult = runWithFakeSdk(stubEnv, 'run');
    assert.equal(runResult.status, 0, runResult.stderr);
    assert.match(readFileSync(stubEnv.ULUV_TEST_ADB_ARGS, 'utf8'), /reverse tcp:3000 tcp:3000/);
    assert.match(readFileSync(stubEnv.ULUV_TEST_FLUTTER_ARGS, 'utf8'), /ULUV_API_BASE_URL=http:\/\/127\.0\.0\.1:3000/);
    assert.doesNotMatch(runResult.stdout + runResult.stderr, /fixture_x{12}/);
    const e2e = runWithFakeSdk(stubEnv, 'e2e', '--device', 'R58ABCDEFG');
    assert.equal(e2e.status, 0, e2e.stderr);
    assert.match(readFileSync(stubEnv.ULUV_TEST_ADB_ARGS, 'utf8'), /-s R58ABCDEFG reverse tcp:3000 tcp:3000/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('emulator mode uses 10.0.2.2 and does not invoke adb reverse (synthetic SDK only)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uluv-emulator-stub-'));
  try {
    const stubEnv = createFakeSdk(dir);
    const runResult = runWithFakeSdk(stubEnv, 'run', '--target', 'emulator');
    assert.equal(runResult.status, 0, runResult.stderr);
    assert.equal(existsSync(stubEnv.ULUV_TEST_ADB_ARGS), false);
    assert.match(readFileSync(stubEnv.ULUV_TEST_FLUTTER_ARGS, 'utf8'), /ULUV_API_BASE_URL=http:\/\/10\.0\.2\.2:3000/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('USB reverse failure blocks Flutter launch, and invalid target is rejected', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uluv-adb-fail-stub-'));
  try {
    const stubEnv = createFakeSdk(dir, {adbStatus: 7});
    const runResult = runWithFakeSdk(stubEnv, 'run');
    assert.equal(runResult.status, 2);
    assert.match(runResult.stderr, /ADB reverse unavailable/);
    assert.equal(existsSync(stubEnv.ULUV_TEST_FLUTTER_ARGS), false);
    const invalidTarget = runWithFakeSdk(stubEnv, 'run', '--target', 'lan');
    assert.equal(invalidTarget.status, 2);
    assert.match(invalidTarget.stderr, /Target must be usb or emulator/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('Flutter run/e2e commands execute via an isolated stub and preserve exit codes', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'uluv-fake-flutter-'));
  try {
    const fakeEnv = createFakeSdk(dir, {flutterStatus: 7});
    for (const mode of ['run', 'e2e']) {
      const result = runWithFakeSdk(fakeEnv, mode);
      assert.equal(result.status, 7, `${mode}: Flutter failure code should be propagated`);
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
