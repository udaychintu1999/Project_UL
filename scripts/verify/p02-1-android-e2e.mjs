/** Disposable local P02-1 account + real physical Android integration runner. */
import { spawnSync } from 'node:child_process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createP012DeviceFixture } from './p01-2-device-fixture.mjs';
import { assertLocalHttpEndpoint } from '../lib/local-endpoints.mjs';
let fixture;
let code = 1;
try {
  fixture = await createP012DeviceFixture();
  const child = spawnSync(process.execPath,
    ['scripts/dev/flutter.mjs', 'p02-1-e2e', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ULUV_P02_1_FIXTURE_EMAIL: fixture.email,
        ULUV_P02_1_FIXTURE_PASSWORD: fixture.password,
        ULUV_P02_1_FIXTURE_UID: fixture.uid,
      },
    });
  code = child.status ?? 1;
  if (code === 0) console.log('PASS P02-1: physical Android, Keystore session, handle, mode drafts, restored persistence.');
  else console.error('FAIL P02-1 Android integration (details above).');
} catch {
  console.error('P02-1 physical-device runner unavailable; do not claim Android verification.');
} finally {
  if (fixture) {
    try {
      const endpoint = assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
      const db = DynamoDBDocumentClient.from(new DynamoDBClient({
        region: 'ap-south-1', endpoint,
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }));
      try {
        const handle = `p02${fixture.uid.replaceAll('-', '').substring(0, 17)}`;
        const toRemove = [
          ['uluv_users', { PK: `HANDLE#${handle}`, SK: 'META' }],
          ['uluv_profiles', { PK: `USER#${fixture.uid}`, SK: 'MODE#DATING' }],
          ['uluv_profiles', { PK: `USER#${fixture.uid}`, SK: 'MODE#FRIENDSHIP' }],
          ...Array.from({ length: 5 }, (_, slot) => ['uluv_auth_links', { PK: `USER#${fixture.uid}`, SK: `DEVICE#${slot}` }]),
        ];
        for (const [TableName, Key] of toRemove) await db.send(new DeleteCommand({ TableName, Key }));
      } finally { db.destroy(); }
      await fixture.cleanup();
      console.log('P02-1 synthetic Android fixture removed.');
    } catch {
      code = 1;
      console.error('WARNING: synthetic local profile fixture cleanup incomplete. Inspect local test data.');
    }
  }
}
process.exitCode = code;
