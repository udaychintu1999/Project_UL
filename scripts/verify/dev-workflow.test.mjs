import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const lint = readFileSync(new URL('../../eslint.config.mjs', import.meta.url), 'utf8');
const prettier = JSON.parse(readFileSync(new URL('../../.prettierrc.json', import.meta.url), 'utf8'));
const ignore = readFileSync(new URL('../../.prettierignore', import.meta.url), 'utf8');
const api = JSON.parse(readFileSync(new URL('../../apps/api/package.json', import.meta.url), 'utf8'));

test('local dev watcher and P01-3 verification commands stay intact', () => {
  assert.equal(api.scripts.dev, 'tsx watch src/server.ts');
  assert.equal(pkg.scripts['dev:api'], 'npm run dev --workspace apps/api');
  assert.equal(pkg.scripts['verify:p01-3'], 'node scripts/verify/p01-3-verifier.mjs');
  assert.equal(pkg.scripts['verify:p01-3:portable'], 'npm run verify:p01-2:portable && npm run test:p01-3:contracts');
});

test('no overlapping runtime watcher, env loader, or HTTP logger packages added', () => {
  for (const name of ['nodemon', 'morgan', 'cross-env']) {
    assert.equal(pkg.devDependencies?.[name], undefined);
    assert.equal(pkg.dependencies?.[name], undefined);
    assert.equal(api.devDependencies?.[name], undefined);
    assert.equal(api.dependencies?.[name], undefined);
  }
  assert.ok(api.dependencies.dotenv);
  assert.ok(api.dependencies.fastify);
  assert.ok(api.devDependencies.tsx);
});

test('code-quality tools are development-only; sensitive code is never auto-rewritten', () => {
  for (const name of ['eslint', 'prettier', 'typescript-eslint', 'pino-pretty']) {
    assert.ok(pkg.devDependencies[name], `${name} must be dev-only`);
    assert.equal(pkg.dependencies?.[name], undefined);
    assert.equal(api.dependencies?.[name], undefined);
  }
  assert.match(pkg.scripts['lint:api'], /^eslint /);
  assert.match(pkg.scripts['format:api:check'], /^prettier --check /);
  assert.match(pkg.scripts['format:api:write'], /^prettier --write /);
  assert.equal(pkg.scripts['check:dev'], 'npm run typecheck && npm run lint');
  assert.doesNotMatch(pkg.scripts['check:dev'], /format|write|install/);
  assert.doesNotMatch(pkg.scripts['verify:p01-3'], /lint|prettier|format/);
  assert.equal(prettier.tabWidth, 2);
  assert.equal(prettier.endOfLine, 'lf');
  assert.match(ignore, /apps\/flutter_app\/\*\*/);
  assert.match(ignore, /package-lock\.json/);
  assert.match(lint, /no-debugger/);
  assert.doesNotMatch(lint, /no-explicit-any.*error/);
});
