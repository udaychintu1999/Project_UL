/** P03-4 owner-run Fastify inject + real JAVA DynamoDB Local.
 * Synthetic isolated accounts and R6 cells only; no cloud calls/real users. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,DeleteCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {latLngToCell,cellToLatLng} from 'h3-js';
import {assertLocalDynamoEndpoint} from '../../src/local-safety.js';
import {registerDiscoveryRoutes} from '../../src/features/discovery/routes.js';

const endpoint=assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000');
if(process.env.APP_ENV!=='local')throw new Error('P03_4_REQUIRES_LOCAL_DYNAMODB');
test('P03-4 authenticated hydration rejects stale, blocked, restricted and unsafe projections',async()=>{
  const sdk=new DynamoDBClient({endpoint,region:'ap-south-1',
    credentials:{accessKeyId:'local',secretAccessKey:'local'}});
  const db=DynamoDBDocumentClient.from(sdk);
  const viewer=`p034v_${randomUUID().replaceAll('-','')}`;
  const target=`p034t_${randomUUID().replaceAll('-','')}`;
  const alias=`p034_${randomUUID().replaceAll('-','').slice(0,12)}`;
  const cell=latLngToCell(17.385,78.486,6);
  const [lat,lng]=cellToLatLng(cell);
  const created:{table:string;key:{PK:string;SK:string}}[]=[];
  const userKey=(uid:string)=>({PK:`USER#${uid}`,SK:'META'});
  const settingsKey=(uid:string)=>({PK:`USER#${uid}`,SK:'SETTINGS'});
  const profileKey=(uid:string)=>({PK:`USER#${uid}`,SK:'MODE#DATING'});
  const blockKey=(from:string,to:string)=>({PK:`BLOCKS#${from}`,SK:`TARGET#${to}`});
  const now='2026-11-19T00:00:00.000Z';
  const pk=`DISC#DATING#R6#${cell}`;
  const pointer=(uid:string)=>({PK:pk,SK:`JOIN#${now}#${uid}`,uid,mode:'DATING',
    homeCell:cell,localityRevision:1,profileVersion:2});
  const get=async(table:string,key:{PK:string;SK:string})=>
    (await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
  const put=async(table:string,item:Record<string,unknown>)=>{
    await db.send(new PutCommand({TableName:table,Item:item,ConditionExpression:'attribute_not_exists(PK)'}));
    created.push({table,key:{PK:String(item.PK),SK:String(item.SK)}});
  };
  const update=async(table:string,key:{PK:string;SK:string},field:string,value:unknown)=>
    db.send(new UpdateCommand({TableName:table,Key:key,
      UpdateExpression:'SET #field = :value',ExpressionAttributeNames:{'#field':field},
      ExpressionAttributeValues:{':value':value}}));
  const app=Fastify({logger:false});
  const guard=async(req:{headers:Record<string,unknown>},reply:{code:(n:number)=>{send:(v:unknown)=>void}})=>{
    const token=req.headers['x-p034-actor'];
    if(token==='viewer-fixture')return {uid:viewer};
    if(token==='target-fixture')return {uid:target};
    reply.code(401).send({error:'authentication_required'});return null;
  };
  registerDiscoveryRoutes(app,db,guard as never,'P034-synthetic-purpose-separated-cursor-secret-0001');
  const call=(path='/v1/discovery/people?mode=dating',actor:'viewer-fixture'|'target-fixture'|null='viewer-fixture')=>
    app.inject({method:'GET',url:path,
      headers:actor?{'x-p034-actor':actor}:{}});
  const photos=new Map<string,string[]>();
  try{
    for(const [uid,handle] of [[viewer,`p034_${randomUUID().replaceAll('-','').slice(0,12)}`],[target,alias]]){
      const ids=[randomUUID(),randomUUID()];photos.set(uid,ids);
      await put('uluv_users',{...userKey(uid),status:'active',ageEligibility:'self_declared_adult',
        birthDate:'1999-04-02',identityRevision:1,handle});
      await put('uluv_settings',{...settingsKey(uid),commonName:'Synthetic Member',
        localityLabel:'Hyderabad',gender:'prefer_not_to_say',selectedModes:{dating:true,friendship:false},
        setupRevision:1,geoSelectionSource:'manual_geonames',geoApprovedCenter:{lat,lng},
        geoH3Cell:cell,localityRevision:1,settingsRevision:1,
        geoDistanceBand:'0-10',geoSortMode:'near_band_first'});
      const anchor={PK:pk,SK:pointer(uid).SK,localityRevision:1,profileVersion:2};
      await put('uluv_profiles',{...profileKey(uid),version:2,photoIds:ids,
        requestedActive:true,activationSetupRevision:1,activationIdentityRevision:1,
        discoveryPointer:anchor,displayName:'Synthetic Member',bio:'Reading and travel',
        interests:['Reading','Travel'],intention:'Friendship'});
      for(const id of ids)await put('uluv_profiles',{PK:`USER#${uid}`,SK:`MEDIA#${id}`,
        mediaId:id,state:'READY',refCount:1,version:3});
      await put('uluv_discovery',pointer(uid));
    }
    assert.equal((await call(undefined,null)).statusCode,401);
    assert.equal((await call('/v1/discovery/people?mode=dating&location=1')).statusCode,400);
    assert.equal((await call('/v1/discovery/people?mode=dating&pageSize=13')).statusCode,400);
    assert.equal((await call('/v1/discovery/people?mode=friendship')).statusCode,403);
    const response=await call();
    assert.equal(response.statusCode,200,response.body);
    assert.match(String(response.headers['cache-control']),/no-store/);
    const body=response.json();
    assert.equal(body.items.length,1,JSON.stringify(body));
    assert.deepEqual(Object.keys(body.items[0]).sort(),
      ['age','bio','broadArea','displayName','distanceBand','handle','intention','interests','photoCount'].sort());
    assert.equal(body.items[0].handle,alias);
    assert.equal(body.items[0].distanceBand,'0-10');
    assert.equal(body.items[0].photoCount,2);
    assert.equal(body.ordering,'page_local_only');
    assert.ok(!JSON.stringify(body).includes(target));
    assert.ok(!JSON.stringify(body).includes(cell));
    assert.ok(!JSON.stringify(body).includes(photos.get(target)![0]));
    if(body.nextCursor){
      const crossed=await call(`/v1/discovery/people?mode=dating&cursor=${body.nextCursor}`,'target-fixture');
      assert.equal(crossed.statusCode,409,'cursor must be bound to authenticated viewer');
    }
    await put('uluv_blocks',{...blockKey(viewer,target),createdAt:now});
    assert.deepEqual((await call()).json().items,[],'viewer block hides candidate');
    await db.send(new DeleteCommand({TableName:'uluv_blocks',Key:blockKey(viewer,target)}));
    await put('uluv_blocks',{...blockKey(target,viewer),createdAt:now});
    assert.deepEqual((await call()).json().items,[],'reverse block hides candidate');
    await db.send(new DeleteCommand({TableName:'uluv_blocks',Key:blockKey(target,viewer)}));
    await update('uluv_users',userKey(target),'status','restricted');
    assert.deepEqual((await call()).json().items,[],'restricted account invisible');
    await update('uluv_users',userKey(target),'status','active');
    await update('uluv_settings',settingsKey(target),'discoveryOptOut',true);
    assert.deepEqual((await call()).json().items,[],'explicit privacy opt-out hides candidate');
    await update('uluv_settings',settingsKey(target),'discoveryOptOut',false);
    await update('uluv_profiles',profileKey(target),'version',3);
    assert.deepEqual((await call()).json().items,[],'stale anchor invisible');
    await update('uluv_profiles',profileKey(target),'version',2);
    const id=photos.get(target)![0];
    await update('uluv_profiles',{PK:`USER#${target}`,SK:`MEDIA#${id}`},'state','STAGED');
    assert.deepEqual((await call()).json().items,[],'not-READY media hides candidate');
    await update('uluv_profiles',{PK:`USER#${target}`,SK:`MEDIA#${id}`},'state','READY');
    await update('uluv_settings',settingsKey(target),'localityRevision',2);
    assert.deepEqual((await call()).json().items,[],'stale locality hides candidate');
    await update('uluv_settings',settingsKey(target),'localityRevision',1);
    await update('uluv_settings',settingsKey(target),'geoDistanceBand','10-35');
    assert.deepEqual((await call()).json().items,[],
      'reciprocal target radius must suppress out-of-band viewer');
    await update('uluv_settings',settingsKey(target),'geoDistanceBand','0-10');
    assert.equal((await call()).json().items.length,1,'valid fixture can recover');
    if(body.nextCursor){
      await update('uluv_settings',settingsKey(viewer),'settingsRevision',2);
      assert.equal((await call(`/v1/discovery/people?mode=dating&cursor=${body.nextCursor}`)).statusCode,409,
        'changing viewer settings invalidates old cursor');
    }
    assert.equal((await get('uluv_users',userKey(target)))?.status,'active');
  }finally{
    await app.close();
    for(const {table,key} of created.reverse()){
      await db.send(new DeleteCommand({TableName:table,Key:key})).catch(()=>{
        console.warn('P03-4 synthetic cleanup pending:',table);
      });
    }
    sdk.destroy();
  }
});
