/** P03-1 / P03-2 acceptance plan. No network, services or secrets on import. */
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

export const P03_PORTABLE_STAGES=Object.freeze([
  ['Inherited P02-5 security and frozen UI regressions','verify:p02-5:portable'],
  ['P03 five-tab navigation, Settings and saved-location contracts','test:p03:navigation-docs'],
  ['P03-1 pinned GeoNames manifest/shard and validation tests','test:p03:cloud-config'],
  ['P03-1 audited CDN/fallback execution','test:p03:api-diagnostics'],
  ['P03-1 India GPS boundary and fix validation','test:p03:gps:unit'],
  ['P03-1 one-tap Flutter GPS contracts','test:p03:gps:contracts'],
  ['P03-1 district autoload and offline recovery contracts','test:p03:district-autoload:contracts'],
  ['P03-1 location save and persistence contracts','test:p03:location-repair:contracts'],
  ['P03-1 Settings UI visibility and retry contracts','test:p03:geo-visibility:contracts'],
  ['P03-1 S3/CloudFront single-bucket privacy contracts','test:p03:cloud-contracts'],
  ['P03-1 strict catalogue/config/cache/GPS tests','test:p03-1:acceptance:contracts'],
  ['P03-1 real Fastify injected API/GPS/catalogue tests','test:p03-1:acceptance:api'],
  ['P03-2 real H3, encrypted cursor, query/coverage and failure-path tests','test:p03-2:acceptance:unit'],
  ['P03-2 pointer/privacy and isolation contracts','test:p03-2:contracts'],
  ['P03 acceptance orchestrator self-tests','test:p03:acceptance:plan'],
]);
export const P03_LOCAL_STAGES=Object.freeze([
  // Reject broken test code BEFORE repeating the long P01/P02/P03 portable suite.
  ['Strict TypeScript compilation of new P03 test suites','test:p03:acceptance:types'],
  // Catch Dart syntax, analyzer and plugin API breakage before expensive P02/P03 regressions.
  ['Flutter analyzer (no ignored warnings)','test:p03:acceptance:flutter-analyze'],
  ['Full backend TypeScript typecheck','typecheck'],
  ['Backend and script lint','lint'],
  ['All offline and inherited P02/P03 regressions','verify:p03:acceptance:portable'],
  ['Real running Fastify HTTP readiness and local DB roundtrips','test:integration'],
  ['Real unauthenticated geo API and session-gated P03-4 discovery HTTP checks','test:p03-1:acceptance:live-api'],
  ['P03-1 isolated real DynamoDB Local roundtrip and conflict/security suite','test:p03-1:acceptance:db'],
  ['P03-2 synthetic DynamoDB Local multi-page read/cleanup','test:p03-2:integration'],
  ['All Flutter widget regressions, including P01/P02','test:flutter'],
  ['Isolated P03 physical Android UI integration','test:flutter:p03:e2e'],
]);

/** Similar to the accepted P02 verifier: fail before any test/credential use. */
export function assertP03LocalEnvironment(env){
  if(env.APP_ENV!=='local')throw new Error('local_environment_required');
  const db=assertLocalHttpEndpoint(env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
  const api=assertLocalHttpEndpoint(env.ULUV_API_BASE_URL??'http://127.0.0.1:3000','ULUV_API_BASE_URL');
  const apiUrl=new URL(api),dbUrl=new URL(db);
  if(apiUrl.port!=='3000'||dbUrl.port!=='8000')throw new Error('local_port_mismatch');
  if(typeof env.ULUV_DEV_TOKEN!=='string'||env.ULUV_DEV_TOKEN.length<24)
    throw new Error('local_test_token_required');
  return true;
}
export function executeP03Stages(stages,run,report=()=>{}){
  for(let i=0;i<stages.length;i++){
    const [title,script]=stages[i];
    report(`P03 GATE ${i+1}/${stages.length}: ${title} (npm run ${script})`);
    let result;
    try{result=run(script);}catch{report(`P03 FAIL gate ${i+1}: ${script}; halted.`);return false;}
    if(result?.error||result?.signal||result?.status!==0){
      report(`P03 FAIL gate ${i+1}: ${script}; subsequent gates NOT RUN.`);return false;
    }
    report(`P03 PASS gate ${i+1}/${stages.length}: ${script}`);
  }
  return true;
}
