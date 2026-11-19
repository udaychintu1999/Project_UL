import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {P03_PORTABLE_STAGES,P03_LOCAL_STAGES,assertP03LocalEnvironment,executeP03Stages} from './p03-acceptance-plan.mjs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const commands=(xs)=>xs.map(([,s])=>s);
test('all P03 acceptance gates have scripts; no duplicated full gates or omitted Flutter/API/DDB',()=>{
  for(const stages of [P03_LOCAL_STAGES,P03_PORTABLE_STAGES]){
    assert.equal(new Set(commands(stages)).size,stages.length);
    for(const script of commands(stages)) assert.ok(pkg.scripts[script],`missing npm script: ${script}`);
  }
  for(const required of ['verify:p03:acceptance:portable','typecheck','lint',
    'test:p03-1:acceptance:db','test:p03-2:integration','test:p03:acceptance:types',
    'test:integration','test:p03-1:acceptance:live-api',
    'test:p03:acceptance:flutter-analyze','test:flutter','test:flutter:p03:e2e'])
    assert.ok(commands(P03_LOCAL_STAGES).includes(required),required);
  assert.ok(commands(P03_PORTABLE_STAGES).includes('verify:p02-5:portable'));
  assert.ok(commands(P03_PORTABLE_STAGES).includes('test:p03:navigation-docs'));
  assert.ok(commands(P03_PORTABLE_STAGES).includes('test:p03-2:acceptance:unit'));
  assert.ok(existsSync('apps/flutter_app/integration_test/p03_location_acceptance_integration_test.dart'));
});
test('strict test compilation runs first and blocks expensive gates on failure',()=>{
  assert.equal(P03_LOCAL_STAGES[0][1],'test:p03:acceptance:types');
  assert.equal(P03_LOCAL_STAGES.filter(([,script])=>script==='test:p03:acceptance:types').length,1);
  const reached=[];
  assert.equal(executeP03Stages(P03_LOCAL_STAGES,script=>{
    reached.push(script);
    return {status:script==='test:p03:acceptance:types'?2:0};
  }),false);
  assert.deepEqual(reached,['test:p03:acceptance:types']);
});
test('Flutter analysis runs second and fails before backend/database/device gates',()=>{
  assert.equal(P03_LOCAL_STAGES[1][1],'test:p03:acceptance:flutter-analyze');
  const called=[];
  assert.equal(executeP03Stages(P03_LOCAL_STAGES,script=>{
    called.push(script);
    return {status:script==='test:p03:acceptance:flutter-analyze'?1:0};
  }),false);
  assert.deepEqual(called,['test:p03:acceptance:types','test:p03:acceptance:flutter-analyze']);
  assert.ok(P03_LOCAL_STAGES.findIndex(([,s])=>s==='test:flutter')>1);
  assert.ok(P03_LOCAL_STAGES.findIndex(([,s])=>s==='test:p03-1:acceptance:db')>1);
});
test('fail-closed runner reports failing gate and stops, never claims later gates',()=>{
  const called=[],logs=[];
  assert.equal(executeP03Stages([['one','a'],['two','b'],['three','c']],
    cmd=>{called.push(cmd);return {status:cmd==='b'?1:0};},s=>logs.push(s)),false);
  assert.deepEqual(called,['a','b']);
  assert.ok(logs.some(x=>x.includes('FAIL gate 2')));
  assert.equal(logs.some(x=>x.includes('PASS gate 3')),false);
  assert.equal(executeP03Stages([['a','a']],()=>({status:0})),true);
  for(const result of [{status:0,signal:'SIGTERM'},{status:null},{error:new Error('fail')},{status:2}])
    assert.equal(executeP03Stages([['a','a']],()=>result),false);
  assert.equal(executeP03Stages([['a','a']],()=>{throw Error('private token');}),false);
});
test('all real local gates fail before work on remote/cloud/unsafe environment',()=>{
  const good={APP_ENV:'local',ULUV_DEV_TOKEN:'x'.repeat(32),
    DYNAMODB_ENDPOINT:'http://127.0.0.1:8000',ULUV_API_BASE_URL:'http://127.0.0.1:3000'};
  assert.equal(assertP03LocalEnvironment(good),true);
  for(const env of [
    {...good,APP_ENV:'production'},
    {...good,ULUV_DEV_TOKEN:'x'},
    {...good,DYNAMODB_ENDPOINT:'https://dynamodb.ap-south-1.amazonaws.com'},
    {...good,DYNAMODB_ENDPOINT:'http://127.0.0.1:8001'},
    {...good,DYNAMODB_ENDPOINT:'http://evil.example:8000'},
    {...good,ULUV_API_BASE_URL:'http://evil.example:3000'},
    {...good,ULUV_API_BASE_URL:'http://127.0.0.1:3001'},
    {...good,ULUV_API_BASE_URL:'http://127.0.0.1:3000/?jwt=secret'},
  ])assert.throws(()=>assertP03LocalEnvironment(env));
});
test('P03 does not publish people or turn on S3 SDK/cloud testing',()=>{
  const src=readFileSync('apps/api/src/features/profiles/routes.ts','utf8');
  assert.match(src,/discoveryEligible:\s*false/);
  const route=readFileSync('apps/api/src/features/geo/routes.ts','utf8');
  assert.doesNotMatch(route,/registerDiscoveryRoutes|\/v1\/discovery\/people/);
  const verifier=readFileSync('scripts/verify/p03-acceptance-verifier.mjs','utf8');
  assert.match(verifier,/assertP03LocalEnvironment\(process\.env\)/);
  assert.doesNotMatch(verifier,/aws s3|aws dynamodb|CreateTable|DeleteTable/);
});

// WidgetTest uses FakeAsync; awaiting genuine dart:io I/O directly at the
// start/finally of testWidgets can deadlock before the first Flutter pump.
// These three files are the P03 cache/GeoNames widget journeys that use
// real, tiny local fixtures: setup/teardown must be synchronous and bounded.
test('P03 widget fixture setup/teardown never awaits real disk I/O in FakeAsync',()=>{
  for(const file of [
    'apps/flutter_app/test/p03_district_auto_load_test.dart',
    'apps/flutter_app/test/p03_geo_settings_visibility_test.dart',
    'apps/flutter_app/test/p03_location_recovery_test.dart',
  ]){
    const src=readFileSync(file,'utf8');
    assert.match(src,/Directory\.systemTemp\.createTempSync\(/,file);
    assert.match(src,/\.deleteSync\(recursive:true\)/,file);
    assert.match(src,/timeout:\s*const Timeout\(Duration\(seconds:\s*75\)\)/,file);
    assert.doesNotMatch(src,/await\s+Directory\.systemTemp\.createTemp\(/,file);
    assert.doesNotMatch(src,/await\s+File\([^)]*\)\.readAsBytes\(/,file);
    assert.doesNotMatch(src,/await\s+\w+\.delete\(recursive:true\)/,file);
    assert.doesNotMatch(src,/\bpumpAndSettle\(/,file);
  }
});

// Device test improvements must remain wired into the one isolated Android
// runner. It is a regression to claim 7 scenarios while compiling only the
// 3 old tests, or to substitute a mock picker that bypasses real HTTP.
test('P03 Android suite registers all seven isolated device journeys with real picker + guarded loopback HTTP',()=>{
  const entry=readFileSync('apps/flutter_app/integration_test/p03_location_acceptance_integration_test.dart','utf8');
  const full=readFileSync('apps/flutter_app/integration_test/p03_full_device_journeys.dart','utf8');
  const runner=readFileSync('scripts/verify/p03-android-e2e.mjs','utf8');
  assert.equal((entry.match(/testWidgets\(/g)||[]).length,3,'prior three scenarios must remain');
  assert.equal((full.match(/testWidgets\(/g)||[]).length,4,'four new device scenarios must be registered');
  assert.match(entry,/import 'p03_full_device_journeys.dart'/);
  assert.match(entry,/registerP03FullDeviceJourneys\(\)/);
  assert.match(full,/HttpServer\.bind\(InternetAddress\.loopbackIPv4, 0\)/);
  assert.match(full,/HttpHeaders\.authorizationHeader/);
  assert.match(full,/HttpStatus\.unauthorized/);
  assert.match(full,/HttpStatus\.conflict/);
  assert.match(full,/HttpStatus\.tooManyRequests/);
  const picker=readFileSync('apps/flutter_app/lib/features/geo/india_location.dart','utf8');
  assert.match(picker,/wait 15 seconds\|location changes are limited/,
    'compact picker must display 429 retry/cooldown feedback');
  assert.match(full,/HttpStatus\.serviceUnavailable/);
  assert.match(full,/DiscoveryLocationGate\(/);
  assert.match(full,/UluvGeoSettingsPanel\(/);
  assert.match(full,/p03-discovery-manual/);
  assert.match(full,/p03-1b-state-null/);
  assert.match(full,/p03-1b-district-01-null/);
  assert.match(full,/p03-1b-place-1252774/);
  assert.match(full,/p03-1b-save/);
  assert.match(full,/testWidgets\('Android full journey:/);
  assert.match(full,/testWidgets\('Android manual save errors:/);
  assert.match(full,/testWidgets\('Android outage:/);
  assert.match(full,/testWidgets\('Android incomplete profile:/);
  assert.match(full,/await tester\.runAsync\(api\.close\)/);
  assert.doesNotMatch(full,/https?:\/\/(?:[a-z0-9-]+\.)+(?:com|net|org)/i);
  assert.match(runner,/p03_location_acceptance_integration_test\.dart/);
  assert.match(runner,/--no-uninstall/);
  assert.match(runner,/--reporter','expanded'/);
  assert.match(runner,/resetP02TestApp/);
});

test('P03 device pack is exactly the real SHA-pinned GeoNames fixture, never a synthetic unverified place',()=>{
  const source=readFileSync('apps/flutter_app/integration_test/p03_fixture_nicobar_bytes.dart','utf8');
  const encoded=source.match(/const _gzFixture =([\s\S]*?);/);
  assert.ok(encoded,'device fixture constant exists');
  const chunks=[...encoded[1].matchAll(/'([A-Za-z0-9+/=]+)'/g)].map(x=>x[1]);
  assert.ok(chunks.length>2);
  const inflated=gunzipSync(Buffer.from(chunks.join(''),'base64'));
  const sourceBytes=readFileSync('apps/flutter_app/test/fixtures/p03-nicobar-638.json');
  assert.deepEqual(inflated,sourceBytes);
  const manifest=JSON.parse(readFileSync('apps/flutter_app/assets/geo/india-manifest.json','utf8'));
  const nicobar=manifest.states.find(x=>x.code==='01')?.districts.find(x=>x.code==='638');
  assert.ok(nicobar);
  assert.equal(nicobar.bytes,inflated.length);
  assert.equal(nicobar.sha256,createHash('sha256').update(inflated).digest('hex'));
  const pack=JSON.parse(inflated.toString('utf8'));
  assert.equal(pack.catalogueVersion,manifest.catalogueVersion);
  assert.equal(pack.places.length,nicobar.count);
});

test('P03-1/P03-2 canonical docs are scoped, linked and do not rewrite P01/P02',()=>{
  const hub=readFileSync('docs/p03/README.md','utf8');
  for(const file of ['01_USER_JOURNEYS.md','02_GEO_DATA_STORAGE_AND_H3.md',
      '03_API_REFERENCE.md','04_ACCEPTANCE_AND_RELEASE_GATES.md',
      '05_LEGACY_MAP_AND_CLEANUP.md']) {
    assert.ok(existsSync('docs/p03/'+file),file);
    assert.ok(hub.includes(file),file);
  }
  assert.match(readFileSync('docs/p03/01_USER_JOURNEYS.md','utf8'),/Dating.*Friendship.*Local Feed.*Connects.*Settings/);
  assert.match(readFileSync('docs/p03/03_API_REFERENCE.md','utf8'),/No|Nonexistent/i);
  const evidence = readFileSync('docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md','utf8');
  // Historical 'NOT YET RUN' wording became false after the owner supplied
  // a complete Windows/DynamoDB/Flutter/Android PASS log. Verify actual
  // scope and explicitly outstanding manual/policy gates instead.
  assert.match(evidence,/15\/15[^\n]*PASS|PASS[^\n]*15\/15/i);
  assert.match(evidence,/11\/11[^\n]*PASS|PASS[^\n]*11\/11/i);
  assert.match(evidence,/81\/81/);
  assert.match(evidence,/7\/7/);
  assert.match(evidence,/reconcileRestrictedPointers/);
  assert.match(evidence,/MANUAL PENDING/);
  assert.match(evidence,/no public discovery|public discovery still disabled/i);
  assert.match(evidence,/moderation.*delet|delet.*moderation/i);
  assert.match(pkg.scripts['verify:p03-3'],/test:p03-3:repair:integration/,
    'combined P03-3 verifier must execute the real restricted-account repair test');
  const cleaner=readFileSync('docs/p03/PRUNE_SUPERSEDED_P03.ps1','utf8');
  assert.match(cleaner,/\$Apply/);
  assert.doesNotMatch(cleaner,/P01_|P02_/);
  assert.match(cleaner,/DRY RUN/);
});
