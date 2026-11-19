/** Owner-only local Java DynamoDB test of a server-internal trusted staff primitive.
 * Synthetic UIDs only; no admin route, no AWS, no real staff credentials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { latLngToCell } from 'h3-js';
import { assertLocalDynamoEndpoint } from '../../src/local-safety.js';
import { restrictAccountAndRevokePointers } from '../../src/features/discovery/restrict-account-pointers.js';

const endpoint = assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000');
if (process.env.APP_ENV !== 'local') throw new Error('P03_3_TRUSTED_RESTRICTION_REQUIRES_LOCAL_MODE');

test('P03-3 trusted restriction atomically fences account, deletes pointers and audits decision', async () => {
  const sdk = new DynamoDBClient({ endpoint, region:'ap-south-1',
    credentials:{ accessKeyId:'local', secretAccessKey:'local' } });
  const db = DynamoDBDocumentClient.from(sdk);
  const uid=`p033restr_${randomUUID().replaceAll('-','')}`;
  const staffUid=`p033staff_${randomUUID().replaceAll('-','')}`;
  const accountKey={PK:`USER#${uid}`,SK:'META'};
  const profileKey=(mode:string)=>({PK:`USER#${uid}`,SK:`MODE#${mode.toUpperCase()}`});
  const records:Array<{table:string; key:{PK:string;SK:string}}> = [];
  const put=async(table:string,item:Record<string,unknown>)=>{
    await db.send(new PutCommand({TableName:table,Item:item,ConditionExpression:'attribute_not_exists(PK)'}));
    records.push({table,key:{PK:String(item.PK),SK:String(item.SK)}});
  };
  const get=async(table:string,key:{PK:string;SK:string})=>
    (await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
  const base={targetUid:uid,staffUid,expectedModerationRevision:0,
    reason:'safety_review' as const};
  const pointers:Array<{PK:string;SK:string}>=[];
  try {
    const cell=latLngToCell(17.385,78.4867,6);
    await put('uluv_users',{...accountKey,status:'active',ageEligibility:'self_declared_adult',
      moderationRestrictionVersion:0});
    for (const mode of ['dating','friendship'] as const) {
      const PK=`DISC#${mode.toUpperCase()}#R6#${cell}`;
      const SK=`JOIN#2026-11-18T00:00:00.000Z#${uid}`;
      const anchor={PK,SK,localityRevision:1,profileVersion:3};
      await put('uluv_profiles',{...profileKey(mode),version:3,requestedActive:true,discoveryPointer:anchor});
      await put('uluv_discovery',{PK,SK,uid,mode:mode.toUpperCase(),localityRevision:1,profileVersion:3});
      pointers.push({PK,SK});
    }
    // Validation happens before any I/O or trusted status write.
    await assert.rejects(restrictAccountAndRevokePointers(db,{...base,staffUid:'bad#staff',actionId:randomUUID()}),
      /invalid_private_restriction_decision/);
    await assert.rejects(restrictAccountAndRevokePointers(db,{...base,actionId:'not-a-uuid'}),
      /invalid_private_restriction_decision/);
    // Poison one projection: the entire transaction must abort and preserve
    // the active account, both canonical anchors and the first pointer.
    await db.send(new UpdateCommand({TableName:'uluv_discovery',Key:pointers[1],
      UpdateExpression:'SET uid = :other',ExpressionAttributeValues:{':other':'another_owner'}}));
    await assert.rejects(restrictAccountAndRevokePointers(db,{...base,actionId:randomUUID()}));
    assert.equal((await get('uluv_users',accountKey))?.status,'active');
    for (const mode of ['dating','friendship'] as const)
      assert.ok((await get('uluv_profiles',profileKey(mode)))?.discoveryPointer);
    assert.ok(await get('uluv_discovery',pointers[0]));
    await db.send(new UpdateCommand({TableName:'uluv_discovery',Key:pointers[1],
      UpdateExpression:'SET uid = :owner',ExpressionAttributeValues:{':owner':uid}}));
    const actionId=randomUUID();
    await restrictAccountAndRevokePointers(db,{...base,actionId});
    const account=await get('uluv_users',accountKey);
    assert.equal(account?.status,'restricted');
    assert.equal(account?.moderationRestrictionVersion,1);
    for(const mode of ['dating','friendship'] as const){
      const modeRecord=await get('uluv_profiles',profileKey(mode));
      assert.equal(modeRecord?.version,4);
      assert.equal(modeRecord?.discoveryPointer,undefined);
      assert.equal(modeRecord?.requestedActive,false,'restricted mode must not auto-reactivate');
    }
    for(const key of pointers)assert.equal(await get('uluv_discovery',key),undefined);
    const auditRows=await db.send(new QueryCommand({TableName:'uluv_safety',
      KeyConditionExpression:'PK = :staff',ExpressionAttributeValues:{':staff':`ADMINAUDIT#${staffUid}`},Limit:2}));
    assert.equal(auditRows.Items?.length,1,'exactly one immutable staff audit should be committed');
    assert.equal(auditRows.Items?.[0]?.actionId,actionId);
    assert.equal(auditRows.Items?.[0]?.targetUid,uid);
    // A second call cannot repeat a restriction or create another audit record.
    await assert.rejects(restrictAccountAndRevokePointers(db,{...base,actionId:randomUUID()}),
      /restriction_revision_conflict/);
  } finally {
    // The new single synthetic audit is located by an exact staff PK Query;
    // no account enumeration or Scan is allowed.
    const audits=await db.send(new QueryCommand({TableName:'uluv_safety',
      KeyConditionExpression:'PK = :staff',ExpressionAttributeValues:{':staff':`ADMINAUDIT#${staffUid}`},Limit:2})).catch(()=>null);
    for(const row of audits?.Items??[]){
      if(row.targetUid!==uid)continue;
      assert.equal(row.action,'restrict_account');
      records.push({table:'uluv_safety',key:{PK:String(row.PK),SK:String(row.SK)}});
    }
    for(const entry of records.reverse()){
      await db.send(new DeleteCommand({TableName:entry.table,Key:entry.key})).catch(()=>{
        console.warn('P03-3 trusted restriction synthetic cleanup pending:',entry.table);
      });
    }
    sdk.destroy();
  }
});
