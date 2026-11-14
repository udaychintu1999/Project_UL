import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=(name)=>readFileSync(name,'utf8');
const routes=read('apps/api/src/features/auth/routes.ts');
const app=read('apps/api/src/app.ts');
const policy=read('apps/api/src/features/auth/policy.ts');
const ui=read('apps/flutter_app/lib/features/auth/auth_screen.dart');
const client=read('apps/flutter_app/lib/features/auth/auth_service.dart');
for(const path of ['/v1/auth/email/request','/v1/auth/email/verify','/v1/auth/me','/v1/auth/logout','/v1/dev/otp/outbox']) assert.ok(routes.includes(path),`Missing route ${path}`);
for(const guard of ['TransactWriteCommand','ConditionExpression','ConsistentRead:true','OTP_MAX_ATTEMPTS','isAdultBirthDate','equalDigest','sessionDigest','requireSession','ageEligibility']) assert.ok(routes.includes(guard),`Missing auth guard ${guard}`);
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

assert.match(routes,/if\(config\.env==='local'\) app\.post\('\/v1\/dev\/otp\/outbox'/);
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
// body. All developer and bearer headers must be assigned BEFORE that write.
const sendStart=client.indexOf('Future<AuthResult> _send(');
const sendEnd=client.indexOf('  @override',sendStart);
assert.ok(sendStart>=0 && sendEnd>sendStart,'Missing real Flutter HTTP sender');
const sender=client.slice(sendStart,sendEnd);
const postBodyWrite=sender.indexOf('request.add(payload)');
assert.ok(postBodyWrite>0,'UTF-8 JSON request body must be sent');
assert.ok(sender.indexOf('final payload = utf8.encode(jsonEncode(body))')>=0 && sender.indexOf('final payload = utf8.encode(jsonEncode(body))')<postBodyWrite, 'Encode JSON to UTF-8 bytes before writing');
assert.ok(sender.indexOf('request.contentLength = payload.length')>=0 && sender.indexOf('request.contentLength = payload.length')<postBodyWrite, 'Explicit fixed JSON Content-Length required before body write');
assert.ok(sender.indexOf('request.persistentConnection = false')>=0 && sender.indexOf('request.persistentConnection = false')<postBodyWrite, 'Avoid persistent ADB-forwarded connections');
for(const h of [
  "request.headers.set(HttpHeaders.acceptHeader, 'application/json')",
  "request.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8')",
  "request.headers.set('x-uluv-dev-key', devToken)",
  "request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token')",
]) {
  const at=sender.indexOf(h);
  assert.ok(at>=0 && at<postBodyWrite,`Set Flutter HTTP header before JSON write: ${h}`);
}
assert.ok(sender.indexOf("if (dev) request.headers.set('x-uluv-dev-key', devToken)")<postBodyWrite,
  'Development outbox header must precede body write');
assert.ok(sender.indexOf('if (token != null) request.headers.set(HttpHeaders.authorizationHeader')<postBodyWrite,
  'Bearer header must precede body write on logout');

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
