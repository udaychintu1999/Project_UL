/** Explicit owner-run integration on loopback Java DynamoDB Local only.
 * No user records, no cloud operations, no auto-created tables. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {DynamoDBClient,DescribeTableCommand} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,DeleteCommand,GetCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {latLngToCell,cellToLatLng} from 'h3-js';
import {assertLocalDynamoEndpoint} from '../../src/local-safety.js';
import {buildPointer} from '../../src/features/discovery/contracts.js';
import {dynamoPointerQuery,scanPointerPage} from '../../src/features/discovery/pointer-reader.js';

test('P03-2 DynamoDB Local exact PK Query, bounded pagination, no Scan, safe cleanup',async()=>{
  // This validation occurs before any SDK/network request, and forbids real AWS.
  const endpoint=assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000/');
  const base=new DynamoDBClient({endpoint,region:'ap-south-1',
    credentials:{accessKeyId:'local',secretAccessKey:'local'}});
  const db=DynamoDBDocumentClient.from(base);
  const keys: {PK:string;SK:string}[]=[];
  try {
    const table=await base.send(new DescribeTableCommand({TableName:'uluv_discovery'}));
    assert.equal(table.Table?.TableName,'uluv_discovery');
    assert.deepEqual(table.Table?.KeySchema?.map((k:{AttributeName?:string;KeyType?:string})=>`${k.AttributeName}:${k.KeyType}`),['PK:HASH','SK:RANGE']);
    const c=latLngToCell(-45,-120,6);
    const [lat,lng]=cellToLatLng(c);
    const prefix=`p032fixture_${randomUUID().replaceAll('-','')}`;
    for(let n=0;n<5;n++){
      const row=buildPointer({mode:'DATING',cell:c,
        joinedAt:new Date(Date.UTC(2026,10,17,0,0,n)).toISOString(),uid:`${prefix}_${n}`,
        localityRevision:1,profileVersion:1});
      keys.push({PK:row.PK,SK:row.SK});
      await db.send(new PutCommand({TableName:'uluv_discovery',Item:row,
        ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}));
    }
    const original=dynamoPointerQuery(db);
    let queryCalls=0;
    const wrapped:typeof original=async(pk,after,limit)=>{
      queryCalls++;assert.ok(limit<=12);
      return original(pk,after,limit);
    };
    const location={center:{lat,lng},cell:c,localityRevision:1,settingsRevision:1,
      distanceBand:'0-10' as const,source:'manual_geonames' as const};
    const seen=new Set<string>();let cursor: string|undefined;
    for(let page=0;page<20;page++){
      const result=await scanPointerPage(wrapped,{uid:'synthetic-viewer',mode:'DATING',location,pageSize:2,
        token:cursor,cursorSecret:'p03-2-synthetic-dynamodb-local-test-key-123456'},
        [{band:'0-10',cells:[c]}]);
      for(const row of result.unverifiedPointers){
        assert.equal(row.homeCell,c);
        assert.ok(row.uid.startsWith(prefix));
        assert.equal(seen.has(row.uid),false,'duplicate pointer across pages');
        seen.add(row.uid);
      }
      if(!result.nextCursor)break;
      cursor=result.nextCursor;
    }
    assert.equal(seen.size,5);
    assert.ok(queryCalls<=8);
    for(const key of keys){assert.ok((await db.send(new GetCommand({TableName:'uluv_discovery',Key:key}))).Item);}
  }finally{
    for(const key of keys){try{await db.send(new DeleteCommand({TableName:'uluv_discovery',Key:key}));}catch{}}
    base.destroy();
  }
});
