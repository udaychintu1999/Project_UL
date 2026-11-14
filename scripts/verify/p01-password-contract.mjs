import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const r=p=>readFileSync(p,'utf8');
// Source-presence checks (and Node --check for .ts files) can PASS malformed TS.
// Node 22's SWC-based type-stripping parser rejects malformed TypeScript syntax offline.
const routes=r('apps/api/src/features/auth/password.ts'),core=r('apps/api/src/features/auth/routes.ts');
assert.doesNotThrow(()=>stripTypeScriptTypes(routes,{mode:'strip'}),'P01-2 password.ts must parse as valid TypeScript');
assert.doesNotThrow(()=>stripTypeScriptTypes(core,{mode:'strip'}),'P01-2 signup/login routes must parse as valid TypeScript');
const client=r('apps/flutter_app/lib/features/auth/auth_service.dart'),ui=r('apps/flutter_app/lib/features/auth/auth_screen.dart');
for(const path of ['/v1/auth/password/set','/v1/auth/password/login','/v1/auth/password/change','/v1/auth/password/recovery/request','/v1/auth/password/recovery/reset','/v1/dev/password/recovery/outbox'])assert.ok(routes.includes(path),`Missing password route ${path}`);
for(const token of ['argonHash','argonVerify','Algorithm.Argon2id','TransactWriteCommand','ConditionExpression','ConsistentRead:true','LOGIN_ATTEMPT_LIMIT','resetHash','sessionEpoch','PASSWORD_RECENT_AUTH_SECONDS'])assert.ok(routes.includes(token),`Missing password guard ${token}`);
assert.ok(core.includes('registerLocalPasswordAuth'));assert.ok(core.includes('sessionEpoch'));
assert.match(routes,/if\(localMode\)app\.post\('\/v1\/dev\/password\/recovery\/outbox'/);
assert.doesNotMatch(routes,/ScanCommand|SendEmailCommand|SESClient|googleapis|password\s*:\s*data\.password/);
for(const key of ['auth-password','auth-password-login','auth-password-set','auth-password-change','auth-recovery-request','auth-recovery-reset','auth-mode-otp'])assert.ok(ui.includes(key));
for(const method of ['passwordLogin','setPassword','changePassword','requestPasswordRecovery','localPasswordRecoveryCode','resetPassword'])assert.ok(client.includes(method));
assert.ok(r('apps/flutter_app/test/password_auth_widget_test.dart').includes('password login is the primary flow'));
assert.ok(r('scripts/verify/p01-password-integration.mjs').includes('session epoch revocation')||r('scripts/verify/p01-password-integration.mjs').includes('sessionEpoch'));
const pkg=JSON.parse(r('apps/api/package.json'));assert.ok(pkg.dependencies['@node-rs/argon2']);
assert.match(r('apps/api/src/features/auth/routes.ts'), /'\/v1\/auth\/signup\/register'/);
assert.match(r('apps/api/src/features/auth/password-policy.ts'), /PASSWORD_MIN_LENGTH=15/);
assert.match(core, /purpose/);
assert.match(core, /finishEmailVerification\(request,reply,'signup'\)/);
assert.match(core, /finishEmailVerification\(request,reply,'login'\)/);
assert.match(core, /CREDENTIAL#PASSWORD/);
assert.match(client, /SignupPasswordAuthService/);
assert.match(ui, /auth-signup-register/);
console.log('PASS: P01-2 Argon2id, separate credentials, login limits, immutable identity, session epoch, recovery and Flutter source contracts');
