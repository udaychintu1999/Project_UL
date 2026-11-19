import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root=process.cwd();
const hub='docs/p03/';
const expected=['README.md','01_USER_JOURNEYS.md','02_GEO_DATA_STORAGE_AND_H3.md',
  '03_API_REFERENCE.md','04_ACCEPTANCE_AND_RELEASE_GATES.md',
  '05_POINTER_LIFECYCLE_AND_SAFETY.md','06_NEXT_STAGES_ROADMAP.md'];
test('P03 documentation has one focused handbook and no superseded manuals',()=>{
  const actual=readdirSync(hub).sort();
  assert.deepEqual(actual, [...expected].sort());
  const intro=readFileSync(hub+'README.md','utf8');
  for(const name of expected.slice(1))assert.ok(intro.includes(name),name);
  for(const path of ['docs/P03_READ_ME_FIRST.md','docs/handoff/TECHNICAL_DOCS_INDEX.md',
    'docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md',
    'docs/architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md',
    'docs/architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md',
    'docs/architecture/P03_3_PRIVATE_POINTER_LIFECYCLE.md',
    'docs/qa/P03_3_POINTER_LIFECYCLE_IMPLEMENTATION_EVIDENCE.md'])
    assert.equal(existsSync(path),false,`obsolete document remains: ${path}`);
  for(const dir of ['docs/manual','docs/api','docs/architecture','docs/qa'])
    assert.equal(readdirSync(dir).filter(name=>/^P03.*\.md$/.test(name)).length,0,dir);
});
test('every maintained P03 Markdown link points to an existing file',()=>{
  for(const name of expected){
    const file=hub+name;
    const data=readFileSync(file,'utf8');
    for(const match of data.matchAll(/(?<!!)\[[^\]\n]+\]\(([^)]+)\)/g)){
      const uri=match[1].split('#')[0];
      if(!uri||/^(?:https?:|mailto:)/.test(uri))continue;
      assert.ok(existsSync(resolve(dirname(file),uri)),`${file} -> ${uri}`);
    }
  }
});
test('living technical facts survive consolidation; original evidence is correctly scoped',()=>{
  const geo=readFileSync(hub+'02_GEO_DATA_STORAGE_AND_H3.md','utf8');
  const api=readFileSync(hub+'03_API_REFERENCE.md','utf8');
  const proof=readFileSync(hub+'04_ACCEPTANCE_AND_RELEASE_GATES.md','utf8');
  const safety=readFileSync(hub+'05_POINTER_LIFECYCLE_AND_SAFETY.md','utf8');
  for(const text of ['CloudFront','ULUV_GEO_CANONICAL_MANIFEST_SHA256','server-index-manifest.json',
    'sha256','CC BY','India boundary','H3','DynamoDB','PIN'])assert.ok(geo.includes(text),text);
  for(const route of ['/v1/me/geo/manual','/v1/me/geo/location','/v1/me/geo/gps','/v1/profiles/me'])
    assert.ok(api.includes(route),route);
  for(const term of ['15/15','11/11','81/81','7/7','MANUAL PENDING','NOT YET OWNER-RUN'])
    assert.ok(proof.includes(term),term);
  for(const term of ['restricted','requestedActive','TransactWrite','both','orphan','block'])
    assert.ok(safety.includes(term),term);
  assert.match(api,/Nonexistent public interfaces/);
  assert.match(proof,/No public|no public discovery/i);
});

test('one-time migration only removes an exact P03 allowlist after explicit -Apply',()=>{
  const manifest=readFileSync('scripts/release/p03-3-superseded-docs.txt','utf8')
    .split(/\r?\n/).filter(x=>x && !x.startsWith('#'));
  assert.equal(manifest.length,36);
  assert.equal(new Set(manifest).size,36);
  assert.ok(manifest.every(x=>x.startsWith('docs/')&&!x.includes('..')&&!/P01|P02|p02/.test(x)));
  const script=readFileSync('scripts/release/remove-p03-superseded-docs.ps1','utf8');
  assert.match(script,/param\(\[switch\]\$Apply\)/);
  assert.match(script,/canonical/);
  assert.match(script,/DRY-RUN/);
  assert.match(script,/if \(-not \$Apply\)/);
  assert.match(script,/Remove-Item -LiteralPath \$file.Full -Force/);
  assert.doesNotMatch(script,/DeleteTable|aws s3|ScanCommand|P01_|P02_/);
});
