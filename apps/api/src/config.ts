import 'dotenv/config';
import {assertLocalDynamoEndpoint, assertLocalMediaDriver} from './local-safety.js';

export type AppConfig = { env: string; host: string; port: number; region: string; dynamodbEndpoint: string; devToken?: string; mediaDriver: 'local' };

export function readConfig(): AppConfig {
  const env = process.env.APP_ENV ?? 'local';
  // P00 starter is deliberately NOT a production runtime. Owner-authorized P17 will add real AWS configuration explicitly.
  if (!['local', 'test'].includes(env)) throw new Error('P00 starter only supports local/test; real AWS DynamoDB mode is a separately approved P17 deliverable.');
  const port = Number(process.env.APP_PORT ?? 3000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('APP_PORT must be a valid TCP port');
  const devToken = process.env.ULUV_DEV_TOKEN;
  if (env === 'local' && (!devToken || devToken.startsWith('REPLACE_') || devToken.length < 24)) {
    throw new Error('Owner must privately configure ULUV_DEV_TOKEN in apps/api/.env; never paste the token into AI Chat.');
  }
  const host = process.env.APP_HOST ?? '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('P00 API must bind to loopback only; use an Android emulator or adb reverse for local devices.');
  }
  const dynamodbEndpoint = assertLocalDynamoEndpoint(process.env.DYNAMODB_ENDPOINT);
  const mediaDriver = assertLocalMediaDriver(process.env.MEDIA_STORAGE_DRIVER);
  return {env, host, port, region:'ap-south-1', dynamodbEndpoint, devToken, mediaDriver};
}
