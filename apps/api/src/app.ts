import Fastify from 'fastify';
import {randomUUID, timingSafeEqual} from 'node:crypto';
import {GetCommand, PutCommand, QueryCommand, DeleteCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import type {AppConfig} from './config.js';
import {registerLocalEmailAuth} from './features/auth/routes.js';

const operationsTable='uluv_operations';
function equalDevToken(expected: string|undefined, supplied: string|undefined): boolean {
  if (!expected || !supplied) return false;
  const a=Buffer.from(expected); const b=Buffer.from(supplied);
  return a.length===b.length && timingSafeEqual(a,b);
}

export function buildApp(config:AppConfig, db:DynamoDBDocumentClient) {
  const app=Fastify({logger:{level:config.env==='test'?'silent':'info',redact:{paths:['req.headers.authorization','req.headers.cookie','req.headers.x-uluv-dev-key','req.url','res.headers.set-cookie'],remove:true}},bodyLimit:16*1024});
  app.get('/health/live',async()=>({status:'ok',service:'uluv-api'}));
  app.get('/health/ready',async(_request, reply)=>{
    try {
      const result=await db.send(new GetCommand({TableName:operationsTable,Key:{PK:'SYSTEM#P00',SK:'HEALTH'},ConsistentRead:true}));
      if(result.Item?.status!=='ready') throw new Error('Health sentinel absent');
      return {status:'ok',database:'connected',service:'uluv-api'};
    }catch(_e){ reply.code(503); return {status:'unavailable',database:'not_ready'}; }
  });
  // Never register local diagnostic mutating routes outside explicit local mode.
  if(config.env==='local') {
    app.post('/v1/dev/db-roundtrip',async(request,reply)=>{
      const token=request.headers['x-uluv-dev-key'];
      if(typeof token!=='string'||!equalDevToken(config.devToken,token)){
        reply.code(403);return {error:'forbidden'};
      }
      const id=randomUUID();
      const key={PK:`P00#TEST#${id}`,SK:'ROUNDTRIP'};
      let writeSucceeded=false;
      try {
        await db.send(new PutCommand({TableName:operationsTable,Item:{...key,nonce:id,expiresAt:Math.floor(Date.now()/1000)+300},ConditionExpression:'attribute_not_exists(PK)'}));
        writeSucceeded=true;
        const read=await db.send(new GetCommand({TableName:operationsTable,Key:key,ConsistentRead:true}));
        const listed=await db.send(new QueryCommand({TableName:operationsTable,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':key.PK},ConsistentRead:true}));
        if(read.Item?.nonce!==id||listed.Items?.length!==1||listed.Items[0]?.nonce!==id) throw new Error('roundtrip mismatch');
        await db.send(new DeleteCommand({TableName:operationsTable,Key:key}));
        writeSucceeded=false;
        const deleted=await db.send(new GetCommand({TableName:operationsTable,Key:key,ConsistentRead:true}));
        if(deleted.Item) throw new Error('roundtrip delete not visible');
        return {status:'ok',database:'connected',roundtrip:{put:true,get:true,query:true,delete:true}};
      }catch(_e){reply.code(503);return {status:'unavailable',error:'db_roundtrip_failed'};}
      finally {if(writeSucceeded){try{await db.send(new DeleteCommand({TableName:operationsTable,Key:key}));}catch{app.log.warn('fixture cleanup failed');}}}
    });
  }
  if(config.env==='local' || (config.env==='test' && config.devToken)) registerLocalEmailAuth(app,db,config);
  app.setErrorHandler((error,_req,reply)=>{
    // Fastify can deliver non-Error throwables. Log only a safe category, never raw payloads.
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    app.log.error({errorName},'request failed');
    reply.code(500).send({error:'internal_error'});
  });
  return app;
}
