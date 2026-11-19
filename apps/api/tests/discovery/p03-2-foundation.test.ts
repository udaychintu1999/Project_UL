import assert from 'node:assert/strict';
import test from 'node:test';
import {cellToLatLng,latLngToCell} from 'h3-js';
import {
  distanceKm,bandForDistance,enclosingCircle,buildPointer,discoveryPartition,discoverySortKey,
  requestedBands,type DistanceBand,type LocalitySnapshot
} from '../../src/features/discovery/contracts.js';
import {conservativeCellCover,planBandCovers,validatedApproximateCenter} from '../../src/features/discovery/coverage.js';
import {decodeCursor,encodeCursor,type CursorContext} from '../../src/features/discovery/cursor.js';
import {scanPointerPage,checkLocality,type QueryFn} from '../../src/features/discovery/pointer-reader.js';

const SECRET='synthetic-test-only-cursor-secret-0000000000000';
function locality(lat:number,lng:number,band:DistanceBand='0-50'):LocalitySnapshot {
  const cell=latLngToCell(lat,lng,6);
  const [approvedLat,approvedLng]=cellToLatLng(cell);
  return {center:{lat:approvedLat,lng:approvedLng},cell,localityRevision:3,settingsRevision:8,
    source:'manual_geonames',distanceBand:band};
}
function pointAround(center:{lat:number;lng:number},radiusKm:number,bearingDegrees:number){
  const R=6371.0088,lat=center.lat*Math.PI/180,lon=center.lng*Math.PI/180;
  const angle=radiusKm/R,bearing=bearingDegrees*Math.PI/180;
  const y=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(bearing));
  const x=lon+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(y));
  return {lat:y*180/Math.PI,lng:((x*180/Math.PI+540)%360)-180};
}
test('exact band boundaries, invalid distance and longitude-aware geodesic',()=>{
  for(const [km,expected] of [[0,'0-10'],[10,'0-10'],[10.0000001,'10-35'],
    [35,'10-35'],[35.000001,'35-50'],[50,'35-50'],[50.00001,null],[-1,null],
    [Number.NaN,null]] as const)assert.equal(bandForDistance(km),expected);
  assert.deepEqual(requestedBands('0-50'),['0-10','10-35','35-50']);
  assert.deepEqual(requestedBands('10-35'),['10-35']);
  assert.throws(()=>requestedBands('unlimited' as DistanceBand));
  assert.ok(Math.abs(distanceKm({lat:0,lng:0},{lat:0,lng:1})-111.195)<0.01);
  assert.throws(()=>distanceKm({lat:NaN,lng:0},{lat:0,lng:0}));
});
test('no invalid R6 cell, incorrect owner center, forged distance band or stale revision',()=>{
  const loc=locality(17.4,78.5);
  checkLocality(loc);
  assert.throws(()=>validatedApproximateCenter(loc.cell,{lat:loc.center.lat+0.01,lng:loc.center.lng}));
  assert.throws(()=>validatedApproximateCenter('fffffffffffffff',loc.center));
  assert.throws(()=>checkLocality({...loc,localityRevision:0}));
  assert.throws(()=>checkLocality({...loc,distanceBand:'0-500' as DistanceBand}));
});
test('geodesic polygon circle closes, no transposed coordinates, invalid geometry rejected',()=>{
  const coords=enclosingCircle({lat:17.385,lng:78.486},10);
  assert.deepEqual(coords[0],coords[coords.length-1]);
  assert.equal(coords.length,97);
  assert.ok(Math.abs(coords[0][0]-78.486)<0.001); // first bearing north
  assert.ok(coords[0][1]>17.385);
  assert.throws(()=>enclosingCircle({lat:99,lng:50},10));
  assert.throws(()=>enclosingCircle({lat:17,lng:78},500));
});
test('conservative H3 overlapping cover includes actual home cells at all sampled bearings and radii',()=>{
  // Production H3 function, not a mock: mainland, coastal, island and border.
  for(const [lat,lng] of [[17.385,78.486],[12.97,77.59],[8.48,76.95],
    [11.62,92.73],[10.57,72.64],[26.91,75.79]]){
    const loc=locality(lat,lng);
    const covers=new Map<number,Set<string>>([10,35,50].map(radius=>
      [radius,new Set(conservativeCellCover(loc.center,radius as 10|35|50))] as const));
    for(const radius of [10,35,50]){
      const cover=covers.get(radius)!;
      assert.ok(cover.has(loc.cell));
      assert.ok(cover.size>3 && cover.size<1600);
      for(const radial of [0,radius*0.5,radius*0.99,radius]){
        for(const bearing of [0,45,90,135,180,225,270,315]){
          const p=pointAround(loc.center,radial,bearing);
          const homeCell=latLngToCell(p.lat,p.lng,6);
          assert.ok(cover.has(homeCell),`${lat}/${lng}: ${radius}km @ ${bearing} missed ${homeCell}`);
        }
      }
    }
  }
});
test('partition and pointer constructor never accept malformed cells, time, uid, revisions',()=>{
  const loc=locality(17,78);
  const joinedAt='2026-11-17T00:00:00.000Z';
  const pointer=buildPointer({mode:'DATING',cell:loc.cell,joinedAt,uid:'public-id',localityRevision:1,profileVersion:2});
  assert.equal(pointer.PK,`DISC#DATING#R6#${loc.cell}`);
  assert.equal(pointer.SK,`JOIN#${joinedAt}#public-id`);
  assert.throws(()=>discoveryPartition('LOCAL' as 'DATING',loc.cell));
  assert.throws(()=>discoverySortKey('2026-02-31T00:00:00.000Z','uid'));
  assert.throws(()=>discoverySortKey(joinedAt,'a#b'));
  assert.throws(()=>buildPointer({mode:'DATING',cell:loc.cell,joinedAt,uid:'uid',localityRevision:0,profileVersion:1}));
});
test('AES-GCM cursor cannot be forged, replayed cross-account, used after locality/filter/settings update or expiry',()=>{
  const loc=locality(17,78);
  const ctx:CursorContext={uid:'viewer-1',mode:'DATING',location:loc,pageSize:12};
  const progress={bandIndex:0,cellIndex:2,lastKey:null};
  const token=encodeCursor(progress,ctx,SECRET,1000);
  assert.deepEqual(decodeCursor(token,ctx,SECRET,1000),progress);
  for(const change of [{...ctx,uid:'viewer-2'},{...ctx,mode:'FRIENDSHIP' as const},
    {...ctx,pageSize:10},{...ctx,location:{...loc,localityRevision:4}},
    {...ctx,location:{...loc,settingsRevision:9}},
    {...ctx,location:{...loc,distanceBand:'10-35' as const}},
    {...ctx,location:{...loc,cell:locality(18,78).cell}}]){
    assert.throws(()=>decodeCursor(token,change,SECRET,1001),/invalid_or_stale/);
  }
  assert.throws(()=>decodeCursor(token,ctx,SECRET,1000+600001));
  assert.throws(()=>decodeCursor((token[0]==='A'?'B':'A')+token.slice(1),ctx,SECRET,1001));
  assert.throws(()=>decodeCursor(token,ctx,'another-very-long-synthetic-cursor-secret-0000',1000));
  assert.throws(()=>encodeCursor({...progress,bandIndex:-1},ctx,SECRET));
  assert.throws(()=>encodeCursor(progress,ctx,'short'));
  assert.throws(()=>decodeCursor('A'.repeat(10000),ctx,SECRET));
});
test('bounded cell scan: filter malformed rows, omit owner, stable progress and no over-fetch',async()=>{
  const loc=locality(17.385,78.486,'0-10');
  const cell=loc.cell,pk=discoveryPartition('DATING',cell);
  const joined='2026-11-17T00:00:00.000Z';
  const good=['aaa','bbb','ccc'].map(uid=>buildPointer({mode:'DATING',cell,joinedAt:joined,uid,
    localityRevision:3,profileVersion:1}));
  const list=[...good,buildPointer({mode:'DATING',cell,joinedAt:'2026-11-17T00:00:01.000Z',uid:'aaa',localityRevision:3,profileVersion:1}),
    buildPointer({mode:'DATING',cell,joinedAt:joined,uid:'viewer',localityRevision:3,profileVersion:1}),
    {...good[0],uid:'bad',homeCell:'not_home'}].sort((a,b)=>b.SK.localeCompare(a.SK));
  const queries:number[]=[];
  const query:QueryFn=async(partition,after,limit)=>{
    assert.equal(partition,pk);queries.push(limit);
    const start=after?list.findIndex(x=>x.SK===after.SK)+1:0;
    const result=list.slice(start,start+limit);
    return {items:result,lastKey:start+limit<list.length&&result.length>0 ?
      {PK:pk,SK:result[result.length-1].SK}:null};
  };
  let token: string|undefined;
  const observed=new Set<string>();
  for(let page=0;page<10;page++){
    const result=await scanPointerPage(query,{uid:'viewer',mode:'DATING',location:loc,pageSize:2,
      token,cursorSecret:SECRET},[{band:'0-10',cells:[cell]}]);
    assert.ok(result.diagnostics.queryCalls<=6);
    assert.ok(result.diagnostics.itemsRead<=72);
    for(const row of result.unverifiedPointers){assert.notEqual(row.uid,'viewer');observed.add(row.uid);}
    if(!result.nextCursor)break;
    token=result.nextCursor;
    assert.ok(page<9,'scan made no forward progress');
  }
  assert.deepEqual([...observed].sort(),['aaa','bbb','ccc']);
  assert.ok(queries.every(x=>x>=1&&x<=12));
});
test('bounded empty partitions and hostile DynamoDB cursor are handled without Scan or infinite loop',async()=>{
  const loc=locality(17.385,78.486,'0-10');
  const covered=conservativeCellCover(loc.center,10).slice(0,15);
  let n=0;
  const empty:QueryFn=async()=>{n++;return {items:[],lastKey:null};};
  const response=await scanPointerPage(empty,{uid:'viewer',mode:'FRIENDSHIP',location:loc,pageSize:4,
    cursorSecret:SECRET},[{band:'0-10',cells:covered}]);
  assert.equal(n,6);assert.ok(response.nextCursor);assert.equal(response.unverifiedPointers.length,0);
  assert.equal(response.diagnostics.budgetExhausted,true);
  assert.throws(()=>decodeCursor(response.nextCursor!,{uid:'viewer',mode:'FRIENDSHIP',location:{...loc,localityRevision:4},pageSize:4},SECRET));
  const bad:QueryFn=async()=>({items:[],lastKey:{PK:'DISC#DATING#R6#invalid',SK:'JOIN#x'}});
  await assert.rejects(scanPointerPage(bad,{uid:'viewer',mode:'FRIENDSHIP',location:loc,pageSize:4,
    cursorSecret:SECRET},[{band:'0-10',cells:[loc.cell]}]),/invalid_discovery_storage_response/);
});
test('P03-2 cannot publish raw pointers; P03-4 route is a separate session-guarded module',async()=>{
  const fs=await import('node:fs');
  const dir=new URL('../../src/features/',import.meta.url);
  for(const relative of ['profiles/routes.ts','geo/routes.ts']){
    const contents=fs.readFileSync(new URL(relative,dir),'utf8');
    assert.doesNotMatch(contents,/registerDiscoveryRoutes|\/v1\/discovery\/people/);
  }
  const auth=fs.readFileSync(new URL('auth/routes.ts',dir),'utf8');
  assert.match(auth,/registerDiscoveryRoutes\(app, db, requireSession, secret\)/);
});
test('staged near-band-first scan honors exact inner/outer bands and no auto-widen',async()=>{
  const loc=locality(17.385,78.486,'0-50');
  const nearCell=loc.cell;
  const farPoint=pointAround(loc.center,20,45);
  const farCell=latLngToCell(farPoint.lat,farPoint.lng,6);
  assert.notEqual(farCell,nearCell);
  const now='2026-11-17T12:00:00.000Z';
  const near=buildPointer({mode:'FRIENDSHIP',cell:nearCell,joinedAt:now,uid:'near',localityRevision:3,profileVersion:1});
  const far=buildPointer({mode:'FRIENDSHIP',cell:farCell,joinedAt:now,uid:'far',localityRevision:3,profileVersion:1});
  const visited:string[]=[];
  const query:QueryFn=async(pk)=>{
    visited.push(pk);
    return {items:pk===near.PK?[near]:pk===far.PK?[far]:[],lastKey:null};
  };
  const result=await scanPointerPage(query,{uid:'viewer',mode:'FRIENDSHIP',location:loc,
    pageSize:4,cursorSecret:SECRET},[
      {band:'0-10',cells:[nearCell]},
      {band:'10-35',cells:[farCell]},
      {band:'35-50',cells:[nearCell]}
    ]);
  assert.deepEqual(result.unverifiedPointers.map(x=>x.uid),['near','far']);
  assert.deepEqual(visited,[near.PK,far.PK,near.PK]);
  assert.equal(result.nextCursor,null);
});
test('DynamoDB adapter requests only limited, strongly consistent PK Query',async()=>{
  const {dynamoPointerQuery}=await import('../../src/features/discovery/pointer-reader.js');
  const loc=locality(17.385,78.486);
  const pk=discoveryPartition('DATING',loc.cell);
  const requests:unknown[]=[];
  const fakeDb={send:async(command:{input:Record<string,unknown>})=>{
    requests.push(command.input);
    return {Items:[],LastEvaluatedKey:undefined};
  }};
  const query=dynamoPointerQuery(fakeDb as never);
  const response=await query(pk,null,7);
  assert.deepEqual(response,{items:[],lastKey:null});
  assert.deepEqual(requests,[{
    TableName:'uluv_discovery',KeyConditionExpression:'PK = :pk AND begins_with(SK, :join)',
    ExpressionAttributeValues:{':pk':pk,':join':'JOIN#'},
    ExclusiveStartKey:undefined,Limit:7,ScanIndexForward:false,ConsistentRead:true
  }]);
  await assert.rejects(query(pk,null,100),/invalid_discovery_query/);
  await assert.rejects(query(pk,{PK:'WRONG',SK:'JOIN#...'},1),/invalid_discovery_query/);
});
test('250 independent cursor ciphertext mutations cannot bypass authentication',()=>{
  const loc=locality(17,78);
  const ctx:CursorContext={uid:'viewer-1',mode:'DATING',location:loc,pageSize:12};
  const token=encodeCursor({bandIndex:0,cellIndex:0,lastKey:null},ctx,SECRET,1000);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for(let i=0;i<250;i++){
    const index=i%token.length;
    const current=token[index];
    const replacement=alphabet[(alphabet.indexOf(current)+1+i%7)%alphabet.length];
    const mutated=token.slice(0,index)+replacement+token.slice(index+1);
    assert.notEqual(mutated,token);
    assert.throws(()=>decodeCursor(mutated,ctx,SECRET,1001));
  }
});
test('trusted locality reads only owner settings, consistently, and rejects invalid or absent source',async()=>{
  const {readTrustedLocality}=await import('../../src/features/discovery/settings-snapshot.js');
  const loc=locality(17.385,78.486);
  const calls:Record<string,unknown>[]=[];
  const makeDb=(row:Record<string,unknown>|undefined)=>({
    send:async(command:{input:Record<string,unknown>})=>{
      calls.push(command.input);return {Item:row};
    }
  });
  const row={geoApprovedCenter:loc.center,geoH3Cell:loc.cell,
    geoSelectionSource:'manual_geonames',geoDistanceBand:'0-50',localityRevision:3,settingsRevision:8};
  const result=await readTrustedLocality(makeDb(row) as never,'owner_1');
  assert.deepEqual(result,loc);
  assert.deepEqual(calls,[{TableName:'uluv_settings',Key:{PK:'USER#owner_1',SK:'SETTINGS'},ConsistentRead:true}]);
  await assert.rejects(readTrustedLocality(makeDb(undefined) as never,'owner_1'),/trusted_locality_required/);
  await assert.rejects(readTrustedLocality(makeDb({...row,geoApprovedCenter:{lat:19,lng:78}}) as never,'owner_1'),/untrusted_locality/);
  await assert.rejects(readTrustedLocality(makeDb(row) as never,'invalid#uid'),/invalid_account_context/);
});
