/**
 * GeoNames public catalogue transport. All India JSON lives under ONE
 * immutable geo/india/vN/ prefix in S3, read-only via CloudFront OAC.
 * No AWS SDK, credentials, signed URLs or user records are needed here.
 * A local external-data-directory provider is retained for offline development.
 */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type GeoCatalogueDeliveryMode = 's3_cloudfront' | 'local';
/** Audit fields are deliberately limited to public catalogue metadata. Never pass
 * request bodies, access tokens, query strings, cookies or GPS coordinates. */
export type GeoAssetAudit = (event: string, detail: Record<string, string | number | boolean>) => void;
export class GeoAssetError extends Error {
  readonly category: string;
  readonly status?: number;
  constructor(category: string, status?: number) {
    super(category);
    this.category=category;
    this.status=status;
    this.name = 'GeoAssetError';
  }
}
export function geoFailureCategory(error: unknown): string {
  if (error instanceof GeoAssetError) return error.category;
  if (!(error instanceof Error)) return 'unknown_error';
  if (error.message.includes('canonical manifest SHA-256')) return 'canonical_manifest_sha_mismatch';
  if (error.message.includes('public/canonical manifests disagree')) return 'public_manifest_mismatch';
  if (error.message.includes('authoritative manifest invalid')) return 'manifest_schema_invalid';
  if (error.message.includes('canonical GeoNames shard') || error.message.includes('Canonical GeoNames shard')) return 'shard_integrity_invalid';
  if (error.message.includes('GeoNames pack metadata') || error.message === 'geo_pack_metadata_invalid') return 'pack_metadata_invalid';
  if (error.message === 'geo_pack_integrity_failed') return 'pack_integrity_failed';
  if (error.message.includes('ULUV_GEO_CANONICAL_MANIFEST_SHA256')) return 'sha_env_invalid';
  if (error.message.includes('public GeoNames base URL') || error.message.includes('Geo CDN base')) return 'cdn_url_env_invalid';
  if (error.message.includes('Set ULUV_GEO_PUBLIC_BASE_URL')) return 'cdn_url_env_missing';
  if (error.message.includes('GeoNames') && error.message.includes('schema')) return 'geo_schema_invalid';
  return 'unexpected_error';
}

export type GeoDeliveryConfiguration = Readonly<{
  mode: GeoCatalogueDeliveryMode;
  /** Pinned by deployment configuration, NOT obtained from the same CDN response. */
  canonicalManifestSha256: string;
  publicBaseUrl?: string;
  localPublicDirectory?: string;
}>;

export const isPublicGeoPackPath = (s: string): boolean =>
  /^(?:states\/[0-9]{1,4}\/districts\/[0-9]{1,6}\.json|states\/[0-9]{1,4}\/unmapped\.json|country-unmapped\.json)$/.test(s);

export const isCanonicalGeoAsset = (s: string): boolean =>
  s === 'manifest.json' || s === 'server-index-manifest.json' ||
  /^server\/[0-9a-f]{2}\.json$/.test(s);

export function validatePublicGeoBaseUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Invalid public GeoNames base URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.search || url.hash || url.port || !/^\/geo\/india\/v[1-9][0-9]*\/$/.test(url.pathname) ||
      !/^[a-z0-9.-]+$/i.test(url.hostname) || url.hostname === 'localhost' ||
      url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) {
    throw new Error('Geo CDN base must be HTTPS and use /geo/india/vN/ path');
  }
  return url.toString();
}

export function readGeoDeliveryConfig(env: NodeJS.ProcessEnv = process.env): GeoDeliveryConfiguration {
  const pinned = env.ULUV_GEO_CANONICAL_MANIFEST_SHA256;
  if (!pinned || !/^[a-f0-9]{64}$/.test(pinned)) {
    throw new Error('ULUV_GEO_CANONICAL_MANIFEST_SHA256 must be an independently trusted 64-character SHA-256');
  }
  const cloud = env.ULUV_GEO_PUBLIC_BASE_URL;
  if (cloud) {
    return { mode: 's3_cloudfront', canonicalManifestSha256: pinned,
      publicBaseUrl: validatePublicGeoBaseUrl(cloud) };
  }
  const local = env.ULUV_GEO_PUBLIC_LOCAL_DIR;
  if (!local || !isAbsolute(local)) {
    throw new Error('Set ULUV_GEO_PUBLIC_BASE_URL or absolute ULUV_GEO_PUBLIC_LOCAL_DIR');
  }
  return { mode: 'local', canonicalManifestSha256:pinned,localPublicDirectory:resolve(local) };
}

/** Read an allowlisted catalogue JSON asset, bounded even after decompression. */
export async function readGeoAsset(
  config: GeoDeliveryConfiguration,
  asset: string,
  maxBytes: number,
  fetcher: typeof fetch = fetch,
  audit?: GeoAssetAudit,
): Promise<Buffer> {
  if (!isCanonicalGeoAsset(asset) && !isPublicGeoPackPath(asset)) {
    throw new Error('GeoNames path not allowlisted');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2_000_000) {
    throw new Error('Invalid GeoNames asset size ceiling');
  }
  if (config.mode === 'local') {
    if (!config.localPublicDirectory) throw new Error('Missing local GeoNames directory');
    const root=resolve(config.localPublicDirectory);
    const file=resolve(root,asset);
    const rel=relative(root,file);
    if (!rel || rel==='..' || rel.startsWith('..'+sep) || isAbsolute(rel)) {
      throw new Error('GeoNames directory traversal rejected');
    }
    audit?.('asset.local.start', {asset, mode:'local'});
    if ((await stat(file)).size > maxBytes) throw new GeoAssetError('size_limit_exceeded');
    const bytes=await readFile(file);
    if (bytes.length>maxBytes) throw new GeoAssetError('size_limit_exceeded');
    audit?.('asset.local.success', {asset, bytes:bytes.length});
    return bytes;
  }
  if (!config.publicBaseUrl) throw new Error('Missing GeoNames HTTPS origin');
  // This is a public, allowlisted URL. No query parameters or authentication.
  const url=new URL(asset,config.publicBaseUrl).toString();
  const started=Date.now();
  audit?.('asset.cdn.start',{asset,url,mode:'s3_cloudfront'});
  let response:Response;
  try {
    response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{Accept:'application/json'}});
  }catch(error){
    const reason=error instanceof Error && (error.name==='TimeoutError' || error.name==='AbortError') ?
      'cdn_timeout':'cdn_network_or_tls_error';
    audit?.('asset.cdn.error',{asset,url,reason,elapsedMs:Date.now()-started});
    throw new GeoAssetError(reason);
  }
  audit?.('asset.cdn.response',{asset,url,status:response.status,elapsedMs:Date.now()-started});
  if (!response.ok || response.status!==200 || !response.body) {
    audit?.('asset.cdn.error',{asset,url,status:response.status,reason:'cdn_http_error'});
    throw new GeoAssetError('cdn_http_error',response.status);
  }
  const chunks: Buffer[]=[];
  let total=0;
  const reader=response.body.getReader();
  try {
    while(true){
      const next=await reader.read();
      if(next.done)break;
      total+=next.value.byteLength;
      if(total>maxBytes)throw new GeoAssetError('decoded_size_limit_exceeded');
      chunks.push(Buffer.from(next.value));
    }
  }catch(error){
    const reason=geoFailureCategory(error)==='unexpected_error'?'cdn_stream_error':geoFailureCategory(error);
    audit?.('asset.cdn.error',{asset,url,reason,bytes:total,elapsedMs:Date.now()-started});
    throw new GeoAssetError(reason);
  }finally{
    reader.releaseLock();
    if(total>maxBytes)await response.body.cancel().catch(()=>{});
  }
  audit?.('asset.cdn.success',{asset,url,bytes:total,elapsedMs:Date.now()-started});
  return Buffer.concat(chunks,total);
}

/** Local-only public serving; deliberately never exposes the canonical shards. */
export function localPublicAsset(config: GeoDeliveryConfiguration, asset: string): Promise<Buffer> {
  if(config.mode!=='local' || (asset!=='manifest.json' && !isPublicGeoPackPath(asset))) {
    return Promise.reject(new Error('Non-public GeoNames asset blocked'));
  }
  return readGeoAsset(config,asset,2_000_000);
}

/** Ensures the Android fallback serves EXACTLY the canonical public release.
 * It can never be used for arbitrary file reads or unverified metadata.
 */
export async function readVerifiedGeoPack(
  config: GeoDeliveryConfiguration,
  path: string,
  meta: {bytes:number;sha256:string},
  fetcher: typeof fetch = fetch,
  audit?: GeoAssetAudit,
): Promise<Buffer> {
  if(!isPublicGeoPackPath(path) || !Number.isSafeInteger(meta.bytes) ||
      meta.bytes<1 || meta.bytes>2_000_000 || !/^[a-f0-9]{64}$/.test(meta.sha256)){
    throw new Error('geo_pack_metadata_invalid');
  }
  const bytes=await readGeoAsset(config,path,2_000_000,fetcher,audit);
  const actual=createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==meta.bytes || actual!==meta.sha256){
    audit?.('asset.integrity.failed',{asset:path,expectedBytes:meta.bytes,actualBytes:bytes.length,expectedShaPrefix:meta.sha256.slice(0,12),actualShaPrefix:actual.slice(0,12)});
    throw new GeoAssetError('geo_pack_integrity_failed');
  }
  audit?.('asset.integrity.ok',{asset:path,bytes:bytes.length,shaPrefix:actual.slice(0,12)});
  return bytes;
}
