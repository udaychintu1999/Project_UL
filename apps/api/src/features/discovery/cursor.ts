import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {
  CURSOR_TTL_MS,MAX_CURSOR_BYTES,type DiscoveryMode,type LocalitySnapshot
} from './contracts.js';

export type CursorKey={PK:string;SK:string};
export type InternalCursor={bandIndex:number;cellIndex:number;lastKey:CursorKey|null};
export type CursorContext={uid:string;mode:DiscoveryMode;location:LocalitySnapshot;pageSize:number;authorizationVersion?:number};
const b64=(bytes:Buffer)=>bytes.toString('base64url');
function fingerprint(ctx:CursorContext){
  // No PII leaves this module except encrypted; fingerprint detects context drift.
  return createHash('sha256').update(JSON.stringify([
    'P03-2-V1',ctx.uid,ctx.mode,ctx.location.cell,ctx.location.center.lat,ctx.location.center.lng,
    ctx.location.localityRevision,ctx.location.settingsRevision,ctx.location.distanceBand,
    ctx.location.source,ctx.pageSize,ctx.authorizationVersion??null
  ])).digest('hex');
}
function aesKey(secret:string):Buffer {
  if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)throw new Error('cursor_secret_unavailable');
  return createHash('sha256').update('uluv-p03-discovery-cursor-v1\0').update(secret).digest();
}
function validState(x:InternalCursor):boolean {
  return x&&Number.isSafeInteger(x.bandIndex)&&x.bandIndex>=0&&x.bandIndex<=3&&
    Number.isSafeInteger(x.cellIndex)&&x.cellIndex>=0&&x.cellIndex<=1600&&
    (x.lastKey===null||!!(x.lastKey&&typeof x.lastKey.PK==='string'&&
      /^DISC#(?:DATING|FRIENDSHIP)#R6#[0-9a-f]{15}$/.test(x.lastKey.PK)&&
      typeof x.lastKey.SK==='string'&&/^JOIN#/.test(x.lastKey.SK)&&
      x.lastKey.SK.length<=300));
}
/** AES-256-GCM: opaque + authenticated, not readable bearer-cursor JSON. */
export function encodeCursor(state:InternalCursor,ctx:CursorContext,secret:string,now=Date.now()):string {
  if(!validState(state)||!Number.isSafeInteger(now)||now<0)throw new Error('invalid_cursor_state');
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',aesKey(secret),iv);
  const payload=Buffer.from(JSON.stringify({v:1,iat:now,exp:now+CURSOR_TTL_MS,
    ctx:fingerprint(ctx),state}), 'utf8');
  const encoded=Buffer.concat([iv,cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
  if(encoded.length>MAX_CURSOR_BYTES)throw new Error('cursor_budget_exceeded');
  return b64(encoded);
}
export function decodeCursor(token:string,ctx:CursorContext,secret:string,now=Date.now()):InternalCursor {
  const key=aesKey(secret);
  if(typeof token!=='string'||token.length<45||token.length>Math.ceil(MAX_CURSOR_BYTES*4/3)||
    !/^[A-Za-z0-9_-]+$/.test(token))throw new Error('invalid_discovery_cursor');
  try {
    const bytes=Buffer.from(token,'base64url');
    if(bytes.length>MAX_CURSOR_BYTES||bytes.length<29||b64(bytes)!==token)throw new Error();
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(bytes.length-16));
    const payload=Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]);
    if(payload.length>1024)throw new Error();
    const parsed=JSON.parse(payload.toString('utf8')) as Record<string,unknown>;
    if(parsed.v!==1||typeof parsed.iat!=='number'||!Number.isSafeInteger(parsed.iat)||
      typeof parsed.exp!=='number'||!Number.isSafeInteger(parsed.exp)||
      parsed.iat>now+30000||parsed.iat>now||parsed.exp<now||parsed.exp-parsed.iat!==CURSOR_TTL_MS||
      typeof parsed.ctx!=='string')throw new Error();
    const expected=Buffer.from(fingerprint(ctx),'hex');
    const actual=Buffer.from(parsed.ctx,'hex');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
    const state=parsed.state as InternalCursor;
    if(!validState(state))throw new Error();
    return state;
  }catch{throw new Error('invalid_or_stale_discovery_cursor');}
}
