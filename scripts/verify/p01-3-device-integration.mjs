/** P01-3 real Fastify + Java DynamoDB Local integration; no production/cloud calls. */
import assert from 'node:assert/strict';
import {createHmac,createHash,generateKeyPairSync,randomBytes,randomUUID,sign,hkdfSync} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,DeleteCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

const endpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
const secret=process.env.ULUV_DEV_TOKEN;
if(process.env.APP_ENV!=='local'||!secret||secret.length<24)throw Error('P01-3 test requires owner local-only env');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint,region:'ap-south-1',credentials:{accessKeyId:'local',secretAccessKey:'local'}}));
const authTable='uluv_auth_links',usersTable='uluv_users',settingsTable='uluv_settings';
const base='http://127.0.0.1:3000',email=`p13-${randomUUID()}@example.invalid`,password='A sufficiently long local passphrase';
const hashed=createHmac('sha256',secret).update(`email-subject\0${email}`).digest('hex');
const legacyDigest=token=>createHmac('sha256',secret).update(`session\0${token}`).digest('hex');
const accessKey=Buffer.from(hkdfSync('sha256',Buffer.from(secret),Buffer.from('U_luv local P01-3 v1'),Buffer.from('access-digest'),32)).toString('hex');
const accessHash=t=>createHmac('sha256',accessKey).update(`p13-access\0${t}`).digest('hex');
let uid;const slots=new Set(),accessTokens=[],legacy=[];
const identityKey=(PK,SK='META')=>({PK,SK});
async function api(path,body={},opt={}){
  const r=await fetch(base+path,{method:opt.get?'GET':'POST',headers:{'content-type':'application/json',...(opt.access?{authorization:`Bearer ${opt.access}`}:{}),...(opt.dev?{'x-uluv-dev-key':secret}:{}),...(opt.requestId?{'x-uluv-request-id':opt.requestId}:{})},...(opt.get?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(18000)});
  return {status:r.status,body:await r.json()};
}
const keypair=()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const tokenHash=t=>createHash('sha256').update(t).digest('base64url');
function signed(operation,uid,slot,familyId,generation,token,keys,nonce=randomBytes(24).toString('base64url')){
  const path=`/v1/auth/device/${operation}`;
  const text=`ULUV-P01-3-V1\n${operation}\n${path}\n${uid}\n${slot}\n${familyId}\n${generation}\n${tokenHash(token)}\n${nonce}`;
  return {nonce,signature:sign('sha256',Buffer.from(text),keys.privateKey).toString('base64')};
}
async function enroll(access,slot,keys=keypair()){
  const familyId=randomUUID();const proof=signed('enroll',uid,slot,familyId,0,access,keys);
  const result=await api('/v1/auth/device/enroll',{slot,familyId,publicKey:keys.publicKey.export({format:'der',type:'spki'}).toString('base64'),...proof},{access});
  if(result.status===200){slots.add(slot);accessTokens.push(result.body.token);}
  return {...result,keys,familyId,slot};
}
async function refresh(item,override={}){
  const data=item.body;const d=data.device;
  return api('/v1/auth/device/refresh',{uid,slot:d.slot,familyId:d.familyId,generation:d.generation,
    refreshToken:data.refreshToken,...signed('refresh',uid,d.slot,d.familyId,d.generation,data.refreshToken,override.keys??item.keys)});
}
try {
  const request=await api('/v1/auth/email/request',{email,purpose:'signup'},{requestId:randomUUID()});
  assert.equal(request.status,202);
  const otp=await api('/v1/dev/otp/outbox',{email},{dev:true});assert.equal(otp.status,200);
  const account=await api('/v1/auth/signup/register',{email,code:otp.body.code,dateOfBirth:'2000-01-01',consent:true,password});
  assert.equal(account.status,201);uid=account.body.account.uniqueId;legacy.push(account.body.token);
  const first=await enroll(account.body.token,0);assert.equal(first.status,200,'first eligible device enrolls');
  assert.equal(first.body.expiresInSeconds,1800);assert.equal(first.body.device.generation,0);
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:account.body.token})).status,401,'old bearer consumed on enrollment');
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:first.body.token})).status,200);
  const stolen=await refresh(first,{keys:keypair()});assert.equal(stolen.status,401,'stolen bearer cannot refresh without signing key');
  const [a,b]=await Promise.all([refresh(first),refresh(first)]);
  const results=[a,b].map(x=>x.status).sort((x,y)=>x-y);
  assert.deepEqual(results,[200,401],'exactly one atomic token rotation winner');
  const winner=a.status===200?a:b;
  accessTokens.push(winner.body.token);
  assert.equal((await refresh(first)).status,401,'old generation never accepted even with new nonce');
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:winner.body.token})).status,200);
  // A second family needs a fresh interactive login, not another enroll with the consumed bearer.
  const secondLogin=await api('/v1/auth/password/login',{email,password});assert.equal(secondLogin.status,200);
  legacy.push(secondLogin.body.token);
  const second=await enroll(secondLogin.body.token,1);assert.equal(second.status,200);
  for(const slot of [2,3,4]){
    const login=await api('/v1/auth/password/login',{email,password});assert.equal(login.status,200);
    legacy.push(login.body.token);
    const enrolled=await enroll(login.body.token,slot);assert.equal(enrolled.status,200);
  }
  const listed=await api('/v1/auth/device/list',{}, {get:true,access:winner.body.token});
  assert.equal(listed.status,200);assert.equal(listed.body.devices.length,5,'five device maximum');
  const sixthLogin=await api('/v1/auth/password/login',{email,password});assert.equal(sixthLogin.status,200);
  legacy.push(sixthLogin.body.token);
  for(let slot=0;slot<5;slot++)assert.equal((await enroll(sixthLogin.body.token,slot)).status,409,'no silent eviction');
  assert.ok(listed.body.devices.every(x=>!('refreshDigest' in x)&&!('publicKey' in x)));
  assert.equal((await api('/v1/auth/device/revoke',{slot:1,familyId:second.familyId},{access:winner.body.token})).status,200);
  assert.equal((await refresh(second)).status,401);
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:second.body.token})).status,401,'revocation applies even before access expiry');
  const after={body:{...winner.body},keys:first.keys};
  const logProof=signed('logout',uid,0,after.body.device.familyId,after.body.device.generation,after.body.refreshToken,first.keys);
  const logged=await api('/v1/auth/device/logout',{uid,slot:0,familyId:after.body.device.familyId,generation:after.body.device.generation,refreshToken:after.body.refreshToken,...logProof});
  assert.equal(logged.status,200);
  assert.equal((await refresh(after)).status,401);
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:winner.body.token})).status,401);
  // Epoch invalidates *all* previously issued device credentials after password reset.
  const thirdLogin=await api('/v1/auth/password/login',{email,password});assert.equal(thirdLogin.status,200);legacy.push(thirdLogin.body.token);
  const third=await enroll(thirdLogin.body.token,0);assert.equal(third.status,200);
  // The server clock is authoritative: a family at the absolute boundary is denied.
  await db.send(new UpdateCommand({TableName:authTable,Key:identityKey(`USER#${uid}`,'DEVICE#0'),
    UpdateExpression:'SET reauthAt = :past',ExpressionAttributeValues:{':past':Math.floor(Date.now()/1000)-1}}));
  assert.equal((await refresh(third)).status,401,'day-30 refresh must be denied');
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:third.body.token})).status,401,'day-30 access must be denied');
  const afterExpiry=await api('/v1/auth/password/login',{email,password});assert.equal(afterExpiry.status,200);
  legacy.push(afterExpiry.body.token);
  const fourth=await enroll(afterExpiry.body.token,0);assert.equal(fourth.status,200);
  await db.send(new UpdateCommand({TableName:usersTable,Key:identityKey(`USER#${uid}`),UpdateExpression:'ADD sessionEpoch :one',ExpressionAttributeValues:{':one':1}}));
  assert.equal((await refresh(fourth)).status,401,'epoch invalidates renewal');
  assert.equal((await api('/v1/auth/me',{}, {get:true,access:fourth.body.token})).status,401,'epoch invalidates access');
  console.log('PASS P01-3 real local: enroll + proof, token invalidation, atomic single-use refresh, replay/revocation, device list, logout and epoch');
} finally {
  const deleteEntries=[
    [authTable,identityKey(`AUTH#EMAIL#${hashed}`)],[authTable,identityKey(`OTP#EMAIL#${hashed}`,'CHALLENGE')],
    [authTable,identityKey(`OTP#EMAIL#${hashed}`,'RATE')],[authTable,identityKey(`PASSWORD#LOGIN#${hashed}`,'RATE')],
    [authTable,identityKey(`USER#${uid}`,'CREDENTIAL#PASSWORD')],[authTable,identityKey(`USER#${uid}`,`PROVIDER#EMAIL#${hashed}`)],
    [usersTable,identityKey(`USER#${uid}`)],[settingsTable,identityKey(`USER#${uid}`,'SETTINGS')],
    ...[...slots].map(slot=>[authTable,identityKey(`USER#${uid}`,`DEVICE#${slot}`)])
  ];
  for(const token of legacy)deleteEntries.push([authTable,identityKey(`SESSION#${legacyDigest(token)}`)]);
  for(const token of accessTokens)deleteEntries.push([authTable,identityKey(`SESSION#${accessHash(token)}`)]);
  for(const [table,key] of deleteEntries){try{await db.send(new DeleteCommand({TableName:table,Key:key}));}catch{/* isolated fixture only */}}
  db.destroy();
}
