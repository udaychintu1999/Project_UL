import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Settings on hold for PIN and isolate PageStorageKey paths',()=>{
 const settings=read('apps/flutter_app/lib/features/geo/geo_settings_panel.dart');
 const pin=read('apps/flutter_app/lib/features/geo/pincode_lookup.dart');
 const village=read('apps/flutter_app/lib/features/geo/india_location.dart');
 assert.match(settings,/PageStorageKey<String>\('p03-location-expansion'\)/);
 assert.doesNotMatch(settings,/PincodeLookupPanel\(/);
 assert.match(pin,/PageStorageKey<String>\('p03-1c-pin-scroll-scope'\)/);
 assert.match(village,/PageStorageKey<String>\('p03-1b-search-scroll'\)/);
 assert.match(village,/OneTimeGpsPanel\(/);
});
test('One-shot permission and consent only; no background tracking',()=>{
 const gps=read('apps/flutter_app/lib/features/geo/gps_location.dart');
 const manifest=read('apps/flutter_app/android/app/src/main/AndroidManifest.xml');
 assert.match(gps,/getCurrentPosition/);
 assert.doesNotMatch(gps,/p03-gps-confirm|Confirm approximate location/);
 assert.match(gps,/widget.client.save\(fix,revision\)/);
 assert.doesNotMatch(gps,/getPositionStream|startForegroundService/);
 assert.match(manifest,/ACCESS_COARSE_LOCATION/);
 assert.match(manifest,/ACCESS_FINE_LOCATION/);
 assert.doesNotMatch(manifest,/ACCESS_BACKGROUND_LOCATION/);
});
test('Fastify alone validates boundary and stores H3 R6 only',()=>{
 const api=read('apps/api/src/features/geo/routes.ts');
 const boundary=read('apps/api/src/features/geo/india-boundary.ts');
 assert.match(api,/parseGpsLocation/);
 assert.match(api,/boundary.contains\(fix.lat,fix.lng\)/);
 assert.match(api,/latLngToCell\(fix.lat,fix.lng,6\)/);
 assert.match(api,/REMOVE geoGeonameId/);
 assert.match(api,/gps_outside_supported_india_boundary/);
 assert.match(boundary,/india-boundary.geojson/);
 assert.doesNotMatch(boundary,/https?:\/\//);
});
