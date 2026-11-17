import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const shell = read('apps/flutter_app/lib/features/auth/account_navigation.dart');
const gate = read('apps/flutter_app/lib/features/auth/persistent_gate.dart');
const auth = read('apps/flutter_app/lib/features/auth/auth_screen.dart');
const workspace = read('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const app = read('apps/api/src/app.ts');

function assertTabs(source) {
  assert.match(source, /\bIndexedStack\s*\(/);
  assert.match(source, /\bNavigationBar\s*\(/);
  assert.match(source, /\bonDestinationSelected\s*:\s*onSelect\b/);
  assert.match(source, /\bselectedIndex\s*:\s*selectedIndex\b/);
  assert.match(source, /\bonPopInvokedWithResult\s*:/);
  assert.match(source, /\bif\s*\(\s*!didPop\s*\)\s*onBack\s*\(\s*\)/);
  for (const tab of ['home', 'settings']) {
    assert.match(source, new RegExp(`Key\\s*\\(\\s*'p02-tab-${tab}'\\s*\\)`));
  }
  assert.equal((source.match(/NavigationDestination\s*\(/g) ?? []).length, 5);
  assert.match(source, /if\s*\(profileComplete\) \.\.\./);
  assert.match(source, /this\.profileComplete = false/);
}

test('navigation preserves two-tab default, conditional five-tab shell and inactive page state', () => {
  assertTabs(shell);
  assert.throws(() => assertTabs(shell.replace('IndexedStack(', 'Column(')));
  assert.throws(() => assertTabs(shell.replace('onDestinationSelected: onSelect', 'onDestinationSelected: null')));
});

test('P01 persistent authentication gate uses the real existing profile and device panels', () => {
  assert.match(gate, /\bbottomNavigation\s*:\s*true\b/);
  assert.match(gate, /\bprofileRepository\s*:\s*HttpProfileRepository\s*\(/);
  assert.match(auth, /\bProfileWorkspace\s*\(/);
  assert.match(auth, /\binitiallyExpanded\s*:\s*true\b/);
  assert.match(gate, /\bsettingsBuilder\s*:/);
  assert.match(gate, /DeviceManagementPanel\s*\(/);
  assert.match(gate, /\bRenewingAuthService\s*\(/);
  assert.match(gate, /\bSessionStage\.authenticated\b/);
  assert.match(workspace, /\bwidget\.initiallyExpanded\b/);
});

test('password and device operations remain on Settings, not a new fake API', () => {
  assert.match(auth, /\btoken\s*!=\s*null\s*&&\s*widget\.bottomNavigation/);
  assert.match(auth, /\b_accountControls\s*\(\s*tabbed\s*:\s*true\s*\)/);
  assert.match(auth, /\bwidget\.settingsContent\b/);
  assert.match(auth, /\bwidget\.service\.me\s*\(/);
  assert.match(auth, /\bpasswords!\.changePassword\s*\(/);
  assert.match(auth, /\bwidget\.service\.logout\s*\(/);
  for (const sensitive of ['password', 'confirm', 'currentPassword', 'newPassword']) {
    assert.match(auth, new RegExp(`${sensitive}\\.clear\\s*\\(\\s*\\)`));
  }
  // Earlier P01 AuthScreen surfaces remain available to their existing tests.
  assert.match(auth, /\.\.\._accountControls\s*\(\s*\)/);
});

test('reported Fastify unknown-error TypeScript failure is narrowed before reading code', () => {
  assert.match(app, /typeof\s+error\s*===\s*'object'/);
  assert.match(app, /'code'\s+in\s+error\s*&&\s*error\.code\s*===\s*'FST_ERR_CTP_BODY_TOO_LARGE'/);
  assert.doesNotMatch(app, /\bif\s*\(\s*error\.code\s*===/);
});
