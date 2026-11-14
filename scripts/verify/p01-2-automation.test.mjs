/** Offline structural regression checks for the required P01-2 device gate.
 * These do NOT claim to run Flutter/Android. The actual device gate is mandatory
 * under `npm run verify:p01-2` on the owner's workstation.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync, chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => readFileSync(path.join(root,file),'utf8');
const packageJson = JSON.parse(read('package.json'));
const verifier = read('scripts/verify/p01-2-verifier.mjs');
const wrapper = read('scripts/dev/flutter.mjs');
const orchestrator = read('scripts/verify/p01-2-android-e2e.mjs');
const fixture = read('scripts/verify/p01-2-device-fixture.mjs');
const dart = read('apps/flutter_app/integration_test/password_integration_test.dart');
const observer = read('apps/flutter_app/integration_test/auth_test_observer.dart');

test('P01-2 device E2E is a required, discoverable real-device gate', () => {
  assert.equal(packageJson.scripts['test:flutter:p01-2:e2e'],
    'node --env-file=apps/api/.env scripts/verify/p01-2-android-e2e.mjs');
  assert.match(verifier, /'test:flutter:p01-2:e2e'/);
  assert.match(verifier, /process\.exitCode\s*=\s*1/);
  assert.match(verifier, /'test:p01:password:integration'/);
  assert.match(verifier, /'test:flutter:e2e'/);
  assert.doesNotMatch(verifier, /commands\.push\('test:flutter:p01:e2e'\)/);
  assert.match(verifier, /P01-1 Android OTP E2E: FAILED/);
  assert.match(wrapper, /integration_test\/password_integration_test\.dart/);
  assert.match(orchestrator, /createP012DeviceFixture/);
  assert.match(orchestrator, /fixture\.cleanup\(\)/);
  assert.match(orchestrator, /process\.exitCode = exitCode/);
});

test('synthetic fixture uses real local Fastify and DynamoDB, never real email or cloud', () => {
  assert.match(fixture, /assertLocalHttpEndpoint/);
  assert.match(fixture, /process\.env\.APP_ENV !== 'local'/);
  assert.match(fixture, /127\.0\.0\.1:3000/);
  for (const route of ['/v1/auth/email/request', '/v1/dev/otp/outbox',
      '/v1/auth/signup/register']) assert.ok(fixture.includes(route));
  assert.match(fixture, /@example\.invalid/);
  assert.match(fixture, /DeleteCommand/);
  assert.match(fixture, /'password preflight'/);
  assert.match(fixture, /preflight\.data\.account\?\.uniqueId !== uid/);
  assert.doesNotMatch(fixture, /ScanCommand|SESClient|SendEmailCommand|https:\/\/|aws\.amazon\.com/);
});

test('device test exercises actual password UI requests, same ID, revocation, recovery and logout', () => {
  assert.match(observer, /class ObservedPasswordAuthService/);
  assert.match(observer, /_record\(AuthOperation\.passwordLogin/);
  for (const op of ['passwordLogin','passwordChange','recoveryRequest','recoveryOutbox','passwordReset','me','logout']) {
    assert.ok(dart.includes('AuthOperation.'+op), `Missing ${op} Flutter UI interaction`);
  }
  for (const key of ['auth-password-login','auth-current-password','auth-new-password',
    'auth-password-change','auth-mode-recovery','auth-recovery-request','auth-recovery-outbox',
    'auth-recovery-reset','auth-me','auth-logout']) {
    assert.ok(dart.includes(key), `Missing ${key}`);
  }
  assert.match(dart, /tester\.tap\(target\)/);
  assert.match(dart, /tester\.runAsync/);
  assert.match(dart, /find\.textContaining\(uid\)/);
  assert.match(dart, /auth-password-settings/);
  assert.match(dart, /auth-create-password/);
  assert.doesNotMatch(dart, /MockAuthService|FakeAuthService|mockito|mocktail/);
});

test('Android post-change failure is independently localized before requesting manual QA', () => {
  const dart = read('apps/flutter_app/integration_test/password_integration_test.dart');
  const observer = read('apps/flutter_app/integration_test/auth_test_observer.dart');
  const widgets = read('apps/flutter_app/test/password_auth_widget_test.dart');
  assert.match(dart, /verifyChangedPasswordAtAPI/);
  assert.match(dart, /observer\.expectChangeInputs\(password, nextPassword\)/);
  assert.match(dart, /observer\.expectLoginInputs\(email, nextPassword\)/);
  assert.match(dart, /observer\.lastLoginInputsMatch == false/);
  assert.match(observer, /lastChangeInputsMatch/);
  assert.match(observer, /lastLoginInputsMatch/);
  assert.match(widgets, /post-change old-password failure does not corrupt next valid login input/);
});

test('Android login E2E re-enters both fields, refocuses IME, and classifies mismatches without leaking credentials', () => {
  const dart = read('apps/flutter_app/integration_test/password_integration_test.dart');
  const observer = read('apps/flutter_app/integration_test/auth_test_observer.dart');
  assert.match(dart, /Future<void> enterLoginCredentials\(/);
  assert.match(dart, /FocusManager\.instance\.primaryFocus\?\.unfocus\(\)/);
  assert.match(dart, /await tester\.tap\(target\)/);
  assert.match(dart, /expectedLoginFieldMatches/);
  assert.match(dart, /lastLoginEmailMatch/);
  assert.match(dart, /lastLoginPasswordMatch/);
  assert.match(observer, /expectedLoginFieldMatches/);
  assert.match(observer, /lastLoginEmailMatch/);
  assert.match(observer, /lastLoginPasswordMatch/);
  assert.match(dart, /enterLoginCredentials\(tester, email, nextPassword\)/);
  assert.match(dart, /enterLoginCredentials\(tester, email, resetPassword\)/);
  assert.doesNotMatch(dart, /No credentials logged\..*\$\{(?:email|password|nextPassword|resetPassword)\}/);
});

test('P01-2 login, signup, password setup and account settings have distinct UI states', () => {
  const ui = read('apps/flutter_app/lib/features/auth/auth_screen.dart');
  const client = read('apps/flutter_app/lib/features/auth/auth_service.dart');
  const widgets = read('apps/flutter_app/test/password_auth_widget_test.dart');
  assert.match(ui, /accountPanel = 'home'/);
  assert.match(ui, /auth-signup-register/);
  assert.match(ui, /if \(accountPanel == 'setup' \|\| accountPanel == 'create'\)/);
  assert.match(ui, /else if \(accountPanel == 'change'\)/);
  assert.match(ui, /auth-password-settings/);
  assert.match(ui, /auth-mode-signup/);
  assert.match(client, /newAccount: decoded\['newAccount'\] is bool/);
  assert.match(widgets, /sign-up requires OTP then creates password atomically before account/);
  assert.match(widgets, /existing OTP user goes to account rather than password setup/);
  assert.match(widgets, /find\.byKey\(const Key\('auth-current-password'\)\),findsNothing/);
});


test('new signup requires password before committing identity and OTP login never creates user', () => {
  const api = read('apps/api/src/features/auth/routes.ts');
  const ui = read('apps/flutter_app/lib/features/auth/auth_screen.dart');
  const client = read('apps/flutter_app/lib/features/auth/auth_service.dart');
  assert.match(api, /purpose.*signup/);
  assert.match(api, /intent==='login' && !link/);
  assert.match(api, /intent==='signup' && link/);
  assert.match(api, /hashNewPassword/);
  assert.match(api, /CREDENTIAL#PASSWORD/);
  assert.match(api, /TransactWriteCommand/);
  assert.match(client, /requestSignupCode/);
  assert.match(client, /registerAccount/);
  assert.match(ui, /mode == 'signup'/);
  assert.match(ui, /auth-signup-register/);
  assert.match(ui, /mode == 'otp'/);
  assert.match(ui, /auth-recovery-confirm/);
  assert.match(ui, /validate\(\['auth-email','auth-recovery-code','auth-recovery-password','auth-recovery-confirm'\]\)/);
});

test('recovery transaction items use explicit AWS SDK contextual typing', () => {
  const password = read('apps/api/src/features/auth/password.ts');
  const budget = read('apps/api/src/features/auth/email-budget.ts');
  // Without an explicit return type, TypeScript infers optional undefined
  // properties across the differing ConditionCheck name dictionaries.
  assert.match(password,
    /makeItems:\s*\(\{code,nonce,version,now\}\):NonNullable<TransactWriteCommandInput\['TransactItems'\]>\s*=>/);
  assert.match(password, /import type \{DynamoDBDocumentClient, TransactWriteCommandInput\}/);
  assert.match(budget, /makeItems:.*NonNullable<TransactWriteCommandInput\['TransactItems'\]>/);
});

test('P01-2 recovery widget validation waits for rendered field rebuilds', () => {
  const widgets = read('apps/flutter_app/test/password_auth_widget_test.dart');
  const ui = read('apps/flutter_app/lib/features/auth/auth_screen.dart');
  const section = widgets.split("testWidgets('P01-2 new-password and recovery-code validation updates while typing'")[1]?.split('\n  });')[0];
  assert.ok(section, 'Missing recovery inline-validation widget regression');
  for (const [key, input] of [
    ['auth-recovery-code', '123'],
    ['auth-recovery-code', '123456'],
    ['auth-recovery-password', 'short'],
    ['auth-recovery-password', 'A long valid passphrase 2026'],
    ['auth-recovery-confirm', 'not matching'],
  ]) {
    const call = `await tester.enterText(find.byKey(const Key('${key}')), '${input}');`;
    const at = section.indexOf(call);
    assert.ok(at >= 0, `Missing tested input: ${key}`);
    assert.match(section.slice(at + call.length), /^\s*await tester\.pump\(\);/,
      `Advance a frame after ${key} text input before checking decoration.errorText`);
  }
  assert.match(ui, /onChanged: \(_\) => touchedField\('auth-recovery-code'\)/);
  assert.match(section, /A valid six-digit code must clear the inline error/);
});

test('P01-2 Android recovery checks the current privacy-safe message and a REAL outbox code', () => {
  const device=read('apps/flutter_app/integration_test/password_integration_test.dart');
  const service=read('apps/flutter_app/lib/features/auth/auth_service.dart');
  const fixture=read('scripts/verify/p01-2-device-fixture.mjs');
  assert.match(service, /If eligible, a recovery code is available in the local development outbox/);
  assert.match(device, /'If eligible, a recovery code is available'/);
  assert.doesNotMatch(device, /'If eligible, a recovery code was issued'/);
  assert.match(device, /AuthOperation\.recoveryOutbox/);
  assert.match(device, /expect\(localCode, matches\(RegExp/);
  // Only the synthetic local test fixture may advance the cooldown. Keep the
  // original issuance in the 24-hour quota and reject unexpected fixture state.
  assert.match(fixture, /import \{DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand\}/);
  assert.match(fixture, /sharedBudgetKey = key\(`OTP#EMAIL#\$\{emailHash\}`, 'RATE'\)/);
  assert.match(fixture, /sharedBudget\.issuances\.length !== 1/);
  assert.match(fixture, /UpdateExpression: 'SET nextAllowedAt = :past'/);
  assert.match(fixture, /ConditionExpression: '#v = :expected AND attribute_exists\(issuances\)'/);
  assert.match(fixture, /adjusted\.issuances\.length !== 1/);
});

test('automated-first rule is permanent and P01-1 exception stays explicit', () => {
  const policy=read('docs/qa/MANUAL_VERIFICATION_ESCALATION.md');
  const qa=read('docs/implementation/QA_AUTOMATION_CONTRACT.md');
  assert.match(policy, /AUTOMATED-FIRST/i);
  assert.match(policy, /P01-1/);
  assert.match(qa, /automated-first/i);
  assert.match(qa, /test:flutter:p01-2:e2e/);
});

// A synthetic npm executable verifies verifier ORCHESTRATION, not app/network
// behavior. The real Android test remains UNVERIFIED until owner runs it.
function stubVerifier(failOn = '') {
  const dir = mkdtempSync(path.join(tmpdir(), 'uluv-p01-2-gate-'));
  const stub = path.join(dir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const log = path.join(dir, 'calls.txt');
  // Windows cmd and POSIX sh variants; no production code or secrets read.
  if (process.platform === 'win32') {
    writeFileSync(stub, `@echo off
 echo %*>>"%ULUV_TEST_LOG%"
 if "%2"=="%ULUV_TEST_FAIL%" exit /b 8
 exit /b 0
`);
  } else {
    writeFileSync(stub, `#!/bin/sh
printf "%s\n" "$*" >> "$ULUV_TEST_LOG"
if [ "$2" = "$ULUV_TEST_FAIL" ]; then exit 8; fi
exit 0
`);
    chmodSync(stub, 0o755);
  }
  try {
    const result = spawnSync(process.execPath, ['scripts/verify/p01-2-verifier.mjs'], {
      cwd: root, encoding: 'utf8', env: {
        ...process.env, ULUV_TEST_LOG: log, ULUV_TEST_FAIL: failOn,
        PATH: dir + path.delimiter + (process.env.PATH ?? ''),
      },
    });
    return {status: result.status, stdout: result.stdout, stderr: result.stderr,
      calls: readFileSync(log, 'utf8').trim().split(/\r?\n/)};
  } finally { rmSync(dir, {recursive:true, force:true}); }
}

test('full verifier invokes P01-2 physical-device command after every prior gate', () => {
  const r = stubVerifier();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.calls, [
    'run verify:p01-2:portable', 'run typecheck', 'run test:db',
    'run test:integration', 'run test:p01:integration',
    'run test:p01:password:integration', 'run test:p01:email-budget:integration', 'run test:flutter',
    'run test:flutter:e2e', 'run test:flutter:p01-2:e2e',
  ]);
});

test('full verifier fails closed when P01-2 Android gate fails', () => {
  const r = stubVerifier('test:flutter:p01-2:e2e');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /P01-2 NOT VERIFIED: test:flutter:p01-2:e2e/);
  assert.equal(r.calls.at(-1), 'run test:flutter:p01-2:e2e');
});


test('P01-1 and P01-2 existing-user OTP widget transitions use a settled, real button tap', () => {
  const legacy = read('apps/flutter_app/test/auth_widget_test.dart');
  const account = read('apps/flutter_app/test/password_auth_widget_test.dart');
  for (const widgetTest of [legacy, account]) {
    assert.match(widgetTest, /FocusManager\.instance\.primaryFocus\?\.unfocus\(\)/);
    assert.match(widgetTest, /await tester\.ensureVisible\(verifyButton\);\s*await tester\.pumpAndSettle\(\)/);
    assert.match(widgetTest, /tester\.widget<FilledButton>\(verifyButton\)\.onPressed/);
    assert.match(widgetTest, /await tester\.tap\(verifyButton\);\s*await tester\.pumpAndSettle\(\)/);
    assert.match(widgetTest, /find\.byKey\(const Key\('auth-me'\)\),findsOneWidget/);
  }
  assert.match(legacy, /expect\(service\.verifies,1/);
  assert.match(account, /expect\(service\.otpLogins,1/);
});


test('backend shared email budget is enforced across signup OTP and recovery', () => {
  const budget=read('apps/api/src/features/auth/email-budget.ts');
  const plan=read('apps/api/src/features/auth/email-budget-policy.ts');
  const email=read('apps/api/src/features/auth/routes.ts');
  const recovery=read('apps/api/src/features/auth/password.ts');
  const integration=read('scripts/verify/p01-email-budget-integration.mjs');
  assert.match(budget,/TransactWriteCommand/);
  assert.match(budget,/ConditionExpression/);
  assert.match(plan,/EMAIL_DAILY_LIMIT = 5/);
  assert.match(plan,/EMAIL_ROLLING_SECONDS = 86400/);
  assert.match(plan,/OTP_COOLDOWN_SECONDS = 60/);
  assert.match(read('apps/api/src/features/auth/policy.ts'),/OTP_COOLDOWN_SECONDS = 60/);
  assert.match(email,/issueEmailChallenge/);
  assert.match(recovery,/issueEmailChallenge/);
  assert.match(integration,/Promise\.all/);
  assert.match(integration,/issuances\.length,5/);
  assert.match(read('scripts/verify/p01-2-verifier.mjs'),/test:p01:email-budget:integration/);
});

test('Flutter validates locally and prevents authenticated Back to diagnostics',()=>{
  const ui=read('apps/flutter_app/lib/features/auth/auth_screen.dart');
  assert.match(ui,/PopScope/);assert.match(ui,/canPop: token == null/);
  assert.match(ui,/fieldError\(String key\)/);
  assert.match(ui,/touchedField\('auth-code'\)/);
  assert.match(ui,/auth-recovery-code/);
  assert.match(ui,/auth-consent/);
  assert.match(ui,/utf8\.encode\(value\)\.length/);
});
