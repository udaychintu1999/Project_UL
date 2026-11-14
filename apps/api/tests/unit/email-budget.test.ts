import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decideEmailBudget,EMAIL_DAILY_LIMIT, EMAIL_ROLLING_SECONDS} from '../../src/features/auth/email-budget-policy.ts';

const now=2000000;
const id=(n:number)=>`request-${n}`;
test('shared rolling email cap permits exactly five committed entries',()=>{
  let prior:Record<string,unknown>|undefined;
  for(let i=0;i<5;i++) {
    const at=now+i*60;
    const choice=decideEmailBudget(prior,at,id(i));
    assert.equal(choice.decision,'issue');
    if(choice.decision==='issue') prior={issuances:choice.entries,nextAllowedAt:at+60};
  }
  assert.equal((prior!.issuances as unknown[]).length,EMAIL_DAILY_LIMIT);
  assert.equal(decideEmailBudget(prior,now+600,id(6)).decision,'exhausted');
  assert.equal(decideEmailBudget(prior,now+EMAIL_ROLLING_SECONDS,id(6)).decision,'issue',
    'exact 24h-old issuance must stop counting');
});
test('idempotency check precedes cooldown and quota; duplicate does not issue',()=>{
  const prior={issuances:[{at:now,requestId:'same'}],nextAllowedAt:now+60};
  assert.equal(decideEmailBudget(prior,now+1,'same').decision,'duplicate');
  assert.equal(decideEmailBudget(prior,now+1,'new').decision,'cooldown');
  assert.equal(decideEmailBudget(prior,now+60,'new').decision,'issue');
});
test('purpose does not participate in budget; all flows share same email record',()=>{
  let record:Record<string,unknown>|undefined;
  for(const [i,purpose] of ['signup','login','recovery','login','recovery'].entries()) {
    const result=decideEmailBudget(record,now+i*61,`${purpose}-${i}`);
    assert.equal(result.decision,'issue');
    if(result.decision==='issue') record={issuances:result.entries,nextAllowedAt:now+i*61+60};
  }
  assert.equal(decideEmailBudget(record,now+2000,'signup-sixth').decision,'exhausted');
});
test('legacy hourly rate record is conservatively migrated',()=>{
  const legacy={issuedCount:3,windowEndAt:now+1800,nextAllowedAt:now};
  const planned=decideEmailBudget(legacy,now,'new');
  assert.equal(planned.decision,'issue');
  if(planned.decision==='issue')assert.equal(planned.entries.length,4);
});
test('cooldown & TTL ignore device timezone and persisted TTL cleanups',()=>{
  const record={issuances:[{at:now-EMAIL_ROLLING_SECONDS,requestId:'expired'}],nextAllowedAt:now-1,expiresAt:now+50};
  const plan=decideEmailBudget(record,now,'fresh');
  assert.equal(plan.decision,'issue');
  if(plan.decision==='issue')assert.equal(plan.entries.length,1);
});

test('migration counts both former signup/login and password-recovery hourly budgets',()=>{
  const old={issuedCount:3,windowEndAt:now+1800,nextAllowedAt:now,
    legacyRecovery:{issuedCount:2,windowEndAt:now+1800,nextAllowedAt:now}};
  assert.equal(decideEmailBudget(old,now,'new').decision,'exhausted',
    'do not give five new emails simply because an old recovery counter was separate');
  const cooled={...old,legacyRecovery:{issuedCount:1,windowEndAt:now+1800,nextAllowedAt:now+60}};
  assert.equal(decideEmailBudget(cooled,now,'new').decision,'cooldown');
});
