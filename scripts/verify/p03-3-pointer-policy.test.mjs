/** No database, account secrets, AWS calls or npm dependencies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPointerAnchor, appendPointerDelete, appendModeInvalidationBarrier,
  samePointerCondition, nextJoinTime, pointerAnchor, matchesCanonicalPublicationSnapshot
} from '../../apps/api/src/features/discovery/pointer-lifecycle-policy.ts';
const uid='p033_synthetic_owner';
const joined='2026-11-18T08:00:00.000Z';
const anchor={PK:'DISC#DATING#R6#86283082fffffff',SK:`JOIN#${joined}#${uid}`,
  localityRevision:3,profileVersion:7};
const canonical={PK:`USER#${uid}`,SK:'MODE#DATING',version:7,discoveryPointer:anchor};

test('canonical pointer ownership is mode- and UID-validated, never copied from client data',()=>{
  assert.deepEqual(canonicalPointerAnchor(uid,'dating',canonical),anchor);
  assert.deepEqual(pointerAnchor(anchor,uid,'dating'),anchor);
  for(const row of [
    {...canonical,discoveryPointer:{...anchor,PK:anchor.PK.replace('DATING','FRIENDSHIP')}},
    {...canonical,discoveryPointer:{...anchor,SK:anchor.SK.replace(uid,'someone_else')}},
    {...canonical,discoveryPointer:{...anchor,PK:'DISC#DATING#R7#86283082fffffff'}},
    {...canonical,discoveryPointer:{...anchor,localityRevision:0}},
    {...canonical,discoveryPointer:{...anchor,profileVersion:NaN}},
    {...canonical,discoveryPointer:'attacker-chosen-key'},
  ]) assert.throws(()=>canonicalPointerAnchor(uid,'dating',row),/invalid_canonical_pointer_anchor/);
  assert.throws(()=>canonicalPointerAnchor('bad#user','dating',canonical),/invalid_pointer_owner/);
  assert.throws(()=>canonicalPointerAnchor(uid,'local',canonical),/invalid_pointer_owner/);
});

test('conditional delete is keyed to canonical anchor; absent pointers are idempotent',()=>{
  const tx=[];
  assert.deepEqual(appendPointerDelete(tx,uid,'dating',canonical),anchor);
  assert.equal(tx.length,1);
  assert.equal(tx[0].Delete.TableName,'uluv_discovery');
  assert.deepEqual(tx[0].Delete.Key,{PK:anchor.PK,SK:anchor.SK});
  assert.match(tx[0].Delete.ConditionExpression,/uid = :owner/);
  assert.deepEqual(tx[0].Delete.ExpressionAttributeValues,{':owner':uid});
  assert.equal(appendPointerDelete(tx,uid,'friendship',{version:2}),null);
  assert.equal(tx.length,1);
});

test('settings/identity changes fence missing and inactive modes and revoke active mode atomically',()=>{
  const tx=[];
  appendModeInvalidationBarrier(tx,uid,'dating',canonical,'2026-11-18T09:00:00.000Z');
  appendModeInvalidationBarrier(tx,uid,'friendship',undefined,'2026-11-18T09:00:00.000Z');
  assert.equal(tx.length,3);
  assert.ok(tx[0].Delete);
  assert.ok(tx[1].Update);
  assert.equal(tx[1].Update.ExpressionAttributeValues[':next'],8);
  assert.match(tx[1].Update.UpdateExpression,/REMOVE discoveryPointer/);
  assert.match(tx[1].Update.ConditionExpression,/discoveryPointer.PK/);
  assert.deepEqual(tx[2].ConditionCheck.Key,{PK:`USER#${uid}`,SK:'MODE#FRIENDSHIP'});
  assert.equal(tx[2].ConditionCheck.ConditionExpression,'attribute_not_exists(PK)');
  const inactive=[];
  appendModeInvalidationBarrier(inactive,uid,'dating',{version:2},'2026-11-18T09:00:00.000Z');
  assert.equal(inactive.length,1);
  assert.match(inactive[0].ConditionCheck.ConditionExpression,/attribute_not_exists\(discoveryPointer\)/);
});

test('invalid canonical versions and corrupt anchors stop transactions before any commit',()=>{
  for(const bad of [0,NaN,'2',-1,undefined]){
    const tx=[];
    assert.throws(()=>appendModeInvalidationBarrier(tx,uid,'dating',{version:bad},joined),
      /invalid_canonical_profile_version/);
    assert.equal(tx.length,0);
  }
  const tx=[];
  assert.throws(()=>appendModeInvalidationBarrier(tx,uid,'dating',
    {version:3,discoveryPointer:{...anchor,SK:'wrong'}},joined));
  assert.equal(tx.length,0);
});

test('profile mutations guard against anchor insertion/removal between Get and TransactWrite',()=>{
  const active=samePointerCondition(anchor),inactive=samePointerCondition(null);
  assert.match(active.expression,/discoveryPointer.SK = :oldPointerSK/);
  assert.deepEqual(active.values,{':oldPointerPK':anchor.PK,':oldPointerSK':anchor.SK});
  assert.match(inactive.expression,/attribute_not_exists\(discoveryPointer\)/);
  assert.deepEqual(inactive.values,{});
});

test('new JOIN key cannot equal old key in a same-millisecond reactivation',()=>{
  const next=nextJoinTime(joined,anchor);
  assert.equal(next,'2026-11-18T08:00:00.001Z');
  assert.notEqual(`JOIN#${next}#${uid}`,anchor.SK);
  assert.equal(nextJoinTime('2026-11-18T08:00:01.000Z',anchor),'2026-11-18T08:00:01.000Z');
  assert.throws(()=>nextJoinTime('wrong',anchor),/invalid_pointer_timestamp/);
});

test('publisher rejects mixed-version READY-photo snapshots and unassigned IDs',()=>{
  const media=['owner_photo_1','owner_photo_2'];
  const record={version:7,photoIds:media};
  assert.equal(matchesCanonicalPublicationSnapshot(7,record,7,media),true);
  assert.equal(matchesCanonicalPublicationSnapshot(7,record,6,media),false,'stale dashboard');
  assert.equal(matchesCanonicalPublicationSnapshot(6,record,7,media),false,'stale canonical profile');
  assert.equal(matchesCanonicalPublicationSnapshot(7,record,7,['different_owner_photo','owner_photo_2']),false);
  assert.equal(matchesCanonicalPublicationSnapshot(7,{version:7,photoIds:['owner_photo_1','owner_photo_1']},7,media),false);
  assert.equal(matchesCanonicalPublicationSnapshot(7,{version:7,photoIds:null},7,media),false);
  assert.equal(matchesCanonicalPublicationSnapshot(7,undefined,7,media),false);
});
