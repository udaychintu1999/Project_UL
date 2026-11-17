import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,writeFile,rm,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePublicGeoBaseUrl, readGeoDeliveryConfig, isPublicGeoPackPath, localPublicAsset,
  readGeoAsset, isCanonicalGeoAsset } from '../../src/features/geo/catalogue-delivery.ts';
import { parseManualLocation,parseDiscoveryPreferences } from '../../src/features/geo/validation.ts';
const pinned='a'.repeat(64);

test('P03 one-bucket CDN accepts only explicit HTTPS canonical geo prefix',()=>{
  assert.equal(validatePublicGeoBaseUrl('https://d123.cloudfront.net/geo/india/v1/'),
    'https://d123.cloudfront.net/geo/india/v1/');
  assert.equal(validatePublicGeoBaseUrl('https://cdn.example.com/geo/india/v2/'),
    'https://cdn.example.com/geo/india/v2/');
  for(const url of ['http://example.com/geo/india/v1/','https://example.com/geo/india/latest/',
    'https://example.com/geo/india/v1/?token=a','https://user:pass@example.com/geo/india/v1/',
    'https://localhost/geo/india/v1/','https://example.com/server/','https://example.com:8443/geo/india/v1/']) {
    assert.throws(()=>validatePublicGeoBaseUrl(url));
  }
});
test('P03 config requires independently pinned canonical manifest, never local canonical directory',()=>{
  const cloud=readGeoDeliveryConfig({ULUV_GEO_CANONICAL_MANIFEST_SHA256:pinned,
    ULUV_GEO_PUBLIC_BASE_URL:'https://d123.cloudfront.net/geo/india/v1/'});
  assert.equal(cloud.mode,'s3_cloudfront');
  assert.equal(cloud.canonicalManifestSha256,pinned);
  assert.equal('privateDirectory' in cloud,false);
  assert.equal(readGeoDeliveryConfig({ULUV_GEO_CANONICAL_MANIFEST_SHA256:pinned,
    ULUV_GEO_PUBLIC_LOCAL_DIR:'/tmp/geo'}).mode,'local');
  assert.throws(()=>readGeoDeliveryConfig({ULUV_GEO_PUBLIC_BASE_URL:'https://d123.cloudfront.net/geo/india/v1/'}));
  assert.throws(()=>readGeoDeliveryConfig({ULUV_GEO_CANONICAL_MANIFEST_SHA256:'bad',
    ULUV_GEO_PUBLIC_BASE_URL:'https://d123.cloudfront.net/geo/india/v1/'}));
  assert.throws(()=>readGeoDeliveryConfig({ULUV_GEO_CANONICAL_MANIFEST_SHA256:pinned,
    ULUV_GEO_PUBLIC_LOCAL_DIR:'geo/india/v1'}));
});
test('P03 same CDN bucket can serve server shards but Fastify local static endpoint never exposes them',async()=>{
  assert.ok(isPublicGeoPackPath('states/40/districts/686.json'));
  assert.ok(isPublicGeoPackPath('states/40/unmapped.json'));
  assert.ok(isCanonicalGeoAsset('server/00.json'));
  assert.ok(isCanonicalGeoAsset('server-index-manifest.json'));
  for(const path of ['../../.env','build-report.json','states/a/districts/686.json','server/ZZ.json',
    'server/00.json?password=x','https://other/geo/india/v1/server/00.json']) {
    assert.equal(isCanonicalGeoAsset(path) || isPublicGeoPackPath(path),false);
  }
  const dir=await mkdtemp(join(tmpdir(),'uluv-onebucket-geo-'));
  try {
    await mkdir(join(dir,'server'));
    await writeFile(join(dir,'manifest.json'),'{}');
    await writeFile(join(dir,'server','00.json'),'{}');
    const config={mode:'local' as const,canonicalManifestSha256:pinned,localPublicDirectory:dir};
    assert.equal((await localPublicAsset(config,'manifest.json')).toString(),'{}');
    assert.equal((await readGeoAsset(config,'server/00.json',1024)).toString(),'{}');
    await assert.rejects(()=>localPublicAsset(config,'server/00.json'));
    await assert.rejects(()=>readGeoAsset(config,'../../.env',1024));
    await assert.rejects(()=>readGeoAsset(config,'server/00.json',1));
  }finally{await rm(dir,{force:true,recursive:true});}
});
test('P03 bounded CDN retrieval refuses redirect, oversized JSON and wrong path',async()=>{
  const config={mode:'s3_cloudfront' as const,canonicalManifestSha256:pinned,
    publicBaseUrl:'https://d123.cloudfront.net/geo/india/v1/'};
  const calls:string[]=[];
  const fake=(async(input:RequestInfo|URL,options?:RequestInit)=>{
    calls.push(String(input));
    assert.equal(options?.redirect,'error');
    assert.equal(options?.headers && (options.headers as Record<string,string>).Accept,'application/json');
    return new Response('{"ok":1}',{status:200});
  }) as typeof fetch;
  assert.equal((await readGeoAsset(config,'server/00.json',1024,fake)).toString(),'{"ok":1}');
  assert.deepEqual(calls,['https://d123.cloudfront.net/geo/india/v1/server/00.json']);
  await assert.rejects(()=>readGeoAsset(config,'server/00.json',2,fake));
  await assert.rejects(()=>readGeoAsset(config,'../../.env',1024,fake));
});
test('P03 manual selection remains independent of client coordinates and PIN',()=>{
  assert.deepEqual(parseDiscoveryPreferences({distanceBand:'0-50',sortMode:'near_band_first',expectedRevision:0}),
    {distanceBand:'0-50',sortMode:'near_band_first',expectedRevision:0});
  assert.equal(parseDiscoveryPreferences({distanceBand:'0-50',sortMode:'popular',expectedRevision:0}),null);
  const manual={geonameId:'1254813',catalogueVersion:'IN-52fd741e8c61b53a',stateCode:'34',districtCode:'222',expectedRevision:1};
  assert.deepEqual(parseManualLocation(manual),manual);
  assert.equal(parseManualLocation({...manual,lat:20,lng:80}),null);
});
