import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MEDIA_BYTES, parsePhotoUpdate, validMediaId, validUploadBegin } from '../../src/features/profiles/media-policy.ts';
const one = '11111111-1111-4111-8111-111111111111';
const two = '22222222-2222-4222-8222-222222222222';
test('P02-2 media identifiers are opaque UUIDs and not paths or owners', () => {
  assert.equal(validMediaId(one), true);
  for (const input of ['../secret', 'abc', 'USER#123', '123.png', null]) assert.equal(validMediaId(input), false);
});
test('P02-2 photo mutations enforce expected version, 0–6 unique owner media references', () => {
  assert.deepEqual(parsePhotoUpdate({ expectedVersion: 1, photoIds: [one, two] }),
    { value: { expectedVersion: 1, photoIds: [one, two] } });
  assert.ok('value' in parsePhotoUpdate({ expectedVersion: 1, photoIds: [] }));
  for (const bad of [
    { expectedVersion: 0, photoIds: [] },
    { expectedVersion: 1, photoIds: [one, one] },
    { expectedVersion: 1, photoIds: Array(7).fill(one) },
    { expectedVersion: 1, photoIds: ['../unsafe'] },
    { expectedVersion: 1, photoIds: [], requestedActive: true },
    { expectedVersion: 1, photoIds: 'not an array' },
  ]) assert.ok('error' in parsePhotoUpdate(bad));
});
test('P02-2 upload initiation rejects client-controlled media identity/path', () => {
  assert.equal(validUploadBegin({}), true);
  assert.equal(validUploadBegin({ ownerUid: 'other' }), false);
  assert.equal(validUploadBegin({ mediaId: one }), false);
  assert.equal(MAX_MEDIA_BYTES, 8 * 1024 * 1024);
});
