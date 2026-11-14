/** Shared, server-enforced rolling email issuance budget for P01-2 local auth.
 * A single versioned record is shared by signup, email login, and recovery.
 * Only a committed challenge consumes quota. No sender secrets or OTPs persist in this record.
 */
import {randomInt, randomUUID} from 'node:crypto';
import {GetCommand, TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import type {DynamoDBDocumentClient, TransactWriteCommandInput} from '@aws-sdk/lib-dynamodb';

import {decideEmailBudget, EMAIL_ROLLING_SECONDS, OTP_COOLDOWN_SECONDS} from './email-budget-policy.js';

type IssueOptions = {
  db:DynamoDBDocumentClient;
  emailHash:string;
  requestId:string;
  makeItems:(value:{code:string;nonce:string;version:string;now:number})=>NonNullable<TransactWriteCommandInput['TransactItems']>;
  onIssued:(value:{code:string;now:number})=>void;
};
const TABLE='uluv_auth_links';
const isConflict=(error:unknown)=>error instanceof Error &&
  (error.name==='TransactionCanceledException'||error.name==='ConditionalCheckFailedException');

export function requestIdFromHeader(value:unknown):string|null {
  if(value===undefined)return randomUUID(); // Backward compatibility with older clients/tests.
  return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

/** All challenge writes and the shared budget write commit in ONE transaction. */
export async function issueEmailChallenge(options:IssueOptions):Promise<'issued'|'not_issued'> {
  const key={PK:`OTP#EMAIL#${options.emailHash}`,SK:'RATE'};
  for(let retry=0;retry<8;retry++) {
    const now=Math.floor(Date.now()/1000);
    const previous=(await options.db.send(new GetCommand({TableName:TABLE,Key:key,ConsistentRead:true}))).Item;
    // One-time conservative migration of both historical per-purpose hourly
    // counters. After the first successful shared write these are ignored.
    const legacyRecovery=!Array.isArray(previous?.issuances)
      ? (await options.db.send(new GetCommand({TableName:TABLE,
          Key:{PK:`PASSWORD#RESET#${options.emailHash}`,SK:'RATE'},ConsistentRead:true}))).Item
      : undefined;
    const source=!Array.isArray(previous?.issuances) && legacyRecovery
      ? {...previous,legacyRecovery} : previous;
    const plan=decideEmailBudget(source,now,options.requestId);
    if(plan.decision!=='issue')return 'not_issued';
    const version=randomUUID(),nonce=randomUUID();
    const code=String(randomInt(0,1000000)).padStart(6,'0');
    const entries=plan.entries;
    const rateItem={...key,version,issuances:entries,nextAllowedAt:now+OTP_COOLDOWN_SECONDS,
      expiresAt:entries[entries.length-1].at+EMAIL_ROLLING_SECONDS+3600};
    const rateWrite={Put:{TableName:TABLE,Item:rateItem,
      ConditionExpression:previous?'#v = :old':'attribute_not_exists(PK)',
      ExpressionAttributeNames:previous?{'#v':'version'}:undefined,
      ExpressionAttributeValues:previous?{':old':previous.version}:undefined}};
    try {
      await options.db.send(new TransactWriteCommand({TransactItems:[rateWrite,...options.makeItems({code,nonce,version,now})]}));
      options.onIssued({code,now});
      return 'issued';
    }catch(error){if(!isConflict(error))throw error;}
  }
  // Never issue outside a successful transaction. A caller may retry with the same ID.
  return 'not_issued';
}
