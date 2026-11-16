// These are quick safeguards for the real device test; they are NOT a
// replacement for executing that test on a physical Android device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrationTestCleanupFlags} from '../lib/flutter-integration-cleanup.mjs';

const source = file => readFileSync(file, 'utf8');
const ui = source('apps/flutter_app/integration_test/p02_2_ui_integration_test.dart');
const host = source('scripts/verify/p02-2-android-e2e.mjs');
const cli = source('scripts/dev/flutter.mjs');
const pkg = JSON.parse(source('package.json'));

test('P02 UI suite mounts the real app and taps required production controls', () => {
  assert.match(ui, /tester\.pumpWidget\(makeApp\(\)\)/);
  assert.match(ui, /UluvApp\(/);
  for (const key of [
    'auth-password-login', 'p02-save-handle', 'p02-save-common',
    'p02-enable-dating', 'p02-enable-friendship', 'p02-save-draft',
    'p02-pick-photo', 'p02-confirm-photo-upload', 'p02-photo-remove-0',
    'p02-tab-settings', 'p02-continue',
  ]) assert.ok(ui.includes(key), `missing real UI interaction: ${key}`);
  assert.match(ui, /tester\.enterText\(/);
  assert.match(ui, /_canContinue\(tester\)/);
  assert.match(ui, /_checkpoint\(13,/);
  assert.doesNotMatch(ui, /HttpProfileRepository|FakeMedia|\.saveDraft\(|\.upload\(/,
    'the UI suite must never bypass the screens with direct profile operations');
});

test('only the Android picker MethodChannel is deterministic, not the API or app', () => {
  assert.match(ui, /TestDefaultBinaryMessengerBinding/);
  assert.match(ui, /_picker = MethodChannel\('uluv\/p02_2_photo_picker'\)/);
  assert.match(ui, /com\.example\.uluv\.p02isolated/);
  assert.match(ui, /messenger\.setMockMethodCallHandler\(_picker, null\)/);
  assert.doesNotMatch(ui, /setMockMethodCallHandler\(_secure|MockProfileRepository|FakeAuth/);
});

test('UI e2e is an independent mandatory full verification gate', () => {
  assert.match(host, /uiJourney \? 'p02-2-ui-e2e' : 'p02-2-e2e'/);
  assert.match(cli, /integration_test\/p02_2_ui_integration_test\.dart/);
  assert.equal(pkg.scripts['test:flutter:p02-2:ui:e2e'],
    'node --env-file=apps/api/.env scripts/verify/p02-2-android-e2e.mjs --ui');
  assert.match(pkg.scripts['verify:p02-2'], /test:flutter:p02-2:e2e && npm run test:flutter:p02-2:ui:e2e/);
});

test('both P02 device suites opt out of Flutter base-app uninstall', () => {
  assert.deepEqual(integrationTestCleanupFlags('p02-2-e2e'), ['--no-uninstall']);
  assert.deepEqual(integrationTestCleanupFlags('p02-2-ui-e2e'), ['--no-uninstall']);
  assert.deepEqual(integrationTestCleanupFlags('p01-2-e2e'), []);
  assert.match(host, /resetP02TestApp/);
  assert.match(host, /ULUV_P02_1_ISOLATED_ANDROID_TEST: '1'/);
});

test('final Continue uses a real unobstructed pointer hit rather than a silent missed tap', () => {
  const helper = ui.split('Future<void> _tapReadyContinue(')[1]
    ?.split('Future<void> _enter(')[0] ?? '';
  assert.ok(helper, 'dedicated Continue interaction helper must exist');
  for (const protection of [
    'FocusManager.instance.primaryFocus?.unfocus()',
    'Scrollable.ensureVisible(',
    'alignment: 0.4',
    'duration: Duration.zero',
    'p02-bottom-navigation',
    'rect.bottom <= navigationTop - 8',
    'expect(unobstructed(), isTrue',
    'await tester.tap(button)',
  ]) assert.ok(helper.includes(protection), `missing final-tap protection: ${protection}`);
  assert.match(ui, /await _tapReadyContinue\(tester\);[\s\S]*?_until\(tester, 'profile setup completion screen'/);
  assert.doesNotMatch(helper, /warnIfMissed:\s*false|onPressed\s*\?*\.|\.onPressed\s*\?*\(/,
    'never bypass the actual Flutter hit test or invoke the button callback directly');
  // Negative mutations: absence of a visible-region check must cause failure.
  const protectsNavigation = source => source.includes('rect.bottom <= navigationTop - 8') &&
    source.includes('await tester.tap(button)');
  assert.equal(protectsNavigation(helper), true);
  assert.equal(protectsNavigation(helper.replace('rect.bottom <= navigationTop - 8', 'true')), false);
  assert.equal(protectsNavigation(helper.replace('await tester.tap(button)', '')), false);
});

// Prevent the exact PASS 12 indefinite hang: the Flutter integration-test
// clock cannot finish an awaited animated Scrollable.ensureVisible unless
// test frames are pumped concurrently. An instant scroll is frame-safe.
test('Continue viewport positioning never awaits an animated Flutter scroll', () => {
  const helper = ui.split('Future<void> _tapReadyContinue(')[1]
    ?.split('Future<void> _enter(')[0] ?? '';
  const scroll = helper.match(/await Scrollable\.ensureVisible\([\s\S]*?\);/)?.[0] ?? '';
  assert.ok(scroll, 'Continue must position its actual scrollable viewport');
  const frameSafe = candidate => /duration:\s*Duration\.zero/.test(candidate) &&
    !/duration:\s*(?:const\s+)?Duration\s*\(\s*(?:milliseconds|seconds|minutes)/.test(candidate);
  assert.equal(frameSafe(scroll), true,
    'nonzero duration awaited before pump would freeze the Android UI test after PASS 12');
  assert.equal(frameSafe(scroll.replace('duration: Duration.zero',
    'duration: const Duration(milliseconds: 250)')), false,
    'a reintroduced animated scroll must fail this regression guard');
  assert.match(helper, /await tester\.pump\(\);/,
    'the immediate viewport scroll must be followed by a pumped layout frame');
  assert.doesNotMatch(helper, /await tester\.pumpAndSettle\(\)/,
    'the fallback must not wait indefinitely for unrelated animations');
  assert.match(helper, /await tester\.tap\(button\)/,
    'the final callback must remain a real pointer tap');
  assert.match(ui, /await _tapReadyContinue\(tester\);[\s\S]*?_checkpoint\(13,/,
    'checkpoint 13 must still require real completion navigation');
});
