/**
 * Server-authoritative GeoNames lookup using verified, S3-hosted JSON shards.
 * Public source data is not a secret; authenticity and version pinning are the
 * security boundary. Fastify NEVER accepts client-supplied manual coordinates.
 */
import { createHash } from 'node:crypto';
import { readGeoAsset, type GeoDeliveryConfiguration, type GeoAssetAudit } from './catalogue-delivery.js';

export type PackMeta = {path:string; bytes:number; sha256:string; count:number; kind:string; code:string; name:string};
type StateEntry = {code:string; name:string; geonameId:string; districts:PackMeta[]; unmapped:PackMeta|null};
type ShardMeta = {path:string; sha256:string; bytes:number};
export type IndiaManifest = {catalogueVersion:string; schemaVersion:number; country:'IN'; sourceSha256:string;
  packFormat:string; totalPlaces:number; serverIndex:ShardMeta[]; states:StateEntry[]; countryUnmapped:PackMeta|null; attribution:string};
export type ApprovedPlace = {id:string; name:string; lat:number; lng:number; state:string; district:string; catalogueVersion:string};
const sha256 = (b:Buffer):string => createHash('sha256').update(b).digest('hex');
const validSha = (s:unknown):s is string => typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
const packPath=(s:string):boolean=>/^(?:states\/[0-9]{1,4}\/districts\/[0-9]{1,6}\.json|states\/[0-9]{1,4}\/unmapped\.json|country-unmapped\.json)$/.test(s);
type ShardRows = Record<string,[number,number,string,string,string]>;
type ReadAsset = (asset:string,maxBytes:number)=>Promise<Buffer>;

export class IndiaCatalogue {
  private readonly shardCache=new Map<number,ShardRows>();
  private readonly inFlight=new Map<number,Promise<ShardRows>>();
  readonly manifest:IndiaManifest;
  readonly publicManifest:Buffer;
  readonly publicManifestSha256:string;
  private readonly getAsset:ReadAsset;
  private readonly audit?:GeoAssetAudit;
  private constructor(manifest:IndiaManifest,publicManifest:Buffer,
      publicManifestSha256:string,getAsset:ReadAsset,audit?:GeoAssetAudit) {
    this.manifest=manifest;
    this.publicManifest=publicManifest;
    this.publicManifestSha256=publicManifestSha256;
    this.getAsset=getAsset;
    this.audit=audit;
  }

  /** Download TWO manifests. Only the canonical manifest's SHA comes from trusted config. */
  static async open(config:GeoDeliveryConfiguration,assetReader?:ReadAsset,audit?:GeoAssetAudit):Promise<IndiaCatalogue> {
    const read=assetReader??((asset,max)=>readGeoAsset(config,asset,max,fetch,audit));
    const [canonicalBytes,publicBytes] = await Promise.all([
      read('server-index-manifest.json',1_000_000),
      read('manifest.json',1_000_000),
    ]);
    const actualCanonical=sha256(canonicalBytes);
    if(actualCanonical!==config.canonicalManifestSha256) {
      audit?.('manifest.pinned_sha.failed',{asset:'server-index-manifest.json',expectedShaPrefix:config.canonicalManifestSha256.slice(0,12),actualShaPrefix:actualCanonical.slice(0,12)});
      throw new Error('Untrusted GeoNames canonical manifest SHA-256');
    }
    audit?.('manifest.pinned_sha.ok',{asset:'server-index-manifest.json',shaPrefix:actualCanonical.slice(0,12)});
    const full=JSON.parse(canonicalBytes.toString('utf8')) as IndiaManifest;
    const pub=JSON.parse(publicBytes.toString('utf8')) as Record<string,unknown>;
    if(full.country!=='IN' || full.schemaVersion!==1 || full.packFormat!=='application/json' ||
       !/^IN-[a-f0-9]{16}$/.test(full.catalogueVersion) || !validSha(full.sourceSha256) ||
       !Array.isArray(full.states) || full.states.length!==36 ||
       !Array.isArray(full.serverIndex) || full.serverIndex.length!==256 ||
       pub['serverIndex']!==undefined || pub['country']!=='IN' ||
       pub['catalogueVersion']!==full.catalogueVersion || pub['sourceSha256']!==full.sourceSha256) {
      throw new Error('GeoNames authoritative manifest invalid');
    }
    // Never trust the public manifest without comparing it to the pinned canonical one.
    const {serverIndex:_,...expectedPublic}=full;
    if(JSON.stringify(pub)!==JSON.stringify(expectedPublic)) {
      audit?.('manifest.public_compare.failed',{asset:'manifest.json',reason:'public_manifest_mismatch'});
      throw new Error('GeoNames public/canonical manifests disagree');
    }
    const distinct=new Set<string>();
    for(const state of full.states) {
      if(!/^\d{1,4}$/.test(state.code) || !Array.isArray(state.districts)) {
        throw new Error('Invalid GeoNames state');
      }
      for(const meta of [...state.districts,...(state.unmapped?[state.unmapped]:[])]) {
        if(!packPath(meta.path) || distinct.has(meta.path) || !validSha(meta.sha256) ||
            !Number.isSafeInteger(meta.bytes) || meta.bytes<1 || meta.bytes>2_000_000 ||
            !Number.isSafeInteger(meta.count) || meta.count<0) {
          throw new Error('Invalid GeoNames pack metadata');
        }
        distinct.add(meta.path);
      }
    }
    if(full.countryUnmapped) {
      const meta=full.countryUnmapped;
      if(meta.path!=='country-unmapped.json' || distinct.has(meta.path) || !validSha(meta.sha256) ||
         !Number.isSafeInteger(meta.bytes) || meta.bytes<1 || meta.bytes>2_000_000) {
        throw new Error('Invalid GeoNames country-unmapped metadata');
      }
    }
    for(let i=0;i<256;i++) {
      const meta=full.serverIndex[i];
      if(meta?.path!==`server/${i.toString(16).padStart(2,'0')}.json` || !validSha(meta.sha256) ||
         !Number.isSafeInteger(meta.bytes) || meta.bytes<1 || meta.bytes>250000) {
        throw new Error('Invalid canonical GeoNames shard metadata');
      }
    }
    audit?.('manifest.ready',{version:full.catalogueVersion,states:full.states.length,shards:full.serverIndex.length,publicShaPrefix:sha256(publicBytes).slice(0,12)});
    return new IndiaCatalogue(full,publicBytes,sha256(publicBytes),read,audit);
  }

  private async loadShard(bucket:number,version:string):Promise<ShardRows> {
    const meta=this.manifest.serverIndex[bucket];
    const bytes=await this.getAsset(meta.path,250000);
    if(bytes.length!==meta.bytes || sha256(bytes)!==meta.sha256) {
      this.audit?.('shard.integrity.failed',{asset:meta.path,expectedBytes:meta.bytes,actualBytes:bytes.length,expectedShaPrefix:meta.sha256.slice(0,12),actualShaPrefix:sha256(bytes).slice(0,12)});
      throw new Error('Canonical GeoNames shard SHA-256 integrity failure');
    }
    this.audit?.('shard.integrity.ok',{asset:meta.path,bytes:bytes.length});
    const parsed=JSON.parse(bytes.toString('utf8')) as {catalogueVersion:string;places:ShardRows};
    if(parsed.catalogueVersion!==version || !parsed.places || Array.isArray(parsed.places) ||
       typeof parsed.places!=='object')throw new Error('Canonical shard schema mismatch');
    const rows=Object.create(null) as ShardRows;
    for(const [id,row] of Object.entries(parsed.places)) {
      if(!/^\d{1,15}$/.test(id) || Number(BigInt(id)%256n)!==bucket ||
         !Array.isArray(row) || row.length!==5 ||
         !Number.isFinite(row[0]) || row[0]<-90 || row[0]>90 ||
         !Number.isFinite(row[1]) || row[1]<-180 || row[1]>180 ||
         typeof row[2]!=='string' || typeof row[3]!=='string' || typeof row[4]!=='string') {
        throw new Error('Invalid canonical GeoNames shard row');
      }
      rows[id]=row;
    }
    if(this.shardCache.size>=64)this.shardCache.delete(this.shardCache.keys().next().value!);
    this.shardCache.set(bucket,rows);
    return rows;
  }

  async resolvePlace(id:string,version:string):Promise<ApprovedPlace|null> {
    if(!/^\d{1,15}$/.test(id) || version!==this.manifest.catalogueVersion)return null;
    const bucket=Number(BigInt(id)%256n);
    let entries=this.shardCache.get(bucket);
    if(!entries) {
      let pending=this.inFlight.get(bucket);
      if(!pending) {
        pending=this.loadShard(bucket,version).finally(()=>this.inFlight.delete(bucket));
        this.inFlight.set(bucket,pending);
      }
      entries=await pending;
    }
    const row=entries[id];
    if(!row)return null;
    const [lat,lng,state,district,name]=row;
    return {id,name,lat,lng,state,district,catalogueVersion:version};
  }
}
