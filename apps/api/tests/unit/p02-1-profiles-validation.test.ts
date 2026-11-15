import test from 'node:test';
import assert from 'node:assert/strict';
import { draftMissing, normalizeHandle, parseDraft, parseHandleInput, parseMode, validPublicText } from '../../src/features/profiles/validation.ts';

const valid = { expectedVersion: 0, displayName: 'Asha', bio: 'Reading and coffee.', interests: ['Reading', 'Art'], intention: 'New connections' };

test('P02-1: ASCII handles are canonical and reserved/prohibited names rejected', () => {
  assert.equal(normalizeHandle(' @Alice_27 '), 'alice_27');
  for (const bad of ['admin', 'ULUV', 'support', 'ñora', 'a', '123abc', 'a.b', 'a/b', 'a'.repeat(25), '', '\u202eabc']) {
    assert.equal(normalizeHandle(bad), null, `must reject ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(parseHandleInput({ handle: 'Abc_27', expectedRevision: 1 }), { value: { handle: 'abc_27', expectedRevision: 1 } });
  assert.deepEqual(parseHandleInput({ handle: 'abc', expectedRevision: 0 }), { error: 'invalid_identity_revision' });
  assert.deepEqual(parseHandleInput({ handle: 'abc', expectedRevision: 1, uid: 'someone' }), { error: 'invalid_handle' });
});

test('P02-1: public drafts reject contact details and spoofing', () => {
  for (const text of ['call me 9876543210', 'me@email.com', '@privatehandle', 'example.org', 'https://example.org', 'www.example.org',
    'Instagram: mypage', 'scan my qr', 'DM me', '<script>test</script>', '\u202ehidden']) {
    assert.equal(validPublicText(text), false, `public contact pattern ${JSON.stringify(text)}`);
    assert.deepEqual(parseDraft({ ...valid, bio: text }), { error: 'invalid_profile_text' });
  }
  assert.equal(validPublicText('I enjoy walking, reading and music.'), true);
  assert.ok('value' in parseDraft(valid));
});

test('P02-1: draft version 0 creates; incomplete fields may save; attempts to set server-owned fields fail', () => {
  const incomplete = parseDraft({ expectedVersion: 0, displayName: '', bio: '', interests: [], intention: '' });
  assert.ok('value' in incomplete);
  assert.deepEqual(parseDraft({ ...valid, requestedActive: true }), { error: 'invalid_profile_fields' });
  assert.deepEqual(parseDraft({ ...valid, uniqueId: 'forged' }), { error: 'invalid_profile_fields' });
  assert.deepEqual(parseDraft({ ...valid, age: 19 }), { error: 'invalid_profile_fields' });
  assert.deepEqual(parseDraft({ ...valid, photoIds: ['foreign'] }), { error: 'invalid_profile_fields' });
  assert.deepEqual(parseDraft({ ...valid, expectedVersion: -1 }), { error: 'invalid_profile_version' });
  assert.deepEqual(parseDraft({ ...valid, expectedVersion: 1.5 }), { error: 'invalid_profile_version' });
});

test('P02-1: interests are bounded and cannot contain duplicates or contact solicitation', () => {
  assert.deepEqual(parseDraft({ ...valid, interests: ['Art', 'art'] }), { error: 'duplicate_interests' });
  assert.deepEqual(parseDraft({ ...valid, interests: Array(11).fill('Reading') }), { error: 'invalid_interests' });
  assert.deepEqual(parseDraft({ ...valid, interests: ['@social'] }), { error: 'invalid_interests' });
  assert.deepEqual(parseDraft({ ...valid, interests: ['A'.repeat(33)] }), { error: 'invalid_interests' });
  assert.deepEqual(parseDraft({ ...valid, interests: ['Fishing', 4] }), { error: 'invalid_interests' });
});

test('P02-1: the two profile modes are only exact approved strings; completeness remains non-active without photos', () => {
  assert.equal(parseMode('dating'), 'dating');
  assert.equal(parseMode('friendship'), 'friendship');
  assert.equal(parseMode('DATING'), null);
  assert.equal(parseMode('local'), null);
  assert.deepEqual(draftMissing(valid, 'asha99', 'Hyderabad', []), ['photos']);
  assert.deepEqual(draftMissing(valid, null, null, []), ['handle', 'photos', 'locality']);
  assert.deepEqual(draftMissing({ displayName: '', bio: '', interests: [], intention: '' }, null, null, []),
    ['handle', 'displayName', 'intention', 'photos', 'locality']);
});

import { ageFromBirthDate, onboardingMissing, parseSetup } from '../../src/features/profiles/validation.ts';

test('P02-1 onboarding: shared setup enforces broad locality, private enums and exact keys', () => {
  const input = { expectedRevision: 0, commonName: 'Example Name', locality: 'Hyderabad', gender: 'prefer_not_to_say',
    selectedModes: { dating: true, friendship: false } };
  assert.deepEqual(parseSetup(input), { value: input });
  assert.deepEqual(parseSetup({ ...input, locality: '16 Park Lane' }), { error: 'invalid_broad_locality' });
  assert.deepEqual(parseSetup({ ...input, locality: '17.3850, 78.4867' }), { error: 'invalid_broad_locality' });
  assert.deepEqual(parseSetup({ ...input, locality: 'contact@example.com' }), { error: 'invalid_broad_locality' });
  assert.deepEqual(parseSetup({ ...input, birthDate: '2000-01-01' }), { error: 'invalid_shared_profile_fields' });
  assert.deepEqual(parseSetup({ ...input, selectedModes: { dating: 'true', friendship: false } }), { error: 'invalid_mode_selection' });
  assert.deepEqual(parseSetup({ ...input, gender: 'unknown' }), { error: 'invalid_gender' });
});

test('P02-1 onboarding: one selected complete mode is enough; selected incomplete modes block', () => {
  const shared = { commonName: 'Common Name', locality: 'Hyderabad', gender: '' as const,
    selectedModes: { dating: true, friendship: false } };
  const filled = { displayName: '', bio: 'My hobbies include art and hiking.',
    interests: ['Art'], intention: 'A meaningful relationship' };
  assert.deepEqual(onboardingMissing('validhandle', shared, { dating: filled }), []);
  assert.deepEqual(onboardingMissing('validhandle', {
    ...shared, selectedModes: { dating: true, friendship: true }
  }, { dating: filled }), ['friendship.draft']);
  assert.deepEqual(onboardingMissing('validhandle', {
    ...shared, selectedModes: { dating: false, friendship: false }
  }, { dating: filled }), ['selectMode']);
  assert.deepEqual(onboardingMissing('validhandle', shared, { dating: { ...filled, interests: [] } }), ['dating.interests']);
  assert.deepEqual(onboardingMissing(null, shared, { dating: filled }), ['handle']);
});

test('P02-1 onboarding: age is derived from self-declared DOB, never client-specified', () => {
  const today = new Date('2026-11-15T12:00:00Z');
  assert.equal(ageFromBirthDate('2000-11-15', today), 26);
  assert.equal(ageFromBirthDate('2000-11-16', today), 25);
  assert.equal(ageFromBirthDate('2009-11-15', today), null);
  assert.equal(ageFromBirthDate('2020-02-30', today), null);
});
