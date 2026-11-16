/**
 * P02-2 physical Android test: isolated app ID, real local API + DynamoDB.
 * Never clears or uninstalls the normal com.example.uluv application.
 */
import {spawnSync} from 'node:child_process';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, DeleteCommand} from '@aws-sdk/lib-dynamodb';
import {localFlutterConnection} from '../../apps/flutter_app/dev_connection.config.mjs';
import {createP012DeviceFixture} from './p01-2-device-fixture.mjs';
import {resetP02TestApp} from './p02-1-android-package.mjs';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

// --ui selects the actual app-screen journey. The existing command still
// checks direct media API/DB invariants; both suites are required for P02-2.
const uiJourney = process.argv.includes('--ui');
const args = process.argv.slice(2).filter((arg) => arg !== '--ui');
function selectedDevice() {
  const requested = args.findIndex((arg) => arg === '--device' || arg === '-d');
  const value = requested < 0 ? localFlutterConnection.deviceId : args[requested + 1];
  if (typeof value !== 'string' || (value && !/^[A-Za-z0-9._:-]+$/.test(value))) {
    throw new Error('Invalid Android device selection');
  }
  return value ? ['-s', value] : [];
}
function adb(command) {
  const result = spawnSync('adb', command, {
    encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    // Do not print subprocess stdout/stderr; some OEM tools echo private data.
    throw new Error('ADB operation failed for the dedicated P02 test package');
  }
  return result.stdout.trim();
}
function resetTestApp() {
  // Package-manager listing returns an empty successful result if the test
  // APK has never been installed; this is a NORMAL first-run state.
  const removed = resetP02TestApp(selectedDevice(), adb);
  if (removed) console.log('P02-2: reset disposable test app only; normal U_luv app untouched.');
}

let fixture;
let code = 1;
let devicePreflightSucceeded = false;
let stage = 'device preflight';
try {
  resetTestApp();
  devicePreflightSucceeded = true;
  stage = 'synthetic local account setup';
  fixture = await createP012DeviceFixture();
  stage = 'Flutter physical-device test';
  const child = spawnSync(process.execPath,
    ['scripts/dev/flutter.mjs', uiJourney ? 'p02-2-ui-e2e' : 'p02-2-e2e', ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Native Gradle suffix isolates the Android package, Keystore and
        // encrypted preferences from the real user's installed application.
        ULUV_P02_1_ISOLATED_ANDROID_TEST: '1',
        ULUV_P02_2_FIXTURE_EMAIL: fixture.email,
        ULUV_P02_2_FIXTURE_PASSWORD: fixture.password,
        ULUV_P02_2_FIXTURE_UID: fixture.uid,
      },
    });
  code = child.status ?? 1;
  if (child.error) console.error('FAIL P02-2: could not launch the local Flutter command.');
  if (code === 0) console.log(uiJourney
    ? 'PASS P02-2 UI: real app login, profile fields, photo controls, Continue gate and restart verified.'
    : 'PASS P02-2 API: physical Android, real media upload, auth, mode reuse and deletion.');
  else console.error('FAIL P02-2: physical Android test failed; inspect the preceding Flutter output.');
} catch {
  // Report the actual stage instead of hiding every failure as "unavailable".
  // Never print the synthetic password, OTP, token or exception internals.
  console.error(`FAIL P02-2 Android ${stage}; see Windows checklist (no credentials printed).`);
} finally {
  if (devicePreflightSucceeded) {
    try { resetTestApp(); }
    catch {
      code = 1;
      console.error('WARNING P02-2: isolated test app cleanup failed; only the dedicated test package may be removed manually.');
    }
  }
  if (fixture) {
    // Even if optional profile cleanup fails, ALWAYS run the base fixture
    // cleanup, so the temporary local account is not unnecessarily retained.
    let cleanupFailed = false;
    let db;
    try {
      const endpoint = assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
      db = DynamoDBDocumentClient.from(new DynamoDBClient({
        region: 'ap-south-1', endpoint,
        credentials: {accessKeyId: 'local', secretAccessKey: 'local'},
      }));
      const records = [
        ['uluv_profiles', {PK: `USER#${fixture.uid}`, SK: 'MODE#DATING'}],
        ['uluv_profiles', {PK: `USER#${fixture.uid}`, SK: 'MODE#FRIENDSHIP'}],
        ...Array.from({length: 5}, (_, slot) =>
          ['uluv_auth_links', {PK: `USER#${fixture.uid}`, SK: `DEVICE#${slot}`}]),
      ];
      // Only synthetic owner records are in scope. Media records use the
      // fixture's exact UID key; no scans or unrelated accounts.
      const mediaRows = await db.send(new (await import('@aws-sdk/lib-dynamodb')).QueryCommand({
        TableName: 'uluv_profiles',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${fixture.uid}`, ':prefix': 'MEDIA#' },
      }));
      for (const row of mediaRows.Items ?? []) {
        records.push(['uluv_profiles', {PK: row.PK, SK: row.SK}]);
      }
      for (const [TableName, Key] of records) {
        try { await db.send(new DeleteCommand({TableName, Key})); }
        catch { cleanupFailed = true; }
      }
    } catch { cleanupFailed = true; }
    finally { db?.destroy(); }
    // Remove only this newly-created fixture's media folder, never real media.
    try {
      const {rm} = await import('node:fs/promises');
      const {join} = await import('node:path');
      const {createHash} = await import('node:crypto');
      // This block runs in the outer finally clause. Never throw/control-flow
      // out of finally: flag invalid synthetic identity and still run account
      // cleanup below. Only a strict UUID may select a media owner directory.
      if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(fixture.uid)) {
        const owner = createHash('sha256').update(fixture.uid).digest('hex').slice(0, 32);
        await rm(join(process.cwd(), '.local', 'media', 'objects', owner), {recursive: true, force: true});
      } else {
        cleanupFailed = true;
      }
    } catch { cleanupFailed = true; }
    try { await fixture.cleanup(); }
    catch { cleanupFailed = true; }
    if (cleanupFailed) {
      code = 1;
      console.error('WARNING P02-2: some synthetic local fixture records could not be cleaned up.');
    } else {
      console.log('P02-2 synthetic Android fixture removed.');
    }
  }
}
process.exitCode = code;
