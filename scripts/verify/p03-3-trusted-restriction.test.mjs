/** P03-3 trusted moderation primitive source guard; real semantics are exercised
 * by the separate Java DynamoDB Local transaction/rollback integration test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(p,'utf8');
const source=read('apps/api/src/features/discovery/restrict-account-pointers.ts');
const policy=read('apps/api/src/features/discovery/pointer-lifecycle-policy.ts');
const testFile='apps/api/tests/discovery/p03-3-trusted-restriction-dynamo.test.ts';
const scripts=JSON.parse(read('package.json')).scripts;
test('restriction and its mandatory audit are one bounded private transaction',()=>{
  assert.match(source,/export async function restrictAccountAndRevokePointers/);
  assert.match(source,/moderationRestrictionVersion = :expected/);
  assert.match(source,/#status = :active/);
  assert.match(source,/moderationRestrictionVersion = :next/);
  assert.match(source,/appendModeRestrictionBarrier\(items, targetUid, 'dating'/);
  assert.match(source,/appendModeRestrictionBarrier\(items, targetUid, 'friendship'/);
  assert.match(source,/TableName: 'uluv_safety'/);
  assert.match(source,/action: 'restrict_account'/);
  assert.match(source,/ConditionExpression: 'attribute_not_exists\(PK\)'/);
  assert.match(source,/new TransactWriteCommand\(\{ TransactItems: items \}\)/);
  assert.match(policy,/requestedActive = :inactive/);
  assert.doesNotMatch(source,/ScanCommand|QueryCommand|app\.(?:get|post|put|delete)\(|FastifyInstance|request\.body/);
  assert.ok(existsSync(testFile),'real DynamoDB Local rollback test must be included');
});
test('new restriction and audit tests must be in fail-closed P03-3 verifier',()=>{
  assert.match(scripts['test:p03-3:restriction:integration'],/env-file=apps\/api\/\.env/);
  assert.match(scripts['verify:p03-3:portable'],/test:p03-3:restriction:contracts/);
  assert.match(scripts['verify:p03-3'],/test:p03-3:restriction:integration/);
  assert.match(read('apps/api/tsconfig.p03-acceptance.json'),/p03-3-trusted-restriction-dynamo\.test\.ts/);
});
