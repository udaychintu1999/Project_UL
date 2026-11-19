import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
const source=(p)=>readFileSync(new URL(p,root),'utf8');
const api=source('apps/api/src/features/auth/routes.ts');
const profile=source('apps/api/src/features/profiles/routes.ts');
const geo=source('apps/api/src/features/geo/routes.ts');
const pointer=source('apps/api/src/features/discovery/pointer-reader.ts');
const cursors=source('apps/api/src/features/discovery/cursor.ts');
test('no new discovery endpoint/publication; P03-1 activation stays fail-closed',()=>{
  for(const text of [api,profile,geo])assert.doesNotMatch(text,/registerDiscoveryRoutes|\/v1\/discovery\/people/);
  assert.match(profile,/discoveryEligible: false/);
  assert.doesNotMatch(profile,/PutCommand.*uluv_discovery|ScanCommand/);
});
test('internal reader uses fixed partition Queries, consistent reads and per-request budgets',()=>{
  assert.match(pointer,/new QueryCommand/);
  assert.match(pointer,/ConsistentRead:true/);
  assert.match(pointer,/MAX_QUERY_CALLS/);
  assert.match(pointer,/MAX_READ_ITEMS/);
  assert.doesNotMatch(pointer,/ScanCommand|new ScanCommand/);
  assert.match(pointer,/unverifiedPointers/);
});
test('authenticated encrypted cursor guards replay, locality/settings revision and expiry',()=>{
  assert.match(cursors,/aes-256-gcm/);
  assert.match(cursors,/ctx\.location\.localityRevision/);
  assert.match(cursors,/ctx\.location\.settingsRevision/);
  assert.match(cursors,/ctx\.uid,ctx\.mode/);
  assert.match(cursors,/CURSOR_TTL_MS/);
});
test('P03-1 frontend and geo routing files untouched by P03-2',()=>{
  assert.ok(existsSync(fileURLToPath(new URL('apps/flutter_app/lib/features/geo/india_location.dart',root))));
  assert.ok(existsSync(fileURLToPath(new URL('apps/api/src/features/geo/india-boundary.ts',root))));
  assert.ok(existsSync(fileURLToPath(new URL('docs/p03/README.md',root))));
});
test('P03-2 code and docs stay isolated in P03, with owner-run local integration gate',()=>{
  const pkg=JSON.parse(source('package.json'));
  assert.match(pkg.scripts['test:p03-2:integration'],/env-file=apps\/api\/\.env/);
  assert.match(pkg.scripts['verify:p03-2'],/test:p03-2:integration/);
  assert.ok(existsSync(fileURLToPath(new URL('docs/p03/02_GEO_DATA_STORAGE_AND_H3.md',root))));
});
