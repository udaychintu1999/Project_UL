# U_luv P03 — District Auto-Load + Verified API Fallback — Windows/Android Acceptance

## What this update changes

- Selecting **State → District** immediately loads the selected district automatically. The separate **Download / load selected district** button is removed. Retry appears only on error, Cancel only during loading.
- Flutter checks the existing on-device cache first. It then tries the public CloudFront URL; if that path fails, it calls the authenticated **Fastify `/v1/geo/india/packs/:state/:district`** fallback.
- Fastify independently verifies fallback bytes against the canonical, SHA-256-pinned manifest. The app re-verifies bytes and full JSON schema before atomic cache activation. No unchecked data is ever accepted.
- Failure feedback distinguishes HTTP failures, networking/storage errors and JSON integrity faults. The old generic `Could not load district. Saved cached data was not replaced.` message is removed.
- Older verified offline packs remain searchable **but cannot be saved as current release selections**. Current verified packs support manual saving through the authoritative Fastify API.
- Settings recovery widget test no longer relies on `pumpAndSettle` while an indeterminate loading indicator may be running. Six `prefer_const_constructors` warnings in the PageStorage regression fixture were addressed.
- GPS API test now verifies persisted coordinates are the **H3 R6 cell centre** and no fix metadata is persisted; fragile substring matching of decimal coordinates is removed. GPS product flow is unchanged.
- No updates to S3 objects, the private India boundary, DynamoDB tables, user records, PIN flows, or credentials are required.

## Installation

1. Back up your current project and compare these changed files with your current P03 local implementation; these changes were prepared from the earlier conversation's P02-5 + OneBucket + GPS + Location Repair overlay, **not** from a newly supplied latest local checkout.
2. Extract the ZIP **at repository root** retaining `apps/...`, `scripts/...`, `docs/...` and `package.json` paths.
3. Make sure the previously uploaded **1,058 GeoNames JSON objects** still exist in your one S3 bucket and are readable through CloudFront. This ZIP does **not** include them and does **not** change your existing S3 setup.
4. Open your private `apps/api/.env` locally and ensure both variables are **uncommented**, populated, and consistent with the existing release:

   ```dotenv
   ULUV_GEO_PUBLIC_BASE_URL=https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/
   ULUV_GEO_CANONICAL_MANIFEST_SHA256=8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
   ```

   Do not place `.env` or secrets in any ZIP. Restart Fastify after changes.

5. Using your existing CloudFront distribution domain in a browser, open:
   - `/geo/india/v1/manifest.json`
   - `/geo/india/v1/server-index-manifest.json`
   - `/geo/india/v1/states/01/districts/638.json`

   Each must be an HTTP 200 JSON response, **not** an HTML error page. When CloudFront fails here, correct the S3 object paths, OAC permissions or CloudFront distribution via the **AWS Console**, not by changing checksum logic.

## Commands — Windows PowerShell at repository root

```powershell
npm run test:p03:district-autoload:contracts
node --experimental-strip-types --test apps/api/tests/unit/p03-district-fallback.test.ts
npm run test:p03:location-repair:contracts
npm run test:p03:gps:unit
npm run test:p03:gps:api
npm run typecheck
npm run verify:p02-5:portable

Push-Location apps/flutter_app
flutter pub get
flutter analyze
flutter test test/p03_location_recovery_test.dart
flutter test test/p03_district_auto_load_test.dart
flutter test test/p03_gps_page_storage_regression_test.dart
flutter test test/p03_gps_one_shot_test.dart
Pop-Location
```

A failed command is a failed acceptance gate. Do not mark P03 as accepted until all supported checks pass.

## moto g04s acceptance

1. Start **DynamoDB Local manually** according to the established P00 runbook, run Fastify with your existing development setup, and confirm the phone can connect to the API using the project's established transport/ADB forwarding.
2. Perform a **full Flutter Android rebuild** (not hot reload only). Open Settings → Location & discovery preferences.
3. Choose `Andaman and Nicobar Islands` → `Nicobar`. The spinner should appear automatically, then the search field and 58 places. **There must be no separate download/load button.**
4. Repeat with a different state/district. Verify busy, cancel, retry-only-on-failure, search, and cache reuse. Relaunch the app and confirm a cached district loads without a new download.
5. Select a village/town and **Save selected location**. Fully terminate and reopen the app. Confirm **Saved location: [name]** is still shown from the account.
6. Test one-tap GPS, including the standard 15-second cooldown, permissions and retained saved account location after app restart. PIN remains disabled.
7. Deliberately make CloudFront unreachable **only after the backend catalogue is already loaded** to test the API fallback. Re-verify normal operation afterward. Backend must still be able to read/verify the canonical data. If both backend and CDN are unavailable, the app must display an actionable error, not fabricate a successful download.
8. Confirm the old Flutter widget exception (`type bool is not a subtype of double?`) and `pumpAndSettle timed out` are absent when the revised tests run. Monitor frame jank in profile mode if scrolling still stalls.

## If a district still fails

- **HTTP 403/404**: Check exact S3 object paths and CloudFront OAC/behaviour using the AWS Console. An uploaded ZIP object is not a substitute for extracted JSON objects.
- **HTTP 503** from `/v1/geo/india/packs/...`: Fastify cannot load the pinned canonical release or access an object. Check the two `ULUV_GEO_*` settings and the three CloudFront browser URLs above; restart Fastify.
- **Checksum mismatch**: CloudFront is returning a different dataset version or a modified JSON byte sequence. Do not disable SHA validation. Re-upload the verified release into the correct prefix via S3 Console and invalidate stale objects only if necessary.
- **Network timeout**: Make sure the Android device and local Fastify API are reachable. Test the authenticated fallback; don't open API routes to unauthenticated users.
- **Cache/storage error**: Check app storage permissions/free space and retry. Existing verified cache files are never deleted on a failed replacement.

## Release qualification

Pure-source, payload-integrity and portable P02-5 tests can run in a headless environment. Full Fastify integration, TypeScript dependency-based compilation, Flutter SDK/Android tests and live CloudFront/AWS validation **cannot be claimed** unless actually executed on the owner's machine. The previous ZIP can differ from your latest local source; preserve any newer P03-1 changes during merge.
