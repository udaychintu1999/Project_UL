import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readVerifiedGeoPack,type GeoDeliveryConfiguration} from '../../src/features/geo/catalogue-delivery.ts';

const data=readFileSync('apps/flutter_app/test/fixtures/p03-nicobar-638.json');
const manifest=JSON.parse(readFileSync('apps/flutter_app/assets/geo/india-manifest.json','utf8'));
const meta=manifest.states.find((s:{code:string})=>s.code==='01').districts.find((d:{code:string})=>d.code==='638');
const config:GeoDeliveryConfiguration={mode:'s3_cloudfront',
  publicBaseUrl:'https://test-distro.cloudfront.net/geo/india/v1/',
  canonicalManifestSha256:'8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa'};
const mockFetch=(bytes:Uint8Array,status=200):typeof fetch=>(async()=>new Response(bytes,{status})) as typeof fetch;
test('verified API fallback accepts real production GeoNames JSON without changing bytes',async()=>{
  assert.equal(createHash('sha256').update(data).digest('hex'),meta.sha256);
  const result=await readVerifiedGeoPack(config,meta.path,meta,mockFetch(data));
  assert.deepEqual(result,data);
});
test('fallback rejects different, corrupt or missing pack',async()=>{
  const tampered=Buffer.from(data);tampered[31]^=1;
  await assert.rejects(readVerifiedGeoPack(config,meta.path,meta,mockFetch(tampered)),/geo_pack_integrity_failed/);
  await assert.rejects(readVerifiedGeoPack(config,meta.path,meta,mockFetch(data,404)));
  await assert.rejects(readVerifiedGeoPack(config,'../secrets.json',meta,mockFetch(data)),/geo_pack_metadata_invalid/);
  await assert.rejects(readVerifiedGeoPack(config,meta.path,{...meta,sha256:'0'.repeat(64)},mockFetch(data)),/geo_pack_integrity_failed/);
});
