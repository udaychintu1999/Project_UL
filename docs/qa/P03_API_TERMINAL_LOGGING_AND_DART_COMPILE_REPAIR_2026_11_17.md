# P03 API terminal diagnostics and Flutter compiler repair — verification evidence

**Source baseline:** Project_UL-master(2).zip (P02-5) overlaid in chronological order with OneBucket CDN, GPS, Location Recovery and Auto District Load update-only ZIPs. The owner's exact latest local Git tree was not supplied. The patch is **not owner accepted** until re-tested.

## Actual failures observed in owner logs

- `india_location.dart` undefined `_DistrictLoadFailure` constructor/type test — confirmed source bug, Flutter/Gradle build blocker.
- `flutter analyze` and `flutter test` cannot pass with undefined Dart type. Earlier source-only contract tests incorrectly reported green.
- API request terminal lacked actionable route/path/status/error-stage/CDN context, especially when `readGeoDeliveryConfig` or pinned manifest loading failed.

## Repairs

- Define `class _DistrictLoadFailure implements Exception` with immutable message, remove unused `_fileMatches` method.
- Replace widget-test `pumpAndSettle` around dropdown animations with bounded `pump`, retaining real automatic district-loading assertions.
- Add global request route-template, status, request ID, duration and safe non-sensitive error-code API terminal logs.
- Add GeoNames-specific structured diagnostics for config, full public CDN asset URL, origin HTTP status, fingerprint-prefix comparison, shard integrity, authenticated fallback, account saved-location read and GPS/manual save failure category.
- Relay only enumerated phone CDN failure code to the authenticated fallback API; do not send tokens to the CDN.
- Preserve verified pack byte limits, immutable manifests, SHA pinning, and private data handling.

## Executed in authoring container

- `node --experimental-strip-types --test apps/api/tests/geo/p03-api-diagnostics.test.ts apps/api/tests/unit/p03-district-fallback.test.ts`: **PASS** (7 tests)
- `node --test scripts/verify/p03-api-diagnostics-contracts.test.mjs`: **PASS** (4 tests)
- `npm run test:p03:district-autoload:contracts`: **PASS** (4 tests; updated source contract permits audited transport argument)
- `npm run test:p03:location-repair:contracts`: **PASS** (4 tests)
- `npm run test:p03:cloud-contracts`: **PASS** (4 tests)
- `npm run verify:p02-5:portable`: **PASS** (full inherited portable gate completed)
- `npm run test:secrets`: **PASS** (safe offline secret-pattern scan)
- `npm run test:cloud-guards`: **PASS** (offline operation safety)
- Global installed TypeScript `transpileModule` syntax pass for all changed API source and new test TS: **PASS**, *not a typecheck*

## Unverified

- `npm run typecheck` with actual project dependency installation, `flutter analyze`, Flutter widget tests, live Fastify + Java DynamoDB Local, physical moto g04s, and actual CloudFront requests: **UNVERIFIED**. Runtime dependency installation timed out in the authoring container. No live AWS network operation was performed. Never represent static contracts or transpile-only checks as full Flutter compilation success.

## Operator action

Apply the update-only ZIP on latest P03, run `npm run verify:p03:api-diagnostics:portable`, `npm run typecheck`, then `flutter analyze` before running Flutter tests/device. Read `docs/manual/P03_API_TERMINAL_LOGGING_AND_DART_COMPILE_REPAIR_2026_11_17.md` for API terminal logs and owner acceptance.
