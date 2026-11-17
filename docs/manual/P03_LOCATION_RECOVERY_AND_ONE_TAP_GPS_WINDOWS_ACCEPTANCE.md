# U_luv P03 — Manual picker recovery, saved location, one-tap GPS

**Applies after:** P03 one-S3-bucket GeoNames/CloudFront update + P03 GPS boundary update.
**Scope:** Flutter only plus lightweight contract tests. The existing Fastify GPS polygon and transactional DynamoDB save routes are unchanged. PIN search remains on hold.

## Changes

- Manual State/UT → District selections are shown using a **175,054-byte**, SHA-256-pinned, release-matched **manifest-only** Flutter asset (`assets/geo/india-manifest.json`). This asset has no village/town rows, private data or user GPS positions. Large packs and 256 lookup shards remain on S3/CloudFront.
- The widget fetches saved `/v1/me/geo/location` **separately from the GeoNames catalogue**. A CDN outage must not hide a successfully loaded saved account location. GPS/Manual save success updates the visible label immediately; reopening Settings fetches the label from DynamoDB again.
- **GPS is now one action:** tap **Use GPS and save location** → Android permission when needed → one current fix → server-side boundary validation → H3 R6 → authenticated transactional save → success status. No second Confirm button. GPS is not captured on Settings load and no location stream/background permission is added.
- Offline/manual fallback displays the State/District choices from the bundled index. **Village/town download and manual save require an operational catalogue delivery API and CloudFront**, unless a previously SHA-verified pack is already cached for offline *browsing*. The client never guesses a district/place from GPS or saves an unverified offline selection.
- **No S3 upload or DynamoDB migration** is required for this patch. The 1.3 MB vetted India GPS boundary remains in `apps/api/assets/geo/india-boundary.geojson` from the earlier patch.

## Apply on Windows

1. Back up the current repo and commit or stash any owner changes. Compare the ZIP with changed local P03-1/Gate-5 source first; do **not** overwrite more recent work blindly.
2. At your **project root** (the folder with `package.json`), extract the update-only ZIP, preserving every project-relative path. Example:

   ```powershell
   Expand-Archive -LiteralPath 'C:\Downloads\Uluv_P03_Location_Manual_Persistence_OneTap_GPS_Repair.zip' -DestinationPath 'C:\Dump\Projects\Project-ULuv-Space' -Force
   ```

3. Restart the API after confirming existing `apps/api/.env` contains **both**:

   ```dotenv
   ULUV_GEO_PUBLIC_BASE_URL=https://YOUR-CLOUDFRONT-DOMAIN.cloudfront.net/geo/india/v1/
   ULUV_GEO_CANONICAL_MANIFEST_SHA256=8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
   ```

   The hash above is the **server-index manifest** pin (not the 97d83d... public manifest SHA). Keep the private `.env` out of Git. Do not change your existing device/API host configuration. If you use USB `adb reverse`, keep the existing forwarding setup.

4. Verify these are publicly readable from the **existing** CloudFront domain using your browser (no AWS CLI needed):

   - `/geo/india/v1/manifest.json`
   - `/geo/india/v1/server-index-manifest.json`
   - `/geo/india/v1/server/00.json`

   Objects must return valid JSON. If they fail, check existing S3 object paths, CloudFront OAC, cache/error behavior and the backend environment. An invalid CDN origin or pinned digest **cannot be repaired by Flutter UI code**.

5. From PowerShell at the project root run:

   ```powershell
   npm run test:p03:location-repair:contracts
   npm run test:p03:gps:unit
   npm run test:p03:gps:contracts
   npm run test:p03:gps:api
   npm run typecheck
   npm run verify:p02-5:portable

   Push-Location apps/flutter_app
   flutter pub get
   flutter analyze
   flutter test test/p03_location_recovery_test.dart
   flutter test test/p03_gps_one_shot_test.dart
   flutter test test/p03_1b_geo_pack_test.dart
   Pop-Location
   ```

   The Flutter asset list changed. **Stop the app and perform a full Android run/reinstall**, not only hot reload. Use your established local API + device launch script, e.g. `npm run dev:flutter` after startup dependencies are ready.

## Manual moto g04s acceptance

1. Sign in, open **Settings → Location & discovery preferences**. Confirm **Manual location: State → District → Village / Town** is visible below the optional GPS button, even if catalogue networking is temporarily off.
2. With working CloudFront/API, choose State/UT → District → **Download/load selected district** → Search village/town → select a result → **Save selected location**. Confirm **Saved location: [place, district, state]** appears.
3. Close the app **fully**, relaunch and sign in. Expand Location & discovery again. The same saved label must be retrieved from the account. If you are offline, the app must explicitly say it could not refresh the saved account location; it must not falsely show “not saved”.
4. Tap **Use GPS and save location** once, accept Android permission if requested, and expect one save request and a saved label, with **no Confirm approximate location** button. Test denial and the outside-India server refusal separately. Wait at least 15 seconds between manual/GPS edits because of the deliberate backend cooldown.
5. Fully close/relaunch again; check saved label still shows **Approximate location in India** (GPS intentionally does not reverse-geocode a precise town name). The backend owns the H3 R6 cell; raw GPS coordinates must not be stored.
6. Temporarily make the public catalogue unreachable: State/District lists should still render from the small bundled manifest, and any previously verified cached packs can be browsed. New district download and manual save must remain disabled/unavailable until the CDN comes back. **Saved account location should still show if authenticated Fastify GET is available**.
7. Expand/collapse Settings repeatedly to verify no `bool`/`double?` PageStorage crash and no new frozen UI. PIN search must remain hidden/on hold.

## Troubleshooting

- **State/District available but district cannot load**: check CloudFront `manifest.json`, S3 object keys under `geo/india/v1`, backend `.env`, and that device can reach Fastify. The UI is a safe fallback, not a substitute for S3 delivery.
- **Saved location isn't shown after restart**: inspect authenticated GET `/v1/me/geo/location` (must return `settingsRevision` and `location`). An unsuccessful save is never treated as persisted. Check Fastify running with the same DynamoDB endpoint/tables after restart and that the account is the same.
- **GPS says not saved**: look for actual permission, GPS fix and API errors; GPS boundary file must accompany the backend. No second confirmation is needed. Try after the 15-second cooldown.
- **Caution**: Local DynamoDB Local uses ephemeral storage if not configured with persistent files; do not assume settings survive a DynamoDB container reset. This patch does not alter DynamoDB Local persistence settings.

## Verification status of the delivery environment

- Passed here: checksum/catalogue and GPS source contracts, GPS boundary unit tests, inherited P02-5 portable regression.
- Not performed here (toolchain absent): Flutter analyzer, widget tests, live Fastify+DynamoDB integration, physical moto g04s tests. Run those locally before accepting this patch.
