# P03 — Owner acceptance for saved-location UI, API logs and CDN contracts

Apply the update-only ZIP **on top of** `Uluv_P03_API_Terminal_Diagnostics_Dart_Compile_Fix.zip` (or the corresponding equivalent integrated files) in your current project root. Back up/compare if your local files contain newer uncommitted changes. These are **not** independent standalone packages.

## 1. Build gates — MUST pass on Windows

From `C:\Dump\Projects\Project-ULuv-Space` (PowerShell):

```powershell
npm run verify:p03:geo-visibility:portable
npm run typecheck
npm run test:p03:gps:api
cd apps/flutter_app
flutter pub get
flutter analyze
flutter test test/p03_geo_settings_visibility_test.dart
flutter test test/p03_location_recovery_test.dart
flutter test test/p03_district_auto_load_test.dart
flutter test test/p03_gps_one_shot_test.dart
cd ../..
npm run verify:p03:geo-visibility
```

The Windows path issue in `scripts/verify/p03-geo-cloud-source-contracts.test.mjs` should no longer print `C:\C:\...`. **Do not treat static contract passes as proof of Flutter compilation**.

## 2. Local terminals

Terminal A (`API`):

```powershell
npm run dev:api
```

Terminal B (`moto g04s`):

```powershell
npm run dev:flutter
```

In local mode the API now prints readable `[API] ...` and `[GEO] ...` lines instead of unformatted Pino JSON. `pino-pretty` is already listed in the root package's development dependencies; run `npm install` if it is unavailable. The deployment environment still emits structured JSON for production log collectors. Do not share raw `.env` files, access tokens or user identifiers.

## 3. Manual selection UI and persistence

1. Open authenticated Settings. **Before tapping any location controls**, confirm the `Location & discovery preferences` tile subtitle says `Saved location: ...`, `No saved location yet`, or a clear account-read failure. It should not start a persistent indeterminate loader.
2. Expand the tile. State/District are available from the verified bundled manifest. Pick Andaman and Nicobar Islands → Nicobar. District should auto-load (cached, direct CDN or verified API fallback). No separate download button.
3. Tap any village/town entry. The **long scrollable result list disappears**, leaving **Selected: <place>**, `Change`, and `Save selected location`.
4. Tap `Save selected location`. Verify API logs show `account.location.save.committed` and `PUT /v1/me/geo/manual → 200`. The entire Settings tile must collapse, showing `Saved location: <full server label>` in the tile subtitle.
5. Kill/reopen the Android app, authenticate/restore session, visit Settings. Without expanding the tile, confirm the same saved label appears. API logs must show `GET /v1/me/geo/location → 200`, `account.location.read found:true`.
6. Expand/reopen again: no indefinitely animated initial loader, and the saved label remains visible even if the public catalogue is temporarily inaccessible. A read failure can show a Retry action but cannot convert a previously confirmed save into `No saved location yet` within the same session.
7. Change selection and save again after the 15-second cooldown. Confirm it replaces the old label, does not enable discovery, and still closes the expanded tile.
8. Test one-time GPS save separately: tap `Use GPS and save location`, grant permission if prompted, and verify the summary updates to `Approximate location in India`; exact GPS coordinates should not be persisted or logged.

## 4. Debugging matrix

| Symptom | Fastify/API evidence | Likely investigation |
|---|---|---|
| `PUT /v1/me/geo/manual` `200` + committed, but no label | No `GET /v1/me/geo/location` on reopening | Flutter Settings summary/get not mounted or not executed |
| `GET` 200, `found:true` yet blank label | API returns good location, client shows no label | Widget state update/rendering; check the Flutter test |
| `GET` 200, `found:false` after a reported save | Check the original PUT transaction and session/auth identity | Backend persistence issue, possibly different account |
| `GET` 409 | `settings_not_initialized` | Account settings record missing; auth/setup issue |
| `GET` 503 | `account_location_read` stage failure | DynamoDB Local/backend availability |
| Direct phone CDN fails but fallback succeeds | `client.cdn_fallback` + `asset.cdn.response 200` | Phone's direct CDN networking; no data corruption |
| CDN 403 | `asset.cdn.response 403` | CloudFront origin OAC or S3 object access policy |
| `canonical_manifest_sha_mismatch` | `manifest.pinned_sha.failed` | `.env` SHA wrong or published manifest differs from release |
| P03 cloud tests `C:\C:\...` | none | Incorrect old path conversion; apply patched test file |
| App shows persistent spinner before opening | none | Must verify new lazy `_everOpened` mount and removed initial progress |

The 15-second cooldown and `expectedRevision` are server-side safety contracts. HTTP 409/429 should show actionable error text, **not** a false success. Do not weaken the canonical SHA pin or delete cached, previously verified packs to mask server failures.

## 5. Deployment notes and rollback

- The full geo reference database stays in the existing S3 bucket/CloudFront. No S3 re-upload is required for this UI/logging repair.
- Fastify GPS boundary is shipped locally as a 1.3 MB asset and must be included in production deployment, but it is unchanged in this repair.
- This ZIP only contains changed files against the last delivered P03 API terminal diagnostics update. Keep other P03 source files and data exactly as they are.
- If `APP_ENV=local`, API logs use `pino-pretty`; install dev dependencies for local development. Production uses JSON logging. No secret logging was added.

**Owner sign-off is required:** Do not mark the Android/Flutter persistent-save bug fixed merely because Node contract tests pass. Record Flutter analyzer/test output plus physical moto g04s results after applying the ZIP.
