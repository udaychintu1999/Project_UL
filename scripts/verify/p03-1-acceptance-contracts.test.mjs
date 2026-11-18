/** No external services. Real shipped manifest and source checked end-to-end. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
const text=(p)=>readFileSync(p,'utf8');
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
test('the actual bundled 175KB manifest equals its Flutter checksum and has 36 state/UT entries',()=>{
  const bytes=readFileSync('apps/flutter_app/assets/geo/india-manifest.json');
  const flutter=text('apps/flutter_app/lib/features/geo/india_location.dart');
  const pinned=flutter.match(/_bundledManifestSha256\s*=\s*'([a-f0-9]{64})'/)?.[1];
  assert.ok(pinned,'Flutter must embed a pinned SHA-256');
  assert.equal(sha(bytes),pinned,'asset differs from embedded SHA; device would reject it');
  assert.ok(bytes.length>100_000&&bytes.length<200_000);
  const manifest=JSON.parse(bytes.toString('utf8'));
  assert.equal(manifest.country,'IN');
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.states.length,36);
  assert.equal(manifest.serverIndex,undefined,'server shards must not ship to Flutter');
  assert.match(manifest.catalogueVersion,/^IN-[0-9a-f]{16}$/);
  const pathSet=new Set();let districts=0;
  for(const state of manifest.states){
    assert.match(state.code,/^\d{1,4}$/);
    for(const d of state.districts){
      districts++;assert.match(d.path,/^states\/\d{1,4}\/districts\/\d{1,6}\.json$/);
      assert.ok(d.bytes>0&&d.bytes<=2_000_000);
      assert.match(d.sha256,/^[a-f0-9]{64}$/);
      assert.equal(pathSet.has(d.path),false);pathSet.add(d.path);
    }
  }
  assert.ok(districts>700,'district manifest unexpectedly empty');
});
test('GPS boundary shipped with Fastify is the exact pinned bytes; attribution retained',()=>{
  const bytes=readFileSync('apps/api/assets/geo/india-boundary.geojson');
  const source=text('apps/api/src/features/geo/india-boundary.ts');
  const pinned=source.match(/INDIA_BOUNDARY_SHA256\s*=\s*'([a-f0-9]{64})'/)?.[1];
  assert.equal(sha(bytes),pinned);
  assert.ok(bytes.length>200_000&&bytes.length<4_000_000);
  const boundary=JSON.parse(bytes.toString('utf8'));
  assert.equal(boundary.type,'Feature');
  assert.equal(boundary.geometry.type,'MultiPolygon');
  assert.ok(boundary.geometry.coordinates.length>=20);
  assert.ok(existsSync('apps/api/assets/geo/ATTRIBUTION.md'));
});
test('Flutter manual selector auto-loads district, checks bytes and never sends bearer token to CDN',()=>{
  const panel=text('apps/flutter_app/lib/features/geo/india_location.dart');
  const cache=text('apps/flutter_app/lib/features/geo/geo_pack_cache.dart');
  assert.match(panel,/authenticated:descriptor\.requiresAuthorization/);
  assert.match(panel,/atomicActivateGeoPack/);
  assert.match(panel,/testCacheDirectory/);
  assert.doesNotMatch(panel,/p03-1b-download.*onPressed/);
  assert.match(cache,/sha256\.convert/);
  assert.match(cache,/\.pending-/);
  assert.match(cache,/isCancelled/);
  assert.doesNotMatch(panel,/server\/00\.json/);
});
test('GPS is one-shot, private, boundary checked; no background tracking or extra confirmation',()=>{
  const gps=text('apps/flutter_app/lib/features/geo/gps_location.dart');
  const api=text('apps/api/src/features/geo/routes.ts');
  const manifest=text('apps/flutter_app/android/app/src/main/AndroidManifest.xml');
  assert.match(gps,/Geolocator\.getCurrentPosition/);
  assert.doesNotMatch(gps,/getPositionStream|p03-gps-confirm/);
  assert.doesNotMatch(manifest,/ACCESS_BACKGROUND_LOCATION/);
  assert.match(api,/boundary\.contains\(fix\.lat,fix\.lng\)/);
  assert.match(api,/cellToLatLng\(cell\)/);
  assert.match(api,/ConsistentRead:true/);
  assert.match(api,/discoveryEnabled:false/);
  assert.doesNotMatch(api,/geoExactLat|geoExactLng/);
});
test('5-tab completed profile, 2-tab incomplete, Settings profile and private location gate',()=>{
  const nav=text('apps/flutter_app/lib/features/auth/account_navigation.dart');
  const auth=text('apps/flutter_app/lib/features/auth/auth_screen.dart');
  const gate=text('apps/flutter_app/lib/features/geo/discovery_location_gate.dart');
  for(const key of ['p03-tab-dating','p03-tab-friendship','p03-tab-local-feed-activities',
    'p03-tab-connects','p02-tab-settings'])assert.ok(nav.includes(key),key);
  assert.match(nav,/if \(profileComplete\)/);
  assert.doesNotMatch(nav,/label: 'Home'/);
  assert.match(auth,/onboarding\.ready/);
  assert.match(gate,/testReadLocation/);
  assert.match(gate,/p03-location-required/);
  assert.match(gate,/p03-discovery-manual/);
});
test('P03-2 does not silently create a discovery route, publish a profile, or read owner GPS',()=>{
  const routes=text('apps/api/src/features/geo/routes.ts');
  const profiles=text('apps/api/src/features/profiles/routes.ts');
  const pointer=text('apps/api/src/features/discovery/pointer-reader.ts');
  assert.doesNotMatch(routes,/\/v1\/discovery\/people|PutCommand.*uluv_discovery/);
  assert.match(profiles,/discoveryEligible:\s*false/);
  assert.match(pointer,/ConsistentRead:true/);
  assert.match(pointer,/new QueryCommand/);
  assert.doesNotMatch(pointer,/ScanCommand/);
});
