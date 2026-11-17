import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source=(path)=>readFileSync(path,'utf8');
const picker=source('apps/flutter_app/lib/features/geo/india_location.dart');
const gps=source('apps/flutter_app/lib/features/geo/gps_location.dart');
const routes=source('apps/api/src/features/geo/routes.ts');
const pubspec=source('apps/flutter_app/pubspec.yaml');

test('small bundled manifest is byte-identical to the immutable S3 catalogue release',()=>{
  const raw=readFileSync('apps/flutter_app/assets/geo/india-manifest.json');
  const sha=createHash('sha256').update(raw).digest('hex');
  assert.equal(sha,'97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887');
  assert.ok(raw.length<200000);
  assert.match(picker,new RegExp(sha));
  assert.match(pubspec,/assets\/geo\/india-manifest\.json/);
  const m=JSON.parse(raw.toString('utf8'));
  assert.equal(m.schemaVersion,1);
  assert.equal(m.country,'IN');
  assert.equal(m.catalogueVersion,'IN-52fd741e8c61b53a');
  assert.equal(m.states.length,36);
  assert.ok(m.states.every(s=>Array.isArray(s.districts)));
  assert.equal(m.totalPlaces,549046);
});

test('manual State/District selector does not depend on CloudFront startup',()=>{
  const init=picker.slice(picker.indexOf('Future<void> _init()'),picker.indexOf('List<Map<String,dynamic>> get states'));
  assert.match(init,/await _bundledManualCatalogue\(\)/);
  assert.match(init,/setState\(\(\)=>manifest=bundled\)/);
  assert.ok(init.indexOf('manifest=bundled')<init.indexOf("_get('/v1/geo/india/delivery'"));
  assert.match(picker,/p03-manual-location-heading/);
  assert.match(picker,/State \/ Union Territory/);
  assert.match(picker,/Search village \/ town \/ locality/);
  assert.match(picker,/!accountLoaded\|\|selectedPlace==null/);
  assert.match(picker,/offline=true/);
  assert.match(picker,/publicDelivery=null/);
});

test('saved account location is retrieved independently from catalogue and survives re-entry',()=>{
  const init=picker.slice(picker.indexOf('Future<void> _init()'),picker.indexOf('List<Map<String,dynamic>> get states'));
  assert.ok(init.indexOf('await _loadSavedLocation()')<init.indexOf("_get('/v1/geo/india/delivery'"));
  assert.match(picker,/final details=await _get\('\/v1\/me\/geo\/location'/);
  assert.match(picker,/selectedLocationName=name as String\?/);
  assert.match(picker,/p03-1b-selected-location/);
  assert.match(picker,/onSaved:\(nextRevision,name\)/);
  const get=routes.slice(routes.indexOf("app.get('/v1/me/geo/location'"),routes.indexOf("app.put('/v1/me/geo/manual'"));
  assert.match(get,/new GetCommand/);
  assert.doesNotMatch(get,/await catalogue\(\)/);
  assert.match(routes,/new TransactWriteCommand/);
  assert.match(routes,/geoSelectionLabel/);
});

test('single GPS tap captures, validates, saves and reports success; no confirmation step',()=>{
  assert.match(gps,/onPressed:busy\?null:_captureAndSave/);
  assert.match(gps,/widget.provider.capture\(\)/);
  assert.match(gps,/widget.client.save\(fix,revision\)/);
  assert.match(gps,/widget.onSaved\(saved\['settingsRevision'\]/);
  assert.doesNotMatch(gps,/p03-gps-confirm|Confirm approximate location|_confirm\(/);
  assert.doesNotMatch(gps,/getPositionStream|ACCESS_BACKGROUND_LOCATION/);
  assert.match(routes,/boundary.contains\(fix.lat,fix.lng\)/);
  assert.match(routes,/latLngToCell\(fix.lat,fix.lng,6\)/);
});
