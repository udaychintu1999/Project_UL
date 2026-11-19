import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { BatchGetCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { ageFromBirthDate, draftMissing, onboardingMissing, parseDraft, parseHandleInput, parseMode, parseSetup } from './validation.js';
import type { DraftFields, ProfileMode, SharedSetup } from './validation.js';
import { validMediaId } from './media-policy.js';
import { activationMissing, modeVisibility, parseActivation, privatePreview } from './activation-policy.js';
import { buildPointer, type Coordinates } from '../discovery/contracts.js';
import { checkLocality } from '../discovery/pointer-reader.js';
import { PRIVATE_DISCOVERY_TABLE, appendModeInvalidationBarrier, appendPointerDelete, canonicalPointerAnchor,
  matchesCanonicalPublicationSnapshot, nextJoinTime, pointerAnchor, samePointerCondition } from '../discovery/pointer-lifecycle-policy.js';

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
function ownerDto(mode: ProfileMode, raw: Item | undefined, handle: string | null, commonName = '', verifiedPhotos: readonly string[] = [], visibility: 'inactive' | 'paused_ineligible' | 'pending_trusted_locality' = 'inactive', activationMissingFields: readonly string[] = []) {
  const fields = normalizedFields(raw);
  const photoIds = Array.isArray(raw?.photoIds) ? raw.photoIds.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  // A typed city label may complete onboarding but is NOT a trusted locality
  // for P02-3 discovery/activation. Keep the future eligibility gate closed.
  const missing = draftMissing({ ...fields, displayName: fields.displayName || commonName }, handle, null, verifiedPhotos);
  return {
    mode, exists: Boolean(raw), ...fields, effectiveDisplayName: fields.displayName || commonName, photoIds,
    requestedActive: raw?.requestedActive === true,
    completeness: { ready: missing.length === 0, missing },
    visibility, activationMissing: activationMissingFields,
    discoveryEligible: false, // P03 trusted locality + atomic H3 pointer not yet present.
    version: revisionOf(raw?.version)
  };
}
async function getItem(db: DynamoDBDocumentClient, table: string, key: {PK: string; SK: string}): Promise<Item | undefined> {
  return (await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }))).Item as Item | undefined;
}
/** Consistent canonical mode reads for transactional setup/identity invalidation.
 * Even absent records receive a conditional barrier to prevent insertion races. */
async function modeRecords(db: DynamoDBDocumentClient, uid: string): Promise<{ dating: Item | undefined; friendship: Item | undefined }> {
  const [dating, friendship] = await Promise.all([
    getItem(db, profilesTable, modeKey(uid, 'dating')),
    getItem(db, profilesTable, modeKey(uid, 'friendship'))
  ]);
  return { dating, friendship };
}
function invalidateBoth(items: NonNullable<TransactWriteCommandInput['TransactItems']>, uid: string,
  records: { dating: Item | undefined; friendship: Item | undefined }, now: string): void {
  appendModeInvalidationBarrier(items, uid, 'dating', records.dating, now);
  appendModeInvalidationBarrier(items, uid, 'friendship', records.friendship, now);
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
  const activation = (mode: ProfileMode, row?: Item) => activationMissing(mode, handle, shared,
    row ? { ...normalizedFields(row), photoIds: photosFor(row) } : undefined, age);
  const activationState = (mode: ProfileMode, row?: Item) => modeVisibility(
    row?.requestedActive === true, shared.selectedModes[mode], activation(mode, row),
    revisionOf(row?.activationSetupRevision, -1), revisionOf(settings?.setupRevision),
    revisionOf(row?.activationIdentityRevision, -1), revisionOf(account.identityRevision, 1));
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
      dating: ownerDto('dating', dating, handle, shared.commonName, photosFor(dating),
        activationState('dating', dating), activation('dating', dating)),
      friendship: ownerDto('friendship', friendship, handle, shared.commonName, photosFor(friendship),
        activationState('friendship', friendship), activation('friendship', friendship))
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
      const records = await modeRecords(db, auth.uid);
      const transaction: NonNullable<TransactWriteCommandInput['TransactItems']> = [
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
      ];
      invalidateBoth(transaction, auth.uid, records, new Date().toISOString());
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
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
      const records = await modeRecords(db, auth.uid);
      invalidateBoth(transaction, auth.uid, records, now);
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
      // Use the same READY-photo/activation projection as /me. A separate
      // ownerDto call here could incorrectly claim an active mode is inactive.
      const dashboard = await ownerDashboard(db, auth.uid);
      return dashboard?.profiles[mode] ?? failure(reply, 403, 'account_unavailable');
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
      const previous = await getItem(db, profilesTable, key);
      if (expectedVersion === 0 ? Boolean(previous) : previous?.version !== expectedVersion)
        return failure(reply, 409, 'profile_version_conflict');
      const oldAnchor = canonicalPointerAnchor(auth.uid, mode, previous);
      const guard = samePointerCondition(oldAnchor);
      const now = new Date().toISOString();
      const next = expectedVersion + 1;
      const profileWrite: NonNullable<TransactWriteCommandInput['TransactItems']>[number] = expectedVersion === 0
        ? { Put: {
          TableName: profilesTable, Item: { ...key, ...fields, version: 1, photoIds: [], requestedActive: false, createdAt: now, updatedAt: now },
          ConditionExpression: 'attribute_not_exists(PK)'
        } }
        : { Update: {
          TableName: profilesTable, Key: key,
          UpdateExpression: 'SET displayName = :name, bio = :bio, interests = :interests, intention = :intent, requestedActive = :inactive, #version = :next, updatedAt = :now REMOVE discoveryPointer',
          ConditionExpression: '#version = :expected AND attribute_exists(PK)' + guard.expression,
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: {
            ':name': fields.displayName, ':bio': fields.bio, ':interests': fields.interests,
            ':intent': fields.intention, ':next': next, ':now': now, ':expected': expectedVersion, ':inactive': false,
            ...guard.values
          }
        } };
      const transaction: NonNullable<TransactWriteCommandInput['TransactItems']> = [
        { ConditionCheck: {
          TableName: usersTable, Key: accountKey(auth.uid),
          ConditionExpression: '#state = :active AND ageEligibility = :adult',
          ExpressionAttributeNames: { '#state': 'status' },
          ExpressionAttributeValues: { ':active': 'active', ':adult': 'self_declared_adult' }
        } },
        profileWrite
      ];
      appendPointerDelete(transaction, auth.uid, mode, previous);
      await db.send(new TransactWriteCommand({ TransactItems: transaction }));
      // Re-read authoritative readiness, photo ownership and activation state.
      const dashboard = await ownerDashboard(db, auth.uid);
      return dashboard?.profiles[mode] ?? failure(reply, 403, 'account_unavailable');
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

  // An authenticated owner can review the privacy-safe public *shape* now.
  // This is NOT the future P03 public endpoint and never returns a raw DB item.
  app.get('/v1/profiles/me/:mode/preview', async (request, reply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const mode = parseMode((request.params as Record<string, unknown>)?.mode);
    if (!mode) return failure(reply, 400, 'invalid_profile_mode');
    try {
      const [dashboard, account] = await Promise.all([
        ownerDashboard(db, auth.uid), ownerAccount(db, auth.uid)
      ]);
      if (!dashboard || !account) return failure(reply, 403, 'account_unavailable');
      const profile = dashboard.profiles[mode];
      if (!dashboard.shared.selectedModes[mode] || !profile.exists ||
          dashboard.shared.age === null || !dashboard.handle) {
        return failure(reply, 409, 'profile_preview_unavailable');
      }
      const shared = sharedSetup(await getItem(db, settingsTable, settingsKey(auth.uid)));
      return privatePreview(mode, dashboard.handle, shared,
        { ...normalizedFields(profile), photoIds: profile.photoIds }, dashboard.shared.age);
    } catch { return failure(reply, 503, 'profile_store_unavailable'); }
  });

  // All third-party preview requests remain private until trusted locality,
  // block/match authorization and atomic pointer publication exist in P03.
  app.get('/v1/profiles/:mode/:handle/preview', async (_request, reply) => {
    noStore(reply);
    return failure(reply, 404, 'profile_not_found');
  });

  // P03-3: independent owner intent plus PRIVATE transactional H3 pointer.
  // The owner response remains discoveryEligible:false; no public route exists.
  const updateActivation = (active: boolean) => async (request: FastifyRequest, reply: FastifyReply) => {
    noStore(reply);
    const auth = await requireSession(request, reply);
    if (!auth) return reply;
    const mode = parseMode((request.params as Record<string, unknown>)?.mode);
    if (!mode) return failure(reply, 400, 'invalid_profile_mode');
    const parsed = parseActivation(request.body, active);
    if ('error' in parsed) return failure(reply, 400, parsed.error);
    const { expectedVersion } = parsed.value;
    try {
      const [account, settings, profile, dashboard] = await Promise.all([
        ownerAccount(db, auth.uid), getItem(db, settingsTable, settingsKey(auth.uid)),
        getItem(db, profilesTable, modeKey(auth.uid, mode)), ownerDashboard(db, auth.uid)
      ]);
      if (!account || !dashboard) return failure(reply, 403, 'account_unavailable');
      if (!profile || profile.version !== expectedVersion) return failure(reply, 409, 'profile_version_conflict');
      const shared = sharedSetup(settings);
      const verifiedPhotos = dashboard.profiles[mode].photoIds;
      // The dashboard verifies READY media in a separate read. If the mode
      // changed between that read and the direct profile read, do not publish
      // using photo evidence from a different profile revision or assignment.
      // Deactivation must remain possible even for an incomplete profile.
      if (active) {
        const assigned = profile.photoIds;
        if (!matchesCanonicalPublicationSnapshot(expectedVersion, profile,
              dashboard.profiles[mode].version, verifiedPhotos) ||
            !Array.isArray(assigned) || !assigned.every(validMediaId)) {
          return failure(reply, 409, 'activation_revision_conflict');
        }
      }
      const missing = activationMissing(mode, dashboard.handle, shared,
        { ...normalizedFields(profile), photoIds: verifiedPhotos }, ageFromBirthDate(account.birthDate));
      if (active && missing.length > 0) return reply.code(409).send({ error: 'profile_ineligible', missing });
      const expectedSetup = revisionOf(settings?.setupRevision);
      const expectedSettings = revisionOf(settings?.settingsRevision);
      const oldAnchor = canonicalPointerAnchor(auth.uid, mode, profile);
      const pointerGuard = samePointerCondition(oldAnchor);
      // P02's activation before an approved R6 locality is retained as an
      // explicit pending intent, NEVER as a discoverable pointer.
      let trusted = false;
      try {
        if (settings) {
          checkLocality({center: settings.geoApprovedCenter as Coordinates,
            cell: settings.geoH3Cell as string, source: settings.geoSelectionSource as 'manual_geonames' | 'gps_selected',
            localityRevision: settings.localityRevision as number,
            settingsRevision: revisionOf(settings.settingsRevision), distanceBand: '0-50'});
          trusted = true;
        }
      } catch { trusted = false; }
      const now = new Date().toISOString();
      const freshPointer = active && trusted && settings ? buildPointer({
        mode: mode.toUpperCase() as 'DATING' | 'FRIENDSHIP', cell: settings.geoH3Cell as string,
        joinedAt: nextJoinTime(now, oldAnchor), uid: auth.uid,
        localityRevision: settings.localityRevision as number, profileVersion: expectedVersion + 1
      }) : null;
      const newAnchor = freshPointer ? pointerAnchor(freshPointer, auth.uid, mode) : null;
      const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
        { ConditionCheck: { TableName: usersTable, Key: accountKey(auth.uid),
          ConditionExpression: '#state = :active AND ageEligibility = :adult AND birthDate = :dob AND identityRevision = :identity',
          ExpressionAttributeNames: { '#state': 'status' },
          ExpressionAttributeValues: { ':active': 'active', ':adult': 'self_declared_adult', ':dob': account.birthDate,
            ':identity': revisionOf(account.identityRevision, 1) } } },
        { ConditionCheck: { TableName: settingsTable, Key: settingsKey(auth.uid),
          ConditionExpression: 'setupRevision = :rev AND selectedModes.#mode = :selected AND ' +
            '(attribute_not_exists(settingsRevision) OR settingsRevision = :settingsVersion)' +
            (trusted ? ' AND localityRevision = :locality AND geoH3Cell = :cell AND geoSelectionSource = :source' : ''),
          ExpressionAttributeNames: { '#mode': mode },
          ExpressionAttributeValues: { ':rev': expectedSetup, ':selected': shared.selectedModes[mode],
            ':settingsVersion': expectedSettings,
            ...(trusted ? { ':locality': settings?.localityRevision, ':cell': settings?.geoH3Cell,
              ':source': settings?.geoSelectionSource } : {}) } } },
        { Update: { TableName: profilesTable, Key: modeKey(auth.uid, mode),
          UpdateExpression: 'SET requestedActive = :requested, activationSetupRevision = :setup, activationIdentityRevision = :identity, #version = :next, updatedAt = :now' +
            (newAnchor ? ', discoveryPointer = :pointer' : ' REMOVE discoveryPointer'),
          ConditionExpression: '#version = :expected AND attribute_exists(PK)' + pointerGuard.expression,
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: { ':requested': active, ':setup': expectedSetup,
            ':identity': revisionOf(account.identityRevision, 1), ':next': expectedVersion + 1,
            ':expected': expectedVersion, ':now': now, ...pointerGuard.values,
            ...(newAnchor ? { ':pointer': newAnchor } : {}) } } }
      ];
      if (active) for (const mediaId of verifiedPhotos) items.push({ ConditionCheck: {
        TableName: profilesTable, Key: mediaKey(auth.uid, mediaId),
        ConditionExpression: '#state = :ready AND refCount >= :one',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':ready': 'READY', ':one': 1 }
      } });
      appendPointerDelete(items, auth.uid, mode, profile);
      if (freshPointer) items.push({ Put: { TableName: PRIVATE_DISCOVERY_TABLE, Item: freshPointer,
        ConditionExpression: 'attribute_not_exists(PK)' } });
      await db.send(new TransactWriteCommand({ TransactItems: items }));
      const updated = await ownerDashboard(db, auth.uid);
      return updated ?? failure(reply, 403, 'account_unavailable');
    } catch (error) {
      return failure(reply, conditionalFailure(error) ? 409 : 503,
        conditionalFailure(error) ? 'activation_revision_conflict' : 'profile_store_unavailable');
    }
  };
  app.post('/v1/profiles/me/:mode/activate', updateActivation(true));
  app.post('/v1/profiles/me/:mode/deactivate', updateActivation(false));

}
