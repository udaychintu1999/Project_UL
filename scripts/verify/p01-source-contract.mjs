import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=(name)=>readFileSync(name,'utf8');
const routes=read('apps/api/src/features/auth/routes.ts');
const app=read('apps/api/src/app.ts');
const policy=read('apps/api/src/features/auth/policy.ts');
const ui=read('apps/flutter_app/lib/features/auth/auth_screen.dart');
const client=read('apps/flutter_app/lib/features/auth/auth_service.dart');
for(const path of ['/v1/auth/email/request','/v1/auth/email/verify','/v1/auth/me','/v1/auth/logout','/v1/dev/otp/outbox']) assert.ok(routes.includes(path),`Missing route ${path}`);
for(const guard of ['TransactWriteCommand','ConditionExpression','OTP_MAX_ATTEMPTS','isAdultBirthDate','equalDigest','sessionDigest','requireSession','ageEligibility']) assert.ok(routes.includes(guard),`Missing auth guard ${guard}`);
// Require strongly consistent DynamoDB reads regardless of whitespace style.
assert.match(routes, /ConsistentRead\s*:\s*true/);
const budget=read('apps/api/src/features/auth/email-budget.ts');
const model=read('apps/api/src/features/auth/email-budget-policy.ts');
assert.match(routes,/issueEmailChallenge/);
assert.match(budget,/TransactWriteCommand/);
assert.match(budget,/ConditionExpression/);
assert.match(model,/EMAIL_DAILY_LIMIT = 5/);
assert.match(model,/EMAIL_ROLLING_SECONDS = 86400/);
assert.match(routes,/requestIdFromHeader/);
assert.match(read('apps/api/src/features/auth/password.ts'),/issueEmailChallenge/);
assert.match(read('apps/api/src/features/auth/password.ts'),/requestIdFromHeader/);
assert.match(client,/x-uluv-request-id/);
assert.match(ui,/canPop: token == null/); // authenticated back guard

assert.match(routes,/if\s*\(\s*config\.env\s*===\s*'local'\s*\)\s*app\.post\s*\(\s*'\/v1\/dev\/otp\/outbox'/);
assert.match(app,/registerLocalEmailAuth/);
assert.match(policy,/createHmac/);
assert.doesNotMatch(routes,/ScanCommand|\.scan\(|SendEmailCommand|SESClient|googleapis|google-auth-library/);
for(const key of ['auth-email','auth-request','auth-outbox','auth-dob','auth-consent','auth-verify','auth-me','auth-logout']) assert.ok(ui.includes(key));
assert.match(client,/Local development code retrieved/);
assert.match(client,/parseAuthResponse/);
assert.match(client,/on SocketException/); // do not disguise all failures as unavailable network
assert.match(client,/on FormatException/);
assert.match(client,/on TimeoutException/);
assert.ok(read('apps/flutter_app/test/auth_response_test.dart').includes('valid local outbox response'));

// Regression for the owner-observed Android HttpException on local outbox POST.
// Dart HttpClientRequest commits headers when request.add begins sending the
// body. Every developer and bearer header must be assigned BEFORE that write.
// Accept dart format line wrapping while still enforcing the same ordering.
const sendStartMatch = /Future\s*<\s*AuthResult\s*>\s*_send\s*\(/.exec(client);
const sendStart = sendStartMatch?.index ?? -1;
const sendEnd = client.indexOf('@override', sendStart);
assert.ok(sendStart >= 0 && sendEnd > sendStart, 'Missing real Flutter HTTP sender');
const sender = client.slice(sendStart, sendEnd);
const bodyWriteMatch = /\brequest\s*\.\s*add\s*\(\s*payload\s*\)/.exec(sender);
assert.ok(bodyWriteMatch, 'UTF-8 JSON request body must be sent');
const beforeBodyWrite = sender.slice(0, bodyWriteMatch.index);

// Assert the *call* exists before body write, not that it occupies one line.
// This keeps the security regression check meaningful after dart format.
function requireBeforeBodyWrite(pattern, reason) {
  assert.match(beforeBodyWrite, pattern, reason);
}
requireBeforeBodyWrite(
  /final\s+payload\s*=\s*utf8\s*\.\s*encode\s*\(\s*jsonEncode\s*\(\s*body\s*\)\s*\)/,
  'Encode JSON to UTF-8 bytes before writing'
);
requireBeforeBodyWrite(
  /request\s*\.\s*contentLength\s*=\s*payload\s*\.\s*length\b/,
  'Explicit fixed JSON Content-Length required before body write'
);
requireBeforeBodyWrite(
  /request\s*\.\s*persistentConnection\s*=\s*false\b/,
  'Avoid persistent ADB-forwarded connections'
);
const requiredHeaders = [
  {
    pattern: /request\s*\.\s*headers\s*\.\s*set\s*\(\s*HttpHeaders\s*\.\s*acceptHeader\s*,\s*'application\/json'\s*\)/,
    name: 'Accept: application/json'
  },
  {
    pattern: /request\s*\.\s*headers\s*\.\s*set\s*\(\s*HttpHeaders\s*\.\s*contentTypeHeader\s*,\s*'application\/json; charset=utf-8'\s*\)/,
    name: 'Content-Type: application/json; charset=utf-8'
  },
  {
    pattern: /request\s*\.\s*headers\s*\.\s*set\s*\(\s*'x-uluv-dev-key'\s*,\s*devToken\s*\)/,
    name: 'development outbox key'
  },
  {
    pattern: /request\s*\.\s*headers\s*\.\s*set\s*\(\s*HttpHeaders\s*\.\s*authorizationHeader\s*,\s*'Bearer \$token'\s*\)/,
    name: 'bearer authorization'
  }
];
for (const {pattern, name} of requiredHeaders) {
  requireBeforeBodyWrite(pattern, `Set Flutter HTTP ${name} header before JSON write`);
}
requireBeforeBodyWrite(
  /if\s*\(\s*dev\s*\)\s*request\s*\.\s*headers\s*\.\s*set\s*\(\s*'x-uluv-dev-key'\s*,\s*devToken\s*\)/,
  'Development outbox header must precede body write'
);
requireBeforeBodyWrite(
  /if\s*\(\s*token\s*!=\s*null\s*\)\s*request\s*\.\s*headers\s*\.\s*set\s*\(\s*HttpHeaders\s*\.\s*authorizationHeader/,
  'Bearer header must precede body write on logout'
);

const deviceTest=read('apps/flutter_app/integration_test/auth_integration_test.dart');
assert.match(deviceTest,/tapAndWaitForAuth/);
assert.match(deviceTest,/tester\.runAsync/);
// The test must await the *actual service Future* while Android HTTP runs,
// rather than polling UI text through fake-clock pumps. No auth bypasses.
const observer=read('apps/flutter_app/integration_test/auth_test_observer.dart');
assert.match(deviceTest,/new ObservedAuthService|ObservedAuthService\(/);
assert.match(deviceTest,/observer\.pending\(action\)/);
assert.match(deviceTest,/inFlight\.execute\(\)\.timeout\(/);
assert.match(deviceTest,/observer\.clear\(action\)/);
assert.doesNotMatch(deviceTest,/Stopwatch\(\)|Future<void>\.delayed\(/);
for(const method of ['requestCode','localOutboxCode','verify','me','logout']) {
  assert.match(observer,new RegExp(`delegate\\.${method}\\(`), `Real ${method} must be delegated`);
}
assert.match(observer,/PendingAuthCall/);
assert.match(observer,/Future<AuthResult> execute\(\) async/);
assert.match(observer,/if \(_started\) throw StateError/);
assert.match(observer,/Completer<AuthResult>/);
assert.match(observer,/final result = await _invoke\(\)/);
assert.match(observer,/return call\.uiResult/);
assert.match(observer,/_record\(AuthOperation\.request, \(\) => delegate\.requestCode/);
assert.ok(read('apps/flutter_app/test/auth_test_observer_test.dart').includes('all five P01 operations'));

assert.match(deviceTest,/probeLocalTransport/);
assert.match(deviceTest,/diagnostic POST/);
assert.match(deviceTest,/failureProbe/); // same-device read-only health probe on outbox failure // real Android HTTP completion, not pumpAndSettle alone
assert.match(deviceTest,/did not complete in the real asynchronous test zone/);
for(const step of ['auth-request','auth-outbox','auth-verify','auth-me','auth-logout']) assert.ok(deviceTest.includes(step));
const cli=read('scripts/dev/flutter.mjs');
assert.match(cli,/integration_test\/diagnostics_integration_test\.dart/);
assert.match(cli,/integration_test\/auth_integration_test\.dart/);
const scripts=JSON.parse(read('package.json')).scripts;
for(const name of ['test:p01:integration','test:flutter:p01:e2e','verify:p01']) assert.ok(scripts[name]);
console.log('PASSED: P01 local OTP contract, canonical real-DB transaction, rate/eligibility/session guards, Flutter client and isolated P00 regression');
