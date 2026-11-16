import test from 'node:test';
import assert from 'node:assert/strict';
import { P02_5_STAGES, executeP02_5 } from './p02-5-plan.mjs';

test('P02-5 runs visual contracts then existing full P02-4 without duplicating device suites', () => {
  assert.deepEqual(P02_5_STAGES.map(([, command]) => command),
    ['test:p02-5:contracts', 'verify:p02-4']);
});

test('P02-5 fails closed on unsuccessful stage and never claims success', () => {
  const called = [], notices = [];
  const ok = executeP02_5(P02_5_STAGES,
    (command) => { called.push(command); return { status: command === 'test:p02-5:contracts' ? 1 : 0 }; },
    (message) => notices.push(message));
  assert.equal(ok, false);
  assert.deepEqual(called, ['test:p02-5:contracts']);
  assert.equal(notices.some((line) => line.includes('PASS gate 2')), false);
  assert.equal(executeP02_5(P02_5_STAGES, () => ({ status: 0 })), true);
  assert.equal(executeP02_5(P02_5_STAGES, () => { throw Error('sensitive'); }), false);
  assert.equal(executeP02_5(P02_5_STAGES, () => ({ status: null, signal: 'SIGTERM' })), false);
});
