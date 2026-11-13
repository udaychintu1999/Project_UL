import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync('apps/api/src/app.ts','utf8');
assert.match(api,/\/health\/ready/);
assert.match(api,/GetCommand/);assert.match(api,/PutCommand/);assert.match(api,/QueryCommand/);assert.match(api,/DeleteCommand/);
assert.match(api,/config\.env==='local'/);
assert.doesNotMatch(api,/ScanCommand|\.scan\(/);
assert.match(api,/error instanceof Error/); // reject direct property access on unknown error payloads
const prod=readFileSync('apps/api/src/config.ts','utf8');assert.match(prod,/assertLocalDynamoEndpoint/);assert.match(prod,/assertLocalMediaDriver/);assert.match(prod,/P00 starter only supports local\/test/);assert.match(prod,/P00 API must bind to loopback only/);
const flutter=readFileSync('apps/flutter_app/lib/main.dart','utf8');assert.match(flutter,/Check server/);assert.match(flutter,/Test database/);assert.match(flutter,/ULUV_API_BASE_URL/);
const service=readFileSync('apps/flutter_app/lib/diagnostics_service.dart','utf8');
assert.match(service,/parseDiagnosticsResponse/);
assert.match(service,/operations\['delete'\] == true/);
assert.match(service,/result\['service'\] == 'uluv-api'/);
assert.match(service,/devToken.length < 24/);
const integrated=readFileSync('apps/flutter_app/integration_test/diagnostics_integration_test.dart','utf8');
assert.match(integrated,/Database Put\/Get\/Query\/Delete succeeded/);
console.log('PASSED: P00 API route declarations, explicit DynamoDB calls, guarded local route, Flutter source contract');
