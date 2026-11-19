/** P03-4 disclosure policy: pointer rows are NEVER a public authorization.
 * Only a canonical active profile, fresh approved R6 locality, mutual no-block
 * and two assigned READY photos authorize a bounded, contact-safe preview. */
import {ageFromBirthDate, normalizeHandle, validPublicText} from '../profiles/validation.js';
import {activationMissing} from '../profiles/activation-policy.js';
import {validMediaId} from '../profiles/media-policy.js';
import {canonicalPointerAnchor} from './pointer-lifecycle-policy.js';
import {checkLocality, type InternalPointer} from './pointer-reader.js';
import {bandForDistance,distanceKm,requestedBands,type DiscoveryMode,type DistanceBand} from './contracts.js';

export type Row=Record<string,unknown>;
export type CanonicalSnapshot=Readonly<{account:Row|undefined;settings:Row|undefined;profile:Row|undefined;
  media:readonly (Row|undefined)[]}>;
export type SafePreview=Readonly<{handle:string;displayName:string;age:number;broadArea:string;
  bio:string;intention:string;interests:readonly string[];photoCount:number;
  distanceBand:Exclude<DistanceBand,'0-50'>}>;
const goodRevision=(value:unknown)=>Number.isSafeInteger(value)&&typeof value==='number'&&value>=0;
const validLabel=(v:unknown,max=60):v is string=>typeof v==='string'&&v.trim()===v&&
  v.length>0&&v.length<=max&&validPublicText(v);
const noExtraPrivateFlag=(row:Row)=>row.discoveryOptOut!==true&&row.hidden!==true&&
  row.private!==true&&row.suspended!==true&&row.discoverable!==false&&
  row.publicVisible!==false&&row.discoveryEnabled!==false&&
  (row.visibility===undefined||row.visibility==='active'||row.visibility==='public')&&
  (row.moderationStatus===undefined||row.moderationStatus==='approved');

export function assignedIds(row:Row|undefined):string[]|null {
  const ids=row?.photoIds;
  if(!Array.isArray(ids)||ids.length<2||ids.length>6||!ids.every(validMediaId)||
    new Set(ids).size!==ids.length)return null;
  return ids;
}
function verifiedMedia(uid:string,ids:readonly string[],media:readonly (Row|undefined)[]):boolean {
  return media.length===ids.length&&ids.every((id,i)=>{
    const row=media[i];return row?.PK===`USER#${uid}`&&row.SK===`MEDIA#${id}`&&
      row.mediaId===id&&row.state==='READY'&&typeof row.refCount==='number'&&
      Number.isSafeInteger(row.refCount)&&row.refCount>=1;
  });
}
export function canonicalEligibility(uid:string,mode:DiscoveryMode,s:CanonicalSnapshot):
  {valid:true;center:{lat:number;lng:number};cell:string;revision:number;anchor:{PK:string;SK:string};
    handle:string;age:number;fields:{displayName:string;bio:string;intention:string;interests:string[]};
    broadArea:string}|{valid:false} {
  if(!/^[-_a-zA-Z0-9]{1,128}$/.test(uid)||!['DATING','FRIENDSHIP'].includes(mode))return {valid:false};
  const {account,settings,profile,media}=s;
  if(!account||!settings||!profile||account.PK!==`USER#${uid}`||account.SK!=='META'||
    settings.PK!==`USER#${uid}`||settings.SK!=='SETTINGS'||
    profile.PK!==`USER#${uid}`||profile.SK!==`MODE#${mode}`||
    account.status!=='active'||account.ageEligibility!=='self_declared_adult'||
    !noExtraPrivateFlag(account)||!noExtraPrivateFlag(settings)||!noExtraPrivateFlag(profile)||
    profile.requestedActive!==true||!goodRevision(account.identityRevision)||
    !goodRevision(settings.setupRevision)||!goodRevision(settings.settingsRevision)||
    !goodRevision(settings.localityRevision)||settings.localityRevision===0||
    !goodRevision(profile.version)||profile.version===0||
    profile.activationSetupRevision!==settings.setupRevision||
    profile.activationIdentityRevision!==account.identityRevision)return {valid:false};
  const modeKey=mode==='DATING'?'dating':'friendship';
  const selected=settings.selectedModes;
  if(!selected||typeof selected!=='object'||Array.isArray(selected)||
    (selected as Row)[modeKey]!==true)return {valid:false};
  const handle=normalizeHandle(account.handle);
  const age=ageFromBirthDate(account.birthDate);
  const ids=assignedIds(profile);
  if(!handle||account.handle!==handle||age===null||age<18||!ids||
    !verifiedMedia(uid,ids,media))return {valid:false};
  const common=settings.commonName;
  const broadArea=settings.localityLabel;
  const gender=settings.gender;
  const displayName=profile.displayName||common;
  if(!validLabel(common)||!validLabel(broadArea)||
    !['woman','man','non_binary','another_identity','prefer_not_to_say'].includes(String(gender))||
    !validLabel(displayName)||!validLabel(profile.bio,500)||
    !validLabel(profile.intention,80)||!Array.isArray(profile.interests)||
    profile.interests.length<1||profile.interests.length>10||
    !profile.interests.every(x=>validLabel(x,32))||
    new Set((profile.interests as string[]).map(x=>x.toLocaleLowerCase('en-US'))).size!==profile.interests.length)return {valid:false};
  const fields={displayName,bio:profile.bio as string,intention:profile.intention as string,
    interests:profile.interests as string[]};
  if(activationMissing(modeKey,handle,{commonName:common as string,locality:broadArea as string,
      gender:gender as 'woman',selectedModes:{dating:(selected as Row).dating===true,
      friendship:(selected as Row).friendship===true}},
      {...fields,photoIds:ids},age).length)return {valid:false};
  try {
    const locality={center:settings.geoApprovedCenter as {lat:number;lng:number},
      cell:settings.geoH3Cell as string,localityRevision:settings.localityRevision as number,
      settingsRevision:settings.settingsRevision as number,distanceBand:'0-50' as const,
      source:settings.geoSelectionSource as 'manual_geonames'|'gps_selected'};
    checkLocality(locality);
    const anchor=canonicalPointerAnchor(uid,modeKey,profile);
    if(!anchor||anchor.PK!==`DISC#${mode}#R6#${locality.cell}`||
      anchor.localityRevision!==locality.localityRevision||
      anchor.profileVersion!==profile.version)return {valid:false};
    return {valid:true,center:locality.center,cell:locality.cell,
      revision:locality.localityRevision,anchor:{PK:anchor.PK,SK:anchor.SK},
      handle,age,fields,broadArea:broadArea as string};
  }catch{return {valid:false};}
}
/** Fail closed for mismatched pointer revisions/identity/blocks/geo. No UID,
 * H3, GPS, media ID or internal pointer is copied into the returned DTO. */
export function disclosedPreview(viewerUid:string,targetUid:string,mode:DiscoveryMode,
  pointer:InternalPointer,viewer:CanonicalSnapshot,target:CanonicalSnapshot,
  blockFromViewer:Row|undefined,blockFromTarget:Row|undefined,selectedBand:DistanceBand):SafePreview|null {
  if(viewerUid===targetUid||pointer.uid!==targetUid||pointer.mode!==mode||
    blockFromViewer||blockFromTarget)return null;
  const self=canonicalEligibility(viewerUid,mode,viewer);
  const candidate=canonicalEligibility(targetUid,mode,target);
  if(!self.valid||!candidate.valid||candidate.anchor.PK!==pointer.PK||
    candidate.anchor.SK!==pointer.SK||candidate.cell!==pointer.homeCell||
    candidate.revision!==pointer.localityRevision||
    target.profile?.version!==pointer.profileVersion)return null;
  const band=bandForDistance(distanceKm(self.center,candidate.center));
  if(!band||!requestedBands(selectedBand).includes(band))return null;
  // Reciprocal radius is a privacy preference: an active target whose own
  // settings permit only 0-10 km must not be revealed to a 20-km viewer.
  const targetBand=target.settings?.geoDistanceBand??'0-50';
  if(!['0-10','10-35','35-50','0-50'].includes(String(targetBand))||
    !requestedBands(targetBand as DistanceBand).includes(band))return null;
  return {handle:candidate.handle,displayName:candidate.fields.displayName,
    age:candidate.age,broadArea:candidate.broadArea,bio:candidate.fields.bio,
    intention:candidate.fields.intention,interests:candidate.fields.interests.slice(0,3),
    photoCount:target.media.length,distanceBand:band};
}
