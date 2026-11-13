import assert from 'node:assert/strict';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

// Validate URL BEFORE retrieving or transmitting a development token.
const url = assertLocalHttpEndpoint(process.env.ULUV_API_BASE_URL ?? 'http://127.0.0.1:3000', 'ULUV_API_BASE_URL');
const token = process.env.ULUV_DEV_TOKEN;
if (!token || token.length < 24) {
  console.error('UNVERIFIED: Configure ULUV_DEV_TOKEN privately for the local API roundtrip');
  process.exit(2);
}
// Require the operator to start Fastify in a separate, persistent terminal.
// A local socket error is a BLOCKED integration gate, not a DynamoDB failure.
async function request(path, options) {
  try {
    return await fetch(url + path, options);
  } catch (error) {
    const code = error instanceof Error && 'cause' in error &&
      error.cause && typeof error.cause === 'object' && 'code' in error.cause
      ? String(error.cause.code) : 'network error';
    console.error(`P00 integration BLOCKED: cannot reach running Fastify (${code}).`);
    console.error('Keep `npm run dev:api` running in another project-root terminal, verify /health/live on 127.0.0.1:3000, then rerun `npm run test:integration`.');
    process.exit(2);
  }
}
const get = async path => request(path, {signal: AbortSignal.timeout(8000)});
const post = async (headers = {}) => request('/v1/dev/db-roundtrip', {
  method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(10000),
});
const live = await get('/health/live');
assert.equal(live.status, 200);
assert.deepEqual(await live.json(), {status: 'ok', service: 'uluv-api'});
const ready = await get('/health/ready');
assert.equal(ready.status, 200, 'Readiness must read real DynamoDB Local sentinel');
const readyBody = await ready.json();
assert.equal(readyBody.status, 'ok');
assert.equal(readyBody.database, 'connected');
assert.equal(readyBody.service, 'uluv-api');
for (const headers of [{}, {'x-uluv-dev-key': 'invalid-local-test-token'}]) {
  const forbidden = await post(headers);
  assert.equal(forbidden.status, 403, 'No roundtrip without correct development token');
  assert.equal((await forbidden.json()).error, 'forbidden');
}
const runRoundtrip = async () => {
  const response = await post({'x-uluv-dev-key': token});
  assert.equal(response.status, 200, 'Local DynamoDB Put/Get/Query/Delete must succeed');
  const result = await response.json();
  assert.equal(result.status, 'ok');
  assert.equal(result.database, 'connected');
  assert.deepEqual(result.roundtrip, {put: true, get: true, query: true, delete: true});
};
await runRoundtrip();
await Promise.all(Array.from({length: 4}, runRoundtrip));
console.log('PASS: live/DB readiness, missing/wrong token rejected, 5 real sequential/concurrent Put/Get/Query/Delete roundtrips');
