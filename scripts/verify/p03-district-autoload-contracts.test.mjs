import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>readFileSync(p,'utf8');
const picker=read('apps/flutter_app/lib/features/geo/india_location.dart');
const api=read('apps/api/src/features/geo/routes.ts');
test('selecting a district automatically starts a single load with no separate download button',()=>{
  assert.match(picker,/if\(val!=null\) _loadDistrict\(\)/);
  assert.doesNotMatch(picker,/Download \/ load selected district|p03-1b-download/);
  assert.match(picker,/busy=true;downloading=true/);
  assert.match(picker,/p03-1b-retry-district/);
  assert.match(picker,/compute\(_parseVerifiedPack/);
  assert.match(picker,/atomicActivateGeoPack/);
});
test('an authenticated Fastify fallback verifies every fetched pack against the authoritative manifest',()=>{
  assert.match(picker,/\/v1\/geo\/india\/packs\/\$state\/\$district/);
  assert.match(api,/await readVerifiedGeoPack\(config,path,meta(?:,fetch,audit\(request\))?\)/);
  assert.match(api,/assetMeta\(c,path\)/);
  assert.match(api,/bytes.length!==meta.bytes \|\| checksum\(bytes\)!==meta.sha256/);
  const section=api.split("app.get<{Params:{state:string;district:string}}>('/v1/geo/india/packs/:state/:district'")[1].split("app.get('/v1/me/geo/location'")[0];
  assert.match(section,/await authorised\(request,reply\)/);
  assert.match(section,/geo_pack_integrity_failed/);
});
test('real S3 fixture matches the published manifest SHA and size',()=>{
 const manifest=JSON.parse(read('apps/flutter_app/assets/geo/india-manifest.json'));
 const item=manifest.states.find(s=>s.code==='01').districts.find(d=>d.code==='638');
 const data=readFileSync('apps/flutter_app/test/fixtures/p03-nicobar-638.json');
 assert.equal(data.length,item.bytes);
 assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);
 assert.equal(JSON.parse(data).places.length,item.count);
});
test('GPS response and persistent read both contain a stable account location label',()=>{
 const post=api.split("app.post('/v1/me/geo/gps'")[1];
 assert.match(post,/location:\{name:'Approximate location in India',source:'gps_selected'\}/);
 const get=api.split("app.get('/v1/me/geo/location'")[1].split("app.put('/v1/me/geo/manual'")[0];
 assert.match(get,/name:'Approximate location in India',source:'gps_selected'/);
});
