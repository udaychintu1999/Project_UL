/** Owner Windows: real Fastify inject + Java DynamoDB Local, synthetic records only.
 * Does not hit internet, use owner accounts, change table definitions or call AWS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,DeleteCommand,QueryCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {latLngToCell,cellToLatLng} from 'h3-js';
import {assertLocalDynamoEndpoint} from '../../src/local-safety.js';
import {registerProfileRoutes} from '../../src/features/profiles/routes.js';
import {registerProfileMediaRoutes} from '../../src/features/profiles/media-routes.js';

const endpoint=assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000');
if(process.env.APP_ENV!=='local')throw new Error('P03_3_DB_INTEGRATION_REQUIRES_LOCAL_MODE');

test('P03-3 real transaction lifecycle, authorization, revocation and CAS',async()=>{
  const sdk=new DynamoDBClient({endpoint,region:'ap-south-1',
    credentials:{accessKeyId:'local',secretAccessKey:'local'}});
  const db=DynamoDBDocumentClient.from(sdk);
  const uid=`p033test_${randomUUID().replaceAll('-','')}`;
  const oldHandle=`p033a${randomUUID().replaceAll('-','').slice(0,12)}`;
  const newHandle=`p033b${randomUUID().replaceAll('-','').slice(0,12)}`;
  const owner={PK:`USER#${uid}`,SK:'META'};
  const settings={PK:`USER#${uid}`,SK:'SETTINGS'};
  const profile=(mode:'dating'|'friendship')=>({PK:`USER#${uid}`,SK:`MODE#${mode.toUpperCase()}`});
  const id1=randomUUID(),id2=randomUUID();
  const media=(id:string)=>({PK:`USER#${uid}`,SK:`MEDIA#${id}`});
  const cell=latLngToCell(-45,-120,6); // isolated synthetic fixture, not a user locality
  const [lat,lng]=cellToLatLng(cell);
  const created: {table:string; key:{PK:string;SK:string}}[]=[];
  const app=Fastify({logger:false});
  const guard=async(req:{headers:Record<string,unknown>},reply:{code:(x:number)=>{send:(x:unknown)=>void}})=>{
    if(req.headers['x-p033-fixture']!=='synthetic-authorized'){
      reply.code(401).send({error:'unauthorized'});return null;
    }
    return {uid};
  };
  registerProfileRoutes(app,db,guard as never);
  registerProfileMediaRoutes(app,db,guard as never);
  const call=async(method:'POST'|'PUT'|'GET',url:string,payload?:unknown,authorized=true)=>
    await app.inject({method,url,headers:{...(authorized?{'x-p033-fixture':'synthetic-authorized'}:{}),
      ...(payload===undefined?{}:{'content-type':'application/json'})},
    ...(payload===undefined?{}:{payload:JSON.stringify(payload)})});
  const get=async(table:string,key:{PK:string;SK:string})=>
    (await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
  const put=async(table:string,item:Record<string,unknown>)=>{
    await db.send(new PutCommand({TableName:table,Item:item,ConditionExpression:'attribute_not_exists(PK)'}));
    created.push({table,key:{PK:String(item.PK),SK:String(item.SK)}});
  };
  const ownedPointers=async(mode:'dating'|'friendship')=>{
    const pk=`DISC#${mode.toUpperCase()}#R6#${cell}`;
    const r=await db.send(new QueryCommand({TableName:'uluv_discovery',
      KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues:{':pk':pk,':prefix':'JOIN#'},ConsistentRead:true,Limit:12}));
    if(r.LastEvaluatedKey)throw new Error('synthetic partition unexpectedly dense: cannot certify singleton');
    return (r.Items??[]).filter(row=>row.uid===uid);
  };
  const assertNoPointer=async(mode:'dating'|'friendship')=>{
    const raw=await get('uluv_profiles',profile(mode));
    assert.equal(raw?.discoveryPointer,undefined);
    assert.equal((await ownedPointers(mode)).length,0);
  };
  const activate=async(mode:'dating'|'friendship',version:number)=>
    await call('POST',`/v1/profiles/me/${mode}/activate`,{expectedVersion:version});
  try{
    await put('uluv_users',{...owner,status:'active',ageEligibility:'self_declared_adult',
      birthDate:'2000-01-01',identityRevision:1,handle:oldHandle});
    await put('uluv_users',{PK:`HANDLE#${oldHandle}`,SK:'META',uid});
    await put('uluv_settings',{...settings,commonName:'Synthetic Owner',localityLabel:'Synthetic only',
      gender:'prefer_not_to_say',selectedModes:{dating:true,friendship:true},setupRevision:1,
      geoSelectionSource:'manual_geonames',geoApprovedCenter:{lat,lng},geoH3Cell:cell,
      localityRevision:1,settingsRevision:1});
    for(const mode of ['dating','friendship'] as const){
      await put('uluv_profiles',{...profile(mode),version:1,photoIds:[id1,id2],requestedActive:false,
        displayName:'Synthetic Owner',bio:'Local friends',interests:['Reading'],intention:'Friendship'});
    }
    for(const id of [id1,id2])await put('uluv_profiles',{...media(id),mediaId:id,state:'READY',refCount:2,version:3});
    assert.equal((await call('POST','/v1/profiles/me/dating/activate',{expectedVersion:1},false)).statusCode,401);
    assert.equal((await call('POST','/v1/profiles/me/dating/activate',{expectedVersion:1,uid})).statusCode,400);
    await assertNoPointer('dating');
    const first=await activate('dating',1);
    assert.equal(first.statusCode,200,first.body);
    assert.equal(first.json().profiles.dating.discoveryEligible,false);
    assert.equal(first.json().profiles.dating.requestedActive,true);
    let published=await ownedPointers('dating');
    assert.equal(published.length,1);
    let raw=await get('uluv_profiles',profile('dating'));
    assert.equal(raw?.discoveryPointer.PK,published[0].PK);
    assert.equal(raw?.discoveryPointer.SK,published[0].SK);
    assert.equal(raw?.discoveryPointer.localityRevision,1);
    assert.equal(raw?.discoveryPointer.profileVersion,2);
    assert.equal((await activate('dating',1)).statusCode,409,'replay cannot double-publish');
    assert.equal((await call('GET','/v1/profiles/dating/a-random-handle/preview')).statusCode,404);
    const concurrent=await Promise.all([activate('dating',2),activate('dating',2)]);
    assert.deepEqual(concurrent.map(x=>x.statusCode).sort(),[200,409]);
    published=await ownedPointers('dating');
    assert.equal(published.length,1,'replacement must remove first index row atomically');
    assert.equal(published[0].profileVersion,3);
    assert.equal((await call('POST','/v1/profiles/me/dating/deactivate',{expectedVersion:3})).statusCode,200);
    await assertNoPointer('dating');
    // Media record downgrade: activation must fail and leave no row.
    await db.send(new UpdateCommand({TableName:'uluv_profiles',Key:media(id2),
      UpdateExpression:'SET #state = :staged',ExpressionAttributeNames:{'#state':'state'},
      ExpressionAttributeValues:{':staged':'STAGED'}}));
    assert.equal((await activate('dating',4)).statusCode,409);
    await assertNoPointer('dating');
    await db.send(new UpdateCommand({TableName:'uluv_profiles',Key:media(id2),
      UpdateExpression:'SET #state = :ready',ExpressionAttributeNames:{'#state':'state'},
      ExpressionAttributeValues:{':ready':'READY'}}));
    assert.equal((await activate('dating',4)).statusCode,200);
    assert.equal((await ownedPointers('dating')).length,1);
    // Saving a canonical draft must atomically remove its old pointer.
    const changed=await call('PUT','/v1/profiles/me/dating',{expectedVersion:5,displayName:'Changed',
      bio:'Changed bio',interests:['Reading'],intention:'Meeting friends'});
    assert.equal(changed.statusCode,200,changed.body);
    await assertNoPointer('dating');
    // A second mode stays independent; shared setup invalidates active pointers.
    assert.equal((await activate('friendship',1)).statusCode,200);
    assert.equal((await ownedPointers('friendship')).length,1);
    const saved=await call('PUT','/v1/profiles/me/setup',{expectedRevision:1,commonName:'Updated owner',
      locality:'Synthetic only',gender:'prefer_not_to_say',selectedModes:{dating:true,friendship:true}});
    assert.equal(saved.statusCode,200,saved.body);
    await assertNoPointer('friendship');
    assert.equal((await ownedPointers('dating')).length,0);
    assert.equal((await activate('friendship',3)).statusCode,200);
    const renamed=await call('PUT','/v1/profiles/me/handle',
      {handle:newHandle,expectedRevision:1});
    assert.equal(renamed.statusCode,200,renamed.body);
    await assertNoPointer('friendship');
    // No read endpoint or owner response may claim newly public discovery.
    const all=await call('GET','/v1/profiles/me');
    assert.equal(all.json().profiles.friendship.discoveryEligible,false);
    assert.equal((await call('GET','/v1/discovery/people')).statusCode,404);
  }finally{
    await app.close();
    // Collect synthetic owner keys only. No Scan and no deletion of other users.
    for(const mode of ['dating','friendship'] as const){
      const raw=await get('uluv_profiles',profile(mode)).catch(()=>undefined);
      if(raw?.discoveryPointer?.PK && raw.discoveryPointer.SK)
        created.push({table:'uluv_discovery',key:{PK:raw.discoveryPointer.PK,SK:raw.discoveryPointer.SK}});
      for(const row of await ownedPointers(mode).catch(()=>[]))
        created.push({table:'uluv_discovery',key:{PK:row.PK,SK:row.SK}});
    }
    const a=await get('uluv_users',owner).catch(()=>undefined);
    for(const handle of [oldHandle,newHandle]){
      if(a?.handle===handle)created.push({table:'uluv_users',key:{PK:`HANDLE#${handle}`,SK:'META'}});
    }
    for(const {table,key} of created.reverse()){
      await db.send(new DeleteCommand({TableName:table,Key:key})).catch(()=>{
        console.warn('P03-3 synthetic cleanup pending:',table,key.SK.startsWith('JOIN#')?'JOIN#redacted':key.SK);
      });
    }
    sdk.destroy();
  }
});
