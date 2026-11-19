import test from 'node:test';
import assert from 'node:assert/strict';
import {latLngToCell,cellToLatLng} from 'h3-js';
import {distanceKm,bandForDistance,type LocalitySnapshot} from '../../src/features/discovery/contracts.js';
import {conservativeCellCover,planBandCovers} from '../../src/features/discovery/coverage.js';
import {encodeCursor,decodeCursor,type CursorContext} from '../../src/features/discovery/cursor.js';
const secret='P03-4-synthetic-cursor-isolation-secret-0123456789';
test('P03-4 near-center H3 traversal returns the owner cell first and does not query wrong band cells',()=>{
  for(const coords of [[17.385,78.486],[11.62,92.73],[26.91,75.79]]){
    const cell=latLngToCell(coords[0],coords[1],6);
    const [lat,lng]=cellToLatLng(cell);
    const center={lat,lng};
    assert.equal(conservativeCellCover(center,10)[0],cell);
    const covers=planBandCovers(center,'0-50');
    assert.deepEqual(covers.map(c=>c.band),['0-10','10-35','35-50']);
    const seen=new Set<string>();
    for(const cover of covers){
      assert.ok(cover.cells.length>0);
      for(const c of cover.cells){
        assert.equal(seen.has(c),false,'same cell must not waste read budget in a later band');
        seen.add(c);
        const [cLat,cLng]=cellToLatLng(c);
        assert.equal(bandForDistance(distanceKm(center,{lat:cLat,lng:cLng})),cover.band);
      }
    }
  }
});
test('P03-4 encrypted cursor binds current viewer activation version',()=>{
  const cell=latLngToCell(17.385,78.486,6);
  const [lat,lng]=cellToLatLng(cell);
  const locality:LocalitySnapshot={center:{lat,lng},cell,localityRevision:3,
    settingsRevision:8,distanceBand:'0-10',source:'manual_geonames'};
  const context:CursorContext={uid:'viewer',mode:'DATING',location:locality,pageSize:8,
    authorizationVersion:2};
  const state={bandIndex:0,cellIndex:3,lastKey:null};
  const now=1_800_000_000_000;
  const token=encodeCursor(state,context,secret,now);
  assert.deepEqual(decodeCursor(token,context,secret,now+10),state);
  assert.throws(()=>decodeCursor(token,{...context,authorizationVersion:3},secret,now+10),
    /invalid_or_stale_discovery_cursor/);
  assert.throws(()=>decodeCursor(token,{...context,uid:'another-viewer'},secret,now+10),
    /invalid_or_stale_discovery_cursor/);
  assert.throws(()=>decodeCursor(token,context,secret,now+10*60*1000+1),
    /invalid_or_stale_discovery_cursor/);
});
