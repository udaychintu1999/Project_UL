/** Portable structural safety checks: actual image and DB behavior is verified by integration suite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text = path => readFileSync(path, 'utf8');
const routes = text('apps/api/src/features/profiles/media-routes.ts');
const store = text('apps/api/src/features/profiles/local-media-store.ts');
const flutter = text('apps/flutter_app/lib/features/profiles/profile_photos_panel.dart');
const kotlin = text('apps/flutter_app/android/app/src/main/kotlin/com/example/uluv/MainActivity.kt');
const native = text('scripts/verify/p02-2-android-e2e.mjs');
const runner = text('scripts/dev/flutter.mjs');
test('P02-2 media routes share existing session authentication and enforce owner-scoped keys', () => {
  assert.match(routes, /guard\(request, reply\)/);
  assert.match(routes, /mediaKey\(auth\.uid, mediaId\)/);
  assert.match(routes, /mediaKey\(auth\.uid, id\)/);
  assert.match(routes, /refCount = :zero/);
  assert.match(routes, /TransactWriteCommand/);
  assert.match(routes, /requestedActive = :inactive/);
  assert.match(routes, /media_in_use/);
});
test('P02-2 keeps media local and sanitizes decoded images without exposing disk paths', () => {
  assert.match(store, /limitInputPixels: MAX_MEDIA_PIXELS/);
  assert.match(store, /VALID_IMAGE_FORMATS/);
  assert.match(store, /\.jpeg\(/);
  assert.match(store, /new InvalidImageError\('invalid_image'\)/);
  assert.doesNotMatch(routes, /presign|cloudfront|S3Client/);
  assert.match(routes, /Cache-Control', 'private, no-store'/);
});
test('P02-2 Android picker uses SAF and no broad storage permissions', () => {
  assert.match(kotlin, /ACTION_OPEN_DOCUMENT/);
  assert.match(kotlin, /CATEGORY_OPENABLE/);
  assert.match(kotlin, /uluv\/p02_2_photo_picker/);
  assert.doesNotMatch(text('apps/flutter_app/android/app/src/main/AndroidManifest.xml'), /READ_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/);
  assert.match(flutter, /Upload and add photo/);
  assert.match(flutter, /refCount != 0/);
});
test('P02-2 physical device uses dedicated package and refuses Flutter base-app uninstall', () => {
  assert.match(native, /resetP02TestApp/);
  assert.match(native, /ULUV_P02_1_ISOLATED_ANDROID_TEST: '1'/);
  assert.match(runner, /p02-2-e2e/);
  assert.match(text('scripts/lib/flutter-integration-cleanup.mjs'), /p02-2-e2e/);
  assert.match(text('apps/flutter_app/integration_test/p02_2_media_integration_test.dart'), /com\.example\.uluv\.p02isolated/);
});
