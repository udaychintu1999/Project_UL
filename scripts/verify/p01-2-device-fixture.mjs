/**
 * Synthetic LOCAL-ONLY P01-2 Android test account. This is not a fake auth
 * response: every setup operation goes through the real Fastify + DynamoDB
 * Local backend, and the Flutter device test uses that real account.
 * No real user emails/passwords, cloud/network endpoints, scans or secrets in
 * output. Fixture credentials are created afresh for each run.
 */
import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

function validateLocal() {
  if (process.env.APP_ENV !== 'local') throw Error('P01-2 device fixture requires APP_ENV=local.');
  const secret = process.env.ULUV_DEV_TOKEN;
  if (!secret || !/^[A-Za-z0-9_-]{24,256}$/.test(secret)) throw Error('P01-2 local token missing or invalid.');
  const dbEndpoint = assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
  // Host-side setup is always PC loopback; Android obtains its own allowed
  // localhost forwarding through the existing flutter.mjs wrapper.
  return {secret, dbEndpoint};
}

export async function createP012DeviceFixture() {
  const {secret, dbEndpoint} = validateLocal();
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({
    endpoint: dbEndpoint, region: 'ap-south-1',
    credentials: {accessKeyId: 'local', secretAccessKey: 'local'},
  }));
  const email = `p01-2-device-${randomUUID()}@example.invalid`;
  const password = `DeviceStart@${randomBytes(10).toString('hex')}`;
  const emailHash = createHmac('sha256', secret).update(`email-subject\0${email}`).digest('hex');
  const tokenDigest = token => createHmac('sha256', secret).update(`session\0${token}`).digest('hex');
  let uid;
  const tokens = [];
  const key = (PK, SK = 'META') => ({PK, SK});
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    const entries = [
      ['uluv_auth_links', key(`AUTH#EMAIL#${emailHash}`)],
      ['uluv_auth_links', key(`OTP#EMAIL#${emailHash}`, 'CHALLENGE')],
      ['uluv_auth_links', key(`OTP#EMAIL#${emailHash}`, 'RATE')],
      ['uluv_auth_links', key(`PASSWORD#LOGIN#${emailHash}`, 'RATE')],
      ['uluv_auth_links', key(`PASSWORD#RESET#${emailHash}`, 'RATE')],
      ['uluv_auth_links', key(`PASSWORD#RESET#${emailHash}`, 'CHALLENGE')],
    ];
    if (uid) entries.push(
      ['uluv_auth_links', key(`USER#${uid}`, 'CREDENTIAL#PASSWORD')],
      ['uluv_auth_links', key(`USER#${uid}`, `PROVIDER#EMAIL#${emailHash}`)],
      ['uluv_users', key(`USER#${uid}`)],
      ['uluv_settings', key(`USER#${uid}`, 'SETTINGS')],
    );
    for (const token of tokens) entries.push(['uluv_auth_links', key(`SESSION#${tokenDigest(token)}`)]);
    let failures = 0;
    try {
      // Deleting the user revokes device-issued sessions even if we do not
      // possess their bearer tokens. Expired orphan session items TTL out.
      for (const [TableName, Key] of entries) {
        try { await db.send(new DeleteCommand({TableName, Key})); }
        catch { failures++; }
      }
    } finally { db.destroy(); }
    if (failures) throw Error(`Synthetic fixture cleanup incomplete for ${failures} items; check local DynamoDB.`);
  };

  async function post(path, body, dev = false, token = null) {
    const response = await fetch(`http://127.0.0.1:3000${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(dev ? {'x-uluv-dev-key': secret} : {}),
        ...(token ? {authorization: `Bearer ${token}`} : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    return {status: response.status, data};
  }
  function requireStatus(actual, expected, stage) {
    if (actual !== expected) throw Error(`Synthetic P01-2 device fixture ${stage} failed (HTTP ${actual}); no user data printed.`);
  }
  try {
    requireStatus((await post('/v1/auth/email/request', {email, purpose:'signup'})).status, 202, 'OTP request');
    const outbox = await post('/v1/dev/otp/outbox', {email}, true);
    requireStatus(outbox.status, 200, 'local OTP outbox');
    if (!/^\d{6}$/.test(outbox.data.code ?? '')) throw Error('Synthetic device OTP fixture: invalid local code response.');
    const registration = await post('/v1/auth/signup/register', {
      email, code: outbox.data.code, dateOfBirth: '2000-01-01', consent: true, password,
    });
    requireStatus(registration.status, 201, 'registration');
    uid = registration.data.account?.uniqueId;
    const token = registration.data.token;
    if (typeof uid !== 'string' || typeof token !== 'string') throw Error('Synthetic device fixture: unexpected registration response.');
    tokens.push(token);
    // Password credential was committed atomically with registration.
    // Confirm the fixture credentials actually authenticate before launching
    // Flutter. A device-side 401 can then be isolated from fixture setup.
    const preflight = await post('/v1/auth/password/login', {email, password});
    requireStatus(preflight.status, 200, 'password preflight');
    if (preflight.data.account?.uniqueId !== uid || typeof preflight.data.token !== 'string') {
      throw Error('Synthetic device fixture password preflight returned an unexpected identity.');
    }
    tokens.push(preflight.data.token);
    requireStatus((await post('/v1/auth/logout', {}, false, preflight.data.token)).status, 200, 'preflight logout');
    // The initial signup OTP is a REAL issued code and must remain counted
    // against the shared rolling 24-hour five-code budget. It also sets the
    // real 60-second resend cooldown. The Android test immediately exercises
    // password recovery, and its run time varies with the Gradle build/device.
    // On this synthetic, disposable LOCAL fixture only, expire the cooldown;
    // never remove issuance history, increase quota, or touch production code.
    const sharedBudgetKey = key(`OTP#EMAIL#${emailHash}`, 'RATE');
    const sharedBudget = (await db.send(new GetCommand({
      TableName: 'uluv_auth_links', Key: sharedBudgetKey, ConsistentRead: true,
    }))).Item;
    if (!sharedBudget || typeof sharedBudget.version !== 'string' ||
        !Array.isArray(sharedBudget.issuances) || sharedBudget.issuances.length !== 1) {
      throw Error('Synthetic P01-2 fixture shared email budget was not initialized as expected.');
    }
    await db.send(new UpdateCommand({
      TableName: 'uluv_auth_links', Key: sharedBudgetKey,
      UpdateExpression: 'SET nextAllowedAt = :past',
      ConditionExpression: '#v = :expected AND attribute_exists(issuances)',
      ExpressionAttributeNames: {'#v': 'version'},
      ExpressionAttributeValues: {
        ':expected': sharedBudget.version,
        ':past': Math.floor(Date.now() / 1000) - 1,
      },
    }));
    const adjusted = (await db.send(new GetCommand({
      TableName: 'uluv_auth_links', Key: sharedBudgetKey, ConsistentRead: true,
    }))).Item;
    if (!adjusted || !Array.isArray(adjusted.issuances) ||
        adjusted.issuances.length !== 1 || adjusted.nextAllowedAt > Math.floor(Date.now() / 1000)) {
      throw Error('Synthetic P01-2 fixture did not preserve the email budget while adjusting its cooldown.');
    }
    return {email, password, uid, cleanup};
  } catch (error) {
    try { await cleanup(); } catch { /* Preserve the setup failure, no data in output. */ }
    throw error;
  }
}
