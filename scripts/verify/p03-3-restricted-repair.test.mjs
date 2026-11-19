/** P03-3 static privacy guard. The semantic proof is the real DynamoDB test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/api/src/features/discovery/reconcile-restricted-pointers.ts','utf8');
test('restricted-account repair remains private and bounded, with strong canonical reads',()=>{
  assert.match(source,/export async function reconcileRestrictedPointers\(/);
  assert.match(source,/ConsistentRead: true/);
  assert.match(source,/account_not_restricted/);
  assert.match(source,/moderationRestrictionVersion/);
  assert.match(source,/appendModeInvalidationBarrier/);
  assert.match(source,/TransactWriteCommand/);
  assert.doesNotMatch(source,/ScanCommand|QueryCommand|\.get\(|app\.(get|post|put|delete)\(/);
  const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts;
  assert.match(scripts['verify:p03-3'],/test:p03-3:repair:integration/,
    'full verifier must not omit new Java DynamoDB Local repair test');
});
