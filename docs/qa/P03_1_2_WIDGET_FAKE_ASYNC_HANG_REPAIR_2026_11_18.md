# P03-1 / P03-2 — Flutter widget FakeAsync hang repair (2026-11-18)

## Owner observation

`npm run test:flutter` completed Flutter analysis (`No issues found!`) and approximately 77 earlier widget tests, then appeared to remain at `selecting district automatically loads a verified real S3 pack via API fallback`. The displayed label is a Flutter **test name**, not a real CloudFront request. This widget test mocks API fallback and reads a packaged, verified local fixture. No production AWS calls or user account are involved.

## Root-cause hypothesis supported by source audit

`p03_district_auto_load_test.dart` awaited `Directory.systemTemp.createTemp()` and `File.readAsBytes()` directly in `testWidgets` before the first frame. `testWidgets` runs in Flutter's FakeAsync environment; real asynchronous filesystem operations can stall without a real-async bridge. The test also awaited asynchronous temp deletion in `finally`. Two other geo widget tests repeated the same pattern. This is a strongly supported explanation for the apparent stall, but **not confirmed by an instrumented live Windows test**. The application was not changed.

## Scope of repair

* `p03_district_auto_load_test.dart`: synchronous creation and fixture read, synchronous cleanup, 75s per-test timeout. The actual widget still exercises its async cache download, SHA/size/provenance checks, background JSON parse, atomic activation, and selectable UI via real pump loops.
* `p03_geo_settings_visibility_test.dart`: same safe setup/teardown for both saved-summary and manual-save widget journeys; 75s timeouts.
* `p03_location_recovery_test.dart`: synchronous temporary cache setup/cleanup and 75s timeout.
* `p03-acceptance-plan.test.mjs`: permanent contract detecting regressions to raw awaited dart:io calls at the beginning/end of the three widget tests and detecting unbounded pumpAndSettle.

No Fastify, DynamoDB, GeoNames public object, app UI, production Flutter code, authentication, or P01/P02 document is changed.

## Owner verification, project root

If the existing test command remains frozen, press Ctrl+C. It does not remove the production application or persistent DB records. Apply the patch and run:

```powershell
cd apps/flutter_app
flutter test test/p03_district_auto_load_test.dart --reporter expanded --concurrency=1
flutter test test/p03_geo_settings_visibility_test.dart test/p03_location_recovery_test.dart --reporter expanded --concurrency=1
cd ../..
npm run test:flutter
# Once widget tests are green, with the local API/DB and phone available:
npm run verify:p03:acceptance
```

If the first standalone Flutter test still stalls or times out, capture the full `--reporter expanded` log and avoid force-fixing app runtime behavior without evidence. An explicit 75s timeout should now fail that test instead of leaving the suite indefinitely blocked. The owner must run Flutter/Android checks; they cannot be claimed green from this authoring environment.
