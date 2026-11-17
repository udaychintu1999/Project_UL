import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { indiaBoundaryLoader, IndiaBoundary, INDIA_BOUNDARY_SHA256 } from '../../src/features/geo/india-boundary.ts';
import { parseGpsLocation } from '../../src/features/geo/validation.ts';

test('real, pinned national MultiPolygon includes mainland and islands, not foreign coordinates',async()=>{
  const boundary=await indiaBoundaryLoader()();
  for(const [lat,lng] of [[17.385,78.487],[19.07,72.88],[28.61,77.21],
    [11.67,92.73],[10.56,72.64]]) {
    assert.equal(boundary.contains(lat,lng),true,`${lat},${lng} should be inside`);
  }
  for(const [lat,lng] of [[51.51,-0.13],[27.71,85.32],[6.93,79.84],
    [0,0],[91,90],[NaN,79],[Infinity,80],[-90,78]]) {
    assert.equal(boundary.contains(lat,lng),false,`${lat},${lng} should be rejected`);
  }
});
test('source SHA is pinned; integrity changes and missing data fail closed',async()=>{
  assert.match(INDIA_BOUNDARY_SHA256,/^[0-9a-f]{64}$/);
  const bytes=await readFile(new URL('../../assets/geo/india-boundary.geojson',import.meta.url));
  assert.ok(IndiaBoundary.fromBytes(bytes).contains(17.385,78.487));
  const tampered=Buffer.from(bytes);tampered[120]^=1;
  assert.throws(()=>IndiaBoundary.fromBytes(tampered),/integrity/i);
  const dir=await mkdtemp(join(tmpdir(),'uluv-geo-gps-'));
  const file=join(dir,'not-found.geojson');
  await assert.rejects(indiaBoundaryLoader(file)(),/ENOENT/);
  await writeFile(file,Buffer.from('not a polygon'));
  await assert.rejects(indiaBoundaryLoader(file)(),/integrity/i);
});
test('GPS payload rejects stale, future, inaccurate, out-of-range and tampered shapes',()=>{
  const now=Date.parse('2026-11-17T08:00:00.000Z');
  const valid={lat:17.385,lng:78.487,accuracyMeters:250,
    fixTimestamp:'2026-11-17T07:59:30.000Z',expectedRevision:4};
  assert.deepEqual(parseGpsLocation(valid,now),valid);
  for(const altered of [
    {...valid,lat:NaN},{...valid,lat:91},{...valid,lng:181},
    {...valid,accuracyMeters:0},{...valid,accuracyMeters:10001},
    {...valid,fixTimestamp:'2026-11-17T07:55:00.000Z'},
    {...valid,fixTimestamp:'2026-11-17T08:01:00.000Z'},
    {...valid,expectedRevision:-1},{...valid,expectedRevision:3.5},
    {...valid,latitude:17.4},{...valid,fixTimestamp:'not a date'}
  ]) assert.equal(parseGpsLocation(altered,now),null);
});
