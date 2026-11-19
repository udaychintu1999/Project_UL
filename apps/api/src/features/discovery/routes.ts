/** P03-4 authenticated people discovery. P03-5 supplies the Flutter UI.
 * The endpoint returns only canonical, block-checked, media-verified previews,
 * never raw pointers, profile records, exact location, or a public user ID. */
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {authenticatedDiscoveryPage} from './hydration-service.js';
import {parseDiscoveryQuery} from './request-policy.js';

type Guard=(request:FastifyRequest,reply:FastifyReply)=>Promise<{uid:string}|null>;
const fail=(reply:FastifyReply,status:number,code:string)=>reply.code(status).send({error:code});
export function registerDiscoveryRoutes(app:FastifyInstance,db:DynamoDBDocumentClient,
  guard:Guard,serverSecret:string):void {
  if(typeof serverSecret!=='string'||serverSecret.length<24)
    throw new Error('discovery_cursor_secret_unavailable');
  app.get('/v1/discovery/people',async(request,reply)=>{
    reply.header('Cache-Control','private, no-store');
    const auth=await guard(request,reply);
    if(!auth)return reply;
    const input=parseDiscoveryQuery(request.query);
    if(!input)return fail(reply,400,'invalid_discovery_request');
    try{
      const result=await authenticatedDiscoveryPage(db,{
        ...input,uid:auth.uid,cursorSecret:`p03-4-hydration:${serverSecret}`});
      return {mode:input.mode.toLowerCase(),distanceBand:result.distanceBand,
        sortMode:result.sortMode,ordering:result.ordering,
        items:result.items,nextCursor:result.nextCursor};
    }catch(error){
      if(error instanceof Error){
        if(['invalid_or_stale_discovery_cursor','viewer_context_changed'].includes(error.message))
          return fail(reply,409,'discovery_context_changed');
        if(error.message==='discovery_not_eligible')return fail(reply,403,'discovery_not_eligible');
        if(['invalid_discovery_request','invalid_discovery_cursor'].includes(error.message))
          return fail(reply,400,'invalid_discovery_request');
      }
      return fail(reply,503,'discovery_unavailable');
    }
  });
}
