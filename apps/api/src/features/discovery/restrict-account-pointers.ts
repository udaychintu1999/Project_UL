/** P03-3 PRIVATE trust-boundary primitive. No Fastify route or public caller.
 * Only a separately authorized, audited staff decision may call this function.
 * Atomically fences the account and revokes its two canonical pointer anchors.
 * A direct use from an untrusted HTTP payload would be a security defect.
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { appendModeRestrictionBarrier, type Mode } from './pointer-lifecycle-policy.js';

const id = (s: string) => /^[-_a-zA-Z0-9]{1,128}$/.test(s);
const accountKey = (uid: string) => ({ PK: `USER#${uid}`, SK: 'META' });
const modeKey = (uid: string, mode: Mode) => ({ PK: `USER#${uid}`, SK: `MODE#${mode.toUpperCase()}` });
type Row = Record<string, unknown> | undefined;

export type RestrictDiscoveryInput = Readonly<{
  targetUid: string;
  /** Server-verified staff actor, never supplied by an untrusted client. */
  staffUid: string;
  /** UUID assigned by trusted workflow, for immutable audit idempotency. */
  actionId: string;
  expectedModerationRevision: number;
  /** Fixed safe code, not a user-provided explanation or private report body. */
  reason: 'safety_review' | 'policy_violation';
}>;

/** Refuses a non-active/changed account, and never performs a status-only write.
 * All account, mode, pointer and audit actions succeed or all roll back.
 * Reinstatement, appeal handling and complete account deletion are separate,
 * explicitly authorized product workflows (not implemented here).
 */
export async function restrictAccountAndRevokePointers(
  db: DynamoDBDocumentClient, input: RestrictDiscoveryInput
): Promise<void> {
  const { targetUid, staffUid, actionId, expectedModerationRevision, reason } = input;
  if (!id(targetUid) || !id(staffUid) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionId) ||
      !Number.isSafeInteger(expectedModerationRevision) || expectedModerationRevision < 0 ||
      !['safety_review', 'policy_violation'].includes(reason)) {
    throw new Error('invalid_private_restriction_decision');
  }
  const get = async (table: string, key: { PK: string; SK: string }): Promise<Row> =>
    (await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }))).Item as Row;
  const [account, dating, friendship] = await Promise.all([
    get('uluv_users', accountKey(targetUid)),
    get('uluv_profiles', modeKey(targetUid, 'dating')),
    get('uluv_profiles', modeKey(targetUid, 'friendship'))
  ]);
  if (account?.status !== 'active' || account.moderationRestrictionVersion !== expectedModerationRevision) {
    throw new Error('restriction_revision_conflict');
  }
  const now = new Date().toISOString();
  const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    { Update: { TableName: 'uluv_users', Key: accountKey(targetUid),
      UpdateExpression: 'SET #status = :restricted, moderationRestrictionVersion = :next',
      ConditionExpression: '#status = :active AND moderationRestrictionVersion = :expected AND attribute_exists(PK)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':active': 'active', ':restricted': 'restricted',
        ':expected': expectedModerationRevision, ':next': expectedModerationRevision + 1 } } }
  ];
  appendModeRestrictionBarrier(items, targetUid, 'dating', dating, now);
  appendModeRestrictionBarrier(items, targetUid, 'friendship', friendship, now);
  items.push({ Put: { TableName: 'uluv_safety',
    Item: { PK: `ADMINAUDIT#${staffUid}`, SK: `T#${now}#${actionId}`,
      actionId, action: 'restrict_account', targetUid, reason,
      moderationRevision: expectedModerationRevision + 1, decidedAt: now },
    ConditionExpression: 'attribute_not_exists(PK)' } });
  await db.send(new TransactWriteCommand({ TransactItems: items }));
}
