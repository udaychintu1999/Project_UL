import assert from 'node:assert/strict';
import test from 'node:test';
import {isP02TestAppInstalled, resetP02TestApp, P02_TEST_PACKAGE} from './p02-1-android-package.mjs';
import {integrationTestCleanupFlags} from '../lib/flutter-integration-cleanup.mjs';
import {readFileSync} from 'node:fs';

const TEST_ID = 'com.example.uluv.p02isolated';

test('P02 package check accepts only the exact dedicated package', () => {
  assert.equal(P02_TEST_PACKAGE, TEST_ID);
  assert.equal(isP02TestAppInstalled(`package:${TEST_ID}`), true);
  assert.equal(isP02TestAppInstalled(`package:${TEST_ID}\r\n`), true);
  assert.equal(isP02TestAppInstalled(''), false);
  assert.equal(isP02TestAppInstalled('package:com.example.uluv'), false);
  assert.equal(isP02TestAppInstalled(`package:${TEST_ID}.other`), false);
  assert.equal(isP02TestAppInstalled('package:unrelated\npackage:com.example.uluv'), false);
});

test('first run with absent test APK completes successfully without uninstall', () => {
  const calls = [];
  const adb = (argv) => {
    calls.push(argv);
    return 'package:com.example.uluv\n';
  };
  assert.equal(resetP02TestApp(['-s', 'usb-id'], adb), false);
  assert.deepEqual(calls, [[
    '-s', 'usb-id', 'shell', 'pm', 'list', 'packages', TEST_ID,
  ]]);
});

test('reset uninstalls only the exact P02 package, never the regular app', () => {
  const calls = [];
  const adb = (argv) => {
    calls.push(argv);
    return calls.length === 1
      ? `package:com.example.uluv\npackage:${TEST_ID}\n`
      : 'Success\n';
  };
  assert.equal(resetP02TestApp([], adb), true);
  assert.deepEqual(calls, [
    ['shell', 'pm', 'list', 'packages', TEST_ID],
    ['uninstall', TEST_ID],
  ]);
});

test('uninstall failure is fatal and cannot be described as successful cleanup', () => {
  let calls = 0;
  assert.throws(() => resetP02TestApp([], () => {
    calls++;
    return calls === 1 ? `package:${TEST_ID}\n` : 'Failure [DELETE_FAILED_INTERNAL_ERROR]';
  }), /could not be uninstalled/);
});

test('ADB failure is fatal, not falsely interpreted as a missing package', () => {
  assert.throws(() => resetP02TestApp([], () => {
    throw new Error('ADB command failed');
  }), /ADB command failed/);
});

// P02 uses a Gradle applicationIdSuffix, and Flutter may otherwise uninstall
// the *base* com.example.uluv package during test teardown.
test('P02 Flutter integration disables tool-driven uninstall; other suites remain unchanged', () => {
  assert.deepEqual(integrationTestCleanupFlags('p02-1-e2e'), ['--no-uninstall']);
  assert.deepEqual(integrationTestCleanupFlags('p01-3-e2e'), []);
  assert.deepEqual(integrationTestCleanupFlags('e2e'), []);
  const source = readFileSync(new URL('../dev/flutter.mjs', import.meta.url), 'utf8');
  assert.match(source, /runFlutter\(\['test', suite, \.\.\.device, \.\.\.define, \.\.\.integrationTestCleanupFlags\(action\)\]\)/);
});
