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
  const before = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(before.status, 200);
  const handle = `active_${marker}`;
  const claim = await api('/v1/profiles/me/handle', {
    handle, expectedRevision: before.data.identityRevision
  }, { method: 'PUT', token: a.token });
  assert.equal(claim.status, 200);
  aliases.add(handle);
  const setup = await api('/v1/profiles/me/setup', {
    expectedRevision: 0, commonName: 'Activation Test', locality: 'Hyderabad',
    gender: 'prefer_not_to_say', selectedModes: { dating: true, friendship: true },
  }, { method: 'PUT', token: a.token });
  assert.equal(setup.status, 200);
  for (const mode of ['dating', 'friendship']) {
    const saved = await api(`/v1/profiles/me/${mode}`, draft(0, 'Activation Person'),
      { method: 'PUT', token: a.token });
    assert.equal(saved.status, 200);
  }
  const without = await api('/v1/profiles/me/dating/activate', { expectedVersion: 1 },
    { token: a.token });
  assert.equal(without.status, 409, 'cannot activate before READY assigned photos');
  assert.ok(without.data.missing.includes('dating.photos'));
  assert.equal((await api('/v1/profiles/me/dating/activate', { expectedVersion: 1 })).status, 401);
  assert.equal((await api('/v1/profiles/me/dating/activate', { expectedVersion: 1, ownerUid: b.uid },
    { token: a.token })).status, 400, 'client owner ID forbidden');

  const img1 = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#129aca' } }).jpeg().toBuffer();
  const img2 = await sharp({ create: { width: 300, height: 250, channels: 3, background: '#cf9181' } }).png().toBuffer();
  const one = await upload(a, img1), two = await upload(a, img2);
  for (const mode of ['dating', 'friendship']) {
    const saved = await api(`/v1/profiles/me/${mode}/photos`,
      { expectedVersion: 1, photoIds: [one, two] }, { token: a.token, method: 'PUT' });
    assert.equal(saved.status, 200);
  }
  const activatedDating = await api('/v1/profiles/me/dating/activate', { expectedVersion: 2 }, { token: a.token });
  assert.equal(activatedDating.status, 200);
  assert.equal(activatedDating.data.profiles.dating.requestedActive, true);
  assert.equal(activatedDating.data.profiles.dating.visibility, 'pending_trusted_locality');
  assert.equal(activatedDating.data.profiles.dating.discoveryEligible, false);
  assert.equal(activatedDating.data.profiles.friendship.requestedActive, false);
  const singleDating = await api('/v1/profiles/me/dating', undefined, { token: a.token });
  assert.equal(singleDating.status, 200);
  assert.equal(singleDating.data.visibility, 'pending_trusted_locality',
    'single-mode and owner dashboard must report identical visibility');
  assert.equal(singleDating.data.discoveryEligible, false);
  assert.equal((await api('/v1/profiles/me/dating/activate', { expectedVersion: 2 }, { token: a.token })).status, 409);

  const ownerPreview = await api('/v1/profiles/me/dating/preview', undefined, { token: a.token });
  assert.equal(ownerPreview.status, 200);
  assert.equal(ownerPreview.data.publicVisible, false);
  assert.deepEqual(ownerPreview.data.photoIds, [one, two]);
  assert.equal(ownerPreview.data.broadArea, 'Hyderabad');
  assertPrivate(ownerPreview.data);
  for (const forbidden of ['gender', 'birthDate', 'uniqueId', 'email', 'requestedActive', 'mediaPath', 'locationCenter']) {
    assert.equal(Object.hasOwn(ownerPreview.data, forbidden), false, `owner safe preview must exclude ${forbidden}`);
  }
  assert.equal((await api('/v1/profiles/me/dating/preview', undefined, { token: b.token })).status, 409,
    'other account cannot request owner A preview');
  assert.equal((await api(`/v1/profiles/dating/${handle}/preview`, undefined, { token: b.token })).status, 404,
    'no trusted pointer or viewer authorization: public preview fails closed');
  assert.equal((await api(`/v1/profiles/dating/${handle}/preview`)).status, 404);

  const activatedFriendship = await api('/v1/profiles/me/friendship/activate', { expectedVersion: 2 }, { token: a.token });
  assert.equal(activatedFriendship.status, 200);
  assert.equal(activatedFriendship.data.profiles.dating.requestedActive, true);
  assert.equal(activatedFriendship.data.profiles.friendship.requestedActive, true);

  const removed = await api('/v1/profiles/me/dating/photos',
    { expectedVersion: 3, photoIds: [one] }, { token: a.token, method: 'PUT' });
  assert.equal(removed.status, 200, 'photo removal must not be locked when intent is active');
  const afterRemoval = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(afterRemoval.data.profiles.dating.requestedActive, false, 'photo removal automatically clears intent');
  assert.equal(afterRemoval.data.profiles.dating.visibility, 'inactive');
  assert.equal(afterRemoval.data.profiles.friendship.requestedActive, true);
  assert.equal(afterRemoval.data.profiles.friendship.visibility, 'pending_trusted_locality');
  const restored = await api('/v1/profiles/me/dating/photos',
    { expectedVersion: 4, photoIds: [one, two] }, { token: a.token, method: 'PUT' });
  assert.equal(restored.status, 200);
  assert.equal((await api('/v1/profiles/me', undefined, { token: a.token })).data.profiles.dating.requestedActive, false,
    'restoring photo count must never silently reactivate Dating');
  const reac = await api('/v1/profiles/me/dating/activate', { expectedVersion: 5 }, { token: a.token });
  assert.equal(reac.status, 200);
  const changedCity = await api('/v1/profiles/me/setup', {
    expectedRevision: 1, commonName: 'Activation Test', locality: 'Mumbai',
    gender: 'prefer_not_to_say', selectedModes: { dating: true, friendship: true }
  }, { token: a.token, method: 'PUT' });
  assert.equal(changedCity.status, 200);
  assert.equal(changedCity.data.profiles.dating.visibility, 'paused_ineligible',
    'old activation cannot resume automatically after Common Profile revision');
  assert.equal(changedCity.data.profiles.friendship.visibility, 'paused_ineligible');
  const deactivate = await api('/v1/profiles/me/dating/deactivate', { expectedVersion: 6 }, { token: a.token });
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.data.profiles.dating.requestedActive, false);
  assert.equal(deactivate.data.profiles.friendship.requestedActive, true,
    'independent Dating deactivation cannot affect Friendship intent');
  const newHandle = `renamed_${marker}`;
  const renamed = await api('/v1/profiles/me/handle', {
    handle: newHandle, expectedRevision: deactivate.data.identityRevision
  }, { method: 'PUT', token: a.token });
  assert.equal(renamed.status, 200, 'owner may rename own public handle');
  aliases.add(newHandle);
  const afterRename = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(afterRename.data.profiles.friendship.requestedActive, true);
  assert.equal(afterRename.data.profiles.friendship.visibility, 'paused_ineligible',
    'an account-handle change must pause any previous activation intent');
  assert.equal(afterRename.data.profiles.friendship.discoveryEligible, false);

  console.log('PASS P02-3: real local activation CAS, eligibility, independent intents, photo auto-pause, handle change, safe private previews and fail-closed public access');

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
