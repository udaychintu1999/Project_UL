import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { BatchGetCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { ageFromBirthDate, draftMissing, onboardingMissing, parseDraft, parseHandleInput, parseMode, parseSetup } from './validation.js';
import type { DraftFields, ProfileMode, SharedSetup } from './validation.js';
import { validMediaId } from './media-policy.js';

const usersTable = 'uluv_users';
const profilesTable = 'uluv_profiles';
const settingsTable = 'uluv_settings';
const modeKey = (uid: string, mode: ProfileMode) => ({ PK: `USER#${uid}`, SK: `MODE#${mode.toUpperCase()}` });
const mediaKey = (uid: string, mediaId: string) => ({ PK: `USER#${uid}`, SK: `MEDIA#${mediaId}` });
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
function ownerDto(mode: ProfileMode, raw: Item | undefined, handle: string | null, commonName = '', verifiedPhotos: readonly string[] = []) {
  const fields = normalizedFields(raw);
  const photoIds = Array.isArray(raw?.photoIds) ? raw.photoIds.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  // A typed city label may complete onboarding but is NOT a trusted locality
  // for P02-3 discovery/activation. Keep the future eligibility gate closed.
  const missing = draftMissing({ ...fields, displayName: fields.displayName || commonName }, handle, null, verifiedPhotos);
  return {
    mode, exists: Boolean(raw), ...fields, effectiveDisplayName: fields.displayName || commonName, photoIds,
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
function sharedSetup(settings?: Item): SharedSetup {
  const modes = settings?.selectedModes as Record<string, unknown> | undefined;
  const gender = settings?.gender;
  return {
    commonName: typeof settings?.commonName === 'string' ? settings.commonName : '',
    locality: localityLabel(settings) ?? '',
    gender: gender === 'woman' || gender === 'man' || gender === 'non_binary' ||
      gender === 'another_identity' || gender === 'prefer_not_to_say' ? gender : '',
    selectedModes: { dating: modes?.dating === true, friendship: modes?.friendship === true }
  };
}

async function ownerDashboard(db: DynamoDBDocumentClient, uid: string) {
  const [account, settings, dating, friendship] = await Promise.all([
    ownerAccount(db, uid), getItem(db, settingsTable, settingsKey(uid)),
    getItem(db, profilesTable, modeKey(uid, 'dating')),
    getItem(db, profilesTable, modeKey(uid, 'friendship'))
  ]);
  if (!account) return null;
  const handle = typeof account.handle === 'string' ? account.handle : null;
  const shared = sharedSetup(settings);
  // A library upload alone does not satisfy onboarding. Only mode-assigned
  // media still marked READY in this authenticated owner's partition counts.
  // Batch-get is bounded to 12 (six per mode); fail closed on unprocessed keys.
  const assigned = (row?: Item): string[] => Array.isArray(row?.photoIds)
    ? row.photoIds.filter(validMediaId).slice(0, 6) : [];
  const mediaIds = [...new Set([...assigned(dating), ...assigned(friendship)])];
  const verified = new Set<string>();
  if (mediaIds.length > 0) {
    const batch = await db.send(new BatchGetCommand({ RequestItems: {
      [profilesTable]: { Keys: mediaIds.map(id => mediaKey(uid, id)), ConsistentRead: true }
    } }));
    if ((batch.UnprocessedKeys?.[profilesTable]?.Keys?.length ?? 0) > 0) {
      throw new Error('profile_photo_verification_unavailable');
    }
    for (const row of batch.Responses?.[profilesTable] ?? []) {
      if (row.PK === `USER#${uid}` && validMediaId(row.mediaId) &&
          row.SK === `MEDIA#${row.mediaId}` && row.state === 'READY' &&
          typeof row.refCount === 'number' && row.refCount >= 1) verified.add(row.mediaId);
    }
  }
  const photosFor = (row?: Item) => assigned(row).filter(id => verified.has(id));
  const drafts = {
    dating: dating ? { ...normalizedFields(dating), photoIds: photosFor(dating) } : undefined,
    friendship: friendship ? { ...normalizedFields(friendship), photoIds: photosFor(friendship) } : undefined
  };
  const missing = onboardingMissing(handle, shared, drafts);
  const age = ageFromBirthDate(account.birthDate);
  if (age === null) missing.push('ageEligibility');
  return {
    handle, identityRevision: revisionOf(account.identityRevision, 1),
    locality: shared.locality || null, localityRevision: revisionOf(settings?.localityRevision),
    shared: {
      commonName: shared.commonName, locality: shared.locality,
      localitySource: 'self_declared', gender: shared.gender,
      age, selectedModes: shared.selectedModes,
      setupRevision: revisionOf(settings?.setupRevision)
    },
    onboarding: { ready: missing.length === 0, missing },
    profiles: {
      dating: ownerDto('dating', dating, handle, shared.commonName, photosFor(dating)),
      friendship: ownerDto('friendship', friendship, handle, shared.commonName, photosFor(friendship))
    }
  };
}

/** Use the exact existing P01 session guard; never create a parallel profile authenticator. */
export function registerProfileRoutes(app: FastifyInstance, db: DynamoDBDocumentClient, requireSession: SessionGuard): void {
  app.get('/v1/profiles/me', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    try {
      const dashboard = await ownerDashboard(db, auth.uid);
      return dashboard ?? failure(reply, 403, 'account_unavailable');
    } catch { return failure(reply, 503, 'profile_store_unavailable'); }
  });

  // Shared details and mode choices never activate discovery. Both modes may
  // be unselected while setup is a draft; the server readiness gate stays shut.
  app.put('/v1/profiles/me/setup', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const parsed = parseSetup(request.body);
    if ('error' in parsed) return failure(reply, 400, parsed.error);
    const { expectedRevision, commonName, locality, gender, selectedModes } = parsed.value;
    try {
      await db.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: {
          TableName: usersTable, Key: accountKey(auth.uid),
          ConditionExpression: '#state = :active AND ageEligibility = :adult',
          ExpressionAttributeNames: { '#state': 'status' },
          ExpressionAttributeValues: { ':active': 'active', ':adult': 'self_declared_adult' }
        } },
        { Update: {
          TableName: settingsTable, Key: settingsKey(auth.uid),
          UpdateExpression: 'SET commonName = :name, localityLabel = :locality, gender = :gender, selectedModes = :modes, setupRevision = :next',
          ConditionExpression: 'attribute_exists(PK) AND ' +
            (expectedRevision === 0 ? 'attribute_not_exists(setupRevision)' : 'setupRevision = :expected'),
          ExpressionAttributeValues: {
            ':name': commonName, ':locality': locality, ':gender': gender,
            ':modes': selectedModes, ':next': expectedRevision + 1,
            ...(expectedRevision === 0 ? {} : { ':expected': expectedRevision })
          }
        } }
      ] }));
      const dashboard = await ownerDashboard(db, auth.uid);
      return dashboard ?? failure(reply, 403, 'account_unavailable');
    } catch (error) {
      if (conditionalFailure(error)) {
        try {
          if (!await ownerAccount(db, auth.uid)) return failure(reply, 403, 'account_unavailable');
        } catch { return failure(reply, 503, 'profile_store_unavailable'); }
        return failure(reply, 409, 'setup_revision_conflict');
      }
      return failure(reply, 503, 'profile_store_unavailable');
    }
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
      return ownerDto(mode, profile, typeof account.handle === 'string' ? account.handle : null, sharedSetup(settings).commonName);
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
      return ownerDto(mode, record, typeof account.handle === 'string' ? account.handle : null, sharedSetup(settings).commonName);
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
