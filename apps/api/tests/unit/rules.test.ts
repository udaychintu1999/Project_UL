import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPair, monthlyFreeCredits, creditCost, distanceBand, isInsideBand, LIMITS, SEVEN_DAYS_MS, expiryTime} from '../../src/domain/rules.ts';

test('canonical pair remains direction independent',()=>{
  assert.equal(canonicalPair('uB','uA'),'uA#uB');
  assert.equal(canonicalPair('uA','uB'),'uA#uB');
  assert.throws(()=>canonicalPair('uA','uA'));
  assert.throws(()=>canonicalPair('x#bad','uA'));
});
test('women monthly 4, other users monthly 2',()=>{
  assert.equal(monthlyFreeCredits('woman'),4);
  assert.equal(monthlyFreeCredits('other'),2);
});
test('two distinct paid Dating actions and unpaid ordinary like',()=>{
  assert.equal(creditCost('liked_you_like_back'),1);
  assert.equal(creditCost('dating_connect'),1);
  assert.equal(creditCost('friendship_request'),1);
  assert.equal(creditCost('ordinary_like'),0);
});
test('distance band boundary inclusivity',()=>{
  for(const [km,expected] of [[0,'0-10'],[10,'0-10'],[10.000001,'10-35'],[35,'10-35'],[35.000001,'35-50'],[50,'35-50']] as const){
    assert.equal(distanceBand(km),expected);
  }
  assert.throws(()=>distanceBand(-1));
  assert.throws(()=>distanceBand(50.001));
  assert.equal(isInsideBand(10,'10-35'),false);
  assert.equal(isInsideBand(35,'10-35'),true);
  assert.equal(isInsideBand(0,'0-50'),true);
  assert.equal(isInsideBand(50.01,'0-50'),false);
});
test('limits and 7-day expiry',()=>{
  assert.deepEqual([LIMITS.dailyPosts,LIMITS.activePosts,LIMITS.dailyComments,LIMITS.dailyReactions,LIMITS.photosPerPost],[3,5,10,30,5]);
  assert.equal(expiryTime(0),SEVEN_DAYS_MS);
  assert.throws(()=>expiryTime(-1));
});
