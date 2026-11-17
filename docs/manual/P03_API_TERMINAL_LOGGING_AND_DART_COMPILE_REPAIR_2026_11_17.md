# U_luv P03 — Fastify API terminal logs + Flutter compilation repair

**2026-11-17 / owner-reported failure.** This update must be layered over the previously delivered P03 One-Bucket → GPS → Location Recovery → District Autoload packages. The source available to this patch is a reconstruction of those packages from the P02-5 project baseline, **not the owner's unpublished latest working tree**. Review newer local changes before overwriting.

## What was broken, exactly

1. `lib/features/geo/india_location.dart` referenced `_DistrictLoadFailure` as a constructor and type but did not define it. The app **could not compile**. This error was missed by tests that read source text rather than invoking the Flutter compiler.
2. Fastify's global logger deliberately redacted `req.url` for privacy, leaving only generic request messages. Catch blocks for GeoNames configuration, HTTP and manifest errors returned generic `503` codes without identifying the failing stage in the API terminal.
3. The phone can GET CloudFront directly. Such requests **never appear in Fastify logs**, making direct CDN errors invisible. When the app falls back to Fastify, this update sends only a fixed non-sensitive error code in a header.
4. The legacy Flutter widget test used `pumpAndSettle` around dropdowns, which could hang when indeterminate loaders were present; it now pumps for a fixed period.

## What appears in the API terminal

All API requests get a sanitized `apiEvent: request.completed` record containing **registered route template** (`/v1/me/geo/location`, `/v1/geo/india/packs/:state/:district`, etc.), HTTP method, status, request ID and duration. This never logs raw query strings, bodies, auth headers, account IDs, place names or GPS coordinates.

GeoNames requests additionally emit `geoEvent` records:

| `geoEvent` | What it tells you |
|---|---|
| `api.request`, `api.response` | Geo API route, request ID, status, elapsed time |
| `config.validated` | Parsed provider (CloudFront or local), *public* base URL, first 12 characters of pinned SHA |
| `asset.cdn.start` | The exact **public allowlisted JSON URL** Fastify is fetching (no query strings) |
| `asset.cdn.response` | CloudFront HTTP status (200, 403, 404, 5xx) and time |
| `asset.cdn.error` | HTTP, connectivity, TLS, timeout, streaming or decoded-byte-limit failure category |
| `manifest.pinned_sha.failed` | Expected and actual **12-character checksum prefixes** disagree |
| `manifest.public_compare.failed` | Public and canonical manifest contents differ |
| `manifest.ready`, `catalogue.ready` | Pinned GeoNames catalog initialized successfully |
| `asset.integrity.failed` | District pack bytes or SHA do not match authoritative metadata |
| `client.cdn_fallback` | Phone's direct CDN request failed; logged code: `no_delivery`, `http_403`, `http_404`, `network`, `timeout`, `sha_mismatch`, or `other` |
| `api.stage.failed` | Stage (`configuration`, `catalogue.bootstrap`, `district_pack`, `account_location_read`, `manual_location_save`, `gps_location_save`) and sanitized reason |
| `gps.boundary.ready` | Country polygon loaded (no location data logged) |

Each geo API response includes `X-ULUV-Geo-Request-Id`, which the Flutter district error can report. Match that request ID in the Fastify terminal. **Do not paste real authorization headers, raw request bodies, private `.env` contents or full server logs into chat.** Share only the relevant sanitized diagnostic events if further debugging is needed.

## How to run on Windows (two terminals, root project directory)

First ensure your local DynamoDB is running using your usual **manual** startup and API database provisioning is ready. Then:

**Terminal A — API + structured logs:**

```powershell
cd C:\Dump\Projects\Project-ULuv-Space
npm run dev:api
```

**Terminal B — Flutter/device:**

```powershell
cd C:\Dump\Projects\Project-ULuv-Space
npm run dev:flutter
```

The API logs appear in **Terminal A**, not in the Flutter/Gradle terminal. Under the current local setup `dev:api` starts `tsx watch`; restart that process fully after modifying `.env` so the new settings are actually read.

Select **Settings → Location & discovery → State/UT → District** on the moto g04s. You should see GeoNames bootstrap requests, the selected API request, and (on fallback) which CloudFront JSON was requested and its HTTP result. If you see no API records at all, the phone may not be reaching Fastify; check your API `/health/live` on the PC, ADB reverse, app base URL and session state. A successful direct phone→CloudFront district request does not generate a Fastify request for that pack.

## Diagnose the actual problem from event categories

| Symptom in API log | Likely cause / next check |
|---|---|
| `sha_env_invalid` | `ULUV_GEO_CANONICAL_MANIFEST_SHA256` is missing, malformed or not 64 lowercase hex digits |
| `cdn_url_env_missing` | Neither valid CloudFront base nor absolute local-data directory was configured |
| `cdn_url_env_invalid` | `ULUV_GEO_PUBLIC_BASE_URL` is malformed, non-HTTPS, or lacks `/geo/india/v1/` trailing slash |
| `cdn_http_error` plus `upstreamStatus:403` | CloudFront origin policy / OAC / bucket authorization may be incorrect |
| `cdn_http_error` plus `upstreamStatus:404` | Wrong object key, missing upload, or wrong version/prefix |
| `canonical_manifest_sha_mismatch` | `.env` pinned SHA does **not** match downloaded `server-index-manifest.json`. Inspect expected/actual prefixes; do **not** disable validation |
| `public_manifest_mismatch` | Uploaded `manifest.json` is from a different release than canonical index |
| `geo_pack_integrity_failed` | Wrong/corrupt pack bytes, different release, or stale CDN object; verified cache is not replaced |
| `cdn_timeout` / `cdn_network_or_tls_error` | DNS/TLS/network/timeout; confirm CloudFront connectivity outside the app |
| `client.cdn_fallback: http_403` | Phone received HTTP 403 from direct CloudFront delivery, which Fastify may work around |
| `api.response` status 401/403 | The authenticated request did not pass session/authorization checks |
| `account_location_read` failure | API/DynamoDB settings read problem, not a CloudFront district issue |

The canonical SHA in the previously issued immutable data release was:

```text
8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
```

This public release checksum is not an API secret. Only use it when your S3 objects belong to **that exact release**; never force it against a different release. Keep `.env` private.

## Gates: from repository root

```powershell
npm run verify:p03:api-diagnostics:portable
# Or run the full gate (TypeScript + GPS API + whole Flutter analyzer/test suite):
npm run verify:p03:api-diagnostics
# Targeted Flutter diagnostics:
cd apps/flutter_app
flutter pub get
flutter analyze
flutter test test/p03_location_recovery_test.dart
flutter test test/p03_district_auto_load_test.dart
flutter test test/p03_gps_one_shot_test.dart
```

- `flutter analyze` must return **No issues found**. Do not proceed to device execution with a Dart compile failure.
- `flutter test` must pass, including a district selection test (not only text/source contracts).
- Run the whole P02-5 regression and the existing P03 manual/GPS selection save flows; the new logging must not change them.
- Restart/rebuild the Flutter debug app, open manual State → District → Village/Town, save a place, fully close/relaunch, and verify saved selection appears. Test one-time GPS on a supported India coordinate, permission denial and manual fallback.
- Check the API terminal for each HTTP event, a successful manifest checksum, and a successful pack checksum. Errors must identify a stage. The API does not disclose any user/GPS coordinates in logs.
- **Any failing gate remains FAILED.** Without Windows Flutter and live DynamoDB/device results, acceptance is UNVERIFIED.

## Scope / privacy

No S3 upload, new infrastructure, AWS credentials, DynamoDB schema change or PIN-code implementation. Existing CDN packs, encrypted/authenticated account settings, 1.3 MB Fastify-bundled country boundary and H3 R6 are unchanged. The log only records public GeoNames paths/statuses and non-personal error categories. `docs` paths and scripts are part of the update-only ZIP.
