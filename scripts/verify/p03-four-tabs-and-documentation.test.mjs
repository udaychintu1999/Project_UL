import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const file = (p) => readFileSync(resolve(root, p), 'utf8');
const nav = file('apps/flutter_app/lib/features/auth/account_navigation.dart');
const auth = file('apps/flutter_app/lib/features/auth/auth_screen.dart');
const profile = file('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const friendship = file('apps/flutter_app/lib/features/geo/friendship_sections.dart');
const settings = file('apps/flutter_app/lib/features/geo/geo_settings_panel.dart');
const manual = file('apps/flutter_app/lib/features/geo/india_location.dart');
const design = file('docs/ui/DESIGN_SYSTEM.md');
const product = file('docs/product/PRODUCT_CONTRACT.md');

test('owner-approved 2/5 navigation: Dating, Friendship, Local Feed, Connects, Settings', () => {
  // Older shared product/design docs have a four-tab historical design. This
  // P03 owner change intentionally supersedes that *navigation-only* detail;
  // do not rewrite P01/P02 docs as part of a scoped P03 update.
  assert.match(design, /Four main tabs/);
  assert.match(product, /Four main tabs/);
  const bottoms = nav.match(/NavigationDestination\s*\(/g) ?? [];
  assert.equal(bottoms.length, 5);
  const labels = ["label: 'Dating'", "label: 'Friendship'", "label: 'Local Feed'",
    "label: 'Connects'", "label: 'Settings'"];
  const indexes = labels.map(label => nav.indexOf(label));
  assert.ok(indexes.every(i => i >= 0), 'Every requested destination exists');
  assert.deepEqual([...indexes].sort((a,b)=>a-b), indexes, 'Destinations are in owner-defined order');
  assert.doesNotMatch(nav, /label:\s*'Home'/);
  assert.match(nav, /profileComplete\s*\?\s*dating\s*:\s*home/);
  assert.match(nav, /if \(profileComplete\) \.\.\./);
  assert.match(friendship, /mode: 'friendship'/);
  assert.doesNotMatch(friendship, /SegmentedButton|local-feed|activities/);
  const local = file('apps/flutter_app/lib/features/geo/local_feed_activities_sections.dart');
  assert.match(local, /'local-feed', 'activities'/);
  assert.match(local, /DiscoveryLocationGate/);
  assert.match(auth, /selectedAccountTab = ready \? 4 : 1/);
  assert.match(auth, /profileComplete \? 4 : 1/);
  assert.match(auth, /selectedAccountTab == 2/);
});

test('Settings owns verified profile summary/edit and keeps old auth/session security', () => {
  assert.match(auth, /profileWorkspace\(compact: true\)/);
  assert.match(auth, /profileComplete \? const SizedBox\.shrink\(\)/);
  assert.match(profile, /widget\.compactSummary/);
  assert.match(profile, /p03-settings-profile-summary/);
  assert.match(profile, /p03-settings-edit-profile/);
  assert.match(profile, /p02-activate-\$selected/);
  assert.match(profile, /p02-owner-preview-\$selected/);
  assert.match(auth, /_accountControls\(tabbed: true\)/);
  assert.match(auth, /passwords!\.changePassword/);
  assert.match(auth, /widget\.service\.logout/);
  assert.match(file('apps/flutter_app/lib/features/auth/persistent_gate.dart'), /RenewingAuthService/);
});

test('Location & discovery is a compact expansion with safe retry and no automatic GPS', () => {
  assert.match(settings, /ExpansionTile\(/);
  assert.match(settings, /title:const Text\('Location & discovery'\)/);
  assert.match(settings, /compact:true/);
  assert.match(settings, /p03-settings-retry-saved/);
  assert.match(manual, /this\.compact = false/);
  assert.match(manual, /if \(!widget\.compact\) Wrap/);
  assert.match(manual, /if \(widget\.showGps\) OneTimeGpsPanel/);
  assert.match(file('apps/flutter_app/lib/features/geo/discovery_location_gate.dart'), /showGps: false, compact: true/);
});

test('living phase documentation indexes actual auth and geo APIs without claiming public discovery', () => {
  const doc = file('docs/architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md');
  const api = file('docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md');
  const index = file('docs/handoff/TECHNICAL_DOCS_INDEX.md');
  assert.match(doc, /five main tabs/i);
  assert.match(doc, /Settings/);
  assert.match(api, /GET \/v1\/me\/geo\/location/);
  assert.match(api, /PUT \/v1\/me\/geo\/manual/);
  assert.match(api, /POST \/v1\/me\/geo\/gps/);
  assert.match(api, /GET \/v1\/profiles\/me/);
  assert.match(index, /P01-3 30-day persistent sign-in/);
  assert.match(index, /P13_REAUTH_SECONDS/);
  assert.match(file('apps/api/src/features/auth/device-session-policy.ts'), /P13_REAUTH_SECONDS = 30 \* 24 \* 60 \* 60/);
  for (const path of ['docs/p03/02_GEO_DATA_STORAGE_AND_H3.md',
    'docs/manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md',
    'docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md',
    'apps/api/src/features/profiles/routes.ts']) {
    assert.ok(existsSync(resolve(root, path)), path);
  }
  assert.doesNotMatch(api, /public discovery enabled/i);
});
