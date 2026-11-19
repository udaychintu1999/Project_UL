import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const auth=read('apps/api/src/features/auth/routes.ts');
const routes=read('apps/api/src/features/discovery/routes.ts');
const hydrate=read('apps/api/src/features/discovery/hydration-service.ts');
const policy=read('apps/api/src/features/discovery/hydration-policy.ts');
const cover=read('apps/api/src/features/discovery/coverage.ts');
const cursor=read('apps/api/src/features/discovery/cursor.ts');
const pkg=JSON.parse(read('package.json'));
test('authenticated P03-4 route exclusively uses P01 guard and denies untrusted input',()=>{
  assert.match(auth,/registerDiscoveryRoutes\(app, db, requireSession, secret\)/);
  assert.match(routes,/const auth=await guard\(request,reply\)/);
  assert.match(routes,/parseDiscoveryQuery\(request\.query\)/);
  assert.match(routes,/Cache-Control','private, no-store'/);
  assert.doesNotMatch(routes,/ScanCommand|PutCommand|TransactWriteCommand/);
  assert.doesNotMatch(routes,/request\.body|request\.headers\['x-uluv-dev-key'\]/);
});
test('untrusted pointers require canonical transactional proof and reciprocal blocks',()=>{
  assert.match(hydrate,/TransactGetCommand/);
  assert.match(hydrate,/blockKey\(viewerUid,target\.uid\)/);
  assert.match(hydrate,/blockKey\(target\.uid,viewerUid\)/);
  assert.match(hydrate,/canonicalKeys\(viewerUid,mode\)/);
  assert.match(hydrate,/photoKeys\(target\.uid,ids\)/);
  assert.match(hydrate,/photoKeys\(viewerUid,viewerIds\)/);
  assert.match(policy,/canonicalPointerAnchor/);
  assert.match(policy,/requestedActive!==true/);
  assert.match(policy,/candidate\.anchor\.SK!==pointer\.SK/);
  assert.match(policy,/verifiedMedia\(uid,ids,media\)/);
  assert.match(policy,/distanceKm\(self\.center,candidate\.center\)/);
  assert.match(policy,/blockFromViewer\|\|blockFromTarget/);
  assert.match(policy,/requestedBands\(targetBand as DistanceBand\)/);
  assert.doesNotMatch(hydrate,/ScanCommand|PutCommand|UpdateCommand|DeleteCommand/);
});
test('P03-4 preview is explicit no-internal-key allowlist with source-bound pagination',()=>{
  const output=policy.slice(policy.lastIndexOf('  return {handle:candidate.handle'));
  for(const key of ['handle','displayName','age','broadArea','bio','intention','interests','photoCount','distanceBand'])
    assert.ok(output.includes(key),key);
  for(const secret of ['uid:','homeCell:','PK:','SK:','geoH3Cell:','mediaId:','lat:','lng:'])
    assert.ok(!output.includes(secret),secret);
  assert.match(cursor,/ctx\.authorizationVersion\?\?null/);
  assert.match(hydrate,/authorizationVersion:viewer\.profile\?\.version/);
  assert.match(hydrate,/ordering:'page_local_only'/);
  assert.match(cover,/distanceKm\(center,/);
  assert.match(pkg.scripts['verify:p03-4'],/test:p03-4:integration/);
  assert.match(pkg.scripts['verify:p03-4'],/verify:p03-3/);
});
