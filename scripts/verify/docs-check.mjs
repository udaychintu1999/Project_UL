import {existsSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
let count=0;
function required(p){assert.ok(existsSync(p),`Missing ${p}`);count++;}
for(const p of ['README.md','AGENTS.md','docs/START_HERE.md','docs/implementation/PHASE_MASTER.md','docs/architecture/TABLE_CATALOG_v0_3.json','apps/api/src/app.ts','apps/flutter_app/lib/main.dart','scripts/db/provision.mjs','infra/local/README.md','scripts/dev/start-local.ps1','scripts/dev/stop-local.ps1','docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md','docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md','docs/architecture/12_BILLING_PROVIDER_STRATEGY.md','docs/security/00_NON_NEGOTIABLE_GUARDS.md','docs/security/02_CLOUD_ACTION_APPROVAL.md','docs/architecture/13_TWO_BUCKET_MEDIA_ARCHITECTURE.md','docs/architecture/14_FEATURE_MODULE_STRUCTURE.md','docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md']) required(p);
for(let n=0;n<18;n++){
 const id=`P${String(n).padStart(2,'0')}`;
 const path=`docs/implementation/phases/${id}.md`;required(path);
 const data=readFileSync(path,'utf8');
 for(const item of ['D1','D2','D3','T1','T2','T3']) assert.ok(data.includes('### '+item+' '),`Missing ${item} in ${id}`);
}
assert.ok(!existsSync('infra/local/compose.yml'),'Obsolete Docker compose file present');
const catalog=JSON.parse(readFileSync('docs/architecture/TABLE_CATALOG_v0_3.json','utf8'));
assert.equal(catalog.table_count,18);assert.equal(catalog.tables.length,18);
assert.equal(new Set(catalog.tables.map(x=>x.name)).size,18);
assert.equal(catalog.tables.some(x=>x.name==='uluv_relationships'),false);
console.log(`PASSED: ${count} required paths, 18 phase guides, all six sections, 18 unique tables`);
