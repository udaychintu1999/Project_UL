import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace = readFileSync('apps/flutter_app/lib/features/profiles/profile_workspace.dart', 'utf8');
const ui = readFileSync('apps/flutter_app/integration_test/p02_2_ui_integration_test.dart', 'utf8');
const photos = readFileSync('apps/flutter_app/lib/features/profiles/profile_photos_panel.dart', 'utf8');

// These source guards complement, but do not replace, real Flutter widget and
// physical Android UI tests. Check invariants rather than whitespace layout.
test('guidance is dynamic: only saved enabled modes add their detail/photo steps', () => {
  assert.match(workspace, /if\s*\(dashboard\?\.shared\.dating\s*==\s*true\)/);
  assert.match(workspace, /if\s*\(dashboard\?\.shared\.friendship\s*==\s*true\)/);
  for (const step of ['common', 'dating.details', 'dating.photos',
    'friendship.details', 'friendship.photos', 'review']) {
    assert.ok(workspace.includes(`'${step}'`), `missing wizard step ${step}`);
  }
});

test('next and forward swipe require saved current step and cannot skip', () => {
  const guard = workspace.match(/void stepTo\(int index\)\s*\{([\s\S]*?)\n  \}\n\n  void swipeStep/)?.[1] ?? '';
  assert.ok(guard, 'navigation gate must exist');
  assert.match(guard, /index\s*!=\s*current\s*\+\s*1\s*\|\|\s*!stepSaved\(activeStep\)/);
  assert.match(workspace, /onHorizontalDragEnd:\s*swipeStep/);
  assert.match(workspace, /onPressed:\s*currentComplete\s*\?/);
  assert.ok(!guard.replace(/index\s*!=\s*current\s*\+\s*1\s*\|\|\s*!stepSaved\(activeStep\)/, '').includes('index != current + 1 || !stepSaved(activeStep)'),
    'forward validation must remain central');
});

test('all step gates rely on backend saved state and require owner-READY photos', () => {
  assert.match(workspace, /shared\.setupRevision\s*<\s*1/);
  assert.match(workspace, /profile\.exists/);
  assert.match(workspace, /profile\.photoIds\.toSet\(\)\.length\s*>=\s*2/);
  assert.match(workspace, /!missing\.contains\('\$profileMode\.photos'\)/);
  assert.match(workspace, /!missing\.contains\('photoVerificationPending'\)/);
  assert.match(workspace, /onboarding:\s*const OnboardingStatus\(/);
  assert.match(workspace, /refreshAfterDraftSave\(preserveEditors:\s*true\)/);
});

test('warnings are strong red; redundant Saved account details panel is gone', () => {
  assert.match(workspace, /fontWeight:\s*FontWeight\.w700/);
  assert.match(workspace, /color:\s*Theme\.of\(context\)\.colorScheme\.error/);
  assert.doesNotMatch(workspace, /Saved account details|p02-saved-name|p02-saved-gender|p02-saved-modes/);
  assert.match(photos, /FontWeight\.w700/);
});

test('final review includes account and separate modes with owner photo previews', () => {
  for (const part of ['Username: @', 'Display name:', 'City:', 'Gender:',
    'Enabled modes:', 'Bio:', 'Intention:', 'Interests:', 'Photos:', 'reviewPhoto(id)']) {
    assert.ok(workspace.includes(part), `review missing ${part}`);
  }
  assert.match(workspace, /profile setup complete/i);
  assert.match(workspace, /onPressed:\s*busy\s*\|\|\s*!stepSaved\('review'\)\s*\?\s*null/);
});

test('physical Android E2E follows Next/Back step gates and real Continue tap', () => {
  for (const required of ["_next(tester, 'Dating details')",
    "_next(tester, 'Dating photos')", "_next(tester, 'Friendship details')",
    "_next(tester, 'Friendship photos')", "_next(tester, 'Review your profile')",
    "_back(tester, 'Common profile')", 'await _tapReadyContinue(tester)',
    '_checkpoint(13,']) {
    assert.ok(ui.includes(required), `Android E2E missing ${required}`);
  }
  assert.doesNotMatch(ui, /p02-saved-name|p02-saved-modes/);
  assert.doesNotMatch(ui, /FakeProfileRepository|FakeAuthService/);
});


test('final review fetches actual photos through the typed media capability', () => {
  const review = workspace.split(/Widget\s+reviewPhoto\s*\(/)[1]?.split(/Widget\s+reviewPage\s*\(/)[0] ?? '';
  assert.ok(review, 'final photo review must be present');
  assert.match(review, /is!\s+ProfileMediaRepository/, 'non-media repositories must remain safe');
  assert.match(review, /as\s+ProfileMediaRepository/, 'media operations need an explicit typed interface');
  assert.match(review, /mediaRepository\.photoBytes\(mediaId\)/,
    'photo previews must use the typed media repository');
  assert.doesNotMatch(review, /future\s*:\s*repository\.photoBytes\(/,
    'ProfileRepository does not declare photoBytes and must not be used for the media read');

  // Negative test: the exact previously reported compile regression fails this guard.
  const broken = review.replace('mediaRepository.photoBytes(mediaId)', 'repository.photoBytes(mediaId)');
  assert.doesNotMatch(broken, /mediaRepository\.photoBytes\(mediaId\)/);
  assert.match(broken, /repository\.photoBytes\(mediaId\)/);
});
