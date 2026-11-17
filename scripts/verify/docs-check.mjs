import {existsSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
let count=0;
function required(p){assert.ok(existsSync(p),`Missing ${p}`);count++;}
for(const p of ['README.md','AGENTS.md','docs/START_HERE.md','docs/implementation/PHASE_MASTER.md','docs/architecture/TABLE_CATALOG_v0_3.json','apps/api/src/app.ts','apps/flutter_app/lib/main.dart','scripts/db/provision.mjs','infra/local/README.md','scripts/dev/start-local.ps1','scripts/dev/stop-local.ps1','docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md','docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md','docs/architecture/12_BILLING_PROVIDER_STRATEGY.md','docs/security/00_NON_NEGOTIABLE_GUARDS.md','docs/security/02_CLOUD_ACTION_APPROVAL.md','docs/architecture/13_TWO_BUCKET_MEDIA_ARCHITECTURE.md','docs/architecture/14_FEATURE_MODULE_STRUCTURE.md','docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md']) required(p);
for(let n=0;n<18;n++){
 const id=`P${String(n).padStart(2,'0')}`;
 const path=`docs/implementation/phases/${id}.md`;required(path);
 const data=readFileSync(path,'utf8');
 // P02 was intentionally consolidated by the owner after acceptance. Its
 // milestone/checkpoint guide replaces the older six-section phase template.
 // Verify the canonical split docs instead of requiring deleted P02 prose.
 if (id === 'P02' && data.includes('# P02 — Dating/Friendship profile foundation (completed local milestone)')) {
   assert.ok(data.includes('## Milestones') && data.includes('## P02 boundary'), 'P02 consolidated guide incomplete');
   for (const p of ['docs/p02/README.md','docs/p02/01_PRODUCT_AND_USER_JOURNEY.md',
     'docs/p02/02_TECHNICAL_AND_PRIVACY_CONTRACT.md',
     'docs/p02/03_UI_VISUAL_REFERENCE.md','docs/p02/04_VERIFICATION_AND_ACCEPTANCE.md']) required(p);
 } else {
   for(const item of ['D1','D2','D3','T1','T2','T3']) assert.ok(data.includes('### '+item+' '),`Missing ${item} in ${id}`);
 }
}
assert.ok(!existsSync('infra/local/compose.yml'),'Obsolete Docker compose file present');
const catalog=JSON.parse(readFileSync('docs/architecture/TABLE_CATALOG_v0_3.json','utf8'));
assert.equal(catalog.table_count,18);assert.equal(catalog.tables.length,18);
assert.equal(new Set(catalog.tables.map(x=>x.name)).size,18);
assert.equal(catalog.tables.some(x=>x.name==='uluv_relationships'),false);
console.log(`PASSED: ${count} required paths, 18 phase documentation contracts, 18 unique tables`);
