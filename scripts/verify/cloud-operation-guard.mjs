/** Offline guard against unreviewed AWS/cloud mutations by automation scripts. Not a replacement for IAM restrictions. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const localGuard=await readFile('apps/api/src/local-safety.ts','utf8');
const config=await readFile('apps/api/src/config.ts','utf8');
const db=await readFile('apps/api/src/db.ts','utf8');
const ex=await readFile('apps/api/.env.example','utf8');
const root=await readFile('AGENTS.md','utf8');
const policy=await readFile('docs/security/00_NON_NEGOTIABLE_GUARDS.md','utf8');
const denial=JSON.parse(await readFile('docs/security/iam/deny_all_agent_aws.json','utf8'));
assert.match(localGuard,/assertLocalDynamoEndpoint/);
assert.match(localGuard,/Only a loopback HTTP/);
assert.match(config,/P00 starter only supports local\/test/);
assert.match(config,/assertLocalDynamoEndpoint/);
assert.match(db,/assertLocalDynamoEndpoint/);
assert.match(db,/accessKeyId:'local',secretAccessKey:'local'/);
assert.match(ex,/MEDIA_STORAGE_DRIVER=local/);
assert.match(root,/NEVER inspect/);
assert.match(policy,/Deny AWS actions by default/);
assert.ok(denial.Statement.some(x=>x.Effect==='Deny'&&x.Action==='*'&&x.Resource==='*'));
const dirs=['scripts/db','scripts/verify','scripts/dev'];
const forbidden=[/(?:^|\n)\s*(?:&\s*)?aws\s+(?:s3|s3api|cloudfront|dynamodb|iam|cloudformation|ses|secretsmanager)\b/im, /\bterraform\s+apply\b/i, /\b(?:PutObjectCommand|DeleteObjectCommand|CreateBucketCommand|CreateDistributionCommand|CreateTableCommandRemote)\b/];
let count=0;
for(const dir of dirs)for(const name of await readdir(dir)){
  if(!/\.(?:mjs|ps1|js|ts)$/.test(name)||name==='cloud-operation-guard.mjs')continue;
  const rel=path.join(dir,name),t=await readFile(rel,'utf8');
  for(const re of forbidden)assert.doesNotMatch(t,re,`${rel} seems to call a real AWS mutating command; reject for owner review`);
  count++;
}
console.log(`PASS: offline cloud-operation safety checks: loopback DB, local media default, deny-all IAM reference, ${count} scripts inspected`);
