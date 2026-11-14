/** Deterministic, backend-authoritative per-address rolling-24h email budget. */
export const OTP_COOLDOWN_SECONDS = 60; // Identical to the existing P01 OTP cooldown; regression guard checks both.
export const EMAIL_DAILY_LIMIT = 5;
export const EMAIL_ROLLING_SECONDS = 86400;
export type BudgetEntry = {at:number;requestId:string};
export type BudgetDecision =
  | {decision:'issue';entries:BudgetEntry[]}
  | {decision:'duplicate'|'cooldown'|'exhausted'};

/** Pure deterministic model; TTL is NOT the source of truth for quota expiration. */
export function decideEmailBudget(previous:Record<string,unknown>|undefined, now:number, requestId:string):BudgetDecision {
  const raw=previous?.issuances;
  let entries:BudgetEntry[] = Array.isArray(raw)
    ? raw.filter((v):v is BudgetEntry=>v!=null && typeof v==='object' &&
      Number.isSafeInteger((v as BudgetEntry).at) && typeof (v as BudgetEntry).requestId==='string')
    : [];
  // Conservative migration of the former per-email hourly record. Its precise
  // individual issue times were not retained; do not reset an active counter.
  if (!Array.isArray(raw) && previous && Number(previous.windowEndAt)>now) {
    const count=Math.min(EMAIL_DAILY_LIMIT,Math.max(0,Number(previous.issuedCount)||0));
    const start=Number(previous.windowEndAt)-3600;
    entries=Array.from({length:count},(_,i)=>({at:start,requestId:`legacy-${i}`}));
  }
  // The old recovery endpoint had an independent hourly counter. During the
  // upgrade, reserve its remaining issuances too so old recovery traffic
  // cannot obtain a free new daily budget. Only used until the new record is written.
  const oldRecovery=previous?.legacyRecovery as Record<string,unknown>|undefined;
  if(!Array.isArray(raw) && oldRecovery && Number(oldRecovery.windowEndAt)>now) {
    const oldCount=Math.min(EMAIL_DAILY_LIMIT,Math.max(0,Number(oldRecovery.issuedCount)||0));
    const start=Number(oldRecovery.windowEndAt)-3600;
    entries.push(...Array.from({length:oldCount},(_,i)=>({at:start,requestId:`legacy-reset-${i}`})));
  }
  entries=entries.filter(item=>item.at>now-EMAIL_ROLLING_SECONDS && item.at<=now);
  if(entries.some(item=>item.requestId===requestId))return {decision:'duplicate'};
  const nextAllowedAt=Array.isArray(raw)?Number(previous?.nextAllowedAt)||0
    : Math.max(Number(previous?.nextAllowedAt)||0,Number(oldRecovery?.nextAllowedAt)||0);
  if(nextAllowedAt>now)return {decision:'cooldown'};
  if(entries.length>=EMAIL_DAILY_LIMIT)return {decision:'exhausted'};
  return {decision:'issue',entries:[...entries,{at:now,requestId}]};
}

