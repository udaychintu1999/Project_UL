/**
 * P02-4: exhaustive local-development verification plan.
 * Static, allowlisted npm commands only. This file never starts an API/DB server,
 * reads secrets, accesses a cloud endpoint or modifies the owner's normal app.
 */
import { assertLocalHttpEndpoint } from '../lib/local-endpoints.mjs';

export const P02_4_STAGES = Object.freeze([
  ['Portable regression, security and source contracts', 'verify:p02-4:portable'],
  ['Semantic backend TypeScript compilation', 'typecheck'],
  ['Backend and script lint', 'lint'],
  ['Private local media-store tests', 'test:p02-2:store'],
  ['Flutter analyzer and widget tests', 'test:flutter'],
  ['Running local Fastify + DynamoDB Local readiness/roundtrip', 'test:integration'],
  ['P02-1 real local profile/account integration', 'test:p02-1:integration'],
  ['P02-2 real image media/owner integration', 'test:p02-2:integration'],
  ['P02-3 activation, privacy and fail-closed integration', 'test:p02-3:integration'],
  ['P02-1 isolated Android session/draft E2E', 'test:flutter:p02-1:e2e'],
  ['P02-2 isolated Android real API/media E2E', 'test:flutter:p02-2:e2e'],
  // Includes P02-1/P02-2 guided UI, photo gates and P02-3 activation.
  // Do not run a redundant identical P02-2 --ui suite.
  ['P02-3 isolated Android real guided UI + activation E2E', 'test:flutter:p02-3:e2e'],
]);

export function assertP02LocalEnvironment(env) {
  // Validate both origins BEFORE any test starts or receives local credentials.
  if (env.APP_ENV !== 'local') throw new Error('APP_ENV must equal local');
  assertLocalHttpEndpoint(env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000', 'DYNAMODB_ENDPOINT');
  const api = assertLocalHttpEndpoint(env.ULUV_API_BASE_URL ?? 'http://127.0.0.1:3000', 'ULUV_API_BASE_URL');
  if (new URL(api).port !== '3000') {
    // P02 integration fixtures are intentionally hardcoded to loopback:3000.
    throw new Error('P02 real integration requires the local API on port 3000');
  }
  if (typeof env.ULUV_DEV_TOKEN !== 'string' || env.ULUV_DEV_TOKEN.length < 24) {
    throw new Error('The owner-managed local development token is missing or too short');
  }
  return true;
}

/** Injected runner makes first-failure behavior testable without running the device. */
export function executeP02Stages(stages, run, report = () => {}) {
  for (let index = 0; index < stages.length; index++) {
    const [description, command] = stages[index];
    report(`P02-4 GATE ${index + 1}/${stages.length}: ${description} (npm run ${command})`);
    let result;
    try { result = run(command); }
    catch { report(`P02-4 FAILED at gate ${index + 1}: ${command} (runner exception)`); return false; }
    if (result?.error || result?.signal || result?.status !== 0) {
      report(`P02-4 FAILED at gate ${index + 1}: ${command}; later gates were not run.`);
      return false;
    }
    report(`P02-4 PASS gate ${index + 1}/${stages.length}: ${command}`);
  }
  return true;
}
