import {DynamoDBClient, CreateTableCommand, DescribeTableCommand, PutItemCommand, waitUntilTableExists} from '@aws-sdk/client-dynamodb';
import {readFile} from 'node:fs/promises';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';
const catalog=JSON.parse(await readFile(new URL('../../docs/architecture/TABLE_CATALOG_v0_3.json',import.meta.url),'utf8'));
if(catalog.table_count!==18 ||catalog.tables.length!==18) throw new Error('Expected 18-table catalog');
// P00 LOCAL provisioner only accepts loopback HTTP endpoint; production tables require separately approved P17 provisioning.
const localEndpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
const db=new DynamoDBClient({region:process.env.AWS_REGION??'ap-south-1',endpoint:localEndpoint,credentials:{accessKeyId:'local',secretAccessKey:'local'}});
try{
 for(const table of catalog.tables){
  try {
   const existing=await db.send(new DescribeTableCommand({TableName:table.name}));
   const keys=(existing.Table?.KeySchema??[]).map(k=>`${k.AttributeName}:${k.KeyType}`);
   if(keys.join(',')!=='PK:HASH,SK:RANGE' || existing.Table?.GlobalSecondaryIndexes?.length) {
    throw new Error(`Existing LOCAL table ${table.name} does not match P00 canonical PK/SK/no-GSI schema`);
   }
   console.log(`VERIFIED ${table.name}`);
  }catch(err){
   if(err?.name!=='ResourceNotFoundException') throw err;
   await db.send(new CreateTableCommand({TableName:table.name,BillingMode:'PAY_PER_REQUEST',KeySchema:[{AttributeName:'PK',KeyType:'HASH'},{AttributeName:'SK',KeyType:'RANGE'}],AttributeDefinitions:[{AttributeName:'PK',AttributeType:'S'},{AttributeName:'SK',AttributeType:'S'}]}));
   await waitUntilTableExists({client:db,maxWaitTime:30},{TableName:table.name});
   console.log(`CREATED ${table.name}`);
  }
 }
 await db.send(new PutItemCommand({TableName:'uluv_operations',Item:{PK:{S:'SYSTEM#P00'},SK:{S:'HEALTH'},status:{S:'ready'}}}));
 console.log('P00 sentinel ready. Provisioned/verified 18 tables.');
} finally {db.destroy();}
