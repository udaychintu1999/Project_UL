/** P02-1 integration: an actual running local Fastify server and Java DynamoDB Local. */
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { assertLocalHttpEndpoint } from '../lib/local-endpoints.mjs';

const endpoint = assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
const secret = process.env.ULUV_DEV_TOKEN;
if (process.env.APP_ENV !== 'local' || typeof secret !== 'string' || secret.length < 24) {
  throw new Error('P02-1 integration requires the owner local-only .env file');
}
const db = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: 'ap-south-1', endpoint, credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
}));
const users = 'uluv_users', authTable = 'uluv_auth_links', profiles = 'uluv_profiles', settings = 'uluv_settings';
const origin = 'http://127.0.0.1:3000';
const marker = randomUUID().replaceAll('-', '').slice(0, 12);
const identities = [];
const aliases = new Set();
const key = (PK, SK = 'META') => ({ PK, SK });
const digest = (kind, raw) => createHmac('sha256', secret).update(`${kind}\0${raw}`).digest('hex');

async function api(path, body, options = {}) {
  const response = await fetch(origin + path, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.dev ? { 'x-uluv-dev-key': secret } : {}),
      ...(options.requestId ? { 'x-uluv-request-id': options.requestId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(18000),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function createUser() {
  const email = `p02-${marker}-${identities.length}@example.invalid`;
  const identity = { email, uid: null, token: null, hash: digest('email-subject', email) };
  identities.push(identity);
  const requested = await api('/v1/auth/email/request', { email, purpose: 'signup' }, { requestId: randomUUID() });
  assert.equal(requested.status, 202, 'local registration OTP requested');
  const outbox = await api('/v1/dev/otp/outbox', { email }, { dev: true });
  assert.equal(outbox.status, 200, 'local test outbox');
  const created = await api('/v1/auth/signup/register', {
    email, code: outbox.data.code, dateOfBirth: '2000-01-01', consent: true,
    password: 'Local-only strong test passphrase',
  });
  assert.equal(created.status, 201, 'local account created');
  identity.uid = created.data.account.uniqueId;
  identity.token = created.data.token;
  return identity;
}
const draft = (version, name, intent = 'Meeting new people') => ({
  expectedVersion: version, displayName: name, bio: 'Books, walks and community.',
  interests: ['Reading', 'Travel'], intention: intent,
});
function assertPrivate(value) {
  const json = JSON.stringify(value);
  for (const forbidden of ['birthDate', 'email', 'sessionEpoch', 'uniqueId', 'passwordHash', 'mediaPath', 'ownerUid']) {
    assert.equal(json.includes(`"${forbidden}"`), false, `profile DTO must not include ${forbidden}`);
  }
}

const createdMedia = [];
async function upload(user, bytes) {
  const begin = await api('/v1/media/profile/uploads', {}, { token: user.token });
  assert.equal(begin.status, 201, 'upload ticket exists');
  const id = begin.data.mediaId;
  createdMedia.push({ uid: user.uid, mediaId: id });
  const content = await fetch(origin + `/v1/media/profile/uploads/${id}/content`, {
    method: 'PUT', headers: { authorization: `Bearer ${user.token}`,
      'content-type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(30000) });
  assert.equal(content.status, 200, 'real image staged');
  assert.equal((await content.json()).state, 'STAGED');
  const done = await api(`/v1/media/profile/uploads/${id}/complete`, {}, { token: user.token });
  assert.equal(done.status, 200, 'real image made ready');
  assert.equal(done.data.state, 'READY');
  return id;
}
try {
  const a = await createUser();
  const b = await createUser();
  assert.equal((await api('/v1/media/profile/uploads', {})).status, 401);
  assert.equal((await api('/v1/media/profile/uploads', { ownerUid: b.uid }, { token: a.token })).status, 400);
  const validJpeg = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#17aabb' } }).jpeg().toBuffer();
  const validPng = await sharp({ create: { width: 300, height: 240, channels: 3, background: '#aacc55' } }).png().toBuffer();
  const jpeg = await upload(a, validJpeg);
  const png = await upload(a, validPng);
  const image = await fetch(origin + `/v1/media/profile/${png}/content`, {
    headers: { authorization: `Bearer ${a.token}` } });
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') ?? '', /^image\/jpeg/);
  assert.equal(image.headers.get('cache-control'), 'private, no-store');
  const normalized = Buffer.from(await image.arrayBuffer());
  assert.equal(normalized[0], 0xff);
  assert.equal(normalized[1], 0xd8);
  const inspected = await sharp(normalized).metadata();
  assert.equal(inspected.format, 'jpeg');
  assert.equal(inspected.exif, undefined, 'normalization strips EXIF');
  const stranger = await fetch(origin + `/v1/media/profile/${png}/content`, {
    headers: { authorization: `Bearer ${b.token}` } });
  assert.equal(stranger.status, 404, 'no cross-account media access');

  const invalidBegin = await api('/v1/media/profile/uploads', {}, { token: a.token });
  assert.equal(invalidBegin.status, 201);
  createdMedia.push({ uid: a.uid, mediaId: invalidBegin.data.mediaId });
  const invalid = await fetch(origin + `/v1/media/profile/uploads/${invalidBegin.data.mediaId}/content`, {
    method: 'PUT', headers: { authorization: `Bearer ${a.token}`,
      'content-type': 'application/octet-stream' }, body: Buffer.from('not a JPEG, PNG or WebP'.repeat(3)) });
  assert.equal(invalid.status, 415, 'invalid magic/decoder rejected');
  assert.equal((await api(`/v1/media/profile/uploads/${invalidBegin.data.mediaId}/complete`, {},
    { token: a.token })).status, 409, 'cannot finalize invalid bytes');

  // Full local end-to-end readiness: verified handle, shared identity and two
  // saved mode drafts are necessary, but not sufficient without assigned media.
  const initial = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(initial.status, 200);
  const handle = `media_${marker}`;
  const claim = await api('/v1/profiles/me/handle', {
    expectedRevision: initial.data.identityRevision, handle
  }, { method: 'PUT', token: a.token });
  assert.equal(claim.status, 200);
  aliases.add(handle);
  const common = (revision, dating, friendship) => ({
    expectedRevision: revision, commonName: 'Local Media Person', locality: 'Hyderabad',
    gender: 'non_binary', selectedModes: { dating, friendship }
  });
  const selected = await api('/v1/profiles/me/setup', common(0, true, false),
    { method: 'PUT', token: a.token });
  assert.equal(selected.status, 200);
  assert.ok(selected.data.onboarding.missing.includes('dating.draft'));
  const draft = { expectedVersion: 0, displayName: 'Local Person', bio: 'I enjoy music and books',
    interests: ['Reading'], intention: 'Friendship' };
  for (const mode of ['dating', 'friendship']) {
    assert.equal((await api(`/v1/profiles/me/${mode}`, draft, { method: 'PUT', token: a.token })).status, 200);
  }
  const textReadyButNoPhotos = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(textReadyButNoPhotos.data.onboarding.ready, false);
  assert.deepEqual(textReadyButNoPhotos.data.onboarding.missing, ['dating.photos']);
  assert.equal(textReadyButNoPhotos.data.profiles.dating.visibility, 'inactive');
  // Uploading images into the private library must not satisfy the mode gate.
  assert.equal((await api('/v1/media/profile/mine', undefined, { token: a.token })).data.items.length >= 2, true);
  assert.equal((await api('/v1/profiles/me', undefined, { token: a.token })).data.onboarding.ready, false);
  assert.equal((await api('/v1/profiles/me/dating/photos', { expectedVersion: 1, photoIds: [jpeg, jpeg] },
    { method: 'PUT', token: a.token })).status, 400, 'duplicate IDs rejected');
  assert.equal((await api('/v1/profiles/me/dating/photos', { expectedVersion: 1, photoIds: [jpeg, png], requestedActive: true },
    { method: 'PUT', token: a.token })).status, 400, 'activation not permitted');
  assert.equal((await api('/v1/profiles/me/dating/photos', { expectedVersion: 1, photoIds: [jpeg] },
    { method: 'PUT', token: b.token })).status, 409, 'no draft owned by other user');
  const first = await api('/v1/profiles/me/dating/photos', { expectedVersion: 1, photoIds: [jpeg, png] },
    { method: 'PUT', token: a.token });
  assert.equal(first.status, 200);
  assert.equal(first.data.version, 2);
  assert.deepEqual(first.data.photoIds, [jpeg, png]);
  assert.equal(first.data.visibility, 'inactive');
  const datingReady = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(datingReady.data.onboarding.ready, true,
    'Two owner READY media assigned to selected Dating mode unlock Continue');
  assert.equal(datingReady.data.profiles.dating.visibility, 'inactive',
    'Continue never implies discovery activation');
  const both = await api('/v1/profiles/me/setup', common(1, true, true), { method: 'PUT', token: a.token });
  assert.equal(both.status, 200);
  assert.equal(both.data.onboarding.ready, false);
  assert.deepEqual(both.data.onboarding.missing, ['friendship.photos']);
  const friend = await api('/v1/profiles/me/friendship/photos', { expectedVersion: 1, photoIds: [png] },
    { method: 'PUT', token: a.token });
  assert.equal(friend.status, 200, 'one file referenced in two modes');
  const oneFriendPhoto = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(oneFriendPhoto.data.onboarding.ready, false);
  assert.deepEqual(oneFriendPhoto.data.onboarding.missing, ['friendship.photos']);
  const friendTwo = await api('/v1/profiles/me/friendship/photos',
    { expectedVersion: friend.data.version, photoIds: [png, jpeg] }, { method: 'PUT', token: a.token });
  assert.equal(friendTwo.status, 200);
  const bothReady = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(bothReady.data.onboarding.ready, true,
    'Dating and Friendship each have two READY mode assignments; reuse allowed');
  assert.equal(bothReady.data.profiles.dating.visibility, 'inactive');
  assert.equal(bothReady.data.profiles.friendship.visibility, 'inactive');
  const mine = await api('/v1/media/profile/mine', undefined, { token: a.token });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.items.find(m => m.mediaId === png).refCount, 2);
  assert.equal((await api(`/v1/media/profile/${png}`, undefined, { token: a.token, method: 'DELETE' })).status, 409);
  const race = await Promise.all([
    api('/v1/profiles/me/dating/photos', { expectedVersion: 2, photoIds: [png, jpeg] }, { token: a.token, method: 'PUT' }),
    api('/v1/profiles/me/dating/photos', { expectedVersion: 2, photoIds: [jpeg] }, { token: a.token, method: 'PUT' }),
  ]);
  assert.deepEqual(race.map(result => result.status).sort((x, y) => x - y), [200, 409]);
  const current = await api('/v1/profiles/me/dating', undefined, { token: a.token });
  const stripped = await api('/v1/profiles/me/dating/photos', { expectedVersion: current.data.version, photoIds: [] },
    { method: 'PUT', token: a.token });
  assert.equal(stripped.status, 200);
  const datingStripped = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(datingStripped.data.onboarding.ready, false);
  assert.ok(datingStripped.data.onboarding.missing.includes('dating.photos'),
    'Removing second photo from an enabled mode closes gate immediately');
  const onlyFriendship = await api('/v1/profiles/me/setup', common(2, false, true),
    { method: 'PUT', token: a.token });
  assert.equal(onlyFriendship.status, 200);
  assert.equal(onlyFriendship.data.onboarding.ready, true,
    'Disabling the incomplete mode preserves the complete enabled mode');
  assert.equal((await api(`/v1/media/profile/${png}`, undefined, { token: a.token, method: 'DELETE' })).status, 409,
    'Friendship still holds reference');
  assert.equal((await api('/v1/profiles/me/friendship/photos', { expectedVersion: friendTwo.data.version, photoIds: [png] },
    { method: 'PUT', token: a.token })).status, 200);
  const oneRemaining = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(oneRemaining.data.onboarding.ready, false,
    'Removing one of two Friendship photos must close the gate after reload');
  assert.ok(oneRemaining.data.onboarding.missing.includes('friendship.photos'));
  assert.equal((await api('/v1/profiles/me/friendship/photos', { expectedVersion: friendTwo.data.version + 1, photoIds: [] },
    { method: 'PUT', token: a.token })).status, 200);
  assert.equal((await api(`/v1/media/profile/${png}`, undefined, { token: a.token, method: 'DELETE' })).status, 200);
  assert.equal((await api(`/v1/media/profile/${png}/content`, undefined, { token: a.token })).status, 404);
  assert.equal((await api('/v1/profiles/me/dating', undefined, { token: a.token })).data.visibility, 'inactive');
  console.log('PASS P02-2: real image bytes, privacy/ownership, two READY photos per enabled mode, 0/1/2 transitions, cross-mode reuse, Continue gate, removal/reload, inactive visibility');
} finally {
  for (const item of createdMedia) {
    try { await db.send(new DeleteCommand({ TableName: profiles, Key: key(`USER#${item.uid}`, `MEDIA#${item.mediaId}`) })); }
    catch { console.warn('WARNING: synthetic media metadata cleanup incomplete'); }
  }
  // Every owner is a fresh synthetic UUID minted by this test. Remove only
  // its hashed object directory in the ignored local media root.
  for (const person of identities) {
    if (!/^[0-9a-f-]{36}$/i.test(person.uid ?? '')) continue;
    const folder = createHash('sha256').update(person.uid).digest('hex').slice(0, 32);
    await rm(join(process.cwd(), '.local', 'media', 'objects', folder),
      {recursive: true, force: true}).catch(() => {
        console.warn('WARNING: P02-2 fixture local media cleanup incomplete');
      });
  }
  for (const handle of aliases) {
    try { await db.send(new DeleteCommand({ TableName: users, Key: key(`HANDLE#${handle}`) })); }
    catch { console.warn('WARNING: synthetic public handle cleanup incomplete'); }
  }
  for (const person of identities) {
    const entries = [
      [authTable, key(`AUTH#EMAIL#${person.hash}`)],
      [authTable, key(`OTP#EMAIL#${person.hash}`, 'CHALLENGE')],
      [authTable, key(`OTP#EMAIL#${person.hash}`, 'RATE')],
      [authTable, key(`USER#${person.uid}`, `CREDENTIAL#PASSWORD`)],
      [authTable, key(`USER#${person.uid}`, `PROVIDER#EMAIL#${person.hash}`)],
      [users, key(`USER#${person.uid}`)],
      [settings, key(`USER#${person.uid}`, 'SETTINGS')],
      [profiles, key(`USER#${person.uid}`, 'MODE#DATING')],
      [profiles, key(`USER#${person.uid}`, 'MODE#FRIENDSHIP')],
      [authTable, key(`SESSION#${digest('session', person.token)}`)],
    ];
    for (const [table, itemKey] of entries) {
      if (!person.uid && itemKey.PK.startsWith('USER#')) continue;
      if (!person.token && itemKey.PK.startsWith('SESSION#')) continue;
      try { await db.send(new DeleteCommand({ TableName: table, Key: itemKey })); }
      catch { console.warn('WARNING: P02-2 synthetic account cleanup incomplete'); }
    }
  }
  db.destroy();
}
