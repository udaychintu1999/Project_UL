import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const theme = read('apps/flutter_app/lib/design/uluv_design.dart');
const app = read('apps/flutter_app/lib/main.dart');
const auth = read('apps/flutter_app/lib/features/auth/auth_screen.dart');
const shell = read('apps/flutter_app/lib/features/auth/account_navigation.dart');
const workspace = read('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const photos = read('apps/flutter_app/lib/features/profiles/profile_photos_panel.dart');
const pkg = JSON.parse(read('package.json'));

test('P02-5 design tokens are installed in the real app without extra dependencies', () => {
  assert.match(app, /theme:\s*UluvTheme\.light\(\)/);
  for (const key of ['blush', 'paper', 'pinkAction', 'pinkTint', 'teal', 'tealTint', 'danger']) {
    assert.match(theme, new RegExp('static const Color ' + key + '\\s*='));
  }
  assert.match(theme, /AppBarThemeData\(/);
  assert.match(theme, /InputDecorationThemeData\(/);
  assert.match(theme, /CardThemeData\(/);
  assert.match(theme, /NavigationBarThemeData\(/);
  assert.match(theme, /class UluvSectionCard/);
  assert.match(theme, /class UluvStatusNotice/);
  assert.doesNotMatch(theme, /http:|https:|AssetImage|NetworkImage/);
  assert.doesNotMatch(read('apps/flutter_app/pubspec.yaml'), /google_fonts:|cached_network_image:/);
});

test('P02-5 keeps current authenticated P02 two-tab navigator; future mock tabs are not shipped', () => {
  for (const key of ['p02-bottom-navigation', 'p02-tab-home', 'p02-tab-settings']) {
    assert.ok(shell.includes(key));
  }
  assert.match(shell, /IndexedStack\(/);
  assert.match(shell, /UluvStageBanner\(/);
  const section = shell.match(/destinations:\s*const\s*\[([\s\S]*?)\],/)?.[1] ?? '';
  assert.equal((section.match(/NavigationDestination\(/g) ?? []).length, 2,
    'P03 must implement real four-tab destinations with functional routes');
  assert.doesNotMatch(shell, /onDestinationSelected:\s*\(\w+\)\s*=>\s*\{\s*\}/);
});

test('P02-5 preserves the existing guided Save & Next + swipe flow and server gates', () => {
  for (const original of ['p02-page-common', 'p02-page-dating-details',
    'p02-page-friendship-details', 'p02-page-review', 'p02-swipe-region',
    'p02-save-next', 'p02-back', 'p02-continue']) {
    // Mode keys are interpolated from the selected mode.
    if (original.includes('dating-details') || original.includes('friendship-details')) {
      assert.match(workspace, /p02-page-\$selected-details/);
    } else assert.ok(workspace.includes(original), `${original} removed`);
  }
  assert.match(workspace, /await saveHandle\(\)/);
  assert.match(workspace, /await saveCommon\(\)/);
  assert.match(workspace, /await saveDraft\(\)/);
  assert.match(workspace, /onHorizontalDragEnd:\s*swipeStep/);
  assert.match(workspace, /!stepSaved\(activeStep\)/);
  assert.match(workspace, /profile\.photoIds\.toSet\(\)\.length\s*>=\s*2/);
  assert.match(workspace, /child:\s*const Text\('Save & Next'\)/);
  assert.doesNotMatch(workspace, /Saved account details/);
});

test('P02-5 preserves P01 authentication, photo safety and private activation', () => {
  assert.match(auth, /auth-password-login/);
  assert.match(auth, /auth-request/);
  assert.match(auth, /auth-signup-register/);
  assert.match(workspace, /key:\s*Key\('p02-activate-\$selected'\)/);
  assert.match(workspace, /Private preview — not publicly discoverable/);
  assert.match(photos, /'p02-pick-photo'/);
  assert.match(photos, /'p02-confirm-photo-upload'/);
  assert.match(photos, /'p02-photo-remove-\$index'/);
  assert.match(photos, /'p02-reuse-\$\{item\.mediaId\}'/);
  assert.match(photos, /'p02-delete-\$\{item\.mediaId\}'/);
  assert.match(photos, /child:\s*Wrap\(spacing:\s*2/,
    'edit/reorder controls must be in a wrapping row on small devices');
  assert.match(read('apps/api/src/features/profiles/activation-policy.ts'), /publicVisible: false/);
});

test('P02-5 has an actual Flutter widget suite and preserves comprehensive verification', () => {
  const flutter = read('apps/flutter_app/test/p02_5_visual_reference_test.dart');
  for (const proof of ['320, 640', '360, 640', 'p02-photo-remove-0',
    'p02-tab-settings', 'greaterThanOrEqualTo(4.5)']) {
    assert.ok(flutter.includes(proof), `missing responsive/contrast widget coverage: ${proof}`);
  }
  assert.match(pkg.scripts['verify:p02-5:portable'], /verify:p02-4:portable/);
  assert.match(pkg.scripts['verify:p02-5:portable'], /test:p02-5:contracts/);
  assert.match(pkg.scripts['verify:p02-5'], /p02-5-verifier\.mjs/);
  assert.match(pkg.scripts['verify:p02-4'], /p02-4-verifier\.mjs/);
});


test('P02-5 320dp visual fixture uses a transitive const root so Flutter analyzer gate 5 stays clean', () => {
  const dart = read('apps/flutter_app/test/p02_5_visual_reference_test.dart');
  const fixture = dart.split("testWidgets('reference surface and status are usable at 320dp'")[1]
    ?.split("testWidgets('P02-5 shell preserves")[0] ?? '';
  assert.match(fixture, /home:\s*const\s+Scaffold\(body:\s*SafeArea\(child:\s*SingleChildScrollView\(/,
    'The first visual fixture must have a const Scaffold root; Flutter requires const in every nested widget constructor.');
  assert.match(fixture, /child:\s*Padding\(padding:\s*const\s+EdgeInsets\.all\(12\)/);
  assert.match(fixture, /child:\s*Column\(children:\s*const\s*\[/);
});


test('P02-5 tinted profile choice cards use Material ink surfaces, not background DecoratedBox', () => {
  const section = theme.split('class UluvSectionCard')[1]?.split('class UluvStageBanner')[0] ?? '';
  assert.match(section, /Widget build\(BuildContext context\) => Material\(/,
    'ListTile and SwitchListTile must paint ink on their nearest Material.');
  assert.match(section, /clipBehavior:\s*Clip\.antiAlias/);
  assert.match(section, /child:\s*Padding\(padding:\s*padding, child:\s*child\)/);
  assert.doesNotMatch(section, /=> Container\(/,
    'A tinted decorated Container causes Flutter ListTile background assertions.');
  const widget = read('apps/flutter_app/test/p02_5_visual_reference_test.dart');
  assert.match(widget, /colored mode cards use Material for real switch ink and taps/);
  assert.match(widget, /p25-dating-switch/);
  assert.match(widget, /p25-friendship-switch/);
});

test('P02-5 photo counts and long-page gestures remain robust against visual text/layout changes', () => {
  const photoTest = read('apps/flutter_app/test/p02_2_photo_panel_test.dart');
  const profileTest = read('apps/flutter_app/test/p02_1_profile_workspace_test.dart');
  const authTest = read('apps/flutter_app/test/password_auth_widget_test.dart');
  assert.match(photos, /key:\s*const Key\('p02-photo-count'\)/);
  assert.match(photoTest, /find\.byKey\(const Key\('p02-photo-count'\)\)/);
  assert.doesNotMatch(photoTest, /0\/6 assigned|1\/6 assigned/);
  assert.match(profileTest, /await tester\.flingFrom\(origin, const Offset\(-120, 0\), 900\)/);
  assert.match(profileTest, /swipeOrigin = find\.text\('The real you, first'\)/);
  assert.doesNotMatch(profileTest, /tester\.drag\(find\.byKey\(const Key\('p02-swipe-region'\)\)/);
  const buttonCase = authTest.split('P01-2 registered signup email shows message without OTP form')[1]
    ?.split("testWidgets(")[0] ?? '';
  assert.match(buttonCase, /Scrollable\.ensureVisible\(tester\.element\(goToLogin\)/);
  assert.match(buttonCase, /hitTestWarningShouldBeFatal = true/);
  assert.doesNotMatch(buttonCase, /tester\.tap\(find\.byKey\(const Key\('auth-signup-go-login'\)\)\)/);
});
