import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=path=>readFileSync(path,'utf8');
const dart=text('apps/flutter_app/lib/features/geo/india_location.dart');
const api=text('apps/api/src/features/geo/routes.ts');
const app=text('apps/api/src/app.ts');
const fetcher=text('apps/api/src/features/geo/catalogue-delivery.ts');
const canonical=text('apps/api/src/features/geo/india-catalogue.ts');

test('Flutter district failure class exists with matching constructor and type guard; no dead analyzer declaration',()=>{
  assert.match(dart,/class _DistrictLoadFailure implements Exception\s*\{/);
  assert.match(dart,/const _DistrictLoadFailure\(this\.message\)/);
  assert.match(dart,/throw _DistrictLoadFailure\(/);
  assert.match(dart,/e is _DistrictLoadFailure/);
  assert.doesNotMatch(dart,/Future<bool> _fileMatches\(/);
});

test('Flutter sends enumerated CDN failure only to authenticated Fastify fallback',()=>{
  assert.match(dart,/authenticated && cdnFailureCode!=null/);
  assert.match(dart,/X-ULUV-Geo-CDN-Failure/);
  assert.match(dart,/cdnFailureCode:cdnFailureCode/);
  assert.match(dart,/request\.headers\.set\(HttpHeaders\.authorizationHeader, 'Bearer \$token'\)/);
  assert.match(dart,/authenticated:descriptor\.requiresAuthorization/);
});

test('all APIs log safe route templates/status while geolocation shows audited CDN lifecycle',()=>{
  assert.match(app,/apiEvent:'request.completed'/);
  assert.match(app,/route:request\.routeOptions\.url/);
  assert.doesNotMatch(app,/route:request\.url|url:request\.url/);
  assert.match(app,/app\.addHook\('onResponse'/);
  assert.match(app,/apiEvent:'request\.completed'/);
  assert.match(api,/account\.location\.read/);
  assert.match(api,/account\.location\.save\.committed/);
  assert.match(api,/X-ULUV-Geo-Request-Id/);
  assert.match(api,/client\.cdn_fallback/);
  assert.match(api,/readVerifiedGeoPack\(config,path,meta,fetch,audit\(request\)\)/);
  assert.match(fetcher,/asset\.cdn\.response/);
  assert.match(fetcher,/asset\.integrity\.failed/);
  assert.match(canonical,/manifest\.pinned_sha\.failed/);
  assert.match(canonical,/manifest\.ready/);
});

test('diagnostics never log raw requests, GPS fixes, bearer tokens or arbitrary network errors',()=>{
  assert.doesNotMatch(api,/request\.log\.(?:info|warn|error)\([^\n]*(?:fix\.lat|fix\.lng|request\.body|authorization)/);
  assert.doesNotMatch(fetcher,/audit\?\.\([^\n]*error\.message/);
  assert.match(fetcher,/throw new GeoAssetError\(reason\)/);
  assert.match(fetcher,/cdn_network_or_tls_error/);
  assert.match(api,/phoneFailure.*test\(phoneFailure\)/);
});
