/** P01-3: local-only, device-bound, single-use rotating renewable sessions. */
import {randomBytes, randomUUID} from 'node:crypto';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {GetCommand, TransactWriteCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient, TransactWriteCommandInput} from '@aws-sdk/lib-dynamodb';
import {P13_ACCESS_SECONDS,P13_REAUTH_SECONDS,P13_INACTIVITY_SECONDS,P13_MAX_DEVICES,P13_KEY_ID,p13Keys,refreshDigest,accessDigest,proofText,deviceProofValid} from './device-session-policy.js';

const AUTH='uluv_auth_links', USERS='uluv_users';
const now=()=>Math.floor(Date.now()/1000);
const fail=(reply:FastifyReply,status:number,error:string)=>reply.code(status).send({error});
const conflict=(error:unknown)=>error instanceof Error && ['ConditionalCheckFailedException','TransactionCanceledException'].includes(error.name);
const familyKey=(uid:string,slot:number)=>({PK:`USER#${uid}`,SK:`DEVICE#${slot}`});
const userKey=(uid:string)=>({PK:`USER#${uid}`,SK:'META'});
const accessKey=(digest:string)=>({PK:`SESSION#${digest}`,SK:'META'});
const body=(raw:unknown)=>raw && typeof raw==='object' && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
const validId=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(v) && v.length<=36;
const validToken=(v:unknown):v is string=>typeof v==='string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const validSlot=(v:unknown):v is number=>Number.isInteger(v) && Number(v)>=0 && Number(v)<P13_MAX_DEVICES;
const validNonce=(v:unknown):v is string=>typeof v==='string' && /^[A-Za-z0-9_-]{22,80}$/.test(v);
export type P13Auth={uid:string;key:{PK:string;SK:string};authenticatedAt:number;familyId?:string;slot?:number};
const familyPublic=(item:Record<string,any>)=>({uid:item.uid,slot:item.slot,familyId:item.familyId,generation:item.generation,reauthAt:item.reauthAt,inactiveAt:item.inactiveAt});

export function registerDeviceSessionRoutes(app:FastifyInstance,db:DynamoDBDocumentClient,legacySecret:string,requireSession:(request:FastifyRequest,reply:FastifyReply,eligibility?:boolean)=>Promise<P13Auth|null>) {
  const keys=p13Keys(legacySecret);
  const getFamily=async(uid:string,slot:number)=>
    (await db.send(new GetCommand({TableName:AUTH,Key:familyKey(uid,slot),ConsistentRead:true}))).Item as Record<string,any>|undefined;
  const freshToken=()=>randomBytes(32).toString('base64url');
  const addAccess=(uid:string,epoch:number,familyId:string,slot:number,reauthAt:number,createdAt:number,token:string):NonNullable<TransactWriteCommandInput['TransactItems']>[number]=>({Put:{TableName:AUTH,Item:{...accessKey(accessDigest(keys.access,token)),uid,kind:'session',createdAt,sessionEpoch:epoch,expiresAt:Math.min(createdAt+P13_ACCESS_SECONDS,reauthAt),familyId,familySlot:slot,keyId:P13_KEY_ID},ConditionExpression:'attribute_not_exists(PK)'}});
  // Proof of the existing interactive login is necessary; legacy tokens cannot silently enroll.
  app.post('/v1/auth/device/enroll',async(request,reply)=>{
    const auth=await requireSession(request,reply);
    if(!auth)return reply;
    const data=body(request.body),publicKey=data.publicKey,signature=data.signature,nonce=data.nonce;
    if(typeof publicKey!=='string'||typeof signature!=='string'||!validNonce(nonce))return fail(reply,400,'invalid_device_proof');
    if(now()-auth.authenticatedAt>600 || auth.familyId)return fail(reply,403,'recent_auth_required');
    const legacyToken=(request.headers.authorization??'').replace(/^Bearer /,'');
    if(!validToken(legacyToken))return fail(reply,401,'authentication_required');
    const epochItem=(await db.send(new GetCommand({TableName:USERS,Key:userKey(auth.uid),ConsistentRead:true}))).Item;
    if(!epochItem)return fail(reply,403,'account_unavailable');
    const epoch=Number(epochItem.sessionEpoch??0);
    const slot=data.slot, familyId=data.familyId;
    if(!validSlot(slot)||!validId(familyId))return fail(reply,400,'invalid_device_request');
    if(!deviceProofValid(publicKey,proofText('enroll',auth.uid,slot,familyId,0,legacyToken,nonce),signature))
      return fail(reply,401,'invalid_device_proof');
    const t=now(), reauthAt=auth.authenticatedAt+P13_REAUTH_SECONDS;
    const renewable=freshToken(),access=freshToken();
    const inactiveAt=Math.min(t+P13_INACTIVITY_SECONDS,reauthAt);
    const previous=await getFamily(auth.uid,slot);
    const items:NonNullable<TransactWriteCommandInput['TransactItems']>=[
      {ConditionCheck:{TableName:USERS,Key:userKey(auth.uid),ConditionExpression:'#s = :active AND ageEligibility = :adult AND (attribute_not_exists(sessionEpoch) OR sessionEpoch = :epoch)',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult',':epoch':epoch}}},
      {Put:{TableName:AUTH,Item:{...familyKey(auth.uid,slot),uid:auth.uid,slot,familyId,generation:0,refreshDigest:refreshDigest(keys.refresh,renewable),status:'active',sessionEpoch:epoch,interactiveAt:auth.authenticatedAt,reauthAt,inactiveAt,publicKey,keyId:P13_KEY_ID,createdAt:t,updatedAt:t,expiresAt:reauthAt+604800},ConditionExpression:'attribute_not_exists(PK) OR #state <> :active OR reauthAt <= :now OR inactiveAt <= :now',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':active':'active',':now':t}}},
      {Delete:{TableName:AUTH,Key:auth.key,ConditionExpression:'uid = :uid AND createdAt = :createdAt',ExpressionAttributeValues:{':uid':auth.uid,':createdAt':auth.authenticatedAt}}},
      addAccess(auth.uid,epoch,familyId,slot,reauthAt,t,access)
    ];
    if(previous?.status==='active' && Number(previous.reauthAt)>t && Number(previous.inactiveAt)>t)return fail(reply,409,'device_slot_in_use');
    try {
      await db.send(new TransactWriteCommand({TransactItems:items}));
      reply.header('Cache-Control','no-store');
      return {token:access,expiresInSeconds:P13_ACCESS_SECONDS,refreshToken:renewable,keyId:P13_KEY_ID,account:{uniqueId:auth.uid},device:{uid:auth.uid,slot,familyId,generation:0,reauthAt,inactiveAt}};
    }catch(error){return fail(reply,conflict(error)?409:503,conflict(error)?'device_slot_in_use':'auth_store_unavailable');}
  });

  async function signedFamily(request:FastifyRequest,reply:FastifyReply,op:'refresh'|'logout') {
    const data=body(request.body),uid=data.uid,slot=data.slot,familyId=data.familyId,refreshToken=data.refreshToken,generation=data.generation,nonce=data.nonce,signature=data.signature;
    if(!validId(uid)||!validSlot(slot)||!validId(familyId)||!validToken(refreshToken)||typeof generation!=='number'||!Number.isSafeInteger(generation)||generation<0||!validNonce(nonce)||typeof signature!=='string'){
      fail(reply,400,'invalid_device_request');return null;
    }
    try {
      const family=await getFamily(uid,slot);
      if(!family || family.familyId!==familyId || family.status!=='active') {fail(reply,401,'refresh_expired_or_revoked');return null;}
      const stamp=now();
      if(Number(family.reauthAt)<=stamp || Number(family.inactiveAt)<=stamp){fail(reply,401,'reauthentication_required');return null;}
      // Validity of binding is checked *before* digest/generation, without leaking either.
      if(!deviceProofValid(family.publicKey,proofText(op,uid,slot,familyId,generation,refreshToken,nonce),signature)){
        fail(reply,401,'invalid_device_proof');return null;
      }
      if(Number(family.generation)!==generation || family.refreshDigest!==refreshDigest(keys.refresh,refreshToken)){
        // Replay is rejected; do not disclose whether a token was previously consumed.
        fail(reply,401,'refresh_reused_or_revoked');return null;
      }
      const user=(await db.send(new GetCommand({TableName:USERS,Key:userKey(uid),ConsistentRead:true}))).Item;
      if(!user || user.status!=='active'|| user.ageEligibility!=='self_declared_adult'||Number(user.sessionEpoch??0)!==Number(family.sessionEpoch)){
        fail(reply,401,'refresh_expired_or_revoked');return null;
      }
      return {family,uid,slot,familyId,refreshToken,generation,stamp};
    }catch{fail(reply,503,'auth_store_unavailable');return null;}
  }

  app.post('/v1/auth/device/refresh',async(request,reply)=>{
    const signed=await signedFamily(request,reply,'refresh');if(!signed)return reply;
    const {family,uid,slot,familyId,generation,stamp}=signed;
    const next=freshToken(), access=freshToken();
    const inactiveAt=Math.min(stamp+P13_INACTIVITY_SECONDS,Number(family.reauthAt));
    const items:NonNullable<TransactWriteCommandInput['TransactItems']>=[
      {ConditionCheck:{TableName:USERS,Key:userKey(uid),ConditionExpression:'#state = :active AND ageEligibility = :adult AND (attribute_not_exists(sessionEpoch) OR sessionEpoch = :epoch)',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult',':epoch':family.sessionEpoch}}},
      {Update:{TableName:AUTH,Key:familyKey(uid,slot),UpdateExpression:'SET refreshDigest = :next, generation = :newGeneration, inactiveAt = :inactive, updatedAt = :now',ConditionExpression:'familyId = :family AND generation = :generation AND refreshDigest = :old AND #state = :active AND reauthAt > :now AND inactiveAt > :now',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':next':refreshDigest(keys.refresh,next),':newGeneration':generation+1,':inactive':inactiveAt,':now':stamp,':family':familyId,':generation':generation,':old':family.refreshDigest,':active':'active'}}},
      addAccess(uid,Number(family.sessionEpoch),familyId,slot,Number(family.reauthAt),stamp,access)
    ];
    try {
      await db.send(new TransactWriteCommand({TransactItems:items}));
      reply.header('Cache-Control','no-store');
      return {token:access,expiresInSeconds:P13_ACCESS_SECONDS,refreshToken:next,keyId:P13_KEY_ID,device:{uid,slot,familyId,generation:generation+1,reauthAt:family.reauthAt,inactiveAt}};
    }catch(error){return fail(reply,conflict(error)?401:503,conflict(error)?'refresh_reused_or_revoked':'auth_store_unavailable');}
  });

  // A signed refresh credential can revoke its own family even after access expiry.
  app.post('/v1/auth/device/logout',async(request,reply)=>{
    const signed=await signedFamily(request,reply,'logout');if(!signed)return reply;
    try {
      await db.send(new UpdateCommand({TableName:AUTH,Key:familyKey(signed.uid,signed.slot),UpdateExpression:'SET #state = :revoked, revokedAt = :now',ConditionExpression:'familyId = :family AND generation = :generation AND refreshDigest = :digest AND #state = :active',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':revoked':'revoked',':now':signed.stamp,':family':signed.familyId,':generation':signed.generation,':digest':signed.family.refreshDigest,':active':'active'}}));
      return {status:'signed_out'};
    }catch(error){return fail(reply,conflict(error)?401:503,conflict(error)?'refresh_reused_or_revoked':'auth_store_unavailable');}
  });

  app.get('/v1/auth/device/list',async(request,reply)=>{
    const auth=await requireSession(request,reply);if(!auth)return reply;
    try {
      const family=await Promise.all(Array.from({length:P13_MAX_DEVICES},(_,slot)=>getFamily(auth.uid,slot)));
      reply.header('Cache-Control','no-store');
      return {devices:family.filter(item=>item && item.status==='active' && Number(item.reauthAt)>now()).map(item=>familyPublic(item!))};
    }catch{return fail(reply,503,'auth_store_unavailable');}
  });

  app.post('/v1/auth/device/revoke',async(request,reply)=>{
    const auth=await requireSession(request,reply);if(!auth)return reply;
    const data=body(request.body);
    if(!validSlot(data.slot)||!validId(data.familyId))return fail(reply,400,'invalid_device_request');
    try {
      await db.send(new UpdateCommand({TableName:AUTH,Key:familyKey(auth.uid,data.slot),UpdateExpression:'SET #state = :revoked, revokedAt = :now',ConditionExpression:'familyId = :family AND #state = :active',ExpressionAttributeNames:{'#state':'status'},ExpressionAttributeValues:{':revoked':'revoked',':now':now(),':family':data.familyId,':active':'active'}}));
      return {status:'revoked'};
    }catch(error){return fail(reply,conflict(error)?404:503,conflict(error)?'device_not_found':'auth_store_unavailable');}
  });

  return {accessKey:(token:string)=>accessKey(accessDigest(keys.access,token)),familyKey,getFamily};
}
