/** P03-1 minimal private Settings preferences, separate from P02 setupRevision.
 * No discovery feed or location pointer publication in this slice.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

type Guard=(req:FastifyRequest,reply:FastifyReply)=>Promise<{uid:string}|null>;
import { parseDiscoveryPreferences } from './validation.js';
export function registerGeoPreferenceRoutes(app:FastifyInstance,db:DynamoDBDocumentClient,guard:Guard):void {
  const table='uluv_settings';
  const key=(uid:string)=>({PK:`USER#${uid}`,SK:'SETTINGS'});
  const fail=(reply:FastifyReply,code:number,reason:string)=>reply.code(code).send({error:reason});
  const view=(row:Record<string,unknown>)=>({
    settingsRevision:typeof row.settingsRevision==='number'?row.settingsRevision:0,
    localityRevision:typeof row.localityRevision==='number'?row.localityRevision:0,
    distanceBand:['0-10','10-35','35-50','0-50'].includes(String(row.geoDistanceBand))?row.geoDistanceBand:'0-50',
    sortMode:['near_band_first','recent_first'].includes(String(row.geoSortMode))?row.geoSortMode:'near_band_first',
    locationSource:row.geoSelectionSource==='manual_geonames'?'manual_geonames':row.geoSelectionSource==='gps_selected'?'gps_selected':null,
    locationName:typeof row.geoSelectionLabel==='string'?row.geoSelectionLabel:null,
    discoveryEnabled:false
  });
  app.get('/v1/me/settings',async(req,reply)=>{
    reply.header('Cache-Control','no-store');
    const auth=await guard(req,reply);if(!auth)return reply;
    try{
      const row=(await db.send(new GetCommand({TableName:table,Key:key(auth.uid),ConsistentRead:true}))).Item;
      if(!row)return fail(reply,409,'settings_not_initialized');
      return view(row);
    }catch{return fail(reply,503,'settings_unavailable');}
  });
  app.put('/v1/me/settings',async(req,reply)=>{
    reply.header('Cache-Control','no-store');
    const auth=await guard(req,reply);if(!auth)return reply;
    const x=parseDiscoveryPreferences(req.body);if(!x)return fail(reply,400,'invalid_preferences');
    try{
      const newRevision=x.expectedRevision+1;
      const result=await db.send(new UpdateCommand({TableName:table,Key:key(auth.uid),
        UpdateExpression:'SET geoDistanceBand=:band, geoSortMode=:sort, settingsRevision=:newRevision',
        ConditionExpression:'attribute_exists(PK) AND '+(x.expectedRevision===0?
          'attribute_not_exists(settingsRevision)':'settingsRevision=:expected'),
        ExpressionAttributeValues:{':band':x.distanceBand,':sort':x.sortMode,':newRevision':newRevision,
          ...(x.expectedRevision===0?{}:{':expected':x.expectedRevision})},ReturnValues:'ALL_NEW'}));
      return view(result.Attributes??{});
    }catch(e){
      if(e instanceof Error && e.name==='ConditionalCheckFailedException')return fail(reply,409,'settings_revision_conflict');
      return fail(reply,503,'settings_unavailable');
    }
  });
}
