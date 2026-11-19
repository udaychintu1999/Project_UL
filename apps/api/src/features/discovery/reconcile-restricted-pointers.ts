/** P03-3 private, bounded repair for pointer anchors of already-restricted accounts.
 * NOT a route, moderation decision, or authorization grant. A trusted owner/staff
 * workflow must change canonical account status first and call this service.
 * No Scan; no UID enumeration; unanchored legacy orphans cannot be found here.
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { appendModeInvalidationBarrier, canonicalPointerAnchor, type Mode } from './pointer-lifecycle-policy.js';

type Row = Record<string, unknown> | undefined;
const accountKey = (uid: string) => ({ PK: `USER#${uid}`, SK: 'META' });
const modeKey = (uid: string, mode: Mode) => ({ PK: `USER#${uid}`, SK: `MODE#${mode.toUpperCase()}` });
const validUid = (uid: string) => /^[-_a-zA-Z0-9]{1,128}$/.test(uid);
const versionOrZero = (value: unknown): number => value === undefined ? 0 :
  (Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : NaN);

/** Fail closed on active/missing account, invalid UID or bad snapshot. No writes on a no-op.
 * A known anchor is deleted in a transaction that rechecks restricted account status,
 * restriction revision and both profile versions/anchors. Any concurrent mutation
 * cancels ALL changes. Cannot be used to authorize a restriction or publish a pointer.
 */
export async function reconcileRestrictedPointers(db: DynamoDBDocumentClient, uid: string): Promise<number> {
  if (!validUid(uid)) throw new Error('invalid_pointer_owner');
  const get = async (table: string, key: {PK: string; SK: string}): Promise<Row> =>
    (await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }))).Item as Row;
  const [account, dating, friendship] = await Promise.all([
    get('uluv_users', accountKey(uid)), get('uluv_profiles', modeKey(uid, 'dating')),
    get('uluv_profiles', modeKey(uid, 'friendship'))
  ]);
  if (!account || typeof account.status !== 'string' || account.status === 'active') {
    throw new Error('account_not_restricted');
  }
  const modVersion = versionOrZero(account.moderationRestrictionVersion);
  if (!Number.isSafeInteger(modVersion)) throw new Error('invalid_moderation_revision');
  const modes: ReadonlyArray<[Mode, Row]> = [['dating', dating], ['friendship', friendship]];
  const active = modes.filter(([mode, row]) => canonicalPointerAnchor(uid, mode, row) !== null);
  if (active.length === 0) return 0;
  const now = new Date().toISOString();
  const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    { ConditionCheck: { TableName: 'uluv_users', Key: accountKey(uid),
      ConditionExpression: 'attribute_exists(PK) AND #state = :state AND ' +
        (account.moderationRestrictionVersion === undefined
          ? 'attribute_not_exists(moderationRestrictionVersion)'
          : 'moderationRestrictionVersion = :revision'),
      ExpressionAttributeNames: { '#state': 'status' },
      ExpressionAttributeValues: { ':state': account.status,
        ...(account.moderationRestrictionVersion === undefined ? {} : { ':revision': modVersion }) }
    } }
  ];
  for (const [mode, row] of modes) appendModeInvalidationBarrier(items, uid, mode, row, now);
  await db.send(new TransactWriteCommand({ TransactItems: items }));
  return active.length;
}
