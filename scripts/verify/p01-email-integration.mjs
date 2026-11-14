/** Local-only real Fastify + DynamoDB integration. NO AWS or SMTP. Run under --env-file=apps/api/.env on owner's machine. */
import assert from 'node:assert/strict';
import {randomUUID, createHmac} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,DeleteCommand,GetCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

const base='http://127.0.0.1:3000';
const endpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
const secret=process.env.ULUV_DEV_TOKEN;
if(process.env.APP_ENV!=='local'||!secret||secret.length<24) throw Error('P01 integration requires authorized local-only env and owner-generated private local key');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({region:'ap-south-1',endpoint,credentials:{accessKeyId:'local',secretAccessKey:'local'}}));
const email=`p01-qa-${randomUUID()}@example.invalid`;
const absentEmail=`p01-unknown-${randomUUID()}@example.invalid`;
const absentHash=createHmac('sha256',secret).update(`email-subject\0${absentEmail}`).digest('hex');
const hash=createHmac('sha256',secret).update(`email-subject\0${email}`).digest('hex');
const linkKey={PK:`AUTH#EMAIL#${hash}`,SK:'META'};
const challengeKey={PK:`OTP#EMAIL#${hash}`,SK:'CHALLENGE'};
const rateKey={PK:`OTP#EMAIL#${hash}`,SK:'RATE'};
const reverseKey=(uid)=>({PK:`USER#${uid}`,SK:`PROVIDER#EMAIL#${hash}`});
const userKey=(uid)=>({PK:`USER#${uid}`,SK:'META'});
const settingsKey=(uid)=>({PK:`USER#${uid}`,SK:'SETTINGS'});
let uid, tokens=[];
async function api(path,body={},opts={}) {
  const response=await fetch(base+path,{method:opts.method??'POST',headers:{'Content-Type':'application/json',...(opts.dev?{'x-uluv-dev-key':secret}:{}),...(opts.token?{'Authorization':`Bearer ${opts.token}`}:{})},...(opts.method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
  return {status:response.status,body:await response.json()};
}
async function resetTestCooldown(){
  // Controlled TEST FIXTURE ONLY: simulates cooldown passage without a 60-second test delay.
  await db.send(new UpdateCommand({TableName:'uluv_auth_links',Key:rateKey,UpdateExpression:'SET nextAllowedAt = :past',ConditionExpression:'attribute_exists(PK)',ExpressionAttributeValues:{':past':Math.floor(Date.now()/1000)-1}}));
}
try {
  // No email is issued for an unknown login. Anonymous response remains neutral.
  assert.equal((await api('/v1/auth/email/request',{email:absentEmail,purpose:'login'})).status,202);
  assert.equal((await api('/v1/dev/otp/outbox',{email:absentEmail},{dev:true})).status,404);
  assert.equal((await db.send(new GetCommand({TableName:'uluv_auth_links',Key:{PK:`AUTH#EMAIL#${absentHash}`,SK:'META'},ConsistentRead:true}))).Item,undefined);
  const noAuth=await api('/v1/auth/me',{}, {method:'GET'});
  assert.equal(noAuth.status,401);
  assert.equal((await api('/v1/auth/email/request',{email:'bad'})).status,400);
  const issued=await api('/v1/auth/email/request',{email,purpose:'signup'});
  assert.equal(issued.status,202); assert.equal(issued.body.delivery,'if_eligible');
  assert.equal((await api('/v1/auth/email/request',{email,purpose:'signup'})).status,202); // neutral cooldown
  assert.equal((await api('/v1/dev/otp/outbox',{email})).status,403);
  const outbox=await api('/v1/dev/otp/outbox',{email},{dev:true});
  assert.equal(outbox.status,200);assert.match(outbox.body.code,/^\d{6}$/);
  assert.equal((await api('/v1/auth/signup/register',{email,code:'abcdef',dateOfBirth:'2000-01-01',consent:true})).status,400);
  assert.equal((await api('/v1/auth/signup/register',{email,code:outbox.body.code,dateOfBirth:'2014-01-01',consent:true,password:'My private long passphrase 2026'})).status,403);
  assert.equal((await api('/v1/auth/signup/register',{email,code:outbox.body.code,dateOfBirth:'2000-01-01',consent:false,password:'My private long passphrase 2026'})).status,400);
  assert.equal((await api('/v1/auth/signup/register',{email,code:'999999'===outbox.body.code?'888888':'999999',dateOfBirth:'2000-01-01',consent:true,password:'My private long passphrase 2026'})).status,400);
  const verifyBody={email,code:outbox.body.code,dateOfBirth:'2000-01-01',consent:true,password:'My private long passphrase 2026'};
  assert.equal((await api('/v1/auth/email/verify',verifyBody)).status,400,'signup purpose cannot sign in');
  const signed=await Promise.all([api('/v1/auth/signup/register',verifyBody),api('/v1/auth/signup/register',verifyBody)]);
  const success=signed.filter(r=>r.status===201);
  assert.equal(success.length,1,'concurrent OTP consumption created exactly one account');
  assert.equal(signed.filter(r=>r.status!==201).length,1);
  uid=success[0].body.account.uniqueId;
  assert.match(uid,/^[0-9a-f-]{36}$/);
  const token=success[0].body.token;tokens.push(token);
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token})).body.account.uniqueId,uid);
  assert.equal((await api('/v1/auth/signup/register',verifyBody)).status,400);
  // Restrict locally created fixture; session must fail authorization immediately.
  await db.send(new UpdateCommand({TableName:'uluv_users',Key:userKey(uid),UpdateExpression:'SET #state = :restricted',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':restricted':'restricted'}}));
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token})).status,403);
  assert.equal((await api('/v1/auth/logout',{}, {token})).status,200);
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token})).status,401);
  await db.send(new UpdateCommand({TableName:'uluv_users',Key:userKey(uid),UpdateExpression:'SET #state = :active',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':active':'active'}}));
  await resetTestCooldown();
  const repeat=await api('/v1/auth/email/request',{email,purpose:'login'});assert.equal(repeat.status,202);
  const newCode=(await api('/v1/dev/otp/outbox',{email},{dev:true})).body.code;
  const reentry=await api('/v1/auth/email/verify',{email,code:newCode});
  assert.equal(reentry.status,200);assert.equal(reentry.body.newAccount,false);assert.equal(reentry.body.account.uniqueId,uid);
  tokens.push(reentry.body.token);
  assert.equal((await api('/v1/auth/me',{}, {method:'GET',token:reentry.body.token})).status,200);
  assert.equal((await api('/v1/auth/logout',{}, {token:reentry.body.token})).status,200);
  console.log('PASS P01 local: explicit login/signup OTP purpose, validation, rate limit, age/consent, concurrent signup, immutable ID, restriction, logout/re-entry, session revocation (real Fastify + Java DynamoDB Local)');
} finally {
  // Clean only this test's synthetic fixture; never touch real users or other records.
  const keys=[{table:'uluv_auth_links',key:challengeKey},{table:'uluv_auth_links',key:rateKey},{table:'uluv_auth_links',key:linkKey},
    {table:'uluv_auth_links',key:{PK:`OTP#EMAIL#${absentHash}`,SK:'CHALLENGE'}},
    {table:'uluv_auth_links',key:{PK:`OTP#EMAIL#${absentHash}`,SK:'RATE'}}];
  if(uid){keys.push({table:'uluv_users',key:userKey(uid)},{table:'uluv_settings',key:settingsKey(uid)},{table:'uluv_auth_links',key:reverseKey(uid)},{table:'uluv_auth_links',key:{PK:`USER#${uid}`,SK:'CREDENTIAL#PASSWORD'}});}
  for(const token of tokens){keys.push({table:'uluv_auth_links',key:{PK:`SESSION#${createHmac('sha256',secret).update(`session\0${token}`).digest('hex')}`,SK:'META'}});}
  for(const item of keys){try{await db.send(new DeleteCommand({TableName:item.table,Key:item.key}));}catch{console.error('WARNING: synthetic P01 fixture cleanup incomplete; inspect local test fixture only.');}}
  db.destroy();
}
