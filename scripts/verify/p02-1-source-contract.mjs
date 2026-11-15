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
assert.match(workspace, /p02-save-draft/);
assert.match(workspace, /confirmDiscard/);
// Mutation checks: removing essential security behavior must break the guard.
assert.equal(guarded(auth.replace(/registerProfileRoutes\s*\(\s*app\s*,\s*db\s*,\s*requireSession\s*\)/, 'void 0')), false);
assert.equal(guardedCreate(api.replace(/requestedActive\s*:\s*false/, 'requestedActive: true')), false);
assert.equal(guardedUpdate(api.replace('#version = :expected AND attribute_exists(PK)', '#version > :expected')), false);
assert.equal(renewedAccess(gate.replace(/access\s*:\s*sessions\.access/, 'access: () => Future.value("stale")')), false);
console.log('PASS P02-1 static contracts: shared session, private create, CAS, fresh mobile access, mutation negatives');
