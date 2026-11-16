/** Formatting-invariant P02-1 source contract. Actual behavior also has unit/live tests. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (p) => readFileSync(p, 'utf8');
const auth = source('apps/api/src/features/auth/routes.ts');
const api = source('apps/api/src/features/profiles/routes.ts');
const policy = source('apps/api/src/features/profiles/validation.ts');
const gate = source('apps/flutter_app/lib/features/auth/persistent_gate.dart');
const workspace = source('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const client = source('apps/flutter_app/lib/features/profiles/profile_service.dart');

function guarded(text) {
  return /registerProfileRoutes\s*\(\s*app\s*,\s*db\s*,\s*requireSession\s*\)/.test(text);
}
function guardedCreate(text) {
  return /requestedActive\s*:\s*false/.test(text) && /ConditionExpression\s*:\s*'attribute_not_exists\(PK\)'/.test(text);
}
function guardedUpdate(text) {
  return /#version\s*=\s*:expected\s+AND\s+attribute_exists\(PK\)/.test(text);
}
function renewedAccess(text) {
  return /access\s*:\s*sessions\.access/.test(text);
}
assert.ok(guarded(auth), 'route must reuse P01 session guard');
assert.ok(guardedCreate(api), 'draft creation must remain private and conditional');
assert.ok(guardedUpdate(api), 'draft updates require CAS');
assert.match(api, /TransactWriteCommand/);
assert.match(api, /ConditionCheck/);
assert.doesNotMatch(api, /\bScanCommand\b|\bQueryCommand\b|\bBatchWriteCommand\b/);
assert.match(policy, /invalid_profile_fields/);
assert.match(policy, /const allowed = new Set/); // explicit positive-field allowlist
assert.doesNotMatch(policy.match(/const allowed = new Set\([^;]+/s)?.[0] ?? '', /requestedActive/);
assert.ok(renewedAccess(gate), 'profile must request a freshly valid device token');
assert.match(gate, /ProfileWorkspace/);
assert.match(client, /client\.putUrl/);
assert.match(workspace, /p02-save-next/);
assert.doesNotMatch(workspace, /key:\s*const Key\('p02-save-(?:draft|handle|common)'\)/);
assert.match(workspace, /confirmDiscard/);

// P02-1 Common Profile regression repairs (2026-11-15): keep meaningful
// guards for the three real owner-reported failures, not brittle whitespace.
const integration = source('scripts/verify/p02-1-profile-integration.mjs');
const android = source('apps/flutter_app/integration_test/p02_1_profile_integration_test.dart');
const androidRunner = source('scripts/verify/p02-1-android-e2e.mjs');
const androidGradle = source('apps/flutter_app/android/app/build.gradle.kts');
const androidNative = source('apps/flutter_app/android/app/src/main/kotlin/com/example/uluv/MainActivity.kt');
const flutterCommand = source('scripts/dev/flutter.mjs');
assert.match(integration, /B reads its own saved Friendship draft/);
assert.match(integration, /B cannot see A-only Dating record/);
assert.match(integration, /B writes do not affect A draft/);
assert.doesNotMatch(integration, /b\.token[^\n]+data\.exists,\s*false,\s*['"]other account cannot see private draft/);
assert.match(androidGradle, /ULUV_P02_1_ISOLATED_ANDROID_TEST/);
assert.match(androidGradle, /applicationIdSuffix\s*=\s*['"]\.p02isolated['"]/);
assert.match(androidRunner, /resetP02TestApp/);
assert.match(androidRunner, /resetTestApp\(\)/);
const androidPackage = source('scripts/verify/p02-1-android-package.mjs');
assert.match(androidPackage, /com\.example\.uluv\.p02isolated/);
assert.match(androidPackage, /pm['"],\s*['"]list['"],\s*['"]packages/);
assert.doesNotMatch(androidPackage, /pm['"],\s*['"]path/);
assert.match(flutterCommand, /ULUV_P02_1_ISOLATED_ANDROID_TEST/);
assert.match(android, /if\s*\(existing\s*!=\s*null\)/);
assert.match(android, /expect\(packageId,\s*['"]com\.example\.uluv\.p02isolated['"]/);
assert.match(androidNative, /['"]applicationId['"]\s*->\s*result\.success\(packageName\)/);
assert.doesNotMatch(android.replace(/\/\/[^\n]*/g, ''), /expect\(existing,\s*isNull/);
assert.match(workspace, /await refreshAfterDraftSave\(\);/);
assert.match(workspace, /p02-handle-error/);
// A handle-only write must refresh the server's readiness without reloading
// unsaved common and mode editor controllers. Assert a behavior boundary,
// independent of formatting, with a negative mutation that would break it.
function handleSavePreservesForms(source) {
  const handler = source.split(/Future\s*<void>\s*saveHandle\s*\(\s*\)\s*async\s*\{/)[1]
    ?.split(/Future\s*<void>\s*saveDraft\s*\(\s*\)\s*async\s*\{/)[0] ?? '';
  return /await\s+refreshAfterDraftSave\s*\(\s*preserveEditors\s*:\s*true\s*\)/.test(handler)
    && /if\s*\(\s*!preserveEditors\s*&&\s*!commonDirty\s*\)\s*loadCommon\s*\(\)/.test(source)
    && /if\s*\(\s*!preserveEditors\s*&&\s*!dirty\s*\)\s*loadMode\s*\(\s*mode\s*\)/.test(source)
    && !/await\s+load\s*\(\s*first\s*:\s*true/.test(handler);
}
assert.ok(handleSavePreservesForms(workspace), 'handle-only save must not reload unsaved editor fields');
assert.equal(handleSavePreservesForms(workspace.replace(/preserveEditors\s*:\s*true/, 'preserveEditors: false')), false);
// Mutation checks: removing essential security behavior must break the guard.
assert.equal(guarded(auth.replace(/registerProfileRoutes\s*\(\s*app\s*,\s*db\s*,\s*requireSession\s*\)/, 'void 0')), false);
assert.equal(guardedCreate(api.replace(/requestedActive\s*:\s*false/, 'requestedActive: true')), false);
const modeEditor = api.split("app.put('/v1/profiles/me/:mode'")[1]?.split("app.get('/v1/profiles/me/:mode/preview'")[0] ?? '';
assert.ok(guardedUpdate(modeEditor), 'draft write must check exact version');
assert.equal(guardedUpdate(modeEditor.replace('#version = :expected AND attribute_exists(PK)', '#version > :expected')), false);
assert.equal(renewedAccess(gate.replace(/access\s*:\s*sessions\.access/, 'access: () => Future.value("stale")')), false);
console.log('PASS P02-1 static contracts: shared session, private create, CAS, fresh access, privacy fixture, isolated Android, readiness race, mutation negatives');
