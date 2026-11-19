import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const read=p=>readFileSync(p,'utf8');
const profile=read('apps/api/src/features/profiles/routes.ts');
const photos=read('apps/api/src/features/profiles/media-routes.ts');
const geo=read('apps/api/src/features/geo/routes.ts');
const life=read('apps/api/src/features/discovery/pointer-lifecycle-policy.ts');
const reader=read('apps/api/src/features/discovery/pointer-reader.ts');
const app=read('apps/api/src/app.ts');
test('all four previously recovered Flutter files remain in ZIP',()=>{
  for(const p of [
    'apps/flutter_app/lib/features/auth/auth_screen.dart',
    'apps/flutter_app/lib/features/auth/account_navigation.dart',
    'apps/flutter_app/lib/features/geo/friendship_sections.dart',
    'apps/flutter_app/lib/features/geo/local_feed_activities_sections.dart'
  ])assert.ok(existsSync(p),`missing recovered file: ${p}`);
});
test('no public discovery endpoint, all DTOs still fail closed',()=>{
  for(const txt of [profile,app,geo,photos]) {
    assert.doesNotMatch(txt,/app\.(?:get|post|put|delete)\(['"]\/v1\/discovery\/people/);
    assert.doesNotMatch(txt,/ScanCommand/);
  }
  assert.match(profile,/discoveryEligible: false/);
  assert.match(geo,/discoveryEnabled:false/);
  assert.match(reader,/unverifiedPointers/);
  assert.match(reader,/ConsistentRead:true/);
});
test('no publisher accepts a client-selected cell or raw fix',()=>{
  assert.match(profile,/buildPointer\(/);
  assert.match(profile,/checkLocality\(/);
  assert.match(profile,/matchesCanonicalPublicationSnapshot\(expectedVersion, profile/,
    'publisher must reject READY-media snapshots from another profile revision or assignment');
  assert.match(life,/dashboardVersion !== expectedVersion/);
  assert.match(life,/verifiedPhotoIds\.every\(id => assigned\.includes\(id\)\)/);
  assert.match(profile,/settings\.geoH3Cell/);
  assert.doesNotMatch(profile,/request\.body.*(?:geoH3Cell|discoveryPointer)/);
  assert.match(geo,/cellToLatLng\(cell\)/);
  assert.match(life,/new RegExp\(`/);
});
test('owner mutations invalidate canonical anchors in one conditional transaction',()=>{
  assert.match(profile,/invalidateBoth\(transaction, auth\.uid, records/);
  assert.match(profile,/appendPointerDelete\(transaction, auth\.uid, mode, previous\)/);
  assert.match(profile,/appendPointerDelete\(items, auth\.uid, mode, profile\)/);
  assert.match(photos,/appendPointerDelete\(transactions, auth\.uid, mode, modeRecord\)/);
  assert.match(geo,/await invalidateOnGeoWrite\(db,auth\.uid,transaction\)/);
  assert.match(life,/attribute_not_exists\(discoveryPointer\)/);
  assert.match(life,/ConditionExpression: 'attribute_not_exists\(PK\) OR uid = :owner'/);
  assert.match(life,/REMOVE discoveryPointer/);
  assert.match(life,/attribute_not_exists\(PK\)/);
});
test('P03 budgets and local-only verification inherited, never relaxed',()=>{
  const contracts=read('apps/api/src/features/discovery/contracts.ts');
  for(const [field,n] of [['MAX_QUERY_CALLS',6],['MAX_READ_ITEMS',72],
    ['MAX_PAGE_SIZE',24],['MAX_DDB_ITEMS_PER_QUERY',12],['MAX_CELLS_IN_COVER',1600]])
    assert.match(contracts,new RegExp(`(?:const|export const) ${field} = ${n}`));
  const pkg=JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:p03-3:integration'],/env-file=apps\/api\/\.env/);
  assert.match(pkg.scripts['verify:p03-3'],/verify:p03:acceptance/);
  assert.match(pkg.scripts['verify:p03-3'],/test:p03-3:repair:integration/,
    'full verification must run real restricted-account repair integration');
  assert.ok(existsSync('docs/architecture/P03_3_PRIVATE_POINTER_LIFECYCLE.md'));
});

test('active P03 Markdown links target real files, not deleted handbook placeholders',()=>{
  const files=[
    ...['README','01_USER_JOURNEYS','02_GEO_DATA_STORAGE_AND_H3','03_API_REFERENCE',
      '04_ACCEPTANCE_AND_RELEASE_GATES','05_LEGACY_MAP_AND_CLEANUP','06_NEXT_STAGES_ROADMAP']
      .map(name=>`docs/p03/${name}.md`),
    'docs/architecture/P03_3_PRIVATE_POINTER_LIFECYCLE.md',
    'docs/qa/P03_3_POINTER_LIFECYCLE_IMPLEMENTATION_EVIDENCE.md'
  ];
  for(const file of files){
    for(const match of read(file).matchAll(/(?<!!)\[[^\]\n]+\]\(([^)]+)\)/g)){
      const target=match[1].split('#')[0].replace(/^<|>$/g,'');
      if(!target||/^(?:https?:|mailto:|#)/.test(target))continue;
      assert.ok(existsSync(resolve(dirname(file),target)),`${file} -> missing ${target}`);
    }
  }
});
