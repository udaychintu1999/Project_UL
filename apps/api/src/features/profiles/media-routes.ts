import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Readable } from 'node:stream';
import { LocalMediaStore, InvalidImageError } from './local-media-store.js';
import { MAX_MEDIA_BYTES, MEDIA_UPLOAD_TTL_SECONDS, parsePhotoUpdate, validMediaId, validUploadBegin } from './media-policy.js';
import { parseMode, draftMissing } from './validation.js';

const profilesTable = 'uluv_profiles';
const usersTable = 'uluv_users';
const accountKey = (uid: string) => ({ PK: `USER#${uid}`, SK: 'META' });
const mediaKey = (uid: string, mediaId: string) => ({ PK: `USER#${uid}`, SK: `MEDIA#${mediaId}` });
const modeKey = (uid: string, mode: string) => ({ PK: `USER#${uid}`, SK: `MODE#${mode.toUpperCase()}` });
type Row = Record<string, unknown>;
type SessionGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<{ uid: string } | null>;
const failure = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });
const nowSeconds = () => Math.floor(Date.now() / 1000);
const noStore = (reply: FastifyReply) => reply.header('Cache-Control', 'private, no-store');
const mediaIdFrom = (request: FastifyRequest) => (request.params as Record<string, unknown>)?.mediaId;
const retryableCondition = (error: unknown) => error instanceof Error &&
  ['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error.name);
const mediaDto = (row: Row) => ({
  mediaId: String(row.mediaId), state: String(row.state),
  bytes: typeof row.bytes === 'number' ? row.bytes : null,
  width: typeof row.width === 'number' ? row.width : null,
  height: typeof row.height === 'number' ? row.height : null,
  refCount: typeof row.refCount === 'number' ? row.refCount : 0,
});

/** P02-2 only: authenticated, private, local-disk media; no activation or public browsing. */
export function registerProfileMediaRoutes(app: FastifyInstance, db: DynamoDBDocumentClient,
    guard: SessionGuard, store = new LocalMediaStore()): void {
  const get = async (table: string, key: { PK: string; SK: string }): Promise<Row | undefined> =>
    (await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }))).Item as Row | undefined;
  const active = async (uid: string) => {
    const user = await get(usersTable, accountKey(uid));
    return user?.status === 'active' && user.ageEligibility === 'self_declared_adult';
  };

  // A raw stream parser is restricted to this exact media Content-Type. The
  // global JSON 16 KiB limit remains intact and the handler enforces 8 MiB.
  app.addContentTypeParser('application/octet-stream', (_request, payload, done) => done(null, payload));

  app.post('/v1/media/profile/uploads', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    if (!validUploadBegin(request.body)) return failure(reply, 400, 'invalid_upload_request');
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      // Bound total private media, including pending uploads, to avoid unbounded disk use.
      const existing = await db.send(new QueryCommand({ TableName: profilesTable,
        KeyConditionExpression: 'PK = :owner AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':owner': `USER#${auth.uid}`, ':prefix': 'MEDIA#' }, Limit: 25 }));
      if ((existing.Items?.length ?? 0) >= 24) return failure(reply, 409, 'media_library_full');
      const mediaId = randomUUID();
      await db.send(new PutCommand({ TableName: profilesTable,
        Item: { ...mediaKey(auth.uid, mediaId), mediaId, state: 'UPLOADING',
          refCount: 0, version: 1, createdAt: new Date().toISOString(),
          expiresAt: nowSeconds() + MEDIA_UPLOAD_TTL_SECONDS },
        ConditionExpression: 'attribute_not_exists(PK)' }));
      return reply.code(201).send({ mediaId, state: 'UPLOADING', maxBytes: MAX_MEDIA_BYTES });
    } catch { return failure(reply, 503, 'media_store_unavailable'); }
  });

  app.put('/v1/media/profile/uploads/:mediaId/content', { bodyLimit: MAX_MEDIA_BYTES + 1024 }, async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    const mediaId = mediaIdFrom(request);
    if (!validMediaId(mediaId)) return failure(reply, 400, 'invalid_media_id');
    if (request.headers['content-type']?.split(';')[0] !== 'application/octet-stream' ||
        (request.headers['content-length'] && Number(request.headers['content-length']) > MAX_MEDIA_BYTES)) {
      return failure(reply, 413, 'image_too_large_or_wrong_type');
    }
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const record = await get(profilesTable, mediaKey(auth.uid, mediaId));
      if (!record) return failure(reply, 404, 'media_not_found');
      if (record.state === 'STAGED') return { mediaId, state: 'STAGED' }; // lost response / retry
      if (record.state !== 'UPLOADING' || Number(record.expiresAt) < nowSeconds()) return failure(reply, 409, 'upload_not_available');
      const source = request.body as Readable;
      if (!source || typeof source.pipe !== 'function') return failure(reply, 400, 'invalid_upload_stream');
      // Crash recovery: the normalized file may have been atomically renamed
      // before the STAGED metadata transaction was acknowledged. Reinspect it
      // instead of irreversibly rejecting the owner's retry.
      const info = await store.exists(auth.uid, mediaId)
        ? await store.inspectMetadata(auth.uid, mediaId)
        : await store.ingest(auth.uid, mediaId, source);
      try {
        await db.send(new UpdateCommand({ TableName: profilesTable, Key: mediaKey(auth.uid, mediaId),
          UpdateExpression: 'SET #state = :staged, #version = :next, bytes = :bytes, sha256 = :digest, width = :width, height = :height, #format = :format',
          ConditionExpression: '#state = :uploading AND #version = :old AND expiresAt >= :now',
          ExpressionAttributeNames: { '#state': 'state', '#version': 'version', '#format': 'format' },
          ExpressionAttributeValues: { ':staged': 'STAGED', ':uploading': 'UPLOADING', ':old': 1, ':next': 2,
            ':bytes': info.bytes, ':digest': info.sha256, ':width': info.width, ':height': info.height,
            ':format': 'jpeg', ':now': nowSeconds() } }));
      } catch (error) {
        // A lost database response may mean the transaction already committed;
        // preserve staged bytes for an idempotent retry/reconciliation.
        const current = await get(profilesTable, mediaKey(auth.uid, mediaId)).catch(() => undefined);
        if (current?.state !== 'STAGED') {
          await store.remove(auth.uid, mediaId).catch(() => {});
          return failure(reply, retryableCondition(error) ? 409 : 503, 'media_stage_unconfirmed');
        }
      }
      return { mediaId, state: 'STAGED', ...info };
    } catch (error) {
      if (error instanceof InvalidImageError) {
        return failure(reply, error.reason === 'image_too_large' ? 413 : error.reason === 'upload_timed_out' ? 408 : 415, error.reason);
      }
      return failure(reply, 503, 'media_store_unavailable');
    }
  });

  app.post('/v1/media/profile/uploads/:mediaId/complete', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    const mediaId = mediaIdFrom(request);
    if (!validMediaId(mediaId) || !validUploadBegin(request.body)) return failure(reply, 400, 'invalid_media_request');
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const record = await get(profilesTable, mediaKey(auth.uid, mediaId));
      if (!record) return failure(reply, 404, 'media_not_found');
      if (record.state === 'READY') return mediaDto(record);
      if (record.state !== 'STAGED' || Number(record.expiresAt) < nowSeconds()) return failure(reply, 409, 'upload_not_ready');
      if (!await store.exists(auth.uid, mediaId)) return failure(reply, 409, 'media_bytes_missing');
      try {
        await db.send(new UpdateCommand({ TableName: profilesTable, Key: mediaKey(auth.uid, mediaId),
          UpdateExpression: 'SET #state = :ready, #version = :next REMOVE expiresAt',
          ConditionExpression: '#state = :staged AND #version = :old AND refCount = :zero',
          ExpressionAttributeNames: { '#state': 'state', '#version': 'version' },
          ExpressionAttributeValues: { ':ready': 'READY', ':staged': 'STAGED', ':old': 2, ':next': 3, ':zero': 0 } }));
      } catch (error) {
        if (!retryableCondition(error)) return failure(reply, 503, 'media_store_unavailable');
        const current = await get(profilesTable, mediaKey(auth.uid, mediaId));
        if (current?.state !== 'READY') return failure(reply, 409, 'media_state_conflict');
      }
      const ready = await get(profilesTable, mediaKey(auth.uid, mediaId));
      return ready ? mediaDto(ready) : failure(reply, 503, 'media_store_unavailable');
    } catch { return failure(reply, 503, 'media_store_unavailable'); }
  });

  app.get('/v1/media/profile/mine', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const found = await db.send(new QueryCommand({ TableName: profilesTable,
        KeyConditionExpression: 'PK = :owner AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':owner': `USER#${auth.uid}`, ':prefix': 'MEDIA#' },
        ConsistentRead: true, Limit: 25 }));
      // Bounded lazy recovery of uploads abandoned longer than the ticket TTL.
      // First atomically tombstone them; only then delete their bytes.
      for (const row of found.Items ?? []) {
        if ((row.state !== 'UPLOADING' && row.state !== 'STAGED') ||
            Number(row.expiresAt) >= nowSeconds() || !validMediaId(row.mediaId)) continue;
        const key = mediaKey(auth.uid, row.mediaId);
        try {
          await db.send(new UpdateCommand({ TableName: profilesTable, Key: key,
            UpdateExpression: 'SET #state = :expired',
            ConditionExpression: '#state = :previous AND expiresAt < :now AND refCount = :zero',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':expired': 'EXPIRED', ':previous': row.state,
              ':now': nowSeconds(), ':zero': 0 } }));
          await store.remove(auth.uid, row.mediaId);
          await db.send(new DeleteCommand({ TableName: profilesTable, Key: key,
            ConditionExpression: '#state = :expired',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':expired': 'EXPIRED' } }));
        } catch { /* A tombstone remains retryable; never hide active files. */ }
      }
      const items = (found.Items ?? []).filter(row => row.state === 'READY').map(mediaDto);
      return { items };
    } catch { return failure(reply, 503, 'media_store_unavailable'); }
  });

  app.get('/v1/media/profile/:mediaId/content', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    const mediaId = mediaIdFrom(request);
    if (!validMediaId(mediaId)) return failure(reply, 404, 'media_not_found');
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const row = await get(profilesTable, mediaKey(auth.uid, mediaId));
      if (row?.state !== 'READY') return failure(reply, 404, 'media_not_found');
      const data = await store.read(auth.uid, mediaId);
      reply.type('image/jpeg').header('X-Content-Type-Options', 'nosniff').header('Content-Disposition', 'inline');
      return reply.send(data);
    } catch { return failure(reply, 404, 'media_not_found'); }
  });

  app.put('/v1/profiles/me/:mode/photos', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    const mode = parseMode((request.params as Record<string, unknown>)?.mode);
    if (!mode) return failure(reply, 400, 'invalid_profile_mode');
    const parsed = parsePhotoUpdate(request.body);
    if ('error' in parsed) return failure(reply, 400, parsed.error);
    const { expectedVersion, photoIds } = parsed.value;
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const modeRecord = await get(profilesTable, modeKey(auth.uid, mode));
      if (!modeRecord || modeRecord.version !== expectedVersion) return failure(reply, 409, 'profile_version_conflict');
      const previous = Array.isArray(modeRecord.photoIds) ? modeRecord.photoIds.filter((v): v is string => typeof v === 'string') : [];
      const add = photoIds.filter(id => !previous.includes(id));
      const remove = previous.filter(id => !photoIds.includes(id));
      const now = new Date().toISOString();
      const transactions: NonNullable<TransactWriteCommandInput['TransactItems']> = [
        { ConditionCheck: { TableName: usersTable, Key: accountKey(auth.uid),
          ConditionExpression: '#state = :active AND ageEligibility = :adult',
          ExpressionAttributeNames: { '#state': 'status' },
          ExpressionAttributeValues: { ':active': 'active', ':adult': 'self_declared_adult' } } },
        { Update: { TableName: profilesTable, Key: modeKey(auth.uid, mode),
          UpdateExpression: 'SET photoIds = :ids, requestedActive = :inactive, #version = :next, updatedAt = :now',
          ConditionExpression: '#version = :expected AND attribute_exists(PK)',
          ExpressionAttributeNames: { '#version': 'version' },
          ExpressionAttributeValues: { ':ids': photoIds, ':next': expectedVersion + 1, ':expected': expectedVersion,
            ':now': now, ':inactive': false } } },
      ];
      for (const id of add) transactions.push({ Update: { TableName: profilesTable, Key: mediaKey(auth.uid, id),
        UpdateExpression: 'ADD refCount :one', ConditionExpression: '#state = :ready AND attribute_exists(PK)',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':one': 1, ':ready': 'READY' } } });
      for (const id of remove) transactions.push({ Update: { TableName: profilesTable, Key: mediaKey(auth.uid, id),
        UpdateExpression: 'ADD refCount :minus',
        ConditionExpression: '#state = :ready AND refCount >= :one',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':minus': -1, ':one': 1, ':ready': 'READY' } } });
      await db.send(new TransactWriteCommand({ TransactItems: transactions }));
      const updated = await get(profilesTable, modeKey(auth.uid, mode));
      if (!updated) return failure(reply, 503, 'media_store_unavailable');
      return { mode, version: updated.version, photoIds: updated.photoIds,
        requestedActive: false, visibility: 'inactive',
        completeness: { ready: false, missing: draftMissing({
          displayName: String(updated.displayName ?? ''), bio: String(updated.bio ?? ''),
          interests: Array.isArray(updated.interests) ? updated.interests.filter((x): x is string => typeof x === 'string') : [],
          intention: String(updated.intention ?? '') }, null, null, photoIds) } };
    } catch (error) {
      return failure(reply, retryableCondition(error) ? 409 : 503,
        retryableCondition(error) ? 'photo_assignment_conflict' : 'media_store_unavailable');
    }
  });

  app.delete('/v1/media/profile/:mediaId', async (request, reply) => {
    noStore(reply);
    const auth = await guard(request, reply);
    if (!auth) return reply;
    const mediaId = mediaIdFrom(request);
    if (!validMediaId(mediaId)) return failure(reply, 404, 'media_not_found');
    try {
      if (!await active(auth.uid)) return failure(reply, 403, 'account_unavailable');
      const key = mediaKey(auth.uid, mediaId);
      const record = await get(profilesTable, key);
      if (!record) return failure(reply, 404, 'media_not_found');
      if (record.state !== 'DELETING') {
        try {
          await db.send(new UpdateCommand({ TableName: profilesTable, Key: key,
            UpdateExpression: 'SET #state = :deleting',
            ConditionExpression: '#state = :ready AND refCount = :zero',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':deleting': 'DELETING', ':ready': 'READY', ':zero': 0 } }));
        } catch (error) { return failure(reply, retryableCondition(error) ? 409 : 503,
          retryableCondition(error) ? 'media_in_use' : 'media_store_unavailable'); }
      }
      // Keep DELETING tombstone after a filesystem failure; next delete retries.
      await store.remove(auth.uid, mediaId);
      await db.send(new DeleteCommand({ TableName: profilesTable, Key: key,
        ConditionExpression: '#state = :deleting AND refCount = :zero',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':deleting': 'DELETING', ':zero': 0 } }));
      return { deleted: true, mediaId };
    } catch { return failure(reply, 503, 'media_delete_pending_retry'); }
  });
}
