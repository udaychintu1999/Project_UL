import {getResolution,isValidCell} from 'h3-js';
/** P03-2: server-private infrastructure. No discoverability/public route in this phase. */
export const RESOLUTION = 6 as const;
export const DISCOVERY_RADII_KM = [10, 35, 50] as const;
export const DISTANCE_BANDS = ['0-10', '10-35', '35-50', '0-50'] as const;
export type DistanceBand = typeof DISTANCE_BANDS[number];
export type DiscoveryMode = 'DATING' | 'FRIENDSHIP';
export type Coordinates = Readonly<{lat:number;lng:number}>;
export type LocalitySnapshot = Readonly<{
  center:Coordinates; cell:string; localityRevision:number; settingsRevision:number;
  distanceBand:DistanceBand; source:'manual_geonames'|'gps_selected';
}>;
export const MAX_CELLS_IN_COVER = 1600;
export const MAX_QUERY_CALLS = 6;
export const MAX_READ_ITEMS = 72;
export const MAX_PAGE_SIZE = 24;
export const MAX_DDB_ITEMS_PER_QUERY = 12;
export const MAX_CURSOR_BYTES = 3072;
export const CURSOR_TTL_MS = 10 * 60 * 1000;
const EARTH_KM = 6371.0088;
export function validCoordinates(x:unknown): x is Coordinates {
  if(!x||typeof x!=='object'||Array.isArray(x))return false;
  const {lat,lng}=x as Record<string,unknown>;
  return typeof lat==='number'&&Number.isFinite(lat)&&lat>=-90&&lat<=90&&
    typeof lng==='number'&&Number.isFinite(lng)&&lng>=-180&&lng<=180;
}
export function distanceKm(a:Coordinates,b:Coordinates):number {
  if(!validCoordinates(a)||!validCoordinates(b))throw new Error('invalid_geo_coordinates');
  const rad=Math.PI/180;const dlat=(b.lat-a.lat)*rad;const dlng=(b.lng-a.lng)*rad;
  const h=Math.min(1,Math.max(0,Math.sin(dlat/2)**2+
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2));
  return 2*EARTH_KM*Math.asin(Math.sqrt(h));
}
export function bandForDistance(km:number):Exclude<DistanceBand,'0-50'>|null {
  if(!Number.isFinite(km)||km<0)return null;
  if(km<=10)return '0-10';
  if(km<=35)return '10-35';
  if(km<=50)return '35-50';
  return null;
}
export function requestedBands(band:DistanceBand):readonly Exclude<DistanceBand,'0-50'>[] {
  if(!DISTANCE_BANDS.includes(band))throw new Error('invalid_distance_band');
  return band==='0-50'?['0-10','10-35','35-50']:[band];
}
/** A circle slightly wider than the user radius for coarse H3 coverage only.
 * Final inclusion always uses exact <= 10/35/50 km on vetted centers. */
export function enclosingCircle(center:Coordinates,radiusKm:number,vertices=96):number[][] {
  if(!validCoordinates(center)||!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>51 ||
    !Number.isSafeInteger(vertices)||vertices<32||vertices>256)throw new Error('invalid_circle');
  const rad=Math.PI/180, phi=center.lat*rad, lambda=center.lng*rad;
  const delta=radiusKm/EARTH_KM;
  const polygon:number[][]=[];
  for(let i=0;i<vertices;i++){
    const bearing=2*Math.PI*i/vertices;
    const lat=Math.asin(Math.sin(phi)*Math.cos(delta)+Math.cos(phi)*Math.sin(delta)*Math.cos(bearing));
    const lng=lambda+Math.atan2(Math.sin(bearing)*Math.sin(delta)*Math.cos(phi),
      Math.cos(delta)-Math.sin(phi)*Math.sin(lat));
    const lonDegrees=((lng/rad+540)%360)-180;
    polygon.push([lonDegrees,lat/rad]); // GeoJSON: [longitude, latitude]
  }
  polygon.push([...polygon[0]]);
  return polygon;
}
export function discoveryPartition(mode:DiscoveryMode,cell:string):string {
  if(!['DATING','FRIENDSHIP'].includes(mode)|| !/^[0-9a-f]{15}$/.test(cell) || !isValidCell(cell) || getResolution(cell)!==RESOLUTION)
    throw new Error('invalid_discovery_partition');
  return `DISC#${mode}#R6#${cell}`;
}
export function discoverySortKey(joinedAt:string,uid:string):string {
  if(typeof joinedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(joinedAt)||
    !Number.isFinite(Date.parse(joinedAt))||new Date(joinedAt).toISOString()!==joinedAt||
    typeof uid!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(uid))throw new Error('invalid_discovery_pointer');
  return `JOIN#${joinedAt}#${uid}`;
}
/** The projection builder is NOT a publisher; P03-3 will own transactional writes. */
export function buildPointer(input:{mode:DiscoveryMode;cell:string;joinedAt:string;uid:string;localityRevision:number;profileVersion:number}){
  if(!Number.isSafeInteger(input.localityRevision)||input.localityRevision<1||
     !Number.isSafeInteger(input.profileVersion)||input.profileVersion<1)throw new Error('invalid_pointer_revision');
  return {PK:discoveryPartition(input.mode,input.cell),SK:discoverySortKey(input.joinedAt,input.uid),
    uid:input.uid,mode:input.mode,homeCell:input.cell,localityRevision:input.localityRevision,
    profileVersion:input.profileVersion} as const;
}
