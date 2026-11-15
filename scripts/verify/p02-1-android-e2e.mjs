/**
 * P02-1 physical Android test: isolated app ID, real local API + DynamoDB.
 * Never clears or uninstalls the normal com.example.uluv application.
 */
import {spawnSync} from 'node:child_process';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, DeleteCommand} from '@aws-sdk/lib-dynamodb';
import {localFlutterConnection} from '../../apps/flutter_app/dev_connection.config.mjs';
import {createP012DeviceFixture} from './p01-2-device-fixture.mjs';
import {resetP02TestApp} from './p02-1-android-package.mjs';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

const args = process.argv.slice(2);
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
  if (removed) console.log('P02-1: reset disposable test app only; normal U_luv app untouched.');
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
    ['scripts/dev/flutter.mjs', 'p02-1-e2e', ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Native Gradle suffix isolates the Android package, Keystore and
        // encrypted preferences from the real user's installed application.
        ULUV_P02_1_ISOLATED_ANDROID_TEST: '1',
        ULUV_P02_1_FIXTURE_EMAIL: fixture.email,
        ULUV_P02_1_FIXTURE_PASSWORD: fixture.password,
        ULUV_P02_1_FIXTURE_UID: fixture.uid,
      },
    });
  code = child.status ?? 1;
  if (child.error) console.error('FAIL P02-1: could not launch the local Flutter command.');
  if (code === 0) console.log('PASS P02-1: physical Android, Keystore session, handle, drafts and restored persistence.');
  else console.error('FAIL P02-1: physical Android test failed; inspect the preceding Flutter output.');
} catch {
  // Report the actual stage instead of hiding every failure as "unavailable".
  // Never print the synthetic password, OTP, token or exception internals.
  console.error(`FAIL P02-1 Android ${stage}; see Windows checklist (no credentials printed).`);
} finally {
  if (devicePreflightSucceeded) {
    try { resetTestApp(); }
    catch {
      code = 1;
      console.error('WARNING P02-1: isolated test app cleanup failed; only the dedicated test package may be removed manually.');
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
      const handle = `p02${fixture.uid.replaceAll('-', '').substring(0, 17)}`;
      const records = [
        ['uluv_users', {PK: `HANDLE#${handle}`, SK: 'META'}],
        ['uluv_profiles', {PK: `USER#${fixture.uid}`, SK: 'MODE#DATING'}],
        ['uluv_profiles', {PK: `USER#${fixture.uid}`, SK: 'MODE#FRIENDSHIP'}],
        ...Array.from({length: 5}, (_, slot) =>
          ['uluv_auth_links', {PK: `USER#${fixture.uid}`, SK: `DEVICE#${slot}`}]),
      ];
      for (const [TableName, Key] of records) {
        try { await db.send(new DeleteCommand({TableName, Key})); }
        catch { cleanupFailed = true; }
      }
    } catch { cleanupFailed = true; }
    finally { db?.destroy(); }
    try { await fixture.cleanup(); }
    catch { cleanupFailed = true; }
    if (cleanupFailed) {
      code = 1;
      console.error('WARNING P02-1: some synthetic local fixture records could not be cleaned up.');
    } else {
      console.log('P02-1 synthetic Android fixture removed.');
    }
  }
}
process.exitCode = code;
