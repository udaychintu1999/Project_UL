/** P02-1 integration: an actual running local Fastify server and Java DynamoDB Local. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
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
try {
  const a = await createUser();
  const b = await createUser();
  const nameA = `p02a${marker}`;
  const nameB = `p02b${marker}`;
  const altA = `p02c${marker}`;
  const raceX = `p02d${marker}`, raceY = `p02e${marker}`;
  aliases.add(nameA); aliases.add(nameB); aliases.add(altA); aliases.add(raceX); aliases.add(raceY);

  assert.equal((await api('/v1/profiles/me')).status, 401, 'anonymous dashboard rejected');
  assert.equal((await api('/v1/profiles/me', undefined, { token: 'not-a-real-session' })).status, 401);
  const initial = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(initial.status, 200);
  assert.equal(initial.data.handle, null);
  assert.equal(initial.data.profiles.dating.version, 0);
  assert.equal(initial.data.profiles.friendship.exists, false);
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assertPrivate(initial.data);

  const bad = await api('/v1/profiles/me/handle', { handle: 'admin', expectedRevision: 1 }, { token: a.token, method: 'PUT' });
  assert.equal(bad.status, 400);
  const first = await api('/v1/profiles/me/handle', { handle: nameA.toUpperCase(), expectedRevision: 1 }, { token: a.token, method: 'PUT' });
  assert.equal(first.status, 200);
  assert.equal(first.data.handle, nameA);
  assert.equal(first.data.identityRevision, 2);
  const idempotent = await api('/v1/profiles/me/handle', { handle: nameA, expectedRevision: 2 }, { token: a.token, method: 'PUT' });
  assert.equal(idempotent.status, 200);
  assert.equal(idempotent.data.identityRevision, 2);
  const collision = await api('/v1/profiles/me/handle', { handle: nameA, expectedRevision: 1 }, { token: b.token, method: 'PUT' });
  assert.equal(collision.status, 409);
  assert.equal(collision.data.error, 'handle_taken');
  assertPrivate(collision.data);
  const bHandle = await api('/v1/profiles/me/handle', { handle: nameB, expectedRevision: 1 }, { token: b.token, method: 'PUT' });
  assert.equal(bHandle.status, 200);
  const renamed = await api('/v1/profiles/me/handle', { handle: altA, expectedRevision: 2 }, { token: a.token, method: 'PUT' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.identityRevision, 3);
  assert.equal((await db.send(new GetCommand({ TableName: users, Key: key(`HANDLE#${nameA}`), ConsistentRead: true }))).Item, undefined, 'old alias removed on rename');
  const staleHandle = await api('/v1/profiles/me/handle', { handle: nameA, expectedRevision: 2 }, { token: a.token, method: 'PUT' });
  assert.equal(staleHandle.status, 409, 'stale identity version rejected');
  const handleRace = await Promise.all([
    api('/v1/profiles/me/handle', { handle: raceX, expectedRevision: 3 }, { token: a.token, method: 'PUT' }),
    api('/v1/profiles/me/handle', { handle: raceY, expectedRevision: 3 }, { token: a.token, method: 'PUT' }),
  ]);
  assert.deepEqual(handleRace.map((x) => x.status).sort((x, y) => x - y), [200, 409], 'only one concurrent rename can commit');
  const afterRace = await db.send(new GetCommand({ TableName: users, Key: key(`USER#${a.uid}`), ConsistentRead: true }));
  const canonical = afterRace.Item?.handle;
  assert.ok(canonical === raceX || canonical === raceY);
  const winningAlias = await db.send(new GetCommand({ TableName: users, Key: key(`HANDLE#${canonical}`), ConsistentRead: true }));
  assert.equal(winningAlias.Item?.uid, a.uid);
  const losingAlias = await db.send(new GetCommand({ TableName: users, Key: key(`HANDLE#${canonical === raceX ? raceY : raceX}`), ConsistentRead: true }));
  assert.equal(losingAlias.Item, undefined, 'losing rename creates no alias');
  assert.equal((await api('/v1/profiles/me/local', undefined, { token: a.token })).status, 400);
  assert.equal((await api('/v1/profiles/me/dating', { ...draft(0, 'Test'), bio: 'a'.repeat(20000) }, { token: a.token, method: 'PUT' })).status, 413, 'large JSON profile rejected');

  assert.equal((await api('/v1/profiles/me/dating', draft(0, 'Test', 'Dating'), { method: 'PUT' })).status, 401);
  assert.equal((await api('/v1/profiles/me/dating', { ...draft(0, 'Test'), uniqueId: b.uid }, { token: a.token, method: 'PUT' })).status, 400);
  assert.equal((await api('/v1/profiles/me/dating', { ...draft(0, 'Test'), requestedActive: true }, { token: a.token, method: 'PUT' })).status, 400);
  assert.equal((await api('/v1/profiles/me/dating', { ...draft(0, 'Test'), bio: 'follow me on instagram' }, { token: a.token, method: 'PUT' })).status, 400);
  const dating = await api('/v1/profiles/me/dating', draft(0, 'Dating Nickname', 'A meaningful relationship'), { token: a.token, method: 'PUT' });
  assert.equal(dating.status, 200);
  assert.equal(dating.data.version, 1);
  assert.equal(dating.data.requestedActive, false);
  assert.deepEqual(dating.data.photoIds, []);
  assert.ok(dating.data.completeness.missing.includes('photos'));
  assert.equal(dating.data.visibility, 'inactive');
  const friends = await api('/v1/profiles/me/friendship', draft(0, 'Friendship Name', 'Friendship'), { token: a.token, method: 'PUT' });
  assert.equal(friends.status, 200);
  assert.equal(friends.data.version, 1);
  assert.equal(friends.data.displayName, 'Friendship Name');
  const after = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(after.data.profiles.dating.displayName, 'Dating Nickname');
  assert.equal(after.data.profiles.friendship.displayName, 'Friendship Name');
  assertPrivate(after.data);

  // The onboarding gate is server-derived from persisted account + shared +
  // selected mode drafts. No image or discovery activation occurs here.
  assert.equal(after.data.onboarding.ready, false);
  const setup = (revision, datingEnabled, friendshipEnabled) => ({
    expectedRevision: revision, commonName: 'Common Person', locality: 'Hyderabad',
    gender: 'prefer_not_to_say', selectedModes: { dating: datingEnabled, friendship: friendshipEnabled },
  });
  assert.equal((await api('/v1/profiles/me/setup', setup(0, true, false), { method: 'PUT' })).status, 401);
  assert.equal((await api('/v1/profiles/me/setup', { ...setup(0, true, false), uniqueId: b.uid },
    { token: a.token, method: 'PUT' })).status, 400);
  assert.equal((await api('/v1/profiles/me/setup', { ...setup(0, true, false), locality: '1 Baker Street' },
    { token: a.token, method: 'PUT' })).status, 400);
  // A blank gender may be saved as a draft, but must not unlock Continue.
  const blankGender = await api('/v1/profiles/me/setup', { ...setup(0, true, false), gender: '' },
    { token: a.token, method: 'PUT' });
  assert.equal(blankGender.status, 200);
  assert.equal(blankGender.data.onboarding.ready, false);
  assert.ok(blankGender.data.onboarding.missing.includes('gender'));
  assert.equal(blankGender.data.shared.gender, '');
  const draftReload = await api('/v1/profiles/me', undefined, { token: a.token });
  assert.equal(draftReload.data.shared.locality, 'Hyderabad');
  assert.equal(draftReload.data.shared.selectedModes.dating, true);
  assert.ok(draftReload.data.onboarding.missing.includes('gender'));
  // The explicit gender selection is a CAS update to the already-created draft.
  const selected = await api('/v1/profiles/me/setup', setup(1, true, false), { token: a.token, method: 'PUT' });
  assert.equal(selected.status, 200);
  assert.equal(selected.data.shared.setupRevision, 2);
  assert.equal(selected.data.shared.gender, 'prefer_not_to_say');
  assert.equal(selected.data.shared.locality, 'Hyderabad');
  assert.equal(selected.data.shared.selectedModes.dating, true);
  assert.equal(selected.data.shared.selectedModes.friendship, false);
  assert.ok(Number.isInteger(selected.data.shared.age) && selected.data.shared.age >= 18);
  assert.equal(selected.data.shared.localitySource, 'self_declared');
  assert.equal(selected.data.onboarding.ready, false);
  assert.ok(selected.data.onboarding.missing.includes('dating.photos'), 'two photos now required for onboarding');
  assert.equal(selected.data.profiles.dating.visibility, 'inactive');
  assertPrivate(selected.data);
  const staleSetup = await api('/v1/profiles/me/setup', setup(0, false, false), { token: a.token, method: 'PUT' });
  assert.equal(staleSetup.status, 409);
  const none = await api('/v1/profiles/me/setup', setup(2, false, false), { token: a.token, method: 'PUT' });
  assert.equal(none.status, 200);
  assert.equal(none.data.onboarding.ready, false);
  assert.ok(none.data.onboarding.missing.includes('selectMode'));
  const restored = await api('/v1/profiles/me/setup', setup(3, true, false), { token: a.token, method: 'PUT' });
  assert.equal(restored.data.onboarding.ready, false);
  assert.ok(restored.data.onboarding.missing.includes('dating.photos'));
  const emptyFriendship = await api('/v1/profiles/me/setup', setup(0, false, true), { token: b.token, method: 'PUT' });
  assert.equal(emptyFriendship.status, 200);
  assert.equal(emptyFriendship.data.onboarding.ready, false);
  assert.ok(emptyFriendship.data.onboarding.missing.includes('friendship.draft'));
  assert.notEqual(emptyFriendship.data.shared.commonName, after.data.profiles.dating.displayName,
    'other account cannot read first account private profile contents');
  const inherited = await api('/v1/profiles/me/friendship', draft(0, '', 'Friendship'),
    { token: b.token, method: 'PUT' });
  assert.equal(inherited.status, 200);
  assert.equal(inherited.data.displayName, '');
  assert.equal(inherited.data.effectiveDisplayName, 'Common Person');
  const bAfter = await api('/v1/profiles/me', undefined, { token: b.token });
  assert.equal(bAfter.data.onboarding.ready, false, 'common name applies, but photos remain required');
  assert.ok(bAfter.data.onboarding.missing.includes('friendship.photos'));
  assert.equal((await api('/v1/profiles/me', undefined, { token: a.token })).data.onboarding.ready, false,
    'server gate still requires two ready photos per selected mode after reload');
  const setupRace = await Promise.all([
    api('/v1/profiles/me/setup', setup(4, true, false), { token: a.token, method: 'PUT' }),
    api('/v1/profiles/me/setup', setup(4, true, true), { token: a.token, method: 'PUT' }),
  ]);
  assert.deepEqual(setupRace.map((result) => result.status).sort((x, y) => x - y), [200, 409],
    'two concurrent mode-setting writes cannot both commit');

  const [one, two] = await Promise.all([
    api('/v1/profiles/me/dating', draft(1, 'One wins'), { token: a.token, method: 'PUT' }),
    api('/v1/profiles/me/dating', draft(1, 'Other edit'), { token: a.token, method: 'PUT' }),
  ]);
  assert.deepEqual([one.status, two.status].sort((x, y) => x - y), [200, 409], 'only one CAS write accepted');
  assert.equal((await api('/v1/profiles/me/dating', undefined, { token: a.token })).data.version, 2);
  assert.equal((await api('/v1/profiles/me/friendship', undefined, { token: a.token })).data.version, 1);
  // Account B has already saved its *own* Friendship draft above. Checking
  // exists=false here is incorrect and confuses valid isolation with a leak.
  // Instead prove that B sees its own record, cannot see A's Dating record,
  // and that A's independent Friendship draft was not overwritten by B.
  const bFriendship = await api('/v1/profiles/me/friendship', undefined, { token: b.token });
  assert.equal(bFriendship.status, 200);
  assert.equal(bFriendship.data.exists, true, 'B reads its own saved Friendship draft');
  assert.equal(bFriendship.data.displayName, '');
  assert.equal(bFriendship.data.effectiveDisplayName, 'Common Person');
  assert.equal(bFriendship.data.version, 1);
  assertPrivate(bFriendship.data);
  const bDating = await api('/v1/profiles/me/dating', undefined, { token: b.token });
  assert.equal(bDating.status, 200);
  assert.equal(bDating.data.exists, false, 'B cannot see A-only Dating record');
  assert.equal(bDating.data.displayName, '');
  assert.equal(bDating.data.bio, '');
  assertPrivate(bDating.data);
  const aFriendship = await api('/v1/profiles/me/friendship', undefined, { token: a.token });
  assert.equal(aFriendship.status, 200);
  assert.equal(aFriendship.data.exists, true);
  assert.equal(aFriendship.data.displayName, 'Friendship Name', 'B writes do not affect A draft');
  assert.equal(aFriendship.data.version, 1);
  const stored = await db.send(new GetCommand({ TableName: profiles, Key: key(`USER#${a.uid}`, 'MODE#DATING'), ConsistentRead: true }));
  assert.equal(stored.Item?.version, 2, 'real DynamoDB persistence');
  assert.equal(stored.Item?.requestedActive, false);

  await db.send(new UpdateCommand({ TableName: users, Key: key(`USER#${a.uid}`),
    UpdateExpression: 'SET #state = :restricted', ExpressionAttributeNames: { '#state': 'status' },
    ExpressionAttributeValues: { ':restricted': 'restricted' } }));
  assert.equal((await api('/v1/profiles/me', undefined, { token: a.token })).status, 403, 'restricted account denied');
  assert.equal((await api('/v1/profiles/me/dating', draft(2, 'No'), { token: a.token, method: 'PUT' })).status, 403);
  assert.equal((await api('/v1/profiles/me/setup', setup(5, false, true), { token: a.token, method: 'PUT' })).status, 403);
  console.log('PASS P02-1: real local registration, authentication, unique atomic handles, revision conflicts, mode-isolated persisted drafts, validation, privacy, setup-gate persistence and restriction');
} finally {
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
      catch { console.warn('WARNING: P02-1 isolated fixture cleanup incomplete'); }
    }
  }
  for (const alias of aliases) {
    try { await db.send(new DeleteCommand({ TableName: users, Key: key(`HANDLE#${alias}`) })); }
    catch { console.warn('WARNING: P02-1 handle fixture cleanup incomplete'); }
  }
  db.destroy();
}
