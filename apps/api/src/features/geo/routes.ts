import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { latLngToCell, cellToLatLng } from 'h3-js';
import { IndiaCatalogue, type PackMeta } from './india-catalogue.js';
import { localPublicAsset, readVerifiedGeoPack, readGeoDeliveryConfig, isPublicGeoPackPath, geoFailureCategory, type GeoAssetAudit, type GeoDeliveryConfiguration } from './catalogue-delivery.js';
import { createHash } from 'node:crypto';
import { parseManualLocation, parseGpsLocation } from './validation.js';
import { indiaBoundaryLoader } from './india-boundary.js';
const settingsTable='uluv_settings', usersTable='uluv_users';
type Session = (request:FastifyRequest,reply:FastifyReply)=>Promise<{uid:string}|null>;
const key=(uid:string)=>({PK:`USER#${uid}`,SK:'SETTINGS'});
const failure=(reply:FastifyReply,status:number,error:string)=>reply.code(status).send({error});

/** Distinct from P03-1 15-city catalogue. Does NOT activate public discovery. */
export function registerIndiaGeoRoutes(app:FastifyInstance, db:DynamoDBDocumentClient, guard:Session):void {
  // Verified ~1.3 MB GeoJSON; cached for the lifetime of this Fastify process.
  // No S3/CloudFront request for GPS, even if GeoNames packs live in S3.
  const getBoundary=indiaBoundaryLoader();
  // Warm once during API boot. A missing/tampered file stays fail-closed;
  // manual location selection and other API routes remain available.
  void getBoundary().then(()=>app.log.info({geoEvent:'gps.boundary.ready'},'[GEO] GPS India boundary verified and loaded'))
    .catch(()=>app.log.warn({geoEvent:'gps.boundary.unavailable',reason:'missing_or_invalid_boundary'},'[GEO] GPS validation unavailable: boundary file invalid/missing'));
  // Log only fixed route patterns; never log query parameters, tokens, user IDs,
  // selected place names, GPS fixes or request/response bodies.
  app.addHook('onRequest',(request,reply,done)=>{
    if(/^\/v1\/(?:geo\/india|me\/geo)(?:\/|$)/.test(request.url.split('?')[0])) {
      reply.header('X-ULUV-Geo-Request-Id',String(request.id));
    }
    done();
  });
  const audit=(request:FastifyRequest):GeoAssetAudit=>(event,details)=>{
    const record={geoEvent:event,requestId:request.id,...details};
    const summary=`[GEO] ${event} [${request.id}]`;
    if(event.endsWith('.failed') || event.endsWith('.error'))request.log.warn(record,summary);
    else request.log.info(record,summary);
  };
  const failStage=(request:FastifyRequest,stage:string,error:unknown)=>{
    const reason=geoFailureCategory(error);
    request.log.error({geoEvent:'api.stage.failed',requestId:request.id,stage,reason,
      ...(error instanceof Error && 'status' in error && typeof error.status==='number' ? {upstreamStatus:error.status} : {})},
      `[GEO ERROR] ${stage}: ${reason} [${request.id}]`);
  };

  let cataloguePromise:Promise<IndiaCatalogue>|null=null;
  let config:GeoDeliveryConfiguration|undefined;
  const catalogue=(request:FastifyRequest):Promise<IndiaCatalogue>=>{
    if(!cataloguePromise) {
      try {
        config=readGeoDeliveryConfig();
        audit(request)('config.validated',{mode:config.mode,
          origin:config.publicBaseUrl??'local_filesystem',
          canonicalShaPrefix:config.canonicalManifestSha256.slice(0,12)});
        cataloguePromise=IndiaCatalogue.open(config,undefined,audit(request)).then(c=>{
          audit(request)('catalogue.ready',{version:c.manifest.catalogueVersion});
          return c;
        }).catch(e=>{
          cataloguePromise=null;
          failStage(request,'catalogue.bootstrap',e);
          throw e;
        });
      }catch(e){
        failStage(request,'configuration',e);
        return Promise.reject(e);
      }
    } // Ready catalogue reuse is expected; avoid spamming per-request logs.
    return cataloguePromise;
  };
  const noStore=(reply:FastifyReply)=>reply.header('Cache-Control','no-store');
  async function authorised(request:FastifyRequest,reply:FastifyReply){
    noStore(reply);return await guard(request,reply);
  }
  const checksum=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  const assetMeta=(catalog:IndiaCatalogue,path:string):PackMeta|undefined=>{
    for(const state of catalog.manifest.states){
      for(const district of state.districts){if(district.path===path)return district;}
      if(state.unmapped?.path===path)return state.unmapped;
    }
    return catalog.manifest.countryUnmapped?.path===path?catalog.manifest.countryUnmapped:undefined;
  };
  async function localAsset(c:IndiaCatalogue, path:string):Promise<Buffer|null>{
    if(!config || config.mode!=='local')return null;
    if(path==='manifest.json') {
      const b=await localPublicAsset(config,path);
      if(checksum(b)!==c.publicManifestSha256)return null;
      return b;
    }
    if(!isPublicGeoPackPath(path))return null;
    const meta=assetMeta(c,path);
    if(!meta)return null;
    const b=await localPublicAsset(config,path);
    if(b.length!==meta.bytes || checksum(b)!==meta.sha256)return null;
    return b;
  }

  /** Only this authenticated API reply gives Flutter the public CDN origin.
   * A public manifest includes no server lookup shards or account data.
   */
  app.get('/v1/geo/india/delivery',async(request,reply)=>{
    if(!await authorised(request,reply))return reply;
    try{
      const c=await catalogue(request);
      if(!config)return failure(reply,503,'geo_delivery_not_configured');
      const version=c.manifest.catalogueVersion;
      return {schemaVersion:1,provider:config.mode,catalogueVersion:version,
        rootUrl:config.mode==='s3_cloudfront'?config.publicBaseUrl:`/v1/geo/india/catalogue/${version}/`,
        manifestPath:'manifest.json',manifestSha256:c.publicManifestSha256,
        requiresAuthorization:config.mode==='local'};
    }catch(e){failStage(request,'delivery',e);return failure(reply,503,'geo_delivery_not_configured');}
  });
  // Local-only public assets can be served from a separate data directory.
  // CDN deployment never routes asset bytes through the API.
  app.get<{Params:{version:string;'*':string}}>('/v1/geo/india/catalogue/:version/*',async(request,reply)=>{
    if(!await authorised(request,reply))return reply;
    try{
      const c=await catalogue(request);
      if(config?.mode!=='local')return failure(reply,404,'geo_local_delivery_disabled');
      if(request.params.version!==c.manifest.catalogueVersion)return failure(reply,404,'geo_catalogue_version_unknown');
      const bytes=await localAsset(c,request.params['*']);
      if(!bytes)return failure(reply,404,'geo_static_asset_not_found');
      return reply.header('Cache-Control','private, max-age=86400')
        .header('X-Content-Type-Options','nosniff')
        .type('application/json; charset=utf-8').send(bytes);
    }catch(e){failStage(request,'local_asset',e);return failure(reply,503,'geo_static_asset_unavailable');}
  });
  app.get('/v1/geo/india/manifest',async(request,reply)=>{
    if(!await authorised(request,reply))return reply;
    try{return JSON.parse((await catalogue(request)).publicManifest.toString('utf8')) as unknown;}
    catch(e){failStage(request,'manifest',e);return failure(reply,503,'geo_catalogue_unavailable');}
  });
  /** Authenticated safety fallback when Android cannot fetch the public CDN
   * directly. Reads the same SHA-pinned release; no raw place/selection data
   * goes to S3. Fastify streams at most the approved 2 MB per request.
   */
  app.get<{Params:{state:string;district:string}}>('/v1/geo/india/packs/:state/:district',async(request,reply)=>{
    if(!await authorised(request,reply))return reply;
    const {state,district}=request.params;
    if(!/^\d{1,4}$/.test(state) && state!=='unresolved')return failure(reply,404,'district_not_found');
    if(!/^\d{1,6}$/.test(district) && district!=='unmapped')return failure(reply,404,'district_not_found');
    const path=state==='unresolved'&&district==='unmapped'?'country-unmapped.json':
      district==='unmapped'?`states/${state}/unmapped.json`:`states/${state}/districts/${district}.json`;
    try{
      const c=await catalogue(request);
      const meta=assetMeta(c,path);
      if(!meta || !config)return failure(reply,404,'district_not_found');
      // Android sends only an enumerated CDN failure code with fallback requests.
      // This is a diagnostic hint, NOT a trusted client assertion.
      const phoneFailure=request.headers['x-uluv-geo-cdn-failure'];
      if(typeof phoneFailure==='string' && /^(?:no_delivery|network|timeout|sha_mismatch|other|http_(?:400|401|403|404|408|429|500|502|503|504))$/.test(phoneFailure)) {
        audit(request)('client.cdn_fallback',{asset:path,phoneFailure,
          origin:config.publicBaseUrl??'local_filesystem'});
      }
      const bytes=config.mode==='local' ? await localAsset(c,path) :
        await readVerifiedGeoPack(config,path,meta,fetch,audit(request));
      if(!bytes || bytes.length!==meta.bytes || checksum(bytes)!==meta.sha256){
        return failure(reply,503,'geo_pack_integrity_failed');
      }
      return reply.header('Cache-Control','private, max-age=86400')
        .header('X-Content-Type-Options','nosniff')
        .type('application/json; charset=utf-8').send(bytes);
    }catch(e){failStage(request,'district_pack',e);return failure(reply,503,'geo_pack_unavailable');}
  });
  app.get('/v1/me/geo/location',async(request,reply)=>{
    const auth=await authorised(request,reply);if (!auth)return reply;
    try {
      const row=(await db.send(new GetCommand({TableName:settingsTable,Key:key(auth.uid),ConsistentRead:true}))).Item;
      if (!row)return failure(reply,409,'settings_not_initialized');
      audit(request)('account.location.read',{found:row.geoSelectionSource==='manual_geonames'||row.geoSelectionSource==='gps_selected',
        source:row.geoSelectionSource==='manual_geonames'?'manual_geonames':row.geoSelectionSource==='gps_selected'?'gps_selected':'none',
        revision:Number.isSafeInteger(row.settingsRevision)?row.settingsRevision:0});
      return {settingsRevision:row.settingsRevision??0,localityRevision:row.localityRevision??0,
        location:row.geoSelectionSource==='manual_geonames' ? {
          id:row.geoGeonameId,stateCode:row.geoStateCode,districtCode:row.geoDistrictCode,
          name:row.geoSelectionLabel,source:'manual_geonames'} :
          row.geoSelectionSource==='gps_selected' ? {name:'Approximate location in India',source:'gps_selected'} : null,
        gpsAvailable:await getBoundary().then(()=>true,()=>false),discoveryEnabled:false};
    }catch(e){failStage(request,'account_location_read',e);return failure(reply,503,'geo_settings_unavailable');}
  });
  app.put('/v1/me/geo/manual',async(request,reply)=>{
    const auth=await authorised(request,reply);if(!auth)return reply;
    const input=parseManualLocation(request.body);
    if(!input)return failure(reply,400,'invalid_geo_selection');
    try {
      const catalog=await catalogue(request);
      if(catalog.manifest.catalogueVersion!==input.catalogueVersion)return failure(reply,409,'geo_catalogue_version_conflict');
      const point=await catalog.resolvePlace(input.geonameId,input.catalogueVersion);
      if(!point)return failure(reply,404,'geo_place_unknown');
      const chosenState=catalog.manifest.states.find(s=>s.code===point.state);
      const knownDistrict=chosenState?.districts.some(d=>d.code===point.district) ?? false;
      const actualDistrict=knownDistrict?point.district:null;
      const actualState=chosenState?point.state:'unresolved';
      if(actualState!==input.stateCode || actualDistrict!==input.districtCode) {
        return failure(reply,400,'geo_provenance_mismatch');
      }
      const item=(await db.send(new GetCommand({TableName:settingsTable,Key:key(auth.uid),ConsistentRead:true}))).Item;
      if(!item)return failure(reply,409,'settings_not_initialized');
      const rev=Number(item.settingsRevision??0);
      if(!Number.isSafeInteger(rev) || rev!==input.expectedRevision)return failure(reply,409,'settings_revision_conflict');
      const prev=item.geoSelectionSource==='manual_geonames'?String(item.geoGeonameId??''):'';
      const changed=prev!==point.id || item.geoSelectionSource!=='manual_geonames';
      const prevLocality=Number(item.localityRevision??0);
      if(!Number.isSafeInteger(prevLocality) || prevLocality<0)return failure(reply,409,'settings_revision_conflict');
      const nowEpoch=Math.floor(Date.now()/1000);
      const last=Number(item.geoLocationUpdatedEpoch??0);
      if(last>nowEpoch-15)return failure(reply,429,'geo_location_change_cooldown');
      const cell=latLngToCell(point.lat,point.lng,6);
      const [lat,lng]=cellToLatLng(cell);
      // Crosswalk names are for display only. Resolve the original place name
      // from the published pack for matching administrative membership.
      const state=chosenState;
      const district=state?.districts.find(d=>d.code===point.district);
      const label=knownDistrict ? `${point.name}, ${district?.name??'Unmapped district'}, ${state?.name??'India'}`:
        `${point.name}, ${state?.name??'Unresolved state'}, India`; 
      await db.send(new TransactWriteCommand({TransactItems:[
        {ConditionCheck:{TableName:usersTable,Key:{PK:`USER#${auth.uid}`,SK:'META'},
          ConditionExpression:'#status = :active AND ageEligibility = :adult',
          ExpressionAttributeNames:{'#status':'status'},
          ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult'}}},
        {Update:{TableName:settingsTable,Key:key(auth.uid),
          UpdateExpression:'SET settingsRevision=:newrev, localityRevision=:locrev, geoGeonameId=:place, '+
            'geoStateCode=:state, geoDistrictCode=:district, geoSelectionLabel=:label, '+
            'geoApprovedCenter=:center, geoH3Cell=:cell, geoSelectionSource=:source, '+
            'geoCatalogueVersion=:version, geoLocationUpdatedAt=:now, geoLocationUpdatedEpoch=:epoch',
          ConditionExpression:'attribute_exists(PK) AND '+(rev===0?'attribute_not_exists(settingsRevision)':'settingsRevision=:expected')+
            ' AND (attribute_not_exists(geoLocationUpdatedEpoch) OR geoLocationUpdatedEpoch <= :cutoff)',
          ExpressionAttributeValues:{':newrev':rev+1,':locrev':prevLocality+(changed?1:0),
            ':place':point.id,':state':point.state,':district':actualDistrict,
            ':label':label,':center':{lat,lng},':cell':cell,':source':'manual_geonames',':version':input.catalogueVersion,
            ':now':new Date().toISOString(),':epoch':nowEpoch,':cutoff':nowEpoch-15,
            ...(rev===0?{}:{':expected':rev})}}}
      ]}));
      audit(request)('account.location.save.committed',{source:'manual_geonames',revision:rev+1});
      return {settingsRevision:rev+1,localityRevision:prevLocality+(changed?1:0),
        location:{id:point.id,stateCode:actualState,districtCode:actualDistrict,name:label,source:'manual_geonames'},
        gpsAvailable:await getBoundary().then(()=>true,()=>false),discoveryEnabled:false};
    } catch(e) {
      if(e instanceof Error && ['TransactionCanceledException','ConditionalCheckFailedException'].includes(e.name))return failure(reply,409,'settings_revision_conflict');
      failStage(request,'manual_location_save',e);
      return failure(reply,503,'geo_selection_unavailable');
    }
  });
  app.post('/v1/me/geo/gps',async(request,reply)=>{
    const auth=await authorised(request,reply);if(!auth)return reply;
    const fix=parseGpsLocation(request.body);
    if(!fix)return failure(reply,400,'gps_fix_invalid_stale_or_inaccurate');
    try {
      // The trusted polygon is bundled with Fastify; no external API or reverse geocoding.
      const boundary=await getBoundary();
      if(!boundary.contains(fix.lat,fix.lng))return failure(reply,400,'gps_outside_supported_india_boundary');
    }catch(e){failStage(request,'gps_boundary_validation',e);return failure(reply,503,'gps_india_boundary_not_configured');}
    try {
      const item=(await db.send(new GetCommand({TableName:settingsTable,Key:key(auth.uid),ConsistentRead:true}))).Item;
      if(!item)return failure(reply,409,'settings_not_initialized');
      const rev=Number(item.settingsRevision??0);
      if(!Number.isSafeInteger(rev)||rev!==fix.expectedRevision)return failure(reply,409,'settings_revision_conflict');
      const prior=Number(item.localityRevision??0);
      if(!Number.isSafeInteger(prior)||prior<0)return failure(reply,409,'settings_revision_conflict');
      const nowEpoch=Math.floor(Date.now()/1000);
      if(Number(item.geoLocationUpdatedEpoch??0)>nowEpoch-15)return failure(reply,429,'geo_location_change_cooldown');
      const cell=latLngToCell(fix.lat,fix.lng,6);
      const [lat,lng]=cellToLatLng(cell);
      const changed=item.geoSelectionSource!=='gps_selected'||item.geoH3Cell!==cell;
      // Never log, persist, return, or expose fix.lat/fix.lng or fixTimestamp.
      await db.send(new TransactWriteCommand({TransactItems:[
        {ConditionCheck:{TableName:usersTable,Key:{PK:`USER#${auth.uid}`,SK:'META'},
          ConditionExpression:'#status = :active AND ageEligibility = :adult',
          ExpressionAttributeNames:{'#status':'status'},
          ExpressionAttributeValues:{':active':'active',':adult':'self_declared_adult'}}},
        {Update:{TableName:settingsTable,Key:key(auth.uid),
          UpdateExpression:'SET settingsRevision=:newrev, localityRevision=:locrev, '+
            'geoApprovedCenter=:center, geoH3Cell=:cell, geoSelectionSource=:source, '+
            'geoSelectionLabel=:label, geoLocationUpdatedAt=:now, geoLocationUpdatedEpoch=:epoch '+
            'REMOVE geoGeonameId, geoStateCode, geoDistrictCode, geoCatalogueVersion',
          ConditionExpression:'attribute_exists(PK) AND '+(rev===0?'attribute_not_exists(settingsRevision)':'settingsRevision=:expected')+
            ' AND (attribute_not_exists(geoLocationUpdatedEpoch) OR geoLocationUpdatedEpoch <= :cutoff)',
          ExpressionAttributeValues:{':newrev':rev+1,':locrev':prior+(changed?1:0),
            ':center':{lat,lng},':cell':cell,':source':'gps_selected',
            ':label':'Approximate location in India',':now':new Date().toISOString(),
            ':epoch':nowEpoch,':cutoff':nowEpoch-15,
            ...(rev===0?{}:{':expected':rev})}}}
      ]}));
      audit(request)('account.location.save.committed',{source:'gps_selected',revision:rev+1});
      return {settingsRevision:rev+1,localityRevision:prior+(changed?1:0),
        location:{name:'Approximate location in India',source:'gps_selected'},
        gpsAvailable:true,discoveryEnabled:false};
    }catch(e){
      if(e instanceof Error && ['TransactionCanceledException','ConditionalCheckFailedException'].includes(e.name))
        return failure(reply,409,'settings_revision_conflict');
      failStage(request,'gps_location_save',e);
      return failure(reply,503,'gps_selection_unavailable');
    }
  });
}
