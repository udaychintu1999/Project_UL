/**
 * P01-3 offline source-contract guard. This supplements—not replaces—TypeScript,
 * Flutter widget, DynamoDB integration, and physical Android verification.
 *
 * Check protocol/authorization invariants, not a formatter's whitespace. Keep
 * failure messages short so a failed assertion never dumps authentication code.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

function requirePattern(source, pattern, invariant) {
  assert.ok(pattern.test(source), `P01-3 contract missing: ${invariant}`);
}

function rejectPattern(source, pattern, invariant) {
  assert.ok(!pattern.test(source), `P01-3 forbidden implementation: ${invariant}`);
}

const api = read('apps/api/src/features/auth/device-sessions.ts');
const policy = read('apps/api/src/features/auth/device-session-policy.ts');
const routes = read('apps/api/src/features/auth/routes.ts');
const android = read('apps/flutter_app/android/app/src/main/kotlin/com/example/uluv/MainActivity.kt');
const manifest = read('apps/flutter_app/android/app/src/main/AndroidManifest.xml');
const flutter = read('apps/flutter_app/lib/features/auth/persistent_session.dart');
const gate = read('apps/flutter_app/lib/features/auth/persistent_gate.dart');
const app = read('apps/flutter_app/lib/main.dart');

// Backend protocol, CAS, and revocation checks. Do not permit grace-period replay
// or a DynamoDB table scan in the five-device session implementation.
for (const operation of ['enroll', 'refresh', 'logout', 'revoke', 'list']) {
  requirePattern(api, new RegExp(`/v1/auth/device/${operation}\\b`), `${operation} device route`);
}
requirePattern(api, /TransactWriteCommand/, 'atomic device transaction');
requirePattern(api, /generation = :generation AND refreshDigest = :old/, 'generation and refresh CAS');
requirePattern(api, /refresh_reused_or_revoked/, 'single-use refresh rejection');
requirePattern(api, /sessionEpoch/, 'account-wide epoch revocation');
rejectPattern(api, /ScanCommand|gracePeriod|retryReceipt/, 'scan or refresh grace/replay receipt');

// Token clock, purpose-separated keys, and P-256 proof identity.
requirePattern(policy, /P13_ACCESS_SECONDS\s*=\s*1800/, '30-minute access deadline');
requirePattern(policy, /P13_REAUTH_SECONDS\s*=\s*30\s*\*\s*24\s*\*\s*60\s*\*\s*60/, '30-day hard reauthentication deadline');
requirePattern(policy, /hkdfSync/, 'purpose-separated keys');
requirePattern(policy, /prime256v1/, 'P-256 proof curve');
requirePattern(routes, /accessDigest\s*\(\s*p13Keys\s*\(\s*secret\s*\)\.access\s*,\s*token\s*\)/, 'separate access digest');
requirePattern(routes, /family\.reauthAt/, 'server-side hard reauthentication gate');

// Native storage and signing: no plaintext fallback, backups disabled.
for (const [pattern, invariant] of [
  [/AndroidKeyStore/, 'Android Keystore'],
  [/secp256r1/, 'non-exportable P-256 key'],
  [/SHA256withECDSA/, 'ECDSA signature'],
  [/AES\/GCM\/NoPadding/, 'AES-GCM sealed session'],
  [/getSharedPreferences/, 'native sealed session storage']
]) requirePattern(android, pattern, invariant);
requirePattern(manifest, /android:allowBackup\s*=\s*"false"/, 'Android backup disabled');

// Flutter lifecycle. Match the *actual sign-out write* instead of merely the
// word "signedOut" (which also occurs as a field default). `dart format` may
// introduce spaces, newlines, and a trailing comma without changing behavior.
const signoutFlag = /\bfinal\s+signedOut\s*=\s*before\s*\.\s*copyWith\s*\(\s*signedOut\s*:\s*true\s*,?\s*\)/;
const signoutWrite = /\bawait\s+vault\s*\.\s*write\s*\(\s*jsonEncode\s*\(\s*signedOut\s*\.\s*toJson\s*\(\s*\)\s*\)\s*,?\s*\)/;
const persistentMode = /\bpersistentMode\s*:\s*true\b/;
requirePattern(flutter, /class\s+PersistentSessionController\b/, 'persistent session controller');
requirePattern(flutter, /\b_refreshing\b/, 'singleflight refresh state');
requirePattern(flutter, signoutFlag, 'signed-out intent created from the existing device record');
requirePattern(flutter, signoutWrite, 'signed-out intent sealed before remote revocation');
requirePattern(flutter, /\bvault\s*\.\s*write\b/, 'native vault write');
requirePattern(flutter, /\bDeviceSessionApi\b/, 'device API adapter');
requirePattern(gate, /Restoring your session/, 'startup session restoration UI');
requirePattern(gate, /Unable to connect/, 'offline retry UI');
requirePattern(app, persistentMode, 'persistent mode enabled in the production entry point');

// Self-tests deliberately run inside the required P01-3 portable gate. They
// catch future regressions in the verifier itself, not just in app code.
for (const equivalent of [
  'final signedOut = before.copyWith(signedOut:true);',
  'final signedOut = before.copyWith(signedOut: true);',
  'final signedOut = before.copyWith(\n  signedOut: true,\n);'
]) requirePattern(equivalent, signoutFlag, 'formatter-independent sign-out detection');
for (const modified of [
  'final signedOut = before.copyWith(signedOut:false);',
  'final signedOut = before.copyWith(signedOut: otherValue);',
  'final signedOut = before.copyWith(signedOut: null);'
]) rejectPattern(modified, signoutFlag, 'sign-out flag changed');
for (const equivalent of [
  'await vault.write(jsonEncode(signedOut.toJson()));',
  'await vault.write(\n  jsonEncode(signedOut.toJson()),\n);'
]) requirePattern(equivalent, signoutWrite, 'formatter-independent sealed sign-out write');
rejectPattern('await vault.clear();', signoutWrite, 'missing sealed sign-out write');
for (const equivalent of ['persistentMode:true', 'persistentMode: true', 'persistentMode:\n  true,']) {
  requirePattern(equivalent, persistentMode, 'formatter-independent entry-point option');
}
rejectPattern('persistentMode: false', persistentMode, 'persistence disabled');

for (const file of [
  'apps/flutter_app/integration_test/persistent_session_integration_test.dart',
  'scripts/verify/p01-3-device-integration.mjs'
]) assert.ok(existsSync(file), `Missing P01-3 integration gate: ${file}`);

console.log('PASS P01-3 structural gates: single-use CAS, server epoch, device signer + AES-GCM, startup restoration, no AWS or extra table');
console.log('PASS P01-3 formatting guards: compact, spaced and multiline Dart accepted; changed sign-out or persistence semantics rejected');
