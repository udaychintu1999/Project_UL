/** Owner-only Java DynamoDB Local test; isolated synthetic rows and exact-key cleanup.
 * No admin route, no AWS, no real account and no Scan. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { latLngToCell } from 'h3-js';
import { assertLocalDynamoEndpoint } from '../../src/local-safety.js';
import { reconcileRestrictedPointers } from '../../src/features/discovery/reconcile-restricted-pointers.js';

const endpoint = assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000');
if (process.env.APP_ENV !== 'local') throw new Error('P03_3_REPAIR_REQUIRES_LOCAL_MODE');

test('P03-3 restricted owner reconciliation is atomic, bounded and idempotent', async () => {
  const sdk = new DynamoDBClient({endpoint, region:'ap-south-1',
    credentials:{accessKeyId:'local',secretAccessKey:'local'}});
  const db = DynamoDBDocumentClient.from(sdk);
  const uid = `p033repair_${randomUUID().replaceAll('-','')}`;
  const key = {PK:`USER#${uid}`,SK:'META'};
  const homeCell = latLngToCell(-45,-120,6);
  const keys: Array<{table:string;key:{PK:string;SK:string}}> = [];
  const profileKey = (mode:string) => ({PK:`USER#${uid}`,SK:`MODE#${mode.toUpperCase()}`});
  const get = async (table:string,k:{PK:string;SK:string}) =>
    (await db.send(new GetCommand({TableName:table,Key:k,ConsistentRead:true}))).Item;
  const put = async (table:string,item:Record<string,unknown>) => {
    await db.send(new PutCommand({TableName:table,Item:item,ConditionExpression:'attribute_not_exists(PK)'}));
    keys.push({table,key:{PK:String(item.PK),SK:String(item.SK)}});
  };
  const pointers: Array<{PK:string;SK:string}> = [];
  try {
    await put('uluv_users',{...key,status:'active',ageEligibility:'self_declared_adult',
      moderationRestrictionVersion:0,identityRevision:1});
    await assert.rejects(reconcileRestrictedPointers(db,uid),/account_not_restricted/);
    for (const mode of ['dating','friendship'] as const) {
      const PK=`DISC#${mode.toUpperCase()}#R6#${homeCell}`;
      const SK=`JOIN#2026-11-18T10:00:00.000Z#${uid}`;
      const anchor={PK,SK,localityRevision:1,profileVersion:3};
      await put('uluv_profiles',{...profileKey(mode),version:3,requestedActive:true,discoveryPointer:anchor});
      await put('uluv_discovery',{PK,SK,uid,mode:mode.toUpperCase(),localityRevision:1,profileVersion:3});
      pointers.push({PK,SK});
    }
    // An active account must not be repairable just because it has anchors.
    await assert.rejects(reconcileRestrictedPointers(db,uid),/account_not_restricted/);
    for (const ptr of pointers) assert.ok(await get('uluv_discovery',ptr));
    await assert.rejects(reconcileRestrictedPointers(db,'bad#uid'),/invalid_pointer_owner/);
    // A future trusted moderation workflow has already made the canonical
    // account ineligible; the internal repair does NOT authorize this change.
    await db.send(new UpdateCommand({TableName:'uluv_users',Key:key,
      UpdateExpression:'SET #state = :restricted, moderationRestrictionVersion = :version',
      ExpressionAttributeNames:{'#state':'status'},
      ExpressionAttributeValues:{':restricted':'restricted',':version':1}}));
    // A hostile/accidentally aliased pointer cannot be deleted. The entire
    // transaction must roll back, including the otherwise-valid Dating row.
    await db.send(new UpdateCommand({TableName:'uluv_discovery',Key:pointers[1],
      UpdateExpression:'SET uid = :other',ExpressionAttributeValues:{':other':'another_owner'}}));
    await assert.rejects(reconcileRestrictedPointers(db,uid));
    for (const mode of ['dating','friendship'] as const)
      assert.ok((await get('uluv_profiles',profileKey(mode)))?.discoveryPointer,
        'a rejected transaction must not partially clear anchors');
    assert.ok(await get('uluv_discovery',pointers[0]),'first pointer must survive canceled transaction');
    await db.send(new UpdateCommand({TableName:'uluv_discovery',Key:pointers[1],
      UpdateExpression:'SET uid = :owner',ExpressionAttributeValues:{':owner':uid}}));
    assert.equal(await reconcileRestrictedPointers(db,uid),2);
    assert.equal(await reconcileRestrictedPointers(db,uid),0,'retry is idempotent');
    for (const mode of ['dating','friendship'] as const) {
      const record=await get('uluv_profiles',profileKey(mode));
      assert.equal(record?.discoveryPointer,undefined);
      assert.equal(record?.version,4);
    }
    for (const ptr of pointers)assert.equal(await get('uluv_discovery',ptr),undefined);
    assert.equal((await get('uluv_users',key))?.status,'restricted');
  } finally {
    for (const entry of keys.reverse()) {
      await db.send(new DeleteCommand({TableName:entry.table,Key:entry.key})).catch(() => {
        console.warn('P03-3 restricted repair synthetic cleanup pending:',entry.table);
      });
    }
    sdk.destroy();
  }
});
