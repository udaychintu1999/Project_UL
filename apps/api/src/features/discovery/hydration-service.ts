/** P03-4: bounded transactional re-hydration. The index supplies only untrusted
 * locators. Each returned candidate is checked against ONE strongly consistent
 * TransactGet snapshot including owner, target, two block edges and READY media.
 * This is a server-only read service; it never exports internal pointer data. */
import {GetCommand, TransactGetCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {assignedIds, canonicalEligibility, disclosedPreview, type CanonicalSnapshot,
  type Row, type SafePreview} from './hydration-policy.js';
import {MAX_HYDRATION_PAGE} from './request-policy.js';
import {scanPointerPage,dynamoPointerQuery,checkLocality,type InternalPointer} from './pointer-reader.js';
import type {DistanceBand,DiscoveryMode,LocalitySnapshot} from './contracts.js';

const userKey=(uid:string)=>({PK:`USER#${uid}`,SK:'META'});
const settingsKey=(uid:string)=>({PK:`USER#${uid}`,SK:'SETTINGS'});
const profileKey=(uid:string,mode:DiscoveryMode)=>({PK:`USER#${uid}`,SK:`MODE#${mode}`});
const mediaKey=(uid:string,id:string)=>({PK:`USER#${uid}`,SK:`MEDIA#${id}`});
const blockKey=(actor:string,target:string)=>({PK:`BLOCKS#${actor}`,SK:`TARGET#${target}`});
const safeUid=(uid:string)=>/^[-_a-zA-Z0-9]{1,128}$/.test(uid);
type Table='uluv_users'|'uluv_settings'|'uluv_profiles'|'uluv_blocks';
type ReadKey={table:Table;key:{PK:string;SK:string}};
const reads=(db:DynamoDBDocumentClient,keys:readonly ReadKey[])=>
  db.send(new TransactGetCommand({TransactItems:keys.map(k=>({Get:{TableName:k.table,Key:k.key}}))}));
const record=(x:unknown):Row|undefined=>x&&typeof x==='object'&&!Array.isArray(x)?x as Row:undefined;
const readResult=(response:{Responses?:readonly {Item?:unknown}[]},count:number)=>{
  if(!Array.isArray(response.Responses)||response.Responses.length!==count)
    throw new Error('canonical_hydration_unavailable');
  return response.Responses.map(r=>record(r?.Item));
};
const table=(table:Table,key:{PK:string;SK:string}):ReadKey=>({table,key});
const canonicalKeys=(uid:string,mode:DiscoveryMode):ReadKey[]=>[
  table('uluv_users',userKey(uid)),table('uluv_settings',settingsKey(uid)),
  table('uluv_profiles',profileKey(uid,mode))];
const photoKeys=(uid:string,ids:readonly string[]):ReadKey[]=>
  ids.map(id=>table('uluv_profiles',mediaKey(uid,id)));
const snapshot=(rows:(Row|undefined)[],at:number,count:number):CanonicalSnapshot=>({
  account:rows[at],settings:rows[at+1],profile:rows[at+2],
  media:rows.slice(at+3,at+3+count)});

async function photoListFor(db:DynamoDBDocumentClient,uid:string,mode:DiscoveryMode):Promise<string[]|null>{
  const raw=(await db.send(new GetCommand({TableName:'uluv_profiles',
    Key:profileKey(uid,mode),ConsistentRead:true}))).Item as Row|undefined;
  return assignedIds(raw);
}
async function loadViewer(db:DynamoDBDocumentClient,uid:string,mode:DiscoveryMode):Promise<CanonicalSnapshot|null>{
  const ids=await photoListFor(db,uid,mode);
  if(!ids)return null;
  const keys=[...canonicalKeys(uid,mode),...photoKeys(uid,ids)];
  const response=await reads(db,keys);
  const result=snapshot(readResult(response,keys.length),0,ids.length);
  return canonicalEligibility(uid,mode,result).valid?result:null;
}
const snapshotFingerprint=(s:CanonicalSnapshot)=>JSON.stringify([
  s.account?.status,s.account?.identityRevision,s.settings?.settingsRevision,
  s.settings?.setupRevision,s.settings?.localityRevision,s.settings?.geoH3Cell,
  s.settings?.geoDistanceBand,s.settings?.geoSortMode,s.profile?.version,
  s.profile?.discoveryPointer,s.profile?.requestedActive,s.profile?.photoIds,
  s.media.map(m=>[m?.mediaId,m?.state,m?.refCount])]);

/** One bounded transaction per candidate. Stale photo lists and blocks are
 * checked with account/profile/settings in the SAME database snapshot. */
async function hydrateOne(db:DynamoDBDocumentClient,viewerUid:string,target:InternalPointer,
  mode:DiscoveryMode,viewer:CanonicalSnapshot,band:DistanceBand):Promise<SafePreview|null>{
  const ids=await photoListFor(db,target.uid,mode);
  if(!ids)return null;
  const viewerIds=assignedIds(viewer.profile);
  if(!viewerIds)return null;
  const targetKeys=canonicalKeys(target.uid,mode);
  const ownerKeys=canonicalKeys(viewerUid,mode);
  const keys=[...targetKeys,...photoKeys(target.uid,ids),
    table('uluv_blocks',blockKey(viewerUid,target.uid)),
    table('uluv_blocks',blockKey(target.uid,viewerUid)),
    ...ownerKeys,...photoKeys(viewerUid,viewerIds)];
  // 3 target + 6 photos + 2 block edges + 3 viewer + 6 viewer photos = 20.
  if(keys.length>20)throw new Error('canonical_hydration_budget_exceeded');
  const rows=readResult(await reads(db,keys),keys.length);
  const targetSnapshot=snapshot(rows,0,ids.length);
  const blocksAt=3+ids.length;
  const viewerAt=blocksAt+2;
  const currentViewer=snapshot(rows,viewerAt,viewerIds.length);
  if(snapshotFingerprint(currentViewer)!==snapshotFingerprint(viewer))
    throw new Error('viewer_context_changed');
  return disclosedPreview(viewerUid,target.uid,mode,target,currentViewer,targetSnapshot,
    rows[blocksAt],rows[blocksAt+1],band);
}

export type HydratedPage=Readonly<{items:readonly SafePreview[];nextCursor:string|null;
  distanceBand:DistanceBand;sortMode:'near_band_first'|'recent_first';
  ordering:'page_local_only';scannedCount:number}>;
export type DiscoveryInput={uid:string;mode:DiscoveryMode;pageSize:number;cursor?:string;
  cursorSecret:string};
/** Return at most 12 previews. No promise of globally exact chronological or
 * nearest ordering across unvisited partitions; no auto-widened radius. */
export async function authenticatedDiscoveryPage(db:DynamoDBDocumentClient,
  p:DiscoveryInput):Promise<HydratedPage>{
  if(!safeUid(p.uid)||!['DATING','FRIENDSHIP'].includes(p.mode)||
    !Number.isSafeInteger(p.pageSize)||p.pageSize<1||p.pageSize>MAX_HYDRATION_PAGE)
    throw new Error('invalid_discovery_request');
  const viewer=await loadViewer(db,p.uid,p.mode);
  if(!viewer)throw new Error('discovery_not_eligible');
  const ownerSettings=viewer.settings as Row;
  const sortMode=ownerSettings.geoSortMode==='recent_first'?'recent_first':'near_band_first';
  const band=ownerSettings.geoDistanceBand??'0-50';
  const locality:LocalitySnapshot={center:ownerSettings.geoApprovedCenter as {lat:number;lng:number},
    cell:ownerSettings.geoH3Cell as string,
    localityRevision:ownerSettings.localityRevision as number,
    settingsRevision:ownerSettings.settingsRevision as number,
    distanceBand:band as DistanceBand,
    source:ownerSettings.geoSelectionSource as 'manual_geonames'|'gps_selected'};
  checkLocality(locality);
  const scanned=await scanPointerPage(dynamoPointerQuery(db),{
    uid:p.uid,mode:p.mode,location:locality,pageSize:p.pageSize,
    token:p.cursor,cursorSecret:p.cursorSecret,
    authorizationVersion:viewer.profile?.version as number});
  const approved:{preview:SafePreview;joinedAt:string;distance:number}[]=[];
  for(const pointer of scanned.unverifiedPointers){
    const preview=await hydrateOne(db,p.uid,pointer,p.mode,viewer,band as DistanceBand);
    if(preview)approved.push({preview,joinedAt:pointer.SK.slice(5,29),distance:pointer.distanceKm});
  }
  // Sort ONLY the hydrated page, not all unvisited partitions.
  approved.sort(sortMode==='recent_first'?
    (a,b)=>b.joinedAt.localeCompare(a.joinedAt)||a.preview.handle.localeCompare(b.preview.handle):
    (a,b)=>a.distance-b.distance||a.preview.handle.localeCompare(b.preview.handle));
  return {items:approved.map(x=>x.preview),nextCursor:scanned.nextCursor,
    distanceBand:locality.distanceBand,sortMode,ordering:'page_local_only',
    scannedCount:scanned.unverifiedPointers.length};
}
