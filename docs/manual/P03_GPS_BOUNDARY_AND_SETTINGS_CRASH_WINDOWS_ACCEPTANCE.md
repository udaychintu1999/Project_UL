# U_luv — P03 GPS completion + Settings PageStorage crash repair

**Target:** Apply as an update to the previously delivered `Uluv_P03_OneBucket_CDN_Full_Geo_Code_Update.zip`, NOT to an untouched P02-5 baseline. Compare working local P03-1/Gate-5 code first and preserve any owner-added edits. This is an update-only patch, not a full repository.

## Architecture

- `apps/api/assets/geo/india-boundary.geojson`: **1,362,454-byte** merged India boundary, bundled in the **Fastify application filesystem** (no S3, no CloudFront, no user coordinates).
- `apps/api/src/features/geo/india-boundary.ts`: exact SHA-256 check of bundled bytes, validate geographic format, construct polygon containment lookup **once per API process** during startup, and reuse it. A missing/altered file blocks GPS without blocking manual GeoNames.
- `POST /v1/me/geo/gps`: authenticated; accepts only finite WGS84 `lat`, `lng`, `accuracyMeters` (positive and <= 10,000 m), ISO UTC `fixTimestamp` (past 120 s to future 30 s skew), and integer `expectedRevision`. Reject out-of-region fixes using **actual polygon containment**, not a bounding box. Transactionally enforce account active + self-declared adult + revision/cooldown. Save only H3 R6 center/cell and selection metadata, removing any previous GeoNames ID association. Never log/store exact GPS coordinates.
- `GET /v1/me/geo/location`: owner-safe selected-source label and `gpsAvailable`; never returns precise fix or H3 cell. `gpsAvailable` false if boundary cannot validate.
- Flutter `OneTimeGpsPanel`: only requesting permission on **Use current GPS location**; no location stream, no startup permission, no background tracking. A separate **Confirm approximate location** action sends the fix; discard leaves settings unchanged.
- State/district/Village search and CDN flow **unchanged**. PIN-code lookup is **on hold**, deliberately not mounted in Settings until a real postal directory is available. Its existing code and unit tests remain.
- The Flutter `_TypeError: type bool is not a subtype of type double?` reported at `p03-1c-pin-input` originates from competing `PageStorage` use: an `ExpansionTile` writes its expansion `bool` into an ancestor page-storage slot that a nested `TextField` ScrollPosition may read as its `double` offset. This patch gives the expansion widget, text-field scrollable scopes, and result lists **distinct PageStorageKey paths**. The PIN widget is also unmounted from active Settings.

## Original boundary / licence

- Dataset supplied by owner: `geoBoundaries-IND-ADM1_simplified.geojson`; merged by unioning 36 valid ADM1 geometries without further reducing exterior precision.
- SHA-256 of bundled optimized union file: `b1af3edb4f806a1b787ff61e366cfae15b14407bda4c131dbff914193f1a65f8`.
- See `apps/api/assets/geo/ATTRIBUTION.md` for source/licence and transformation notices. Simplified coastal and border boundaries can disagree with GPS reality. Treat location as **self-selected**, not verified residence.
- Bundling the GeoJSON in a future Fastify deployment is mandatory: ensure `apps/api/assets/geo/` is copied alongside `apps/api/dist/`. `tsc` compiles TS; it does **not** copy this asset. The app fails closed if missing.

## Apply / verify (PowerShell, Windows 10)

1. **Back up your local project.** Keep the working P03-1 Settings, Flutter Gate 5, and photo flows; compare changed files rather than overwriting newer work blindly.
2. Extract the patch into the project root, retaining project-relative paths. Do not copy the full S3 GeoNames dataset into Git.
3. In the project root:

```powershell
npm install
Push-Location apps/flutter_app
flutter --version
flutter pub get
flutter analyze
flutter test test/p03_gps_one_shot_test.dart
flutter test test/p03_gps_page_storage_regression_test.dart
flutter test test/p03_1c_pincode_lookup_test.dart
Pop-Location
npm run test:p03:gps:unit
npm run test:p03:gps:contracts
npm run test:p03:gps:api
npm run typecheck
npm run test:p03:cloud-config
npm run test:p03:cloud-contracts
npm run verify:p02-5:portable
npm run test:flutter
npm run test:secrets
npm run test:cloud-guards
```

4. Ensure `apps/api/assets/geo/india-boundary.geojson` exists. No new GPS `.env` variable is needed. The pre-existing GeoNames CDN environment configuration remains unchanged. No S3 operation or access keys are needed for GPS.
5. Start **DynamoDB Local manually** as usual; verify API tables and local API using existing P00/P03 runbook. **Do not connect these tests to real AWS DynamoDB.** Run the relevant P03 API integration runner after setting up test profiles.
6. For **moto g04s**, perform a **full rebuild/reinstall** (`flutter run` with the existing U_luv debug launcher); hot reload cannot add Android manifest permissions or native geolocator registration. Test on the phone:
   - Open Settings → **Location & discovery preferences** 5 times; verify no crash, red-screen assertion or `bool`/`double` error, and screen remains responsive.
   - Without tapping GPS, confirm no Android location permission prompt.
   - Tap **Use current GPS location**; grant precise, then approximate permission in separate test runs; verify no location is saved until **Confirm approximate location** is tapped.
   - Confirm save in India, reopen Settings, inspect the approximate location label. Make a second change after the 15-second cooldown. Confirm stale revision and cancelled selection do not falsely save.
   - Deny location permission, deny forever (app settings), turn device Location Services off, and test timeout/fix errors. Manual State → District → on-demand JSON search must continue working.
   - Test an outside-India coordinate using **controlled API test fixtures**, not a real spoofing app. Verify the API rejects it and does not update settings. Test coastal/island locations and report false rejects caused by the simplified polygon.
   - Verify no PIN search appears (on hold), and all P02 guided onboarding/photo/device-management buttons still work.
7. Check logs and response bodies for **no raw GPS** or `geoH3Cell` leaks; include the API privacy tests. The debug log `Skipped NN frames` alone isn't proof of a fault, but measure if it persists after the widget exception repair.

**If Android build fails:** geolocator 14.1.x expects Flutter >= 3.29 and Android compile SDK >= 35. Upgrade Flutter tooling on your development machine or reconcile the plugin version through a reviewed compatibility change; **never mark build PASS without compiling**. Avoid `ACCESS_BACKGROUND_LOCATION`.

## Status / failures

- Do not claim GPS fully accepted until actual `flutter analyze`, widget tests, real DynamoDB Local integration and moto g04s tests are run successfully.
- Do not change `docs/implementation/PROGRESS.md` to P03-complete. Discovery publication and PIN search remain out of scope.
- Existing S3 + CloudFront public GeoNames catalogue remains separate and unchanged. **Do not upload the optimized India boundary to S3**.
