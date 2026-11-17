export type ManualLocationPayload = {
  geonameId: string; catalogueVersion: string; stateCode: string; districtCode: string | null; expectedRevision: number;
};
function object(v: unknown): v is Record<string,unknown> {return v!==null && typeof v==='object' && !Array.isArray(v);}
export function parseManualLocation(x: unknown): ManualLocationPayload | null {
  if (!object(x) || Object.keys(x).length!==5 ||
      !['geonameId','catalogueVersion','stateCode','districtCode','expectedRevision'].every(k=>Object.hasOwn(x,k)))return null;
  if (typeof x.geonameId!=='string' || !/^\d{1,15}$/.test(x.geonameId) ||
      typeof x.catalogueVersion!=='string' || !/^IN-[a-f0-9]{16}$/.test(x.catalogueVersion) ||
      typeof x.stateCode!=='string' || !(/^\d{1,4}$/.test(x.stateCode) || x.stateCode==='unresolved') ||
      (x.districtCode!==null && (typeof x.districtCode!=='string' || !/^\d{1,6}$/.test(x.districtCode))) ||
      typeof x.expectedRevision!=='number' || !Number.isSafeInteger(x.expectedRevision) ||
      x.expectedRevision<0 || x.expectedRevision>1_000_000_000) return null;
  return x as ManualLocationPayload;
}

export type DiscoveryPreferences={distanceBand:'0-10'|'10-35'|'35-50'|'0-50';sortMode:'near_band_first'|'recent_first';expectedRevision:number};
export function parseDiscoveryPreferences(raw:unknown):DiscoveryPreferences|null {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return null;
  const x=raw as Record<string,unknown>;
  if(Object.keys(x).length!==3 || !Object.hasOwn(x,'distanceBand') || !Object.hasOwn(x,'sortMode') ||
    !Object.hasOwn(x,'expectedRevision') || !['0-10','10-35','35-50','0-50'].includes(String(x.distanceBand)) ||
    !['near_band_first','recent_first'].includes(String(x.sortMode)) ||
    typeof x.distanceBand!=='string' || typeof x.sortMode!=='string' ||
    typeof x.expectedRevision!=='number' || !Number.isSafeInteger(x.expectedRevision) ||
    x.expectedRevision<0 || x.expectedRevision>1000000000)return null;
  return x as DiscoveryPreferences;
}


/** One-shot phone fix. Timestamps and accuracy are claims, not proof of physical presence. */
export type GpsSelectionPayload={lat:number;lng:number;accuracyMeters:number;fixTimestamp:string;expectedRevision:number};
export function parseGpsLocation(x:unknown, nowMs=Date.now()):GpsSelectionPayload|null {
  if(!object(x)||Object.keys(x).length!==5 ||
      !['lat','lng','accuracyMeters','fixTimestamp','expectedRevision'].every(k=>Object.hasOwn(x,k)))return null;
  const {lat,lng,accuracyMeters,fixTimestamp,expectedRevision}=x;
  if(typeof lat!=='number'||!Number.isFinite(lat)||lat < -90||lat>90||
     typeof lng!=='number'||!Number.isFinite(lng)||lng < -180||lng>180||
     typeof accuracyMeters!=='number'||!Number.isFinite(accuracyMeters)||accuracyMeters<=0||accuracyMeters>10000||
     typeof expectedRevision!=='number'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>1_000_000_000||
     typeof fixTimestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(fixTimestamp))return null;
  const then=Date.parse(fixTimestamp);
  if(!Number.isFinite(then)||then>nowMs+30_000||then<nowMs-120_000)return null;
  return {lat,lng,accuracyMeters,fixTimestamp,expectedRevision};
}
