import assert from 'node:assert/strict';
import test from 'node:test';
import { flutterAppDirectory, runTask, tasks, usage } from '../flutter-workflow.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('commands always execute from flutter_app, regardless of caller directory', () => {
  assert.equal(flutterAppDirectory, appDir);
  const calls = [];
  const runner = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  assert.equal(runTask('quick', runner), 0);
  assert.deepEqual(calls.map(({command,args}) => [command,...args]), [
    ['flutter','analyze'],['flutter','test']
  ]);
  for (const call of calls) assert.equal(call.options.cwd, appDir);
});

test('format write is strictly opt-in and not part of quick', () => {
  assert.deepEqual(tasks['format:write'], [['dart','format','lib','test','integration_test']]);
  assert.ok(!tasks.quick.some(step => step[1] === 'format'));
  assert.deepEqual(tasks['format:check'][0].slice(0, 4),
    ['dart','format','--output=none','--set-exit-if-changed']);
});

test('fails closed on tool error and does not execute later stages', () => {
  let n = 0;
  const runner = () => {n++;return {status: 42};};
  assert.equal(runTask('quick', runner), 42);
  assert.equal(n, 1);
});

test('unrecognized commands never invoke a shell or external tool', () => {
  let called = false;
  assert.equal(runTask('run-production', () => {called=true;return {status:0};}), 2);
  assert.equal(called, false);
  assert.match(usage, /npm run verify:p01-3/);
});
