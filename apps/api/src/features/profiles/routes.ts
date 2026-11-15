import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { draftMissing, parseDraft, parseHandleInput, parseMode } from './validation.js';
import type { DraftFields, ProfileMode } from './validation.js';

const usersTable = 'uluv_users';
const profilesTable = 'uluv_profiles';
const settingsTable = 'uluv_settings';
const modeKey = (uid: string, mode: ProfileMode) => ({ PK: `USER#${uid}`, SK: `MODE#${mode.toUpperCase()}` });
const accountKey = (uid: string) => ({ PK: `USER#${uid}`, SK: 'META' });
const settingsKey = (uid: string) => ({ PK: `USER#${uid}`, SK: 'SETTINGS' });
const aliasKey = (handle: string) => ({ PK: `HANDLE#${handle}`, SK: 'META' });

type Item = Record<string, unknown>;
type SessionGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<{ uid: string } | null>;
const noStore = (reply: FastifyReply) => reply.header('Cache-Control', 'no-store');
const failure = (reply: FastifyReply, code: number, reason: string) => reply.code(code).send({ error: reason });
function conditionalFailure(error: unknown): boolean {
  return error instanceof Error &&
    ['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error.name);
}
function normalizedFields(raw?: Item): DraftFields {
  return {
    displayName: typeof raw?.displayName === 'string' ? raw.displayName : '',
    bio: typeof raw?.bio === 'string' ? raw.bio : '',
    interests: Array.isArray(raw?.interests) ? raw.interests.filter((x): x is string => typeof x === 'string').slice(0, 10) : [],
    intention: typeof raw?.intention === 'string' ? raw.intention : ''
  };
}
function revisionOf(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
function ownerDto(mode: ProfileMode, raw: Item | undefined, handle: string | null, locality: string | null) {
  const fields = normalizedFields(raw);
  const photoIds = Array.isArray(raw?.photoIds) ? raw.photoIds.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  const missing = draftMissing(fields, handle, locality, photoIds);
  return {
    mode, exists: Boolean(raw), ...fields, photoIds,
    requestedActive: raw?.requestedActive === true,
    // No P02-1 draft becomes visible; activation and photo access are P02-3/P02-2.
    completeness: { ready: missing.length === 0, missing },
    visibility: 'inactive',
    version: revisionOf(raw?.version)
  };
}
async function getItem(db: DynamoDBDocumentClient, table: string, key: {PK: string; SK: string}): Promise<Item | undefined> {
  return (await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }))).Item as Item | undefined;
}
async function ownerAccount(db: DynamoDBDocumentClient, uid: string): Promise<Item | null> {
  const item = await getItem(db, usersTable, accountKey(uid));
  return item?.status === 'active' && item.ageEligibility === 'self_declared_adult' ? item : null;
}
function localityLabel(item?: Item): string | null {
  return typeof item?.localityLabel === 'string' && item.localityLabel.length > 0 ? item.localityLabel : null;
}
/** Use the exact existing P01 session guard; never create a parallel profile authenticator. */
export function registerProfileRoutes(app: FastifyInstance, db: DynamoDBDocumentClient, requireSession: SessionGuard): void {
  app.get('/v1/profiles/me', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    try {
      const [account, settings, dating, friendship] = await Promise.all([
        ownerAccount(db, auth.uid), getItem(db, settingsTable, settingsKey(auth.uid)),
        getItem(db, profilesTable, modeKey(auth.uid, 'dating')),
        getItem(db, profilesTable, modeKey(auth.uid, 'friendship'))
      ]);
      if (!account) return failure(reply, 403, 'account_unavailable');
      const handle = typeof account.handle === 'string' ? account.handle : null;
      const locality = localityLabel(settings);
      return {
        handle, identityRevision: revisionOf(account.identityRevision, 1),
        locality, localityRevision: revisionOf(settings?.localityRevision),
        profiles: { dating: ownerDto('dating', dating, handle, locality), friendship: ownerDto('friendship', friendship, handle, locality) }
      };
    } catch { return failure(reply, 503, 'profile_store_unavailable'); }
  });

  app.put('/v1/profiles/me/handle', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const parsed = parseHandleInput(request.body);
    if ('error' in parsed) return failure(reply, 400, parsed.error);
    const { handle, expectedRevision } = parsed.value;
    try {
      const account = await ownerAccount(db, auth.uid);
      if (!account) return failure(reply, 403, 'account_unavailable');
      const current = typeof account.handle === 'string' ? account.handle : null;
      const revision = revisionOf(account.identityRevision, 1);
      if (revision !== expectedRevision) return failure(reply, 409, 'identity_revision_conflict');
      if (current === handle) {
        // No-change handle requests are idempotent only if the alias still
        // resolves to this exact owner (fail closed on inconsistent records).
        const alias = await getItem(db, usersTable, aliasKey(handle));
        if (alias?.uid !== auth.uid) return failure(reply, 409, 'handle_mapping_conflict');
        return { handle, identityRevision: revision };
      }
      const next = revision + 1;
      const now = new Date().toISOString();
      const transaction: NonNullable<TransactWriteCommandInput['TransactItems']> = [
        { Put: {
          TableName: usersTable,
          Item: { ...aliasKey(handle), uid: auth.uid, createdAt: now },
          ConditionExpression: 'attribute_not_exists(PK)'
        } },
        { Update: {
          TableName: usersTable, Key: accountKey(auth.uid),
          UpdateExpression: 'SET #handle = :handle, identityRevision = :next',
          ConditionExpression: 'identityRevision = :expected AND #state = :active AND ageEligibility = :adult AND ' +
            (current === null ? 'attribute_not_exists(#handle)' : '#handle = :old'),
          ExpressionAttributeNames: { '#handle': 'handle', '#state': 'status' },
          ExpressionAttributeValues: {
            ':handle': handle, ':next': next, ':expected': revision,
            ':active': 'active', ':adult': 'self_declared_adult', ...(current === null ? {} : { ':old': current })
          }
        } }
      ];
      if (current) transaction.push({ Delete: {
        TableName: usersTable, Key: aliasKey(current),
        ConditionExpression: 'uid = :uid', ExpressionAttributeValues: { ':uid': auth.uid }
      } });
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      return { handle, identityRevision: next };
    } catch (error) {
      if (conditionalFailure(error)) {
        try {
          const claim = await getItem(db, usersTable, aliasKey(handle));
          if (claim && claim.uid !== auth.uid) return failure(reply, 409, 'handle_taken');
        } catch { return failure(reply, 503, 'profile_store_unavailable'); }
        return failure(reply, 409, 'identity_revision_conflict');
      }
      return failure(reply, 503, 'profile_store_unavailable');
    }
  });

  app.get('/v1/profiles/me/:mode', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const mode = parseMode((request.params as Record<string, unknown>)?.mode);
    if (!mode) return failure(reply, 400, 'invalid_profile_mode');
    try {
      const [account, settings, profile] = await Promise.all([
        ownerAccount(db, auth.uid), getItem(db, settingsTable, settingsKey(auth.uid)),
        getItem(db, profilesTable, modeKey(auth.uid, mode))
      ]);
      if (!account) return failure(reply, 403, 'account_unavailable');
      return ownerDto(mode, profile, typeof account.handle === 'string' ? account.handle : null, localityLabel(settings));
    } catch { return failure(reply, 503, 'profile_store_unavailable'); }
  });

  app.put('/v1/profiles/me/:mode', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const mode = parseMode((request.params as Record<string, unknown>)?.mode);
    if (!mode) return failure(reply, 400, 'invalid_profile_mode');
    const parsed = parseDraft(request.body);
    if ('error' in parsed) return failure(reply, 400, parsed.error);
    const { expectedVersion, ...fields } = parsed.value;
    const key = modeKey(auth.uid, mode);
    try {
      const now = new Date().toISOString();
      const next = expectedVersion + 1;
      const profileWrite: NonNullable<TransactWriteCommandInput['TransactItems']>[number] = expectedVersion === 0
        ? { Put: {
          TableName: profilesTable, Item: { ...key, ...fields, version: 1, photoIds: [], requestedActive: false, createdAt: now, updatedAt: now },
          ConditionExpression: 'attribute_not_exists(PK)'
        } }
        : { Update: {
          TableName: profilesTable, Key: key,
          UpdateExpression: 'SET displayName = :name, bio = :bio, interests = :interests, intention = :intent, #version = :next, updatedAt = :now',
          ConditionExpression: '#version = :expected AND attribute_exists(PK)',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: {
            ':name': fields.displayName, ':bio': fields.bio, ':interests': fields.interests,
            ':intent': fields.intention, ':next': next, ':now': now, ':expected': expectedVersion
          }
        } };
      await db.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: {
          TableName: usersTable, Key: accountKey(auth.uid),
          ConditionExpression: '#state = :active AND ageEligibility = :adult',
          ExpressionAttributeNames: { '#state': 'status' },
          ExpressionAttributeValues: { ':active': 'active', ':adult': 'self_declared_adult' }
        } },
        profileWrite
      ] }));
      // Re-read authoritative versions and shared state after the transaction.
      const [account, settings, record] = await Promise.all([
        ownerAccount(db, auth.uid), getItem(db, settingsTable, settingsKey(auth.uid)), getItem(db, profilesTable, key)
      ]);
      if (!account) return failure(reply, 403, 'account_unavailable');
      return ownerDto(mode, record, typeof account.handle === 'string' ? account.handle : null, localityLabel(settings));
    } catch (error) {
      if (conditionalFailure(error)) {
        try {
          const account = await ownerAccount(db, auth.uid);
          if (!account) return failure(reply, 403, 'account_unavailable');
          const current = await getItem(db, profilesTable, key);
          const replyData = { error: 'profile_version_conflict', currentVersion: revisionOf(current?.version) };
          return reply.code(409).send(replyData);
        } catch { return failure(reply, 503, 'profile_store_unavailable'); }
      }
      return failure(reply, 503, 'profile_store_unavailable');
    }
  });
}
