/** Pure P01-3 security primitives, independently testable without Fastify/DynamoDB. */
import {createHash, createHmac, createPublicKey, hkdfSync, verify as verifySignature} from 'node:crypto';
const keyedHash=(key:string,purpose:string,value:string)=>createHmac('sha256',key).update(`${purpose}\0${value}`).digest('hex');
export const P13_ACCESS_SECONDS=1800;
export const P13_REAUTH_SECONDS=30*24*60*60;
export const P13_INACTIVITY_SECONDS=30*24*60*60;
export const P13_MAX_DEVICES=5;
export const P13_KEY_ID='p13-v1';
export function p13Keys(localRoot:string) {
  if(localRoot.length<24)throw new Error('P01-3 requires a private local root');
  return {
    refresh:Buffer.from(hkdfSync('sha256',Buffer.from(localRoot),Buffer.from('U_luv local P01-3 v1'),Buffer.from('refresh-digest'),32)).toString('hex'),
    access:Buffer.from(hkdfSync('sha256',Buffer.from(localRoot),Buffer.from('U_luv local P01-3 v1'),Buffer.from('access-digest'),32)).toString('hex')
  };
}
export const refreshDigest=(key:string,token:string)=>keyedHash(key,'p13-refresh',token);
export const accessDigest=(key:string,token:string)=>keyedHash(key,'p13-access',token);
const sha=(data:string)=>createHash('sha256').update(data,'utf8').digest('base64url');
export function proofText(operation:'enroll'|'refresh'|'logout', uid:string,slot:number,familyId:string,generation:number,token:string,nonce:string) {
  const path=operation==='enroll'?'/v1/auth/device/enroll':operation==='refresh'?'/v1/auth/device/refresh':'/v1/auth/device/logout';
  return `ULUV-P01-3-V1\n${operation}\n${path}\n${uid}\n${slot}\n${familyId}\n${generation}\n${sha(token)}\n${nonce}`;
}
export function deviceProofValid(publicKey:string,message:string,signature:string):boolean {
  try {
    if(publicKey.length>512 || !/^[A-Za-z0-9+/=]+$/.test(publicKey) || signature.length>192 || !/^[A-Za-z0-9+/=]+$/.test(signature))return false;
    const key=createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'});
    if(key.asymmetricKeyType!=='ec' || key.asymmetricKeyDetails?.namedCurve!=='prime256v1')return false;
    return verifySignature('sha256',Buffer.from(message,'utf8'),key,Buffer.from(signature,'base64'));
  }catch{return false;}
}
