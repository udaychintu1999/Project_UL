import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const file=(path)=>readFileSync(resolve(root,path),'utf8');
const auth=file('apps/flutter_app/lib/features/auth/auth_screen.dart');
const gate=file('apps/flutter_app/lib/features/auth/persistent_gate.dart');
const nav=file('apps/flutter_app/lib/features/auth/account_navigation.dart');
const profile=file('apps/flutter_app/lib/features/profiles/profile_workspace.dart');
const location=file('apps/flutter_app/lib/features/geo/discovery_location_gate.dart');
const manual=file('apps/flutter_app/lib/features/geo/india_location.dart');
const gps=file('apps/flutter_app/lib/features/geo/gps_location.dart');
const settings=file('apps/flutter_app/lib/features/geo/geo_settings_panel.dart');

test('two-tab setup before onboarding.ready and five-tab navigation after',()=>{
 assert.match(auth,/verified\.onboarding\.ready/);
 assert.match(auth,/profileComplete = ready/);
 assert.match(auth,/profileStatusKnown = true/);
 assert.match(nav,/bottomNavigationBar: navigationReady \? Container/);
 assert.match(gate,/profileRepository: HttpProfileRepository/);
 assert.match(nav,/if \(profileComplete\) \.\.\./);
 for(const name of ['p03-tab-dating','p03-tab-friendship','p03-tab-local-feed-activities','p03-tab-connects','p02-tab-settings','p02-tab-home'])assert.ok(nav.includes(name),name);
 assert.match(auth,/selectedAccountTab = ready \? 4 : 1/);
});
test('returning owner loads summary instead of flashing onboarding steps',()=>{
 assert.match(profile,/summaryOnReady && dashboard == null/);
 assert.match(profile,/Checking your saved profile/);
 assert.match(profile,/summaryOnReady && result\.value!\.onboarding\.ready/);
 assert.match(profile,/onDashboardConfirmed\?\.call\(result\.value!\)/);
 assert.match(profile,/readySummary = widget\.summaryOnReady && result\.value!\.onboarding\.ready/);
});
test('discovery location is authenticated owner-only and never publishes discovery',()=>{
 assert.match(location,/\/v1\/me\/geo\/location/);
 assert.match(location,/HttpHeaders\.authorizationHeader/);
 assert.match(location,/if \(checked && locationName == null && !loading\)/);
 assert.match(location,/if \(locationName != null\)/);
 assert.match(location,/OneTimeGpsPanel\(/);
 assert.match(location,/showModalBottomSheet<void>/);
 assert.match(location,/IndiaLocationPanel\(/);
 assert.match(location,/showGps: false/);
 assert.match(location,/settingsRevision/);
 assert.match(location,/\+\+epoch; \/\/ A late GET/);
 assert.doesNotMatch(location,/(\/v1\/discovery|scan\(|\/v1\/feed\/public)/i);
});
test('no background GPS, no auto district bulk fetch, settings refresh propagates',()=>{
 assert.match(gps,/if\s*\(!widget\.compact\)/);
 assert.match(gps,/onPressed:busy\?null:_captureAndSave/);
 assert.match(manual,/if \(widget\.showGps\) OneTimeGpsPanel/);
 assert.match(settings,/widget\.onLocationSaved\?\.call\(label\)/);
 assert.match(gate,/onLocationSaved: onSaved/);
 assert.match(auth,/locationRefreshEpoch\+\+/);
 assert.match(settings,/widget\.refreshEpoch != oldWidget\.refreshEpoch/);
 assert.match(gate,/locationRefreshEpoch: refreshEpoch/);
 assert.match(auth,/refreshEpoch: locationRefreshEpoch/);
 assert.match(gate,/showDiscoveryPreferences: widget\.profileComplete/);
});
test('new actual Flutter widget tests and phase manual are present',()=>{
 const widgets=file('apps/flutter_app/test/p03_pre_discovery_shell_test.dart');
 for(const phrase of ['findsNWidgets(2)','findsNWidgets(5)','p03-location-required','p03-discovery-manual','p02-setup-ready'])assert.ok(widgets.includes(phrase),phrase);
 assert.ok(file('docs/architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md').includes('onboarding.ready'));
});
