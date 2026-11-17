/** P03-2 bounded internal discovery pointer scan. Raw pointer rows must NEVER
 * leave Fastify as user-visible candidates. P03-3/P03-4 must hydrate canonical
 * profiles/users/blocks and recheck authorisation before responding. */
import {QueryCommand, type DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {cellToLatLng} from 'h3-js';
import {
  distanceKm, bandForDistance, discoveryPartition, MAX_PAGE_SIZE, MAX_QUERY_CALLS,
  MAX_DDB_ITEMS_PER_QUERY, MAX_READ_ITEMS,
  type DistanceBand, type DiscoveryMode, type LocalitySnapshot
} from './contracts.js';
import {validatedApproximateCenter, planBandCovers, isR6Cell, type BandCover} from './coverage.js';
import {encodeCursor,decodeCursor,type CursorContext,type CursorKey,type InternalCursor} from './cursor.js';

export type InternalPointer={uid:string;mode:DiscoveryMode;homeCell:string;
  localityRevision:number;profileVersion:number;PK:string;SK:string;distanceKm:number};
export type QueryResponse={items:readonly Record<string,unknown>[];lastKey:CursorKey|null};
export type QueryFn=(partition:string,after:CursorKey|null,limit:number)=>Promise<QueryResponse>;
export type ScanParams={uid:string;mode:DiscoveryMode;location:LocalitySnapshot;pageSize:number;
  token?:string;cursorSecret:string};
export type InternalScanPage={unverifiedPointers:readonly InternalPointer[];nextCursor:string|null;
  diagnostics:{queryCalls:number;itemsRead:number;cellsTraversed:number;budgetExhausted:boolean}};

/** All values in location originate from a server-consistent settings read. */
export function checkLocality(location:LocalitySnapshot):void {
  if(!location || !['manual_geonames','gps_selected'].includes(location.source) ||
    !Number.isSafeInteger(location.localityRevision)||location.localityRevision<1 ||
    !Number.isSafeInteger(location.settingsRevision)||location.settingsRevision<0 ||
    !['0-10','10-35','35-50','0-50'].includes(location.distanceBand))throw new Error('trusted_locality_required');
  validatedApproximateCenter(location.cell,location.center);
}
function validPointer(row:Record<string,unknown>,pk:string,mode:DiscoveryMode,cell:string):row is
  Record<string,unknown>&{PK:string;SK:string;uid:string;mode:DiscoveryMode;
    homeCell:string;localityRevision:number;profileVersion:number} {
  return row.PK===pk && typeof row.SK==='string' &&
    /^JOIN#\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z#[-_a-zA-Z0-9]{1,128}$/.test(row.SK) &&
    typeof row.uid==='string' && /^[-_a-zA-Z0-9]{1,128}$/.test(row.uid) &&
    row.SK.endsWith(`#${row.uid}`) && row.mode===mode && row.homeCell===cell &&
    typeof row.localityRevision==='number' && Number.isSafeInteger(row.localityRevision) && row.localityRevision>=1 &&
    typeof row.profileVersion==='number' && Number.isSafeInteger(row.profileVersion) && row.profileVersion>=1;
}
function matchesBand(actual:Exclude<DistanceBand,'0-50'>|null,wanted:Exclude<DistanceBand,'0-50'>){
  return actual===wanted;
}
/** Query calls bounded to 6 and read items to 72 per request.
 * The returned list is an untrusted *internal* pre-hydration queue. */
export async function scanPointerPage(query:QueryFn,p:ScanParams,
  covers?:readonly BandCover[]):Promise<InternalScanPage>{
  if(!/^[-_a-zA-Z0-9]{1,128}$/.test(p.uid)||!['DATING','FRIENDSHIP'].includes(p.mode)||
    !Number.isSafeInteger(p.pageSize)||p.pageSize<1||p.pageSize>MAX_PAGE_SIZE)
    throw new Error('invalid_discovery_request');
  checkLocality(p.location);
  const planned=covers??planBandCovers(p.location.center,p.location.distanceBand);
  if(planned.length===0||planned.length>3||planned.some((pBand,i)=>
    pBand.cells.length===0||pBand.cells.length>1600||
    (i>0&&pBand.band===planned[i-1].band)||
    pBand.cells.some(cell=>!isR6Cell(cell))))throw new Error('invalid_discovery_cover');
  const context:CursorContext={uid:p.uid,mode:p.mode,location:p.location,pageSize:p.pageSize};
  const state:InternalCursor=p.token?decodeCursor(p.token,context,p.cursorSecret):
    {bandIndex:0,cellIndex:0,lastKey:null};
  if(state.bandIndex>planned.length||
    (state.bandIndex<planned.length && state.cellIndex>planned[state.bandIndex].cells.length) ||
    (state.bandIndex===planned.length && (state.cellIndex!==0||state.lastKey)))
    throw new Error('invalid_or_stale_discovery_cursor');
  let queries=0,itemsRead=0,cellsTraversed=0;
  const rows:InternalPointer[]=[];const seen=new Set<string>();
  while(state.bandIndex<planned.length && queries<MAX_QUERY_CALLS && itemsRead<MAX_READ_ITEMS && rows.length<p.pageSize){
    const phase=planned[state.bandIndex];
    if(state.cellIndex>=phase.cells.length){state.bandIndex++;state.cellIndex=0;state.lastKey=null;continue;}
    const cell=phase.cells[state.cellIndex];
    const pk=discoveryPartition(p.mode,cell);
    if(state.lastKey&&state.lastKey.PK!==pk)throw new Error('invalid_or_stale_discovery_cursor');
    const remaining=p.pageSize-rows.length;
    const maxRead=Math.min(MAX_DDB_ITEMS_PER_QUERY,MAX_READ_ITEMS-itemsRead,remaining);
    const response=await query(pk,state.lastKey,maxRead);
    queries++;
    if(!response || !Array.isArray(response.items)||response.items.length>maxRead ||
      (response.lastKey!==null&&(!response.lastKey||response.lastKey.PK!==pk||
      typeof response.lastKey.SK!=='string'||!response.lastKey.SK.startsWith('JOIN#'))))
      throw new Error('invalid_discovery_storage_response');
    itemsRead+=response.items.length;
    for(const raw of response.items){
      if(!raw||!validPointer(raw,pk,p.mode,cell)||raw.uid===p.uid||seen.has(raw.uid))continue;
      const [lat,lng]=cellToLatLng(cell);
      const km=distanceKm(p.location.center,{lat,lng});
      if(matchesBand(bandForDistance(km),phase.band)){
        seen.add(raw.uid);rows.push({PK:raw.PK,SK:raw.SK,uid:raw.uid,mode:p.mode,homeCell:cell,
          localityRevision:raw.localityRevision,profileVersion:raw.profileVersion,distanceKm:km});
      }
    }
    if(response.lastKey){
      if(state.lastKey&&state.lastKey.SK===response.lastKey.SK)throw new Error('discovery_cursor_stalled');
      state.lastKey=response.lastKey;
    }else {state.cellIndex++;state.lastKey=null;cellsTraversed++;}
  }
  // No ranking promise across undiscovered cells: stable order over fetched
  // pointers only. Preserve the scan cursor, not the sorted candidate order.
  rows.sort((a,b)=>a.distanceKm-b.distanceKm||a.uid.localeCompare(b.uid));
  const done=state.bandIndex>=planned.length || (state.bandIndex===planned.length-1 &&
    state.cellIndex>=planned[state.bandIndex].cells.length && !state.lastKey);
  return {unverifiedPointers:rows,nextCursor:done?null:encodeCursor(state,context,p.cursorSecret),
    diagnostics:{queryCalls:queries,itemsRead,cellsTraversed,budgetExhausted:!done}};
}
/** Standard DynamoDB Local query adapter. No Scan, no GSI, no unbounded read.
 * Projection is pointers only. No requests made until scanPointerPage called. */
export function dynamoPointerQuery(db:DynamoDBDocumentClient):QueryFn {
  return async(partition,after,limit)=>{
    if(!/^DISC#(?:DATING|FRIENDSHIP)#R6#[0-9a-f]{15}$/.test(partition)||
      !Number.isSafeInteger(limit)||limit<1||limit>MAX_DDB_ITEMS_PER_QUERY||
      (after!==null && (after.PK!==partition||!after.SK.startsWith('JOIN#'))))
      throw new Error('invalid_discovery_query');
    const response=await db.send(new QueryCommand({TableName:'uluv_discovery',
      KeyConditionExpression:'PK = :pk AND begins_with(SK, :join)',
      ExpressionAttributeValues:{':pk':partition,':join':'JOIN#'},
      ExclusiveStartKey:after??undefined,Limit:limit,ScanIndexForward:false,
      ConsistentRead:true}));
    const key=response.LastEvaluatedKey;
    if(key && (typeof key.PK!=='string'||typeof key.SK!=='string'))
      throw new Error('invalid_discovery_storage_response');
    return {items:response.Items??[],lastKey:key?{PK:key.PK as string,SK:key.SK as string}:null};
  };
}
