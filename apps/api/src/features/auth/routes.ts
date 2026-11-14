import {randomBytes, randomInt, randomUUID} from 'node:crypto';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {DeleteCommand, GetCommand, TransactWriteCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient, TransactWriteCommandInput} from '@aws-sdk/lib-dynamodb';
import type {AppConfig} from '../../config.js';
import {registerLocalPasswordAuth, hashNewPassword} from './password.js';
import {validPassword, compromisedCandidate} from './password-policy.js';
import {bearerToken, challengeState, equalDigest, isAdultBirthDate, keyedHash, normalizeEmail, OTP_COOLDOWN_SECONDS, OTP_HOURLY_LIMIT, OTP_LIFETIME_SECONDS, OTP_MAX_ATTEMPTS, SESSION_LIFETIME_SECONDS, validOtp} from './policy.js';

const authTable='uluv_auth_links';
const usersTable='uluv_users';
const settingsTable='uluv_settings';
const outbox=new Map<string,{code:string; expiresAt:number}>(); // local-only; never persisted or logged

type Payload = Record<string,unknown>;
function bodyOf(raw:unknown): Payload|null {
  return raw !== null && typeof raw==='object' && !Array.isArray(raw) ? raw as Payload : null;
}
function fail(reply:FastifyReply, status:number, error:string) {
  return reply.code(status).send({error});
}
function nowSeconds():number {return Math.floor(Date.now()/1000);}
function conditionalError(error:unknown):boolean {
  return error instanceof Error && (error.name==='ConditionalCheckFailedException' || error.name==='TransactionCanceledException');
}
function sessionDigest(secret:string, token:string):string {return keyedHash(secret,'session',token);}

/** P01 development-only email outbox. A delivered email is never claimed; production provider wiring is not included. */
export function registerLocalEmailAuth(app:FastifyInstance, db:DynamoDBDocumentClient, config:AppConfig) {
  const secret:string=config.devToken ?? ''; // retain concrete type inside nested route handlers
  if (secret.length<24 || !['local','test'].includes(config.env)) {
    throw new Error('P01 local email authentication requires a private local signing secret and local/test mode');
  }
  const emailHash=(email:string)=>keyedHash(secret,'email-subject',email);
  const otpDigest=(hash:string,nonce:string,code:string)=>keyedHash(secret,'email-otp',`${hash}:${nonce}:${code}`);
  const challengeKey=(hash:string)=>({PK:`OTP#EMAIL#${hash}`,SK:'CHALLENGE'});
  const rateKey=(hash:string)=>({PK:`OTP#EMAIL#${hash}`,SK:'RATE'});
  const linkKey=(hash:string)=>({PK:`AUTH#EMAIL#${hash}`,SK:'META'});
  const userKey=(uid:string)=>({PK:`USER#${uid}`,SK:'META'});
  const localOutboxKey=(hash:string)=>hash;

  app.post('/v1/auth/email/request', async(request,reply)=>{
    const body=bodyOf(request.body);
    const email=normalizeEmail(body?.email);
    if (!email) return fail(reply,400,'invalid_email');
    const purpose=body?.purpose??'login';
    if(purpose!=='login' && purpose!=='signup') return fail(reply,400,'invalid_otp_purpose');
    const hash=emailHash(email), key=challengeKey(hash), rkey=rateKey(hash), now=nowSeconds();
    // Rate record survives OTP consumption. Atomic transaction + version CAS bounds concurrent issuance.
    try {
      for (let retry=0;retry<3;retry++) {
        const previous=(await db.send(new GetCommand({TableName:authTable,Key:rkey,ConsistentRead:true}))).Item;
        if (previous && Number(previous.nextAllowedAt)>now) return fail(reply,429,'otp_cooldown');
        if (previous && Number(previous.windowEndAt)>now && Number(previous.issuedCount)>=OTP_HOURLY_LIMIT) return fail(reply,429,'otp_rate_limited');
        const windowEndAt=previous && Number(previous.windowEndAt)>now ? Number(previous.windowEndAt) : now+3600;
        const issuedCount=previous && Number(previous.windowEndAt)>now ? Number(previous.issuedCount)+1 : 1;
        const nonce=randomUUID(),version=randomUUID();
        const code=String(randomInt(0,1000000)).padStart(6,'0');
        try {
          await db.send(new TransactWriteCommand({TransactItems:[
            {Put:{TableName:authTable,Item:{...rkey,version,windowEndAt,issuedCount,nextAllowedAt:now+OTP_COOLDOWN_SECONDS,expiresAt:windowEndAt+3600},ConditionExpression:previous?'#version = :previous':'attribute_not_exists(PK)',ExpressionAttributeNames:previous?{'#version':'version'}:undefined,ExpressionAttributeValues:previous?{':previous':previous.version}:undefined}},
            {Put:{TableName:authTable,Item:{...key,kind:'email_otp',purpose,codeDigest:otpDigest(hash,nonce,code),nonce,version,issuedAt:now,expiresAt:now+OTP_LIFETIME_SECONDS,attempts:0}}}
          ]}));
          outbox.set(localOutboxKey(hash),{code,expiresAt:now+OTP_LIFETIME_SECONDS});
          return reply.code(202).send({status:'otp_requested',delivery:'local_dev_outbox',expiresInSeconds:OTP_LIFETIME_SECONDS});
        }catch(error) {if (!conditionalError(error)) throw error;}
      }
      return fail(reply,429,'otp_request_conflict');
    }catch(_error) {return fail(reply,503,'auth_store_unavailable');}
  });

  // Explicitly local, gated by P00's private local key; no public bypass or OTP in logs.
  if(config.env==='local') app.post('/v1/dev/otp/outbox',async(request,reply)=>{
    const provided=request.headers['x-uluv-dev-key'];
    if(typeof provided!=='string' || !equalDigest(keyedHash(secret,'dev-key',provided),keyedHash(secret,'dev-key',secret))) return fail(reply,403,'forbidden');
    const email=normalizeEmail(bodyOf(request.body)?.email);
    if(!email) return fail(reply,400,'invalid_email');
    const entry=outbox.get(localOutboxKey(emailHash(email)));
    if(!entry || entry.expiresAt<=nowSeconds()) return fail(reply,404,'otp_not_in_outbox');
    reply.header('Cache-Control','no-store');
    return {code:entry.code,delivery:'local_dev_outbox'};
  });

  /**
   * Explicitly separate returning-user email-code login from new registration.
   * A login may NEVER create an identity. New registration is atomic with its
   * password credential after valid email proof, DOB and consent.
   */
  async function finishEmailVerification(request:FastifyRequest,reply:FastifyReply, intent:'login'|'signup') {
    const data=bodyOf(request.body), email=normalizeEmail(data?.email);
    const code=data?.code;
    if(!email || !validOtp(code)) return fail(reply,400,'invalid_verification_request');
    if(intent==='signup') {
      if(data?.consent!==true) return fail(reply,400,'consent_required');
      if(!isAdultBirthDate(data?.dateOfBirth,new Date())) return fail(reply,403,'adult_eligibility_required');
      if(!validPassword(data?.password) || compromisedCandidate(data.password)) return fail(reply,400,'invalid_password');
    }
    const hash=emailHash(email), now=nowSeconds(), key=challengeKey(hash);
    try {
      const challenge=(await db.send(new GetCommand({TableName:authTable,Key:key,ConsistentRead:true}))).Item;
      if(!challenge || (challenge.purpose??'login')!==intent) return fail(reply,400,'otp_invalid_or_used');
      const state=challengeState(Number(challenge.expiresAt),Number(challenge.attempts),now);
      if(state==='expired') return fail(reply,400,'otp_expired');
      if(state==='exhausted') return fail(reply,429,'otp_attempts_exhausted');
      if(!equalDigest(otpDigest(hash,String(challenge.nonce),code),String(challenge.codeDigest))) {
        try {await db.send(new UpdateCommand({TableName:authTable,Key:key,UpdateExpression:'ADD attempts :one',ConditionExpression:'#version = :version AND expiresAt > :now AND attempts < :max',ExpressionAttributeNames:{'#version':'version'},ExpressionAttributeValues:{':one':1,':version':challenge.version,':now':now,':max':OTP_MAX_ATTEMPTS}}));}
        catch(error){if(!conditionalError(error))throw error;}
        return fail(reply,400,'otp_invalid_or_used');
      }
      const link=(await db.send(new GetCommand({TableName:authTable,Key:linkKey(hash),ConsistentRead:true}))).Item;
      if(intent==='login' && !link) return fail(reply,401,'email_login_unavailable');
      if(intent==='signup' && link) return fail(reply,409,'registration_unavailable');
      const uid=link?String(link.uid):randomUUID();
      let currentEpoch=0;
      if(link) {
        const existing=(await db.send(new GetCommand({TableName:usersTable,Key:userKey(uid),ConsistentRead:true}))).Item;
        if(!existing || existing.status!=='active' || existing.ageEligibility!=='self_declared_adult') return fail(reply,403,'account_unavailable');
        currentEpoch=Number(existing.sessionEpoch??0);
      }
      // Hash only after proof is valid. This is not written until all related
      // identity records can be committed in one DynamoDB transaction.
      const passwordHash=intent==='signup' ? await hashNewPassword(data!.password as string) : null;
      const token=randomBytes(32).toString('base64url');
      const sessionKey={PK:`SESSION#${sessionDigest(secret,token)}`,SK:'META'};
      const transaction:NonNullable<TransactWriteCommandInput['TransactItems']>=[
        {Delete:{TableName:authTable,Key:key,ConditionExpression:'#version = :version AND codeDigest = :digest AND expiresAt > :now AND attempts < :max',ExpressionAttributeNames:{'#version':'version'},ExpressionAttributeValues:{':version':challenge.version,':digest':challenge.codeDigest,':now':now,':max':OTP_MAX_ATTEMPTS}}},
        {Put:{TableName:authTable,Item:{...sessionKey,uid,kind:'session',createdAt:now,sessionEpoch:currentEpoch,expiresAt:now+SESSION_LIFETIME_SECONDS},ConditionExpression:'attribute_not_exists(PK)'}}
      ];
      if(link){
        transaction.push({ConditionCheck:{TableName:authTable,Key:linkKey(hash),ConditionExpression:'uid = :uid',ExpressionAttributeValues:{':uid':uid}}});
        transaction.push({ConditionCheck:{TableName:usersTable,Key:userKey(uid),ConditionExpression:'#state = :active AND ageEligibility = :adult AND (attribute_not_exists(sessionEpoch) OR sessionEpoch = :epoch)',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult',':epoch':currentEpoch}}});
      }else{
        const stamped=new Date().toISOString();
        transaction.push({Put:{TableName:usersTable,Item:{...userKey(uid),uniqueId:uid,status:'active',ageEligibility:'self_declared_adult',birthDate:data!.dateOfBirth,consentedAt:stamped,createdAt:stamped,sessionEpoch:0,moderationRestrictionVersion:0,identityRevision:1},ConditionExpression:'attribute_not_exists(PK)'}});
        transaction.push({Put:{TableName:authTable,Item:{...linkKey(hash),uid,provider:'EMAIL',subjectHash:hash,verifiedAt:now},ConditionExpression:'attribute_not_exists(PK)'}});
        transaction.push({Put:{TableName:authTable,Item:{PK:`USER#${uid}`,SK:`PROVIDER#EMAIL#${hash}`,uid,provider:'EMAIL',subjectHash:hash},ConditionExpression:'attribute_not_exists(PK)'}});
        transaction.push({Put:{TableName:settingsTable,Item:{PK:`USER#${uid}`,SK:'SETTINGS',createdAt:now,privacyDefault:'private'},ConditionExpression:'attribute_not_exists(PK)'}});
        transaction.push({Put:{TableName:authTable,Item:{PK:`USER#${uid}`,SK:'CREDENTIAL#PASSWORD',kind:'password',passwordHash,version:randomUUID(),createdAt:now},ConditionExpression:'attribute_not_exists(PK)'}});
      }
      try {await db.send(new TransactWriteCommand({TransactItems:transaction}));}
      catch(error){if(conditionalError(error)) return fail(reply,409,'otp_used_or_identity_conflict');throw error;}
      outbox.delete(localOutboxKey(hash));
      reply.header('Cache-Control','no-store');
      return reply.code(link?200:201).send({token,tokenType:'Bearer',expiresInSeconds:SESSION_LIFETIME_SECONDS,account:{uniqueId:uid,status:'active',ageEligibility:'self_declared_adult'},newAccount:!link});
    }catch(_error){return fail(reply,503,'auth_store_unavailable');}
  }

  app.post('/v1/auth/email/verify',(request,reply)=>finishEmailVerification(request,reply,'login'));
  app.post('/v1/auth/signup/register',(request,reply)=>finishEmailVerification(request,reply,'signup'));

  async function requireSession(request:FastifyRequest,reply:FastifyReply,checkEligibility=true):Promise<{uid:string;key:{PK:string;SK:string};authenticatedAt:number}|null>{
    const token=bearerToken(request.headers.authorization);
    if(!token) {fail(reply,401,'authentication_required');return null;}
    const key={PK:`SESSION#${sessionDigest(secret,token)}`,SK:'META'};
    try {
      const session=(await db.send(new GetCommand({TableName:authTable,Key:key,ConsistentRead:true}))).Item;
      if(!session || session.kind!=='session' || Number(session.expiresAt)<=nowSeconds()) {fail(reply,401,'session_expired_or_revoked');return null;}
      const user=(await db.send(new GetCommand({TableName:usersTable,Key:userKey(String(session.uid)),ConsistentRead:true}))).Item;
      if(!user || Number(user.sessionEpoch??0)!==Number(session.sessionEpoch??0)) {fail(reply,401,'session_expired_or_revoked');return null;}
      if(checkEligibility && (user.status!=='active' || user.ageEligibility!=='self_declared_adult')) {fail(reply,403,'account_unavailable');return null;}
      return {uid:String(session.uid),key,authenticatedAt:Number(session.createdAt)};
    }catch(_error) {fail(reply,503,'auth_store_unavailable');return null;}
  }
  registerLocalPasswordAuth(app,db,secret,config.env==='local',requireSession);
  app.get('/v1/auth/me',async(request,reply)=>{
    const auth=await requireSession(request,reply);
    if(!auth) return reply;
    reply.header('Cache-Control','no-store');
    return {account:{uniqueId:auth.uid,status:'active',ageEligibility:'self_declared_adult'}};
  });
  app.post('/v1/auth/logout',async(request,reply)=>{
    const auth=await requireSession(request,reply,false);
    if(!auth) return reply;
    try {await db.send(new DeleteCommand({TableName:authTable,Key:auth.key}));return {status:'signed_out'};}
    catch(_error) {return fail(reply,503,'auth_store_unavailable');}
  });
}
