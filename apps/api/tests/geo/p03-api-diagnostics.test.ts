import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GeoAssetError, geoFailureCategory, readVerifiedGeoPack, readGeoAsset,
  readGeoDeliveryConfig, type GeoAssetAudit, type GeoDeliveryConfiguration } from '../../src/features/geo/catalogue-delivery.ts';

const fixture=readFileSync('apps/flutter_app/test/fixtures/p03-nicobar-638.json');
const sha=createHash('sha256').update(fixture).digest('hex');
const config:GeoDeliveryConfiguration={mode:'s3_cloudfront',publicBaseUrl:'https://example.cloudfront.net/geo/india/v1/',canonicalManifestSha256:'a'.repeat(64)};
const records:{event:string;fields:Record<string,string|number|boolean>}[]=[];
const audit:GeoAssetAudit=(event,fields)=>records.push({event,fields});
const fetchOf=(payload:Uint8Array,status=200):typeof fetch=>
  (async(_input,init)=>{
    assert.equal(init?.redirect,'error');
    assert.equal(init?.headers && (init.headers as Record<string,string>).Accept,'application/json');
    return new Response(status===200?payload:null,{status});
  }) as typeof fetch;

test('API diagnostic audit records safe CloudFront URL, HTTP 200, SHA and byte count',async()=>{
  records.length=0;
  const bytes=await readVerifiedGeoPack(config,'states/01/districts/638.json',
    {sha256:sha,bytes:fixture.length},fetchOf(fixture),audit);
  assert.deepEqual(bytes,fixture);
  assert.ok(records.some(r=>r.event==='asset.cdn.start' && r.fields.url==='https://example.cloudfront.net/geo/india/v1/states/01/districts/638.json'));
  assert.ok(records.some(r=>r.event==='asset.cdn.response' && r.fields.status===200));
  assert.ok(records.some(r=>r.event==='asset.integrity.ok' && r.fields.shaPrefix===sha.slice(0,12)));
  assert.ok(!JSON.stringify(records).includes('Authorization'));
});

test('API diagnostic audit labels 403 origin/OAC errors with upstream status',async()=>{
  records.length=0;
  await assert.rejects(readVerifiedGeoPack(config,'states/01/districts/638.json',
    {sha256:sha,bytes:fixture.length},fetchOf(fixture,403),audit),
    (e:unknown)=>e instanceof GeoAssetError && e.category==='cdn_http_error' && e.status===403);
  assert.ok(records.some(r=>r.event==='asset.cdn.error' && r.fields.status===403));
});

test('API diagnostic audit distinguishes unexpected bytes from incorrect trusted SHA',async()=>{
  records.length=0;
  const damaged=Buffer.from(fixture);damaged[damaged.length-6]^=1;
  await assert.rejects(readVerifiedGeoPack(config,'states/01/districts/638.json',
    {sha256:sha,bytes:fixture.length},fetchOf(damaged),audit),/geo_pack_integrity_failed/);
  assert.ok(records.some(r=>r.event==='asset.integrity.failed' && r.fields.expectedShaPrefix===sha.slice(0,12) && r.fields.actualShaPrefix!==sha.slice(0,12)));
});

test('API diagnostic audit distinguishes network failure without leaking error text',async()=>{
  records.length=0;
  const mock=(async()=>{throw new Error('sensitive-user-token')}) as typeof fetch;
  await assert.rejects(readGeoAsset(config,'manifest.json',1000000,mock,audit),
    (e:unknown)=>e instanceof GeoAssetError && e.category==='cdn_network_or_tls_error');
  assert.ok(records.some(r=>r.event==='asset.cdn.error' && r.fields.reason==='cdn_network_or_tls_error'));
  assert.ok(!JSON.stringify(records).includes('sensitive-user-token'));
});

test('invalid canonical SHA or CDN URL identifies environment variable without printing its value',()=>{
  assert.equal(geoFailureCategory(new Error('ULUV_GEO_CANONICAL_MANIFEST_SHA256 must be an independently trusted 64-character SHA-256')),'sha_env_invalid');
  assert.equal(geoFailureCategory(new Error('Geo CDN base must be HTTPS and use /geo/india/vN/ path')),'cdn_url_env_invalid');
  assert.equal(geoFailureCategory(new Error('Untrusted GeoNames canonical manifest SHA-256')),'canonical_manifest_sha_mismatch');
  assert.throws(()=>readGeoDeliveryConfig({ULUV_GEO_CANONICAL_MANIFEST_SHA256:'bad',ULUV_GEO_PUBLIC_BASE_URL:'https://example.com/geo/india/v1/'}));
});
