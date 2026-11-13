import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';
import {DynamoDBClient,DescribeTableCommand} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand,GetCommand,QueryCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';

const catalog=JSON.parse(await readFile(new URL('../../docs/architecture/TABLE_CATALOG_v0_3.json',import.meta.url),'utf8'));
const localEndpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
const client=new DynamoDBClient({region:process.env.AWS_REGION??'ap-south-1',endpoint:localEndpoint,credentials:{accessKeyId:'local',secretAccessKey:'local'}});
const doc=DynamoDBDocumentClient.from(client);
const key={PK:`P00#DIRECT#${randomUUID()}`,SK:'SMOKE'};
try{
  for(const spec of catalog.tables){
    const table=await client.send(new DescribeTableCommand({TableName:spec.name}));
    assert.equal(table.Table?.TableName,spec.name);
    assert.deepEqual(table.Table?.KeySchema?.map(x=>`${x.AttributeName}:${x.KeyType}`),['PK:HASH','SK:RANGE']);
    assert.ok(!table.Table?.GlobalSecondaryIndexes?.length,`${spec.name} unexpectedly has GSI`);
  }
  await doc.send(new PutCommand({TableName:'uluv_operations',Item:{...key,kind:'synthetic-test'},ConditionExpression:'attribute_not_exists(PK)'}));
  await assert.rejects(doc.send(new PutCommand({TableName:'uluv_operations',Item:{...key,kind:'duplicate'},ConditionExpression:'attribute_not_exists(PK)'})));
  const get=await doc.send(new GetCommand({TableName:'uluv_operations',Key:key,ConsistentRead:true}));
  assert.equal(get.Item?.kind,'synthetic-test');
  const query=await doc.send(new QueryCommand({TableName:'uluv_operations',KeyConditionExpression:'PK = :v',ExpressionAttributeValues:{':v':key.PK},ConsistentRead:true}));
  assert.equal(query.Items?.length,1);
  await doc.send(new DeleteCommand({TableName:'uluv_operations',Key:key}));
  const missing=await doc.send(new GetCommand({TableName:'uluv_operations',Key:key,ConsistentRead:true}));
  assert.equal(missing.Item,undefined);
  console.log('PASSED: all 18 real DynamoDB Local table schemas + conditional Put/Get/Query/Delete');
}finally{
  try{await doc.send(new DeleteCommand({TableName:'uluv_operations',Key:key}));}catch{}
  client.destroy();
}
