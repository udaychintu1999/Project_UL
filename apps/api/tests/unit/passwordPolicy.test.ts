import test from 'node:test';
import assert from 'node:assert/strict';
import {validPassword, compromisedCandidate, canonicalPassword, remainingWindow, PASSWORD_MIN_LENGTH, LOGIN_ATTEMPT_LIMIT} from '../../src/features/auth/password-policy.ts';
test('P01-2: NIST single-factor policy requires 15 Unicode code points, no composition',()=>{
  assert.equal(PASSWORD_MIN_LENGTH,15);
  for(const value of ['fifteen letters yes','correct horse battery staple','123456789012345','hello wonderful world','🎉'.repeat(15),'Long passphrase with spaces.']) assert.equal(validPassword(value),true);
  for(const value of ['Abc@123','Hello@12345678','12345678901234','a\n'.repeat(8)])assert.equal(validPassword(value),false);
  assert.equal(validPassword('A'.repeat(64)),true);
  assert.equal(validPassword('A'.repeat(256)),true);
  assert.equal(validPassword('A'.repeat(257)),false);
  assert.equal(canonicalPassword('e\u0301'.repeat(15)),'é'.repeat(15));
  assert.equal(validPassword('e\u0301'.repeat(15)),true);
  assert.equal(validPassword('x'.repeat(14)+'\u0000'),false);
});
test('P01-2: whole password blocklist and attempt windows',()=>{
  assert.equal(compromisedCandidate('123456789012345'),true);
  assert.equal(compromisedCandidate('correcthorsebatterystaple'),true);
  assert.equal(compromisedCandidate('different correct horse!'),false);
  assert.equal(LOGIN_ATTEMPT_LIMIT,10);
  assert.equal(remainingWindow(100,99),true);
  assert.equal(remainingWindow(100,100),false);
});
