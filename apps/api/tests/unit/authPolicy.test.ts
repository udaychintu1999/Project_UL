import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEmail,isAdultBirthDate,keyedHash,equalDigest,validOtp,bearerToken,challengeState} from '../../src/features/auth/policy.ts';

test('normalize email without unverified identity aliasing',()=>{
  assert.equal(normalizeEmail('  TEst.User@Example.COM '),'test.user@example.com');
  assert.equal(normalizeEmail('a..b@example.com'),null);
  assert.equal(normalizeEmail('missing-at'),null);
  assert.equal(normalizeEmail({email:'a@example.com'}),null);
});
test('strict date parsing and UTC 18th birthday boundary including leap years',()=>{
  const today=new Date('2026-11-13T14:00:00Z');
  assert.equal(isAdultBirthDate('2008-11-13',today),true);
  assert.equal(isAdultBirthDate('2008-11-14',today),false);
  assert.equal(isAdultBirthDate('2000-02-29',today),true);
  assert.equal(isAdultBirthDate('2007-02-29',today),false);
  assert.equal(isAdultBirthDate('2027-01-01',today),false);
  assert.equal(isAdultBirthDate('1899-12-31',today),false);
  assert.equal(isAdultBirthDate('2026-1-3',today),false);
});
test('identity hashing is secret- and purpose-separated',()=>{
  const secret='a'.repeat(32), value='user@example.com';
  const digest=keyedHash(secret,'email-subject',value);
  assert.equal(digest.length,64);
  assert.notEqual(digest,keyedHash(secret,'session',value));
  assert.notEqual(digest,keyedHash('b'.repeat(32),'email-subject',value));
  assert.equal(equalDigest(digest,keyedHash(secret,'email-subject',value)),true);
  assert.equal(equalDigest(digest,'abc'),false);
});
test('OTP and bearer parsing strictly reject malformed input',()=>{
  assert.equal(validOtp('000123'),true);
  assert.equal(validOtp(123456),false);
  assert.equal(validOtp('12345'),false);
  assert.equal(bearerToken(`Bearer ${'x'.repeat(43)}`),'x'.repeat(43));
  assert.equal(bearerToken(`Basic ${'x'.repeat(43)}`),null);
  assert.equal(bearerToken(`Bearer ${'x'.repeat(42)}!`),null);
});

test('OTP expiry and lockout are deterministic',()=>{
  assert.equal(challengeState(1001,0,1000),'valid');
  assert.equal(challengeState(1000,0,1000),'expired');
  assert.equal(challengeState(999,0,1000),'expired');
  assert.equal(challengeState(1001,5,1000),'exhausted');
  assert.equal(challengeState(1001,4,1000),'valid');
});
