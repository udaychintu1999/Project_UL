/** Local Fastify + REAL Java DynamoDB Local; never sends email or calls AWS. */
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,DeleteCommand,GetCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

const local=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
const secret=process.env.ULUV_DEV_TOKEN;
if(process.env.APP_ENV!=='local'||!secret||secret.length<24)throw Error('P01-2 integration requires an authorized local-only environment');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:local,region:'ap-south-1',credentials:{accessKeyId:'local',secretAccessKey:'local'}}));
const base='http://127.0.0.1:3000';
const email=`p01-2-${randomUUID()}@example.invalid`;
const emailHash=createHmac('sha256',secret).update(`email-subject\0${email}`).digest('hex');
const tokenHash=t=>createHmac('sha256',secret).update(`session\0${t}`).digest('hex');
const password1='Correct example passphrase';const password2='Updated example passphrase';const password3='Reset example passphrase';
const auth='uluv_auth_links';const users='uluv_users';const settings='uluv_settings';
let uid;const sessions=[];
const authKey=(PK,SK='META')=>({PK,SK});
async function api(path,payload={},options={}){
  const response=await fetch(base+path,{method:options.method??'POST',headers:{'content-type':'application/json',...(options.dev?{'x-uluv-dev-key':secret}:{}),...(options.token?{'authorization':`Bearer ${options.token}`}:{})},...(options.method==='GET'?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(15000)});
  return {status:response.status,body:await response.json()};
}
try {
  assert.equal((await api('/v1/auth/password/login',{email,password:password1})).status,401);
  assert.equal((await api('/v1/auth/email/request',{email,purpose:'signup'})).status,202);
  const otp=await api('/v1/dev/otp/outbox',{email},{dev:true});assert.equal(otp.status,200);
  const created=await api('/v1/auth/signup/register',{email,code:otp.body.code,dateOfBirth:'2000-01-01',consent:true,password:password1});assert.equal(created.status,201);
  uid=created.body.account.uniqueId;sessions.push(created.body.token);
  assert.equal((await api('/v1/auth/password/set',{password:'Abc@123'},{token:created.body.token})).status,400);
  assert.equal((await api('/v1/auth/password/set',{password:'password!'},{token:created.body.token})).status,400);
  assert.equal((await api('/v1/auth/password/set',{password:password1},{token:created.body.token})).status,409,'new signup already has password');
  const item=(await db.send(new GetCommand({TableName:auth,Key:authKey(`USER#${uid}`,'CREDENTIAL#PASSWORD'),ConsistentRead:true}))).Item;
  assert.ok(item?.passwordHash?.startsWith('$argon2id$'));assert.equal(JSON.stringify(item).includes(password1),false);
  assert.equal((await api('/v1/auth/password/login',{email,password:'wrong-password!'})).status,401);
  const pwLogin=await api('/v1/auth/password/login',{email,password:password1});assert.equal(pwLogin.status,200);
  assert.equal(pwLogin.body.account.uniqueId,uid);sessions.push(pwLogin.body.token);
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token:pwLogin.body.token})).status,200);
  assert.equal((await api('/v1/auth/password/change',{currentPassword:'wrong',newPassword:password2},{token:pwLogin.body.token})).status,401);
  assert.equal((await api('/v1/auth/password/change',{currentPassword:password1,newPassword:password2},{token:pwLogin.body.token})).status,200);
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token:pwLogin.body.token})).status,401,'password change must revoke prior sessions');
  assert.equal((await api('/v1/auth/password/login',{email,password:password1})).status,401);
  const changed=await api('/v1/auth/password/login',{email,password:password2});assert.equal(changed.status,200);sessions.push(changed.body.token);
  // Synthetic test fixture advances the shared OTP/recovery cooldown without waiting 60 seconds.
  await db.send(new UpdateCommand({TableName:auth,Key:authKey(`OTP#EMAIL#${emailHash}`,'RATE'),UpdateExpression:'SET nextAllowedAt = :past',ExpressionAttributeValues:{':past':Math.floor(Date.now()/1000)-1}}));
  assert.equal((await api('/v1/auth/password/recovery/request',{email})).status,202);
  assert.equal((await api('/v1/dev/password/recovery/outbox',{email})).status,403);
  const resetOtp=await api('/v1/dev/password/recovery/outbox',{email},{dev:true});assert.equal(resetOtp.status,200);
  assert.equal((await api('/v1/auth/password/recovery/reset',{email,code:'000000'===resetOtp.body.code?'111111':'000000',newPassword:password3})).status,400);
  assert.equal((await api('/v1/auth/password/recovery/reset',{email,code:resetOtp.body.code,newPassword:password3})).status,200);
  assert.equal((await api('/v1/auth/password/recovery/reset',{email,code:resetOtp.body.code,newPassword:password3})).status,400,'recovery challenge cannot replay');
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token:changed.body.token})).status,401,'reset revokes all old sessions');
  const recovered=await api('/v1/auth/password/login',{email,password:password3});assert.equal(recovered.status,200);sessions.push(recovered.body.token);
  assert.equal(recovered.body.account.uniqueId,uid,'password reset may not change uniqueId');
  await db.send(new UpdateCommand({TableName:users,Key:authKey(`USER#${uid}`),UpdateExpression:'SET #state = :restricted',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':restricted':'restricted'}}));
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token:recovered.body.token})).status,403);
  assert.equal((await api('/v1/auth/password/login',{email,password:password3})).status,401);
  assert.equal((await api('/v1/auth/logout',{}, {token:recovered.body.token})).status,200);
  console.log('PASS P01-2 local: password set/races, Argon2id, password sign-in, change, reset/replay, session epoch revocation, immutable ID, account restriction (real Fastify + Java DynamoDB Local)');
}finally{
  const keyEntries=[
    [auth,authKey(`AUTH#EMAIL#${emailHash}`)],[auth,authKey(`OTP#EMAIL#${emailHash}`,'CHALLENGE')],[auth,authKey(`OTP#EMAIL#${emailHash}`,'RATE')],
    [auth,authKey(`PASSWORD#LOGIN#${emailHash}`,'RATE')],[auth,authKey(`PASSWORD#RESET#${emailHash}`,'RATE')],[auth,authKey(`PASSWORD#RESET#${emailHash}`,'CHALLENGE')]
  ];
  if(uid)keyEntries.push([auth,authKey(`USER#${uid}`,'CREDENTIAL#PASSWORD')],[auth,authKey(`USER#${uid}`,`PROVIDER#EMAIL#${emailHash}`)],[users,authKey(`USER#${uid}`)],[settings,authKey(`USER#${uid}`,'SETTINGS')]);
  for(const token of sessions)keyEntries.push([auth,authKey(`SESSION#${tokenHash(token)}`)]);
  for(const [table,key] of keyEntries){try{await db.send(new DeleteCommand({TableName:table,Key:key}));}catch{console.warn('WARNING: P01-2 synthetic fixture cleanup incomplete; inspect local test fixture only.');}}
  db.destroy();
}
