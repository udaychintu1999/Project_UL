import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const file=(p)=>readFileSync(join(root,p),'utf8');

test('ONE S3 bucket is the entire canonical source: no GeoNames JSON or AWS SDK stored in repository',()=>{
  assert.equal(existsSync(join(root,'geo/india/v1/manifest.json')),false);
  const delivery=file('apps/api/src/features/geo/catalogue-delivery.ts');
  const index=file('apps/api/src/features/geo/india-catalogue.ts');
  assert.match(delivery,/ULUV_GEO_PUBLIC_BASE_URL/);
  assert.match(delivery,/ULUV_GEO_CANONICAL_MANIFEST_SHA256/);
  assert.doesNotMatch(delivery,/ULUV_GEO_PRIVATE_DIR/);
  assert.match(index,/server-index-manifest\.json/);
  assert.match(index,/canonicalManifestSha256/);
  assert.match(index,/Untrusted GeoNames canonical manifest/);
  assert.match(index,/SHA-256 integrity failure/);
  assert.match(index,/readGeoAsset/);
  for(const src of [delivery,index,file('apps/api/src/features/geo/routes.ts')]){
    assert.doesNotMatch(src,/@aws-sdk\/client-s3|S3Client|CloudFrontClient|CreateInvalidationCommand/);
  }
});
test('Fastify returns authenticated pinned public manifest but never public H3 values',()=>{
  const api=file('apps/api/src/features/geo/routes.ts');
  assert.match(api,/c\.publicManifestSha256/);
  assert.match(api,/config\.publicBaseUrl/);
  assert.match(api,/readGeoDeliveryConfig/);
  assert.match(api,/geo_local_delivery_disabled/);
  assert.match(api,/Cache-Control/);
  assert.match(api,/latLngToCell\(point\.lat,point\.lng,6\)/);
  assert.match(api,/gps_india_boundary_not_configured/);
});
test('Flutter downloads only selected public packs without sending JWT to CloudFront',()=>{
  const picker=file('apps/flutter_app/lib/features/geo/india_location.dart');
  const config=file('apps/flutter_app/lib/features/geo/geo_catalogue_delivery.dart');
  const cache=file('apps/flutter_app/lib/features/geo/geo_pack_cache.dart');
  assert.match(picker,/authenticated:descriptor\.requiresAuthorization/);
  assert.match(picker,/descriptor\.manifestSha256/);
  assert.match(picker,/atomicActivateGeoPack/);
  assert.match(cache,/sha256\.convert/);
  assert.match(config,/provider=='s3_cloudfront'/);
  assert.doesNotMatch(picker,/\.cloudfront\.net/);
  assert.doesNotMatch(picker,/server\/00\.json/);
});
test('P03 settings and PIN code remain distinct from P02-5 frozen baseline',()=>{
  const auth=file('apps/api/src/features/auth/routes.ts');
  const pincode=file('apps/api/src/features/pincode/routes.ts');
  const flutter=file('apps/flutter_app/lib/features/auth/persistent_gate.dart');
  assert.match(auth,/registerIndiaGeoRoutes\(app, db, requireSession\)/);
  assert.match(pincode,/requiresManualPlaceConfirmation:true/);
  assert.match(flutter,/settingsBuilder: \(onSaved, completed, refreshEpoch\) => DeviceManagementPanel\(/);
  assert.match(flutter,/controller: sessions, profileComplete: completed/);
  assert.match(flutter,/UluvGeoSettingsPanel/);
  assert.doesNotMatch(file('apps/flutter_app/android/app/src/main/AndroidManifest.xml'),/ACCESS_BACKGROUND_LOCATION/);
});
