import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { activationMissing, modeVisibility, parseActivation, privatePreview } from '../../src/features/profiles/activation-policy.ts';
const shared = { commonName: 'Alex', locality: 'Hyderabad', gender: 'prefer_not_to_say' as const,
  selectedModes: { dating: true, friendship: false } };
const record = { displayName: '', bio: 'I enjoy books', interests: ['Books', 'Music', 'Art', 'Cycling'],
  intention: 'Looking for a connection', photoIds: ['a', 'b'] };

test('P02-3 activation rejects extra fields and invalid versions', () => {
  assert.deepEqual(parseActivation({ expectedVersion: 2 }, true), { value: { active: true, expectedVersion: 2 } });
  for (const input of [{ active: true, expectedVersion: 0 }, { active: 'true', expectedVersion: 1 },
    { active: true, expectedVersion: 1, publicVisible: true }, null]) {
    assert.ok('error' in parseActivation(input, true));
  }
});
test('P02-3 independently validates selected mode, images, DOB and text', () => {
  assert.deepEqual(activationMissing('dating', 'alex_123', shared, record, 36), []);
  assert.ok(activationMissing('friendship', 'alex_123', shared, record, 36).includes('mode_not_selected'));
  assert.ok(activationMissing('dating', 'alex_123', shared, { ...record, photoIds: ['a'] }, 36).includes('dating.photos'));
  assert.ok(activationMissing('dating', 'alex_123', shared, record, null).includes('ageEligibility'));
});
test('P02-3 public eligibility ALWAYS fails closed without a trusted pointer', () => {
  assert.equal(modeVisibility(false, true, [], 1, 1, 2, 2), 'inactive');
  assert.equal(modeVisibility(true, false, [], 1, 1, 2, 2), 'paused_ineligible');
  assert.equal(modeVisibility(true, true, [], 1, 2, 2, 2), 'paused_ineligible');
  assert.equal(modeVisibility(true, true, [], 1, 1, 2, 2), 'pending_trusted_locality');
  assert.equal(modeVisibility(true, true, [], 1, 1, 2, 3), 'paused_ineligible',
    'changing the public handle invalidates the old activation intent');
});
test('P02-3 preview allowlists fields, limits interests/photos, never exposes DOB or UID', () => {
  const out = privatePreview('dating', 'alex_123', shared, record, 36);
  assert.deepEqual(out.photoIds, ['a', 'b']);
  assert.deepEqual(out.interests, ['Books', 'Music', 'Art']);
  assert.equal(out.publicVisible, false);
  for (const forbidden of ['birthDate', 'email', 'uniqueId', 'coordinates', 'mediaPath', 'sessionEpoch']) {
    assert.equal(forbidden in out, false);
  }
});
