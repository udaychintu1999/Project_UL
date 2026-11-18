/** REAL Fastify route + REAL Java DynamoDB Local; only isolated synthetic rows.
 * Safe: verify loopback environment before creating the SDK client. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand,GetCommand,DeleteCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {cellToLatLng,isValidCell,getResolution} from 'h3-js';
import {assertLocalDynamoEndpoint} from '../../src/local-safety.js';
import {registerIndiaGeoRoutes} from '../../src/features/geo/routes.js';
import {registerGeoPreferenceRoutes} from '../../src/features/geo/settings-routes.js';
import {makeSyntheticGeoCatalogue,FIXTURE_VERSION,FIXTURE_PLACE,FIXTURE_LAT,FIXTURE_LNG} from './p03-1-fixture.js';

// This must happen BEFORE any network request. NO AWS tests here.
const local=assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000');
if(process.env.APP_ENV!=='local')throw new Error('P03_DB_ACCEPTANCE_REQUIRES_LOCAL_MODE');

test('P03-1 local DynamoDB: authenticated save/read, permission, GPS, revision, rollback and privacy',async()=>{
  const fixture=await makeSyntheticGeoCatalogue();
  const before={
    ULUV_GEO_PUBLIC_BASE_URL:process.env.ULUV_GEO_PUBLIC_BASE_URL,
    ULUV_GEO_PUBLIC_LOCAL_DIR:process.env.ULUV_GEO_PUBLIC_LOCAL_DIR,
    ULUV_GEO_CANONICAL_MANIFEST_SHA256:process.env.ULUV_GEO_CANONICAL_MANIFEST_SHA256
  };
  delete process.env.ULUV_GEO_PUBLIC_BASE_URL;
  process.env.ULUV_GEO_PUBLIC_LOCAL_DIR=fixture.dir;
  process.env.ULUV_GEO_CANONICAL_MANIFEST_SHA256=fixture.pin;
  const client=new DynamoDBClient({region:'ap-south-1',endpoint:local,
    credentials:{accessKeyId:'local',secretAccessKey:'local'}});
  const db=DynamoDBDocumentClient.from(client);
  const uid=`p03acc_${randomUUID().replaceAll('-','')}`;
  const userKey={PK:`USER#${uid}`,SK:'META'};
  const settingsKey={PK:`USER#${uid}`,SK:'SETTINGS'};
  const app=Fastify({logger:false});
  const auth=async(req:{headers:Record<string,unknown>},reply:{code:(x:number)=>{send:(x:unknown)=>void}})=>{
    if(req.headers['x-p03-fixture']!==uid){reply.code(401).send({error:'unauthorized'});return null;}
    return {uid};
  };
  registerIndiaGeoRoutes(app,db,auth as never);
  registerGeoPreferenceRoutes(app,db,auth as never);
  // Fastify inject requires a supported payload type, not unknown/null. Send test
  // objects as JSON bytes and await the completed response instead of returning
  // a LightMyRequest chain (which has different statusCode/json typings).
  const call=async(method:'GET'|'PUT'|'POST',url:string,payload?:unknown,allowed=true)=>{
    const headers:Record<string,string>=allowed?{'x-p03-fixture':uid}:{};
    if(payload!==undefined)headers['content-type']='application/json';
    return await app.inject({method,url,headers,
      ...(payload===undefined?{}:{payload:JSON.stringify(payload)})});
  };
  try{
    await db.send(new PutCommand({TableName:'uluv_users',Item:{...userKey,status:'active',
      ageEligibility:'self_declared_adult'},ConditionExpression:'attribute_not_exists(PK)'}));
    await db.send(new PutCommand({TableName:'uluv_settings',Item:{...settingsKey},
      ConditionExpression:'attribute_not_exists(PK)'}));
    assert.equal((await call('GET','/v1/me/geo/location',undefined,false)).statusCode,401);
    const initial=await call('GET','/v1/me/geo/location');
    assert.equal(initial.statusCode,200,initial.body);
    assert.equal(initial.json().location,null);
    assert.equal(initial.json().settingsRevision,0);
    const delivery=await call('GET','/v1/geo/india/delivery');
    assert.equal(delivery.statusCode,200,delivery.body);
    assert.equal(delivery.json().manifestSha256,fixture.files.get('manifest.json')!==undefined?
      (await import('node:crypto')).createHash('sha256').update(fixture.files.get('manifest.json')!).digest('hex'):null);
    const pack=await call('GET','/v1/geo/india/packs/01/101');
    assert.equal(pack.statusCode,200,pack.body);
    assert.deepEqual(Buffer.from(pack.rawPayload),fixture.pack);
    assert.equal((await call('GET','/v1/geo/india/packs/01/000')).statusCode,404);
    const manual={geonameId:FIXTURE_PLACE,catalogueVersion:FIXTURE_VERSION,stateCode:'01',
      districtCode:'101',expectedRevision:0};
    assert.equal((await call('PUT','/v1/me/geo/manual',{...manual,lat:FIXTURE_LAT})).statusCode,400,
      'clients cannot supply raw coordinates');
    assert.equal((await call('PUT','/v1/me/geo/manual',{...manual,stateCode:'02'})).statusCode,400,
      'server resolves canonical state/district, not client assertion');
    assert.equal((await call('PUT','/v1/me/geo/manual',{...manual,geonameId:'999999'})).statusCode,404);
    assert.equal((await call('PUT','/v1/me/geo/manual',{...manual,expectedRevision:99})).statusCode,409);
    assert.equal((await call('PUT','/v1/me/geo/manual',manual,false)).statusCode,401);
    const saved=await call('PUT','/v1/me/geo/manual',manual);
    assert.equal(saved.statusCode,200,saved.body);
    assert.equal(saved.json().settingsRevision,1);
    assert.equal(saved.json().localityRevision,1);
    assert.equal(saved.json().location.source,'manual_geonames');
    assert.equal(saved.json().discoveryEnabled,false);
    assert.equal((await call('PUT','/v1/me/geo/manual',manual)).statusCode,409,
      'stale revision must not save');
    const persisted=(await db.send(new GetCommand({TableName:'uluv_settings',Key:settingsKey,ConsistentRead:true}))).Item!;
    assert.equal(persisted.geoGeonameId,FIXTURE_PLACE);
    assert.equal(persisted.geoSelectionSource,'manual_geonames');
    assert.ok(isValidCell(persisted.geoH3Cell));
    assert.equal(getResolution(persisted.geoH3Cell),6);
    assert.deepEqual(persisted.geoApprovedCenter,(()=>{const [lat,lng]=cellToLatLng(persisted.geoH3Cell);return {lat,lng};})());
    assert.notDeepEqual(persisted.geoApprovedCenter,{lat:FIXTURE_LAT,lng:FIXTURE_LNG});
    const reread=await call('GET','/v1/me/geo/location');
    assert.equal(reread.json().location.name,saved.json().location.name,
      'a fresh server read must return the saved label');
    assert.equal(reread.json().location.lat,undefined);
    assert.equal((await call('PUT','/v1/me/settings',{expectedRevision:1,distanceBand:'0-10',sortMode:'recent_first'})).statusCode,200);
    assert.equal((await call('PUT','/v1/me/settings',{expectedRevision:1,distanceBand:'0-50',sortMode:'near_band_first'})).statusCode,409);
    assert.equal((await call('GET','/v1/me/settings')).json().distanceBand,'0-10');
    const gps={lat:FIXTURE_LAT,lng:FIXTURE_LNG,accuracyMeters:20,fixTimestamp:new Date().toISOString(),expectedRevision:2};
    assert.equal((await call('POST','/v1/me/geo/gps',gps)).statusCode,429,'cooldown enforced');
    await db.send(new UpdateCommand({TableName:'uluv_settings',Key:settingsKey,
      UpdateExpression:'SET geoLocationUpdatedEpoch=:old',ExpressionAttributeValues:{':old':0}}));
    assert.equal((await call('POST','/v1/me/geo/gps',{...gps,lat:51.5,lng:-0.1})).statusCode,400);
    assert.equal((await call('POST','/v1/me/geo/gps',{...gps,accuracyMeters:99999})).statusCode,400);
    assert.equal((await call('POST','/v1/me/geo/gps',{...gps,expectedRevision:1})).statusCode,409);
    const res=await call('POST','/v1/me/geo/gps',gps);
    assert.equal(res.statusCode,200,res.body);
    const after=(await db.send(new GetCommand({TableName:'uluv_settings',Key:settingsKey,ConsistentRead:true}))).Item!;
    assert.equal(after.geoSelectionSource,'gps_selected');
    assert.equal(after.geoGeonameId,undefined,'GPS removes obsolete manual metadata');
    assert.equal(after.settingsRevision,3);
    assert.equal(after.localityRevision,2);
    const stable=await call('GET','/v1/me/geo/location');
    assert.equal(stable.json().location.source,'gps_selected');
    assert.equal(JSON.stringify(stable.json()).includes('accuracyMeters'),false);
    assert.equal(JSON.stringify(after).includes('fixTimestamp'),false);
    assert.equal(JSON.stringify(after).includes('accuracyMeters'),false);
    // Transactional user eligibility must be rechecked at the commit point,
    // even if a valid test session exists. A failed save cannot alter settings.
    await db.send(new UpdateCommand({TableName:'uluv_settings',Key:settingsKey,
      UpdateExpression:'SET geoLocationUpdatedEpoch=:old',ExpressionAttributeValues:{':old':0}}));
    await db.send(new UpdateCommand({TableName:'uluv_users',Key:userKey,
      UpdateExpression:'SET #status=:disabled',ExpressionAttributeNames:{'#status':'status'},
      ExpressionAttributeValues:{':disabled':'disabled'}}));
    const forbidden={...manual,expectedRevision:3};
    assert.equal((await call('PUT','/v1/me/geo/manual',forbidden)).statusCode,409,
      'disabled owner must fail the transactional authorization check');
    await db.send(new UpdateCommand({TableName:'uluv_users',Key:userKey,
      UpdateExpression:'SET #status=:active, ageEligibility=:notAdult',
      ExpressionAttributeNames:{'#status':'status'},
      ExpressionAttributeValues:{':active':'active',':notAdult':'unknown'}}));
    assert.equal((await call('PUT','/v1/me/geo/manual',forbidden)).statusCode,409,
      'non-adult owner must fail the same transactional authorization check');
    const afterDenied=(await db.send(new GetCommand({TableName:'uluv_settings',Key:settingsKey,
      ConsistentRead:true}))).Item!;
    assert.equal(afterDenied.settingsRevision,3,'failed eligibility checks must not mutate saved settings');
    assert.equal(afterDenied.geoSelectionSource,'gps_selected');
  }finally{
    await app.close();
    for(const {TableName,Key} of [{TableName:'uluv_settings',Key:settingsKey},{TableName:'uluv_users',Key:userKey}]){
      await db.send(new DeleteCommand({TableName,Key})).catch(()=>{});
    }
    client.destroy();
    for(const [k,v] of Object.entries(before)){
      if(v===undefined)delete process.env[k]; else process.env[k]=v;
    }
    await fixture.close();
  }
});
