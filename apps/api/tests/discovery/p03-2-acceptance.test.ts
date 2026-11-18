import test from 'node:test';
import assert from 'node:assert/strict';
import {latLngToCell,cellToLatLng} from 'h3-js';
import {buildPointer,discoveryPartition,MAX_QUERY_CALLS,MAX_READ_ITEMS,
  type LocalitySnapshot,type DiscoveryMode} from '../../src/features/discovery/contracts.js';
import {scanPointerPage,type QueryFn} from '../../src/features/discovery/pointer-reader.js';
import {decodeCursor,encodeCursor,type CursorContext} from '../../src/features/discovery/cursor.js';
const secret='p03-2-extra-acceptance-test-secret-00000000000';
function loc():LocalitySnapshot {
  const cell=latLngToCell(17.385,78.4867,6);
  const [lat,lng]=cellToLatLng(cell);
  return {cell,center:{lat,lng},localityRevision:1,settingsRevision:4,
    source:'manual_geonames',distanceBand:'0-50'};
}
const joined='2026-11-17T00:00:00.000Z';
function row(mode:DiscoveryMode,cell:string,uid:string){
  return buildPointer({mode,cell,uid,joinedAt:joined,localityRevision:1,profileVersion:1});
}
test('0-50 spans three bands, never duplicates candidates across band transitions',async()=>{
  const location=loc();const cell=location.cell;
  const pk=discoveryPartition('DATING',cell);let queries=0;
  const reader:QueryFn=async(partition,_after,limit)=>{
    assert.equal(partition,pk);assert.ok(limit<=12);queries++;
    return {items:[row('DATING',cell,'eligible')],lastKey:null};
  };
  const covers=[{band:'0-10' as const,cells:[cell]},
    {band:'10-35' as const,cells:[cell]}, {band:'35-50' as const,cells:[cell]}];
  const page=await scanPointerPage(reader,{uid:'viewer',mode:'DATING',location,
    pageSize:24,cursorSecret:secret},covers);
  assert.equal(page.unverifiedPointers.length,1);
  assert.equal(page.unverifiedPointers[0].uid,'eligible');
  assert.equal(page.nextCursor,null);
  assert.equal(queries,3);
});
test('empty partitions cannot exceed six queries per page, cursor resumes without losing cells',async()=>{
  const location={...loc(),distanceBand:'0-10' as const};
  const covers=[{band:'0-10' as const,cells:Array.from({length:19},()=>location.cell)}];
  let calls=0;const reader:QueryFn=async()=>{calls++;return {items:[],lastKey:null};};
  let token: string|undefined;
  for(let pageIndex=0;pageIndex<4;pageIndex++){
    const page=await scanPointerPage(reader,{uid:'viewer',mode:'DATING',location,
      pageSize:10,token,cursorSecret:secret},covers);
    assert.ok(page.diagnostics.queryCalls<=MAX_QUERY_CALLS);
    assert.ok(page.diagnostics.itemsRead<=MAX_READ_ITEMS);
    token=page.nextCursor??undefined;
    if(pageIndex<3)assert.ok(token,'more empty partitions must preserve progress');
    else assert.equal(token,undefined);
  }
  assert.equal(calls,19);
});
test('storage fails closed on oversized payload, invalid keys, impossible partition, and same cursor',async()=>{
  const location={...loc(),distanceBand:'0-10' as const};
  const pk=discoveryPartition('DATING',location.cell);
  const p={uid:'viewer',mode:'DATING' as const,location,pageSize:3,cursorSecret:secret};
  const cover=[{band:'0-10' as const,cells:[location.cell]}];
  const hostile:QueryFn[]=[
    async(_pk,_cursor,limit)=>({items:Array.from({length:limit+1},()=>row('DATING',location.cell,'a')),lastKey:null}),
    async()=>({items:[],lastKey:{PK:'DISC#DATING#R6#not-a-cell',SK:'JOIN#2026'}}),
    async()=>({items:[],lastKey:{PK:pk,SK:'invalid'}}),
  ];
  for(const query of hostile)await assert.rejects(scanPointerPage(query,p,cover),/invalid_discovery_storage_response/);
  const last={PK:pk,SK:row('DATING',location.cell,'a').SK};
  const token=encodeCursor({bandIndex:0,cellIndex:0,lastKey:last},
    {uid:p.uid,mode:p.mode,location:p.location,pageSize:p.pageSize},secret);
  await assert.rejects(scanPointerPage(async()=>({items:[],lastKey:last}),{...p,token},cover),/discovery_cursor_stalled/);
});
test('invalid row cannot become a candidate, including wrong mode/PK/revision/uid/self',async()=>{
  const location={...loc(),distanceBand:'0-10' as const};
  const good=row('DATING',location.cell,'valid');
  const malicious=[{...good,uid:'cross-user',SK:'JOIN#bad'},
    {...good,mode:'FRIENDSHIP'}, {...good,PK:'WRONG'},
    {...good,localityRevision:0}, {...good,profileVersion:-1},
    row('DATING',location.cell,'viewer'),good];
  const result=await scanPointerPage(async()=>({items:malicious,lastKey:null}),
    {uid:'viewer',mode:'DATING',location,pageSize:12,cursorSecret:secret},
    [{band:'0-10',cells:[location.cell]}]);
  assert.deepEqual(result.unverifiedPointers.map(r=>r.uid),['valid']);
});
test('expired/cross-account/cross-band/cross-revision replay and huge tokens never reach query',async()=>{
  const location=loc();const ctx:CursorContext={uid:'viewer',mode:'DATING',location,pageSize:5};
  const token=encodeCursor({bandIndex:0,cellIndex:0,lastKey:null},ctx,secret,1000000);
  let calls=0;const reader:QueryFn=async()=>{calls++;return {items:[],lastKey:null};};
  for(const other of [
    {...ctx,uid:'another'}, {...ctx,mode:'FRIENDSHIP' as const},
    {...ctx,location:{...location,settingsRevision:5}},
    {...ctx,location:{...location,localityRevision:2}},
    {...ctx,location:{...location,distanceBand:'0-10' as const}},
    {...ctx,pageSize:10},
  ])assert.throws(()=>decodeCursor(token,other,secret,1000001));
  assert.throws(()=>decodeCursor(token,ctx,secret,1000000+600001));
  await assert.rejects(scanPointerPage(reader,{...ctx,token:'!' .repeat(4000),cursorSecret:secret},
    [{band:'0-10',cells:[location.cell]}]));
  assert.equal(calls,0);
});
test('no filter or unsanctioned partitions; malformed cover fails before data access',async()=>{
  const location={...loc(),distanceBand:'0-10' as const};
  let calls=0;const reader:QueryFn=async()=>{calls++;return {items:[],lastKey:null};};
  for(const covers of [[],[{band:'0-10' as const,cells:[]}],
    [{band:'0-10' as const,cells:['fffffffffffffff']}],
    [{band:'0-10' as const,cells:[location.cell]},{band:'0-10' as const,cells:[location.cell]}]])
    await assert.rejects(scanPointerPage(reader,{uid:'viewer',mode:'DATING',location,
      pageSize:3,cursorSecret:secret},covers));
  assert.equal(calls,0);
});
