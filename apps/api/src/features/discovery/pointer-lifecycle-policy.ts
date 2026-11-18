/** P03-3 private pointer ownership and transactional invalidation primitives.
 * No public endpoint imports this file. This module intentionally has no
 * runtime dependencies so negative policy tests run without credentials/DB. */
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';

export const PRIVATE_DISCOVERY_TABLE = 'uluv_discovery' as const;
type Items = NonNullable<TransactWriteCommandInput['TransactItems']>;
type Row = Record<string, unknown> | undefined;
export type Mode = 'dating' | 'friendship';
export type PointerAnchor = Readonly<{
  PK: string; SK: string; localityRevision: number; profileVersion: number;
}>;
const safeUid = (uid: string): boolean => /^[-_a-zA-Z0-9]{1,128}$/.test(uid);
const modeSK = (mode: Mode): string => `MODE#${mode.toUpperCase()}`;
const key = (uid: string, mode: Mode) => ({ PK: `USER#${uid}`, SK: modeSK(mode) });
function safeContext(uid: string, mode: Mode): void {
  if (!safeUid(uid) || !['dating', 'friendship'].includes(mode)) throw new Error('invalid_pointer_owner');
}
const profileVersion = (row: Row): number => {
  if (!row || !Number.isSafeInteger(row.version) || (row.version as number) < 1) {
    throw new Error('invalid_canonical_profile_version');
  }
  return row.version as number;
};
/** Never use a client pointer or an index query to decide what to delete. */
export function canonicalPointerAnchor(uid: string, mode: Mode, row: Row): PointerAnchor | null {
  safeContext(uid, mode);
  if (!row || !Object.hasOwn(row, 'discoveryPointer')) return null;
  const raw = row.discoveryPointer;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_canonical_pointer_anchor');
  const a = raw as Record<string, unknown>;
  if (typeof a.PK !== 'string' || typeof a.SK !== 'string' ||
      !new RegExp(`^DISC#${mode.toUpperCase()}#R6#[0-9a-f]{15}$`).test(a.PK) ||
      !/^JOIN#\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z#[-_a-zA-Z0-9]{1,128}$/.test(a.SK) ||
      !a.SK.endsWith(`#${uid}`) ||
      !Number.isSafeInteger(a.localityRevision) || (a.localityRevision as number) < 1 ||
      !Number.isSafeInteger(a.profileVersion) || (a.profileVersion as number) < 1) {
    throw new Error('invalid_canonical_pointer_anchor');
  }
  return { PK: a.PK, SK: a.SK, localityRevision: a.localityRevision as number,
    profileVersion: a.profileVersion as number };
}
export function pointerAnchor(pointer: {PK: string; SK: string; localityRevision: number; profileVersion: number},
  uid: string, mode: Mode): PointerAnchor {
  const row = {discoveryPointer: pointer};
  const a = canonicalPointerAnchor(uid, mode, row);
  if (!a) throw new Error('invalid_canonical_pointer_anchor');
  return a;
}
/** Delete is idempotent on a missing row; never delete a different uid's row. */
export function appendPointerDelete(items: Items, uid: string, mode: Mode, row: Row): PointerAnchor | null {
  const anchor = canonicalPointerAnchor(uid, mode, row);
  if (anchor) items.push({ Delete: { TableName: PRIVATE_DISCOVERY_TABLE, Key: { PK: anchor.PK, SK: anchor.SK },
    ConditionExpression: 'attribute_not_exists(PK) OR uid = :owner',
    ExpressionAttributeValues: { ':owner': uid } } });
  return anchor;
}
/** Include this in the SAME transaction as an already-updated canonical mode.
 * An activation/field/photo writer must compare profile version, and this
 * additionally checks that the anchor seen before the write is still current.
 */
export function samePointerCondition(anchor: PointerAnchor | null): {
  expression: string; values: Record<string, unknown>;
} {
  return anchor ? {
    expression: ' AND discoveryPointer.PK = :oldPointerPK AND discoveryPointer.SK = :oldPointerSK',
    values: { ':oldPointerPK': anchor.PK, ':oldPointerSK': anchor.SK }
  } : { expression: ' AND attribute_not_exists(discoveryPointer)', values: {} };
}
/** Settings / identity changes must cover BOTH modes, including inactive and
 * not-yet-created records. The conditional barrier defeats create/activate
 * races. Active anchors are cleared atomically with their old pointer delete;
 * inactive modes get a non-mutating conditional check.
 */
export function appendModeInvalidationBarrier(items: Items, uid: string, mode: Mode,
  row: Row, now: string): void {
  safeContext(uid, mode);
  const recordKey = key(uid, mode);
  if (!row) {
    items.push({ ConditionCheck: { TableName: 'uluv_profiles', Key: recordKey,
      ConditionExpression: 'attribute_not_exists(PK)' } });
    return;
  }
  const version = profileVersion(row);
  const anchor = canonicalPointerAnchor(uid, mode, row);
  const guard = samePointerCondition(anchor);
  if (!anchor) {
    items.push({ ConditionCheck: { TableName: 'uluv_profiles', Key: recordKey,
      ConditionExpression: '#version = :expected' + guard.expression,
      ExpressionAttributeNames: { '#version': 'version' },
      ExpressionAttributeValues: { ':expected': version, ...guard.values } } });
    return;
  }
  appendPointerDelete(items, uid, mode, row);
  items.push({ Update: { TableName: 'uluv_profiles', Key: recordKey,
    UpdateExpression: 'SET #version = :next, updatedAt = :now REMOVE discoveryPointer',
    ConditionExpression: '#version = :expected' + guard.expression,
    ExpressionAttributeNames: { '#version': 'version' },
    ExpressionAttributeValues: { ':expected': version, ':next': version + 1, ':now': now,
      ...guard.values } } });
}
/** Require no aliasing between old and newly published pointer transaction
 * items. DynamoDB transactions prohibit acting twice on the same item. */
export function nextJoinTime(now: string, old: PointerAnchor | null): string {
  const previous = old ? Date.parse(old.SK.slice(5, 29)) : NaN;
  const current = Date.parse(now);
  if (!Number.isFinite(current) || new Date(current).toISOString() !== now) {
    throw new Error('invalid_pointer_timestamp');
  }
  return new Date(Number.isFinite(previous) ? Math.max(current, previous + 1) : current).toISOString();
}
