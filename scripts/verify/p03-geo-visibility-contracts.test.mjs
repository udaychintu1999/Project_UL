import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=(name)=>readFileSync(join(root,name),'utf8');
test('Windows-safe file URL conversion for geo source contracts',()=>{
  assert.match(source('scripts/verify/p03-geo-cloud-source-contracts.test.mjs'),/fileURLToPath/);
  assert.doesNotMatch(source('scripts/verify/p03-geo-cloud-source-contracts.test.mjs'),/\.pathname\)/);
});
test('manual place picker collapses result list, sends authenticated save, updates tile',()=>{
  const picker=source('apps/flutter_app/lib/features/geo/india_location.dart');
  const tile=source('apps/flutter_app/lib/features/geo/geo_settings_panel.dart');
  assert.match(picker,/showPlaceResults=false/);
  assert.match(picker,/p03-selected-place-summary/);
  assert.match(picker,/widget\.onLocationSaved\?\.call\(newName\)/);
  assert.match(tile,/_tile\.collapse\(\)/);
  assert.match(tile,/subtitle:Text\(_savedName!=null\?_savedName!/);
  assert.match(tile,/_readSavedLocation\(\)/);
  assert.match(tile,/_everOpened/);
});
test('Fastify confirms DynamoDB read/save and local terminal is readable',()=>{
  const routes=source('apps/api/src/features/geo/routes.ts');
  const app=source('apps/api/src/app.ts');
  assert.match(routes,/account\.location\.save\.committed/);
  assert.match(routes,/account\.location\.read/);
  assert.match(app,/target: 'pino-pretty'/);
  assert.match(app,/config\.env === 'local'/);
  assert.match(app,/disableRequestLogging: true/);
});
test('Location architecture and verification runbook documents S3, cache, H3, APIs, and test gates',()=>{
  const doc=[source('docs/p03/02_GEO_DATA_STORAGE_AND_H3.md'),
    source('docs/p03/03_API_REFERENCE.md'),source('docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md'),
    source('docs/p03/05_POINTER_LIFECYCLE_AND_SAFETY.md'),
    source('docs/p03/06_NEXT_STAGES_ROADMAP.md')].join('\n');
  for(const term of ['CloudFront','ULUV_GEO_CANONICAL_MANIFEST_SHA256','server-index-manifest.json',
    '/v1/me/geo/manual','/v1/me/geo/location','/v1/me/geo/gps','H3','DynamoDB',
    'sha256','CC BY','India boundary','PIN code','npm run verify:p03:geo-visibility'])assert.ok(doc.includes(term),term);
});
