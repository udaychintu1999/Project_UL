import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {P13_ACCESS_SECONDS,P13_REAUTH_SECONDS,p13Keys,refreshDigest,accessDigest,proofText,deviceProofValid} from '../../src/features/auth/device-session-policy.ts';

test('P01-3 fixed 30-minute access and 30-day interactive boundary',()=>{
  assert.equal(P13_ACCESS_SECONDS,1800);
  assert.equal(P13_REAUTH_SECONDS,2592000);
});
test('P01-3 access and refresh HMAC keys and digests are purpose-separated',()=>{
  const a=p13Keys('a'.repeat(32)),b=p13Keys('b'.repeat(32));
  assert.notEqual(a.access,a.refresh);assert.notEqual(a.access,b.access);
  assert.notEqual(accessDigest(a.access,'test'),refreshDigest(a.refresh,'test'));
  assert.throws(()=>p13Keys('short'));
});
test('P01-3 P-256 proof authenticates exact operation, path, device, generation and token',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const publicDer=publicKey.export({type:'spki',format:'der'}).toString('base64');
  const uid='00000000-0000-4000-8000-000000000001',family='00000000-0000-4000-8000-000000000002';
  const token=randomBytes(32).toString('base64url'),nonce=randomBytes(24).toString('base64url');
  const text=proofText('refresh',uid,1,family,0,token,nonce);
  const signature=sign('sha256',Buffer.from(text),privateKey).toString('base64');
  assert.ok(deviceProofValid(publicDer,text,signature));
  assert.equal(deviceProofValid(publicDer,proofText('logout',uid,1,family,0,token,nonce),signature),false);
  assert.equal(deviceProofValid(publicDer,proofText('refresh',uid,0,family,0,token,nonce),signature),false);
  assert.equal(deviceProofValid(publicDer,proofText('refresh',uid,1,family,1,token,nonce),signature),false);
  assert.equal(deviceProofValid(publicDer,proofText('refresh',uid,1,family,0,'other',nonce),signature),false);
  assert.equal(deviceProofValid(publicDer,proofText('refresh',uid,1,family,0,token,nonce+'x'),signature),false);
  const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  assert.equal(deviceProofValid(other.publicKey.export({type:'spki',format:'der'}).toString('base64'),text,signature),false);
});
