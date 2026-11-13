import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Uses controlled synthetic files inside a throwaway directory; NEVER touches
// apps/api/.env in the project or any owner-managed configuration.
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const original = join(root, 'scripts/dev/generate-token.mjs');

function fixtureTest(fn) {
  const fixture = mkdtempSync(join(tmpdir(), 'uluv-env-test-'));
  const scriptDir = join(fixture, 'scripts/dev');
  const apiDir = join(fixture, 'apps/api');
  try {
    mkdirSync(scriptDir, {recursive:true});
    mkdirSync(apiDir, {recursive:true});
    copyFileSync(original, join(scriptDir, 'generate-token.mjs'));
    writeFileSync(join(fixture,'package.json'), '{"type":"module"}');
    writeFileSync(join(apiDir, '.env.example'), 'APP_ENV=local\nULUV_DEV_TOKEN=REPLACE_WITH_OWNER_GENERATED_LOCAL_TOKEN\n');
    const run = () => spawnSync(process.execPath, [join(scriptDir, 'generate-token.mjs')], {
      encoding:'utf8', cwd:fixture, env:{...process.env},
    });
    fn({apiDir, run});
  } finally {
    rmSync(fixture, {recursive:true, force:true});
  }
}

test('env:init generates a token once from the example; never prints it', () => {
  fixtureTest(({apiDir,run}) => {
    const one = run();
    assert.equal(one.status,0,one.stderr);
    const result = readFileSync(join(apiDir,'.env'),'utf8'); // synthetic fixture only
    const token = result.match(/^ULUV_DEV_TOKEN=([0-9a-f]{64})$/m)?.[1];
    assert.ok(token);
    assert.ok(!one.stdout.includes(token));
    assert.match(one.stdout,/Created apps\/api\/\.env/);
    const two = run();
    assert.equal(two.status,0,two.stderr);
    assert.equal(readFileSync(join(apiDir,'.env'),'utf8'),result);
    assert.match(two.stdout,/already exists; kept unchanged/);
  });
});

test('env:init never opens or changes existing synthetic owner config', () => {
  fixtureTest(({apiDir,run}) => {
    const existing = 'APP_ENV=local\nULUV_DEV_TOKEN=existing_synthetic_value\n';
    writeFileSync(join(apiDir,'.env'),existing);
    const runResult = run();
    assert.equal(runResult.status,0,runResult.stderr);
    assert.equal(readFileSync(join(apiDir,'.env'),'utf8'),existing);
    assert.match(runResult.stdout,/kept unchanged/);
    assert.doesNotMatch(runResult.stdout,/existing_synthetic_value/);
  });
});

test('env:init refuses a missing placeholder without creating a file', () => {
  fixtureTest(({apiDir,run}) => {
    writeFileSync(join(apiDir,'.env.example'),'APP_ENV=local\n');
    const result = run();
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Invalid \.env\.example/);
    assert.equal(existsSync(join(apiDir,'.env')),false);
  });
});
