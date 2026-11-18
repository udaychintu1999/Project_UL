import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {IndiaCatalogue} from '../../src/features/geo/india-catalogue.js';
import {readVerifiedGeoPack,readGeoDeliveryConfig} from '../../src/features/geo/catalogue-delivery.js';
import {parseManualLocation,parseGpsLocation,parseDiscoveryPreferences} from '../../src/features/geo/validation.js';
import {makeSyntheticGeoCatalogue,FIXTURE_VERSION,FIXTURE_PLACE} from './p03-1-fixture.js';

test('synthetic release is pinned: canonical/place/shard/pack verify without any network',async()=>{
  const f=await makeSyntheticGeoCatalogue();
  try{
    const config={mode:'local' as const,canonicalManifestSha256:f.pin,localPublicDirectory:f.dir};
    const catalog=await IndiaCatalogue.open(config);
    const place=await catalog.resolvePlace(FIXTURE_PLACE,FIXTURE_VERSION);
    assert.equal(place?.name,'Synthetic Hyderabad Test Place');
    assert.equal(await catalog.resolvePlace(FIXTURE_PLACE,'IN-1111111111111111'),null);
    const meta=catalog.manifest.states[0].districts[0];
    assert.deepEqual(await readVerifiedGeoPack(config,meta.path,meta),f.pack);
    await assert.rejects(readVerifiedGeoPack(config,meta.path,{...meta,sha256:'0'.repeat(64)}));
    await assert.rejects(IndiaCatalogue.open({...config,canonicalManifestSha256:'0'.repeat(64)}));
    assert.equal((await readFile(join(f.dir,'manifest.json'))).includes(Buffer.from('serverIndex')),false,
      'public manifest must never leak canonical index metadata');
  }finally{await f.close();}
});
test('manual selection rejects forged fields, unsupported revisions and invalid mode settings',()=>{
  const good={geonameId:FIXTURE_PLACE,catalogueVersion:FIXTURE_VERSION,
    stateCode:'01',districtCode:'101',expectedRevision:0};
  assert.deepEqual(parseManualLocation(good),good);
  for(const bad of [{...good,lat:1},{...good,expectedRevision:-1},
    {...good,geonameId:'1e6'},{...good,districtCode:'../x'},
    {...good,catalogueVersion:'latest'},{...good,expectedRevision:1.1},
    {...good,stateCode:'some state'},{...good,expectedRevision:NaN}])
    assert.equal(parseManualLocation(bad),null);
  const settings={distanceBand:'0-50',sortMode:'recent_first',expectedRevision:0};
  assert.deepEqual(parseDiscoveryPreferences(settings),settings);
  for(const bad of [{...settings,distanceBand:'0-500'},
    {...settings,sortMode:'most_popular'}, {...settings,expectedRevision:-1},
    {...settings,arbitrary:true}])assert.equal(parseDiscoveryPreferences(bad),null);
});
test('one-shot GPS parser rejects stale, future, inaccurate, malformed and client extras',()=>{
  const now=Date.now();const base={lat:17.385,lng:78.4867,accuracyMeters:20,
    fixTimestamp:new Date(now).toISOString(),expectedRevision:0};
  assert.deepEqual(parseGpsLocation(base,now),base);
  for(const bad of [{...base,lat:91},{...base,lng:-181},
    {...base,accuracyMeters:0},{...base,accuracyMeters:10001},
    {...base,fixTimestamp:new Date(now-121000).toISOString()},
    {...base,fixTimestamp:new Date(now+31000).toISOString()},
    {...base,expectedRevision:NaN},{...base,fixTimestamp:'invalid'},
    {...base,rawLocation:{lat:17}},{...base,accuracyMeters:Infinity}])
    assert.equal(parseGpsLocation(bad,now),null);
});
test('CDN URL allowlist never accepts credentials, plaintext, arbitrary paths or query tokens',()=>{
  for(const invalid of ['http://cdn.example.com/geo/india/v1/',
    'https://u:pass@cdn.example.com/geo/india/v1/',
    'https://cdn.example.com/geo/india/v1/?token=secret',
    'https://cdn.example.com/private/geo/india/v1/',
    'https://localhost/geo/india/v1/'])
    assert.throws(()=>readGeoDeliveryConfig({ULUV_GEO_PUBLIC_BASE_URL:invalid,
      ULUV_GEO_CANONICAL_MANIFEST_SHA256:'a'.repeat(64)} as NodeJS.ProcessEnv));
});
