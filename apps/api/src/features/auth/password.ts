/** P01-2: password credentials are separate from the verified email link and canonical user. */
import {randomBytes, randomInt, randomUUID} from 'node:crypto';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {GetCommand, PutCommand, TransactWriteCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient, TransactWriteCommandInput} from '@aws-sdk/lib-dynamodb';
import {hash as argonHash, verify as argonVerify, Algorithm} from '@node-rs/argon2';
import {bearerToken, challengeState, equalDigest, keyedHash, normalizeEmail, OTP_COOLDOWN_SECONDS, OTP_HOURLY_LIMIT, OTP_MAX_ATTEMPTS, SESSION_LIFETIME_SECONDS, validOtp} from './policy.js';
import {compromisedCandidate, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_SECONDS, PASSWORD_RECENT_AUTH_SECONDS, PASSWORD_RESET_LIFETIME_SECONDS, remainingWindow, validPassword, canonicalPassword} from './password-policy.js';

const AUTH='uluv_auth_links';
const USERS='uluv_users';
export const hashOptions={algorithm:Algorithm.Argon2id,memoryCost:19456,timeCost:2,parallelism:1,outputLen:32};
export async function hashNewPassword(password:string):Promise<string> {return argonHash(canonicalPassword(password),hashOptions);}
type Input=Record<string,unknown>;
const body=(raw:unknown):Input=>raw && typeof raw==='object' && !Array.isArray(raw)?raw as Input:{};
const fail=(reply:FastifyReply,code:number,error:string)=>reply.code(code).send({error});
const now=()=>Math.floor(Date.now()/1000);
const conflict=(error:unknown)=>error instanceof Error && ['ConditionalCheckFailedException','TransactionCanceledException'].includes(error.name);
const credentials=(uid:string)=>({PK:`USER#${uid}`,SK:'CREDENTIAL#PASSWORD'});
const account=(uid:string)=>({PK:`USER#${uid}`,SK:'META'});
const digest=(secret:string,token:string)=>keyedHash(secret,'session',token);

export type PasswordSession={uid:string;key:{PK:string;SK:string};authenticatedAt:number};
export function registerLocalPasswordAuth(app:FastifyInstance,db:DynamoDBDocumentClient,secret:string,localMode:boolean,requireSession:(request:FastifyRequest,reply:FastifyReply,checkEligibility?:boolean)=>Promise<PasswordSession|null>) {
  const emailHash=(email:string)=>keyedHash(secret,'email-subject',email);
  const emailLink=(hashed:string)=>({PK:`AUTH#EMAIL#${hashed}`,SK:'META'});
  const rateKey=(hashed:string)=>({PK:`PASSWORD#LOGIN#${hashed}`,SK:'RATE'});
  const resetRate=(hashed:string)=>({PK:`PASSWORD#RESET#${hashed}`,SK:'RATE'});
  const resetChallenge=(hashed:string)=>({PK:`PASSWORD#RESET#${hashed}`,SK:'CHALLENGE'});
  const resetHash=(hashed:string,nonce:string,code:string)=>keyedHash(secret,'password-reset-otp',`${hashed}:${nonce}:${code}`);
  // Dummy hash prevents a missing account from skipping expensive verification.
  const dummyHash=argonHash(randomBytes(32).toString('hex'),hashOptions);
  const resetOutbox=new Map<string,{code:string;expiresAt:number}>();

  async function getActiveUser(uid:string) {
    const item=(await db.send(new GetCommand({TableName:USERS,Key:account(uid),ConsistentRead:true}))).Item;
    return item && item.status==='active' && item.ageEligibility==='self_declared_adult'?item:null;
  }
  // Atomic per-email attempt counting. Applied BEFORE checking whether the email exists.
  async function registerAttempt(hashed:string):Promise<boolean> {
    const key=rateKey(hashed);
    for(let i=0;i<4;i++) {
      const t=now();
      const previous=(await db.send(new GetCommand({TableName:AUTH,Key:key,ConsistentRead:true}))).Item;
      const inside=previous && remainingWindow(Number(previous!.windowEndAt),t);
      if(inside && Number(previous!.count)>=LOGIN_ATTEMPT_LIMIT) return false;
      const version=randomUUID();
      try {
        await db.send(new PutCommand({TableName:AUTH,Item:{...key,version,count:inside?Number(previous!.count)+1:1,windowEndAt:inside?Number(previous!.windowEndAt):t+LOGIN_WINDOW_SECONDS,expiresAt:t+2*LOGIN_WINDOW_SECONDS},ConditionExpression:previous?'#v = :old':'attribute_not_exists(PK)',ExpressionAttributeNames:previous?{'#v':'version'}:undefined,ExpressionAttributeValues:previous?{':old':previous.version}:undefined}));
        return true;
      } catch(error) {if(!conflict(error))throw error;}
    }
    return false;
  }
  async function lookupByEmail(email:string) {
    const mapped=(await db.send(new GetCommand({TableName:AUTH,Key:emailLink(emailHash(email)),ConsistentRead:true}))).Item;
    if(!mapped || typeof mapped.uid!=='string') return null;
    return {uid:mapped.uid,user:await getActiveUser(mapped.uid)};
  }
  async function createSession(uid:string,epoch:number):Promise<{token:string}|null> {
    const token=randomBytes(32).toString('base64url');
    const t=now();
    try {
      await db.send(new TransactWriteCommand({TransactItems:[
        {ConditionCheck:{TableName:USERS,Key:account(uid),ConditionExpression:'#status = :active AND ageEligibility = :adult AND (attribute_not_exists(sessionEpoch) OR sessionEpoch = :epoch)',ExpressionAttributeNames:{'#status':'status'},ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult',':epoch':epoch}}},
        {Put:{TableName:AUTH,Item:{PK:`SESSION#${digest(secret,token)}`,SK:'META',uid,kind:'session',createdAt:t,sessionEpoch:epoch,expiresAt:t+SESSION_LIFETIME_SECONDS},ConditionExpression:'attribute_not_exists(PK)'}}
      ]}));
      return {token};
    }catch(error) {if(conflict(error)) return null;throw error;}
  }

  // Existing OTP-signed-in users attach one password without changing identity.
  app.post('/v1/auth/password/set',async(request,reply)=>{
    const data=body(request.body);
    if(!validPassword(data.password)||compromisedCandidate(data.password)) return fail(reply,400,'invalid_password');
    const auth=await requireSession(request,reply);
    if(!auth)return reply;
    if(now()-auth.authenticatedAt>PASSWORD_RECENT_AUTH_SECONDS) return fail(reply,403,'recent_auth_required');
    try {
      await db.send(new TransactWriteCommand({TransactItems:[
        {ConditionCheck:{TableName:USERS,Key:account(auth.uid),ConditionExpression:'#s = :active AND ageEligibility = :adult',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult'}}},
        {Put:{TableName:AUTH,Item:{...credentials(auth.uid),kind:'password',passwordHash:await hashNewPassword(data.password),version:randomUUID(),createdAt:now()},ConditionExpression:'attribute_not_exists(PK)'}}
      ]}));
      return reply.code(201).send({status:'password_set'});
    }catch(error) {return fail(reply,conflict(error)?409:503,conflict(error)?'password_already_set':'auth_store_unavailable');}
  });

  app.post('/v1/auth/password/login',async(request,reply)=>{
    const data=body(request.body), email=normalizeEmail(data.email);
    if(!email || typeof data.password!=='string'||Buffer.byteLength(data.password,'utf8')>1024 || data.password.length===0) return fail(reply,400,'invalid_login_request');
    const hashed=emailHash(email);
    try {
      if(!await registerAttempt(hashed))return fail(reply,429,'password_login_limited');
      const linked=await lookupByEmail(email);
      const saved=linked?.user?(await db.send(new GetCommand({TableName:AUTH,Key:credentials(linked.uid),ConsistentRead:true}))).Item:null;
      const stored=typeof saved?.passwordHash==='string'?saved.passwordHash:await dummyHash;
      let matched=false;
      try {
        matched=await argonVerify(stored,canonicalPassword(data.password));
        // Legacy hashes from the former 8+symbol phase were made from raw input.
        // Permit them to log in without a sudden lockout; new writes are NFC.
        if(!matched && data.password!==canonicalPassword(data.password)) matched=await argonVerify(stored,data.password);
      }catch{/* Corrupt hash must not authenticate. */}
      if(!matched || !linked?.user || !saved || saved.kind!=='password')return fail(reply,401,'invalid_credentials');
      const issued=await createSession(linked.uid,Number(linked.user.sessionEpoch??0));
      if(!issued)return fail(reply,403,'account_unavailable');
      reply.header('Cache-Control','no-store');
      return {token:issued.token,tokenType:'Bearer',expiresInSeconds:SESSION_LIFETIME_SECONDS,account:{uniqueId:linked.uid,status:'active',ageEligibility:'self_declared_adult'}};
    }catch(_error) {return fail(reply,503,'auth_store_unavailable');}
  });

  app.post('/v1/auth/password/change',async(request,reply)=>{
    const data=body(request.body);
    if(typeof data.currentPassword!=='string' || !validPassword(data.newPassword) || compromisedCandidate(data.newPassword) || canonicalPassword(data.currentPassword)===canonicalPassword(data.newPassword)) return fail(reply,400,'invalid_password_change');
    const auth=await requireSession(request,reply);
    if(!auth)return reply;
    try {
      const current=(await db.send(new GetCommand({TableName:AUTH,Key:credentials(auth.uid),ConsistentRead:true}))).Item;
      if(!current || current.kind!=='password' || typeof current.passwordHash!=='string' || !(await argonVerify(current.passwordHash,canonicalPassword(data.currentPassword)) || (data.currentPassword!==canonicalPassword(data.currentPassword) && await argonVerify(current.passwordHash,data.currentPassword))))return fail(reply,401,'invalid_credentials');
      const updatedHash=await hashNewPassword(data.newPassword), version=randomUUID();
      try {
        await db.send(new TransactWriteCommand({TransactItems:[
          {Put:{TableName:AUTH,Item:{...credentials(auth.uid),kind:'password',passwordHash:updatedHash,version,updatedAt:now()},ConditionExpression:'#v = :old',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':old':current.version}}},
          {Update:{TableName:USERS,Key:account(auth.uid),UpdateExpression:'ADD sessionEpoch :one',ConditionExpression:'#s = :active AND ageEligibility = :adult',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':one':1,':active':'active',':adult':'self_declared_adult'}}}
        ]}));
      }catch(error) {return fail(reply,conflict(error)?409:503,conflict(error)?'password_change_conflict':'auth_store_unavailable');}
      return {status:'password_changed_reauthentication_required'};
    }catch(_error) {return fail(reply,503,'auth_store_unavailable');}
  });

  // Recovery always responds identically for existing and unknown emails.
  app.post('/v1/auth/password/recovery/request',async(request,reply)=>{
    const data=body(request.body), email=normalizeEmail(data.email);
    if(!email)return fail(reply,400,'invalid_email');
    const hashed=emailHash(email), key=resetRate(hashed), challenge=resetChallenge(hashed);
    const accepted={status:'recovery_requested',delivery:'local_dev_outbox'};
    try {
      for(let i=0;i<4;i++) {
        const t=now(), prev=(await db.send(new GetCommand({TableName:AUTH,Key:key,ConsistentRead:true}))).Item;
        if(prev && Number(prev.nextAllowedAt)>t)return reply.code(202).send(accepted);
        const inside=prev&&Number(prev!.windowEndAt)>t;
        if(inside&&Number(prev!.issuedCount)>=OTP_HOURLY_LIMIT)return reply.code(202).send(accepted);
        const nonce=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0'),version=randomUUID();
        try {
          await db.send(new TransactWriteCommand({TransactItems:[
            {Put:{TableName:AUTH,Item:{...key,version,nextAllowedAt:t+OTP_COOLDOWN_SECONDS,windowEndAt:inside?Number(prev!.windowEndAt):t+3600,issuedCount:inside?Number(prev!.issuedCount)+1:1,expiresAt:t+7200},ConditionExpression:prev?'#v = :old':'attribute_not_exists(PK)',ExpressionAttributeNames:prev?{'#v':'version'}:undefined,ExpressionAttributeValues:prev?{':old':prev.version}:undefined}},
            {Put:{TableName:AUTH,Item:{...challenge,kind:'password_reset',nonce,version,codeDigest:resetHash(hashed,nonce,code),attempts:0,expiresAt:t+PASSWORD_RESET_LIFETIME_SECONDS}}}
          ]}));
          resetOutbox.set(hashed,{code,expiresAt:t+PASSWORD_RESET_LIFETIME_SECONDS});
          return reply.code(202).send(accepted);
        }catch(error){if(!conflict(error))throw error;}
      }
      return reply.code(202).send(accepted);
    }catch(_error){return fail(reply,503,'auth_store_unavailable');}
  });

  // Outbox is only available with the existing private LOCAL developer key.
  if(localMode)app.post('/v1/dev/password/recovery/outbox',async(request,reply)=>{
    if(typeof request.headers['x-uluv-dev-key']!=='string' || !equalDigest(keyedHash(secret,'dev-key',request.headers['x-uluv-dev-key']),keyedHash(secret,'dev-key',secret)))return fail(reply,403,'forbidden');
    const email=normalizeEmail(body(request.body).email);
    if(!email)return fail(reply,400,'invalid_email');
    const entry=resetOutbox.get(emailHash(email));
    if(!entry || entry.expiresAt<=now())return fail(reply,404,'otp_not_in_outbox');
    reply.header('Cache-Control','no-store');
    return {code:entry.code,delivery:'local_dev_outbox'};
  });

  app.post('/v1/auth/password/recovery/reset',async(request,reply)=>{
    const data=body(request.body),email=normalizeEmail(data.email);
    if(!email || !validOtp(data.code) || !validPassword(data.newPassword) || compromisedCandidate(data.newPassword))return fail(reply,400,'invalid_password_reset');
    const hashed=emailHash(email), key=resetChallenge(hashed), t=now();
    try {
      const challenge=(await db.send(new GetCommand({TableName:AUTH,Key:key,ConsistentRead:true}))).Item;
      if(!challenge || challenge.kind!=='password_reset' || challengeState(Number(challenge.expiresAt),Number(challenge.attempts),t)!=='valid')return fail(reply,400,'reset_invalid_or_used');
      if(!equalDigest(resetHash(hashed,String(challenge.nonce),data.code),String(challenge.codeDigest))) {
        try{await db.send(new UpdateCommand({TableName:AUTH,Key:key,UpdateExpression:'ADD attempts :one',ConditionExpression:'#v = :old AND expiresAt > :now AND attempts < :max',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':one':1,':old':challenge.version,':now':t,':max':OTP_MAX_ATTEMPTS}}));}catch(error){if(!conflict(error))throw error;}
        return fail(reply,400,'reset_invalid_or_used');
      }
      const linked=await lookupByEmail(email);
      if(!linked?.user)return fail(reply,400,'reset_invalid_or_used');
      const old=(await db.send(new GetCommand({TableName:AUTH,Key:credentials(linked.uid),ConsistentRead:true}))).Item;
      if(!old || old.kind!=='password')return fail(reply,400,'reset_invalid_or_used');
      const updated=await hashNewPassword(data.newPassword);
      try {
        await db.send(new TransactWriteCommand({TransactItems:[
          {Delete:{TableName:AUTH,Key:key,ConditionExpression:'#v = :old AND codeDigest = :digest AND expiresAt > :now AND attempts < :max',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':old':challenge.version,':digest':challenge.codeDigest,':now':t,':max':OTP_MAX_ATTEMPTS}}},
          {Put:{TableName:AUTH,Item:{...credentials(linked.uid),kind:'password',passwordHash:updated,version:randomUUID(),updatedAt:t},ConditionExpression:'#v = :old',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':old':old.version}}},
          {Update:{TableName:USERS,Key:account(linked.uid),UpdateExpression:'ADD sessionEpoch :one',ConditionExpression:'#s = :active AND ageEligibility = :adult',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':one':1,':active':'active',':adult':'self_declared_adult'}}}
        ]}));
      }catch(error){return fail(reply,conflict(error)?409:503,conflict(error)?'reset_invalid_or_used':'auth_store_unavailable');}
      resetOutbox.delete(hashed);
      return {status:'password_reset_reauthentication_required'};
    }catch(_error) {return fail(reply,503,'auth_store_unavailable');}
  });
}
