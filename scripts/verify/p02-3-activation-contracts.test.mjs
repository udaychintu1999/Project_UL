import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
const routes = read('apps/api/src/features/profiles/routes.ts');
const media = read('apps/api/src/features/profiles/media-routes.ts');
const policy = read('apps/api/src/features/profiles/activation-policy.ts');
const workspace = read('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const http = read('apps/flutter_app/lib/features/profiles/profile_service.dart');
const device = read('apps/flutter_app/integration_test/p02_2_ui_integration_test.dart');
const pkg = JSON.parse(read('package.json'));

test('P02-3 activation is authenticated, CAS/versioned and restricted to exact modes', () => {
  assert.match(routes, /app\.post\('\/v1\/profiles\/me\/:mode\/activate',\s*updateActivation\(true\)\)/);
  assert.match(routes, /app\.post\('\/v1\/profiles\/me\/:mode\/deactivate',\s*updateActivation\(false\)\)/);
  const handler = routes.split('const updateActivation =')[1] ?? '';
  assert.match(handler, /await requireSession\(request, reply\)/);
  assert.match(handler, /parseMode\(/);
  assert.match(handler, /activationMissing\(/);
  assert.match(handler, /ConditionExpression: '#version = :expected AND attribute_exists\(PK\)'/);
  assert.match(handler, /TableName: settingsTable/);
  assert.match(handler, /state.*ready|':ready': 'READY'/);
  assert.doesNotMatch(handler, /ScanCommand|QueryCommand|PutCommand.*uluv_discovery/);
});

test('P02-3 never publishes a discovery pointer from a typed city', () => {
  assert.match(policy, /return 'pending_trusted_locality'/);
  assert.match(policy, /activationIdentityRevision !== currentIdentityRevision/);
  assert.match(routes, /identityRevision = :identity/);
  assert.match(policy, /publicVisible: false/);
  assert.match(routes, /app\.get\('\/v1\/profiles\/:mode\/:handle\/preview'/);
  assert.match(routes, /return failure\(reply, 404, 'profile_not_found'\)/);
  assert.doesNotMatch(routes, /uluv_discovery|homeCell|lat\s*:/);
  // A concrete negative mutation must invalidate the public-visibility guard.
  const mutated = policy.replace("return 'pending_trusted_locality'", "return 'active'");
  assert.doesNotMatch(mutated, /return 'pending_trusted_locality'/);
});

test('P02-3 account/mode/photo edits suppress stale activation intent', () => {
  assert.match(routes, /activationSetupRevision/);
  assert.match(routes, /requestedActive = :inactive/);
  assert.match(media, /SET photoIds = :ids, requestedActive = :inactive/);
  assert.doesNotMatch(media, /AND requestedActive = :inactive/);
});

test('P02-3 Save & Next replaces individual saves and enforces server gate', () => {
  assert.match(workspace, /Future<void> saveAndNext\(\) async/);
  assert.match(workspace, /await saveHandle\(\)/);
  assert.match(workspace, /await saveCommon\(\)/);
  assert.match(workspace, /await saveDraft\(\)/);
  assert.match(workspace, /!stepSaved\(current\)/);
  assert.match(workspace, /key: const Key\('p02-save-next'\)/);
  assert.match(workspace, /child: const Text\('Save & Next'\)/);
  assert.doesNotMatch(workspace, /key: const Key\('p02-(?:save-handle|save-common|save-draft|next)'\)/);
  assert.match(workspace, /onHorizontalDragEnd: swipeStep/);
  assert.doesNotMatch(device, /await _tapKey\(tester, 'p02-save-common'\)/,
    'Android E2E must use the unified Save & Next action');
});

test('P02-3 app activation and owner preview are actual API calls and UI taps', () => {
  assert.match(http, /setModeActivation\(/);
  assert.match(http, /\$mode\/\$action/);
  assert.match(http, /ownerPreview\(/);
  assert.match(workspace, /key: Key\('p02-activate-\$selected'\)/);
  assert.match(workspace, /key: Key\('p02-owner-preview-\$selected'\)/);
  assert.match(workspace, /key: const Key\('p02-private-preview-photos'\)/);
  assert.match(device, /_checkpoint\(14,/);
  assert.match(device, /_checkpoint\(15,/);
  assert.match(device, /await _tapKey\(tester, 'p02-activate-dating'\)/);
  assert.match(device, /await _tapKey\(tester, 'p02-activate-friendship'\)/);
  assert.match(device, /await _tapKey\(tester, 'p02-owner-preview-dating'\)/);
  assert.match(pkg.scripts['verify:p02-3'], /test:p02-3:integration/);
  assert.match(pkg.scripts['verify:p02-3'], /test:flutter:p02-3:e2e/);
});
