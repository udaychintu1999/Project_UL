/** P01-2 shared email-cost budget: real Fastify + Java DynamoDB Local ONLY.
 * Creates disposable synthetic data and never invokes AWS, SMTP or production email.
 */
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,DeleteCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';
const secret=process.env.ULUV_DEV_TOKEN;
if(process.env.APP_ENV!=='local' || !secret || secret.length<24)throw Error('P01-2 email budget test requires local environment');
const endpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint,region:'ap-south-1',credentials:{accessKeyId:'local',secretAccessKey:'local'}}));
const email=`p01-budget-${randomUUID()}@example.invalid`;
const unknown=`p01-budget-unknown-${randomUUID()}@example.invalid`;
const hash=value=>createHmac('sha256',secret).update(`email-subject\0${value}`).digest('hex');
const h=hash(email),u=hash(unknown), table='uluv_auth_links';
const key=(PK,SK='META')=>({PK,SK});
const budget=key(`OTP#EMAIL#${h}`,'RATE');
const status=async(path,payload,headerId)=>{
  const response=await fetch('http://127.0.0.1:3000'+path,{method:'POST',headers:{'content-type':'application/json',...(headerId?{'x-uluv-request-id':headerId}:{}),...(path.startsWith('/v1/dev')?{'x-uluv-dev-key':secret}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  return {code:response.status,data:await response.json()};
};
const request=(purpose,id)=>status('/v1/auth/email/request',{email,purpose},id);
const recovery=id=>status('/v1/auth/password/recovery/request',{email},id);
const get=async k=>(await db.send(new GetCommand({TableName:table,Key:k,ConsistentRead:true}))).Item;
const releaseCooldown=()=>db.send(new UpdateCommand({TableName:table,Key:budget,UpdateExpression:'SET nextAllowedAt = :past',ExpressionAttributeValues:{':past':Math.floor(Date.now()/1000)-1}}));
let uid=null,token=null;
try {
  const noUser=await status('/v1/auth/email/request',{email:unknown,purpose:'login'});
  const noRecovery=await status('/v1/auth/password/recovery/request',{email:unknown});
  assert.equal(noUser.code,202);assert.equal(noRecovery.code,202);
  assert.deepEqual(noUser.data,(await request('signup',randomUUID())).data,'public OTP response stays neutral across eligibility');
  assert.equal(await get(key(`OTP#EMAIL#${u}`,'RATE')),undefined,'unknown email never burns quota');
  assert.equal((await status('/v1/dev/otp/outbox',{email:unknown})).code,404);
  assert.equal((await status('/v1/auth/email/request',{email,purpose:'signup'},'not-a-valid-uuid')).code,400,
    'Malformed idempotency key must be rejected before issuing');
  const first=await get(budget);assert.equal(first.issuances.length,1);
  const identicalId=randomUUID();
  const newRequest=await request('signup',identicalId);
  assert.equal(newRequest.code,202,'cooldown is a neutral response');
  assert.equal((await get(budget)).issuances.length,1,'cooldown cannot spend a second slot');
  const outbox=await status('/v1/dev/otp/outbox',{email});assert.equal(outbox.code,200);
  const registered=await status('/v1/auth/signup/register',{email,code:outbox.data.code,dateOfBirth:'2000-01-01',consent:true,password:'Example long budget passphrase'});
  assert.equal(registered.code,201);uid=registered.data.account.uniqueId;token=registered.data.token;
  const duplicateSignup=await request('signup',randomUUID());
  assert.equal(duplicateSignup.code,409,'existing signup email rejected before a code is issued');
  assert.deepEqual(duplicateSignup.data,{error:'email_already_registered'});
  assert.equal((await status('/v1/dev/otp/outbox',{email})).code,404,
    'registration consumed the earlier code and duplicate signup must not issue a replacement');
  assert.equal((await get(budget)).issuances.length,1,'already registered signup never consumes another slot');
  await releaseCooldown();
  const secondId=randomUUID();
  assert.equal((await recovery(secondId)).code,202);
  let record=await get(budget);assert.equal(record.issuances.length,2);
  assert.equal((await recovery(secondId)).code,202);
  assert.equal((await get(budget)).issuances.length,2,'same request ID is idempotent');
  assert.equal((await status('/v1/dev/password/recovery/outbox',{email})).code,200);
  await releaseCooldown();assert.equal((await request('login',randomUUID())).code,202);
  await releaseCooldown();assert.equal((await recovery(randomUUID())).code,202);
  record=await get(budget);assert.equal(record.issuances.length,4);
  await releaseCooldown();
  const concurrency=await Promise.all(Array.from({length:10},(_,i)=>i%2
      ? request('login',randomUUID()) : recovery(randomUUID())));
  assert.ok(concurrency.every(r=>r.code===202));
  record=await get(budget);
  assert.equal(record.issuances.length,5,'10 concurrent cross-purpose sends must consume only one last slot');
  await releaseCooldown();
  assert.equal((await recovery(randomUUID())).code,202);
  assert.equal((await get(budget)).issuances.length,5,'daily cap never issues a sixth email');
  // After 24h boundary oldest issuance drops out. No wall-clock sleeps required:
  // modify ONLY the synthetic test record to move its oldest timestamp backwards.
  const old=record.issuances.map((v,i)=>i===0?{...v,at:Math.floor(Date.now()/1000)-86400-1}:v);
  await db.send(new UpdateCommand({TableName:table,Key:budget,UpdateExpression:'SET issuances = :list, nextAllowedAt = :past',ExpressionAttributeValues:{':list':old,':past':Math.floor(Date.now()/1000)-1}}));
  assert.equal((await request('login',randomUUID())).code,202);
  assert.equal((await get(budget)).issuances.length,5,'oldest issuance falls out of rolling 24h window');
  console.log('PASS P01-2 real shared rolling email budget: 5/day, cross-purpose CAS concurrency, cooldown, idempotency, no-send existing signup notice, 24h expiry, no new table');
}finally{
  const keys=[key(`OTP#EMAIL#${h}`,'RATE'),key(`OTP#EMAIL#${h}`,'CHALLENGE'),key(`OTP#EMAIL#${u}`,'RATE'),key(`OTP#EMAIL#${u}`,'CHALLENGE'),key(`AUTH#EMAIL#${h}`),key(`PASSWORD#RESET#${h}`,'CHALLENGE'),key(`PASSWORD#LOGIN#${h}`,'RATE')];
  if(uid)keys.push(key(`USER#${uid}`,'CREDENTIAL#PASSWORD'),key(`USER#${uid}`,`PROVIDER#EMAIL#${h}`));
  if(token)keys.push(key(`SESSION#${createHmac('sha256',secret).update(`session\0${token}`).digest('hex')}`));
  for(const k of keys){try{await db.send(new DeleteCommand({TableName:table,Key:k}));}catch{console.warn('Synthetic email budget test cleanup incomplete; inspect local fixtures only.');}}
  if(uid){for(const [tbl,k] of [['uluv_users',key(`USER#${uid}`)],['uluv_settings',key(`USER#${uid}`,'SETTINGS')]]){try{await db.send(new DeleteCommand({TableName:tbl,Key:k}));}catch{console.warn('Synthetic user cleanup incomplete.');}}}
  db.destroy();
}
