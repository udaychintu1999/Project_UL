import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {cellToLatLng} from 'h3-js';
import {GetCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {registerIndiaGeoRoutes} from '../../src/features/geo/routes.js';
import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';

test('authenticated GPS save derives H3 from vetted polygon and never persists raw fix',async()=>{
  // At revision 0, settingsRevision is intentionally absent: the production
  // conditional write requires attribute_not_exists(settingsRevision).
  const row:Record<string,unknown>={PK:'USER#fixture',SK:'SETTINGS',localityRevision:0};
  let transaction:unknown;
  const fake={send:async(command:unknown)=>{
    if(command instanceof GetCommand){
      const {TableName,Key}=command.input;
      assert.equal(Key?.PK,'USER#fixture','only synthetic fixture owner may be read');
      if(TableName==='uluv_settings'){
        assert.equal(Key?.SK,'SETTINGS');
        return {Item:row};
      }
      if(TableName==='uluv_profiles'){
        assert.ok(Key?.SK==='MODE#DATING'||Key?.SK==='MODE#FRIENDSHIP');
        // No mode profiles exist for this test owner. P03-3 must still
        // install both absence-condition barriers in the same transaction.
        return {};
      }
      throw new Error(`Unexpected DynamoDB Get table: ${TableName}`);
    }
    if(command instanceof TransactWriteCommand){
      transaction=command.input;
      const items=command.input.TransactItems??[];
      assert.equal(items.length,4,'account + settings + Dating/Friendship barriers required');
      for(const mode of ['DATING','FRIENDSHIP']){
        const item=items.find(x=>x.ConditionCheck?.TableName==='uluv_profiles' &&
          x.ConditionCheck.Key?.SK===`MODE#${mode}`);
        assert.equal(item?.ConditionCheck?.ConditionExpression,'attribute_not_exists(PK)',
          `${mode} missing-profile creation race must be fenced`);
      }
      const attrs=items[1]?.Update?.ExpressionAttributeValues as Record<string,unknown>;
      row.settingsRevision=attrs[':newrev'];
      row.localityRevision=attrs[':locrev'];
      row.geoSelectionSource=attrs[':source'];
      row.geoSelectionLabel=attrs[':label'];
      row.geoH3Cell=attrs[':cell'];
      row.geoLocationUpdatedEpoch=attrs[':epoch'];
      return {};
    }
    throw new Error('Unknown command');
  }} as unknown as DynamoDBDocumentClient;
  const app=Fastify({logger:false});
  registerIndiaGeoRoutes(app,fake,async(req,reply)=>{
    if(req.headers['x-test-session']!=='fixture'){
      reply.code(401).send({error:'unauthorized'});return null;
    }
    return {uid:'fixture'};
  });
  const now=()=>new Date().toISOString();
  const post=(payload:Record<string,unknown>,authorized=true)=>app.inject({
    method:'POST',url:'/v1/me/geo/gps',
    headers:{...(authorized?{'x-test-session':'fixture'}:{})},payload,
  });
  const valid=()=>({lat:17.385,lng:78.487,accuracyMeters:100,fixTimestamp:now(),expectedRevision:0});
  try{
    assert.equal((await post(valid(),false)).statusCode,401);
    assert.equal((await post({...valid(),lat:51.5,lng:-0.1})).statusCode,400);
    assert.equal((await post({...valid(),accuracyMeters:15000})).statusCode,400);
    assert.equal((await post({...valid(),expectedRevision:1})).statusCode,409);
    assert.equal(transaction,undefined);
    const reply=await post(valid());
    assert.equal(reply.statusCode,200,reply.body);
    const payload=reply.json();
    assert.equal(payload.location.source,'gps_selected');
    assert.equal(payload.discoveryEnabled,false);
    assert.equal(payload.location.name,'Approximate location in India');
    assert.equal('lat' in payload.location,false);
    assert.equal('lng' in payload.location,false);
    assert.equal(row.geoSelectionSource,'gps_selected');
    assert.match(String(row.geoH3Cell),/^[0-9a-f]+$/);
    // Check structural privacy, not substring matching: two different floating-
    // point numbers can legitimately share decimal digits. Only the H3 centre
    // may be persisted; no exact phone fix or fix metadata is written.
    const attrs=(transaction as {TransactItems:Array<{Update?:{ExpressionAttributeValues?:Record<string,unknown>}}>})
      .TransactItems[1].Update!.ExpressionAttributeValues!;
    const [centerLat,centerLng]=cellToLatLng(String(row.geoH3Cell));
    assert.deepEqual(attrs[':center'],{lat:centerLat,lng:centerLng});
    assert.notDeepEqual(attrs[':center'],{lat:17.385,lng:78.487});
    assert.equal(JSON.stringify(transaction).includes('fixTimestamp'),false);
    assert.equal(JSON.stringify(transaction).includes('accuracyMeters'),false);
    assert.equal((await post({...valid(),expectedRevision:1})).statusCode,429);
    const read=await app.inject({method:'GET',url:'/v1/me/geo/location',headers:{'x-test-session':'fixture'}});
    assert.equal(read.statusCode,200,read.body);
    assert.equal(read.json().gpsAvailable,true);
    assert.equal(read.json().location.source,'gps_selected');
    assert.equal(read.json().location.lat,undefined);
  }finally{await app.close();}
});
