# U_luv P03 — Complete GeoNames, Location, GPS, Storage & Operations Handbook

**Status:** implementation reference for the U_luv P03 codebase, 17 November 2026. **Scope:** current India GeoNames manual selection, one-time GPS, backend validation, private location storage and offline search. **PIN code is on hold.** This document describes implementation contracts, not proof that every device/build has passed. For live acceptance run the checks at the bottom.

> Read this for the **GeoNames/GPS/data processing** contract. For the five-tab Flutter shell use [P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md](P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md), and for HTTP requests/responses use [../api/P03_GEO_AND_SHELL_API_CONTRACTS.md](../api/P03_GEO_AND_SHELL_API_CONTRACTS.md).

## 1. Decision summary and non-negotiables

- All **large public GeoNames reference JSON** is versioned under `geo/india/v1/` in **one S3 bucket**, read through **one CloudFront distribution with S3 Origin Access Control**. No public source dataset is committed in the Flutter/API source repository.
- The API receives its CloudFront base URL from the **private** `ULUV_GEO_PUBLIC_BASE_URL` environment variable. The backend uses an **independently pinned SHA-256** of the canonical `server-index-manifest.json`, not a hash downloaded from the same CDN as its only trust root.
- The Flutter app bundles the small **state/district manifest** `apps/flutter_app/assets/geo/india-manifest.json` so manual State/District choices render without an API/CDN connection. This is **metadata only**; it is not an offline copy of all India places.
- Flutter downloads **only the selected district's pack** on demand. Existing valid, version-matched caches are reused, checksum-checked, and atomically replaced only after validation. No unnecessary bulk India downloads.
- **Private user location** is in DynamoDB `uluv_settings` keyed by `PK=USER#<uid>, SK=SETTINGS`; never S3, CloudFront, a public manifest, public discovery, or an app-private place-cache file. The API never trusts client-supplied coordinates for manual selections.
- **One-time GPS** uses a locally bundled, SHA-pinned, previously reviewed India `MultiPolygon`: `apps/api/assets/geo/india-boundary.geojson`. Fastify loads it once per process and reuses it. No S3 lookup per GPS request; no background tracking. It uses one explicit **Use GPS and save location** action, without a second confirmation.
- The app must show the server-confirmed saved location in the **Settings tile subtitle even while collapsed**, retrieve it again after a new authenticated Settings mount/reopen, and never hide a known saved label just because the public catalogue failed. A successful manual or GPS save closes the expanded Settings tile.
- The optional **PIN-code** importer/UI remains on hold pending authentic India Post source data. **Discovery remains disabled** even after saving a location.

## P03 shell and Settings integration (current decision, 2026-11-17)

The latest owner-approved P03 navigation has **five main tabs** for completed accounts: **Dating · Friendship · Local Feed · Connects · Settings**. The third tab contains two sections, **Local Feed** and **Activities**; Friendship no longer contains them. The original shared product/design documents retain a historical four-tab description, which is superseded only for P03 navigation. Before authenticated `GET /v1/profiles/me` confirms `onboarding.ready`, the shell does not guess profile status. Incomplete accounts see **Dating (onboarding) · Settings**. There is no Home page. The saved-location gate checks each active Dating, Friendship, Local Feed or Activities surface only when a successful authenticated read confirms no location; it does **not** enable public discovery. Detailed transitions: [P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md](P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md).


## 2. Component map

| Responsibility | Code / data |
|---|---|
| Data generator | `scripts/geo/india_catalogue.py`, `export_s3_bundle.py`, `verify_onebucket_release.py` |
| Public immutable release | existing S3 bucket: `geo/india/v1/` |
| Public + canonical integrity/index | `apps/api/src/features/geo/india-catalogue.ts` |
| CDN and local-dev asset transport | `apps/api/src/features/geo/catalogue-delivery.ts` |
| Backend location API and DynamoDB transactions | `apps/api/src/features/geo/routes.ts` |
| Settings/discovery preferences API | `apps/api/src/features/geo/settings-routes.ts` |
| Coordinate input validation | `apps/api/src/features/geo/validation.ts` |
| GPS polygon validator | `apps/api/src/features/geo/india-boundary.ts` and `apps/api/assets/geo/` |
| Flutter State → District → Place selector and save | `apps/flutter_app/lib/features/geo/india_location.dart` |
| Flutter public-asset provider parsing | `apps/flutter_app/lib/features/geo/geo_catalogue_delivery.dart` |
| Flutter atomic, verified district cache | `apps/flutter_app/lib/features/geo/geo_pack_cache.dart` |
| One-time phone GPS client and UI | `apps/flutter_app/lib/features/geo/gps_location.dart` |
| Location Settings tile and independent saved-label read | `apps/flutter_app/lib/features/geo/geo_settings_panel.dart` |
| Bundled State/District manifest | `apps/flutter_app/assets/geo/india-manifest.json`, pinned in picker |
| Canonical boundary and attribution | `apps/api/assets/geo/india-boundary.geojson`, `ATTRIBUTION.md` |

## 3. GeoNames release format, source, and attribution

The GeoNames `IN.txt` input yields the current version's ~549,046 selected populated-place records, 36 states/UTs, 798 district/unmapped place packs, and 256 server lookup shards. These values refer to the built **immutable release**; don't recompute or change a release in place. New data → **new version/pin** with cache migration/testing. GeoNames is **CC BY 4.0** and requires attribution. GPS boundary derives from **geoBoundaries IND ADM1 simplified**, unioned without further exterior coordinate simplification; its separate attribution/licence information lives next to the boundary asset.

Example S3 object paths (upload the JSON objects, **not** the ZIP itself):

```text
geo/india/v1/
  manifest.json                  # public state/district metadata, per-pack bytes/sha256/count
  server-index-manifest.json     # full canonical metadata + 256 shard hashes
  attribution.json
  build-report.json
  country-unmapped.json
  states/<state-code>/districts/<district-code>.json
  states/<state-code>/unmapped.json
  server/00.json ... server/ff.json
```

Public `manifest.json` contains pack paths, byte size, SHA-256 and count. `server-index-manifest.json` includes the canonical server index shard checksums; Fastify compares the public manifest against the pinned canonical manifest. Place-pack JSON has `schemaVersion`, `catalogueVersion`, `country`, `stateCode`, `districtCode`, `places[]`; each populated place has an immutable GeoNames ID, name/aliases, latitude and longitude. These are public **source** coordinates, not user GPS data. A district pack's content SHA is over decoded **plain JSON bytes**; HTTP gzip/br transport may be used, but avoid hashing compressed bytes. Clients must reject unverified/oversized/corrupted objects.

Even though public index shards are viewable over CloudFront, **public does not mean authoritative**: Fastify's independently trusted SHA prevents accidental or malicious alteration of the manifest, and each shard is checked against that manifest. Do not publish API credentials or private DynamoDB user records into S3.

## 4. Configuration and bootstrap

Private `apps/api/.env` values (shown as placeholders; **do not** commit the real file):

```dotenv
ULUV_GEO_PUBLIC_BASE_URL=https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/
ULUV_GEO_CANONICAL_MANIFEST_SHA256=<sha256 of the exact published server-index-manifest.json>
```

- The URL must be HTTPS, without query, user-info or custom port, and end in `/geo/india/vN/`. The `v1` S3 prefix must match the server metadata and Flutter's bundled manifest release.
- The pinned SHA must be the full 64-character lowercase SHA-256 of the exact server-index manifest bytes and must be provided from an independently trusted release build or deployment config. A manifest/SHA read from the same mutable bucket is insufficient as a trust anchor.
- For local-only developer fixtures (without CDN), **omit** the CloudFront URL and set `ULUV_GEO_PUBLIC_LOCAL_DIR` to an **absolute external** directory with the complete versioned JSON tree. Never set both by accident; CDN takes precedence.
- S3 objects remain private behind OAC; CloudFront serves *read-only* source JSON. No AWS SDK, S3 secrets, signed URLs or second bucket are needed in the app/API for GeoNames delivery.
- Fastify `IndiaCatalogue.open()` reads the public and canonical manifests; checks canonical pinned SHA, structure, version, equality of public/canonical metadata, pack path/count/size/hash metadata, and all 256 shard descriptors. Failed trust checks fail closed.
- The canonical manifest is cached per Fastify process after successful load. On manual save, lookup is by `geonameId % 256` into the appropriate server shard. Up to **64 verified shards** are cached in memory; in-flight reads are coalesced. No 256-shard all-at-once download.

## 5. Manual State → District → Village/Town flow

1. User visits authenticated Settings; the collapsed `Location & discovery` tile independently reads `GET /v1/me/geo/location` so the saved selection is already visible. **The tile's contents do not mount or begin downloading until first expansion.**
2. On expansion, Flutter checks the **bundled**, checksum-pinned State/District manifest immediately. It also asks Fastify for the previously saved account revision and selection **independently** of the public catalogue.
3. Flutter calls **authenticated** `GET /v1/geo/india/delivery` for the configured provider/version/manifest SHA. Fastify validates canonical release metadata and returns the public URL. A phone-origin CloudFront request never carries a bearer token.
4. Flutter independently downloads and hashes `manifest.json` from the delivery origin. A failed CDN/manifest does **not** hide the bundled State/District choices, and **must not** erase the saved account location.
5. On State change, stale district results/selection are cleared. On District change, `_loadDistrict()` runs **automatically**; no separate download/load button exists.
6. Try a verified cache for *this exact catalogue version/state/district*. Otherwise try the direct CloudFront pack URL (no JWT), then the authenticated Fastify fallback `GET /v1/geo/india/packs/:state/:district`. The fallback uses the same pinned version/manifest and checks bytes+SHA server-side. The phone supplies only an enumerated CDN-failure header to aid diagnosis.
7. Validate decoded bytes, reported SHA, version, state, district, place count/fields in a background isolate, then activate new pack via `.pending` file+atomic rename. Do not destroy an old valid version on an unsuccessful new load. Old-version caches may support browsing, **not** saving against a newer catalogue.
8. Present searchable candidates (first 60 results), then on tapping a place **close the result list** and display a compact selected-row preview. User taps **Save selected location**.
9. `PUT /v1/me/geo/manual` sends **ID**, catalogueVersion, stateCode, districtCode and expectedRevision. **No client-generated coordinates** are accepted. Fastify resolves ID from authoritative shard, verifies state/district provenance and revision, checks user activation/age and cooldown, derives an H3 resolution 6 cell/center, and transactionally updates `uluv_settings`.
10. After HTTP 200, Flutter updates its saved label from the **server acknowledgement**, collapses Settings and keeps the label visible in the tile subtitle. On reopening the app, Settings reads `GET /v1/me/geo/location` again, not from the public district pack.

**Failure policy:** return stage-specific UI errors and API logs; never call a failed download "saved". A 200 `PUT` means the transaction committed, but must be followed by a persisted `GET` in owner acceptance tests. On 409 refresh the revision before retrying; 429 enforces the 15-second change cooldown.

## 6. One-time GPS flow

1. Only on explicit `Use GPS and save location`: Flutter checks Android service/permission and asks for a **single current position** with a timeout; it does not subscribe to continuous updates.
2. Client checks obvious coordinate validity, accuracy and timestamp freshness. It reads the current settingsRevision from the authenticated API before saving.
3. `POST /v1/me/geo/gps` validates strict payload keys, latitude/longitude bounds, accuracy, timestamp/revision, then calls the **bundled** India boundary polygon loaded and checksum-pinned once per process. It uses point-in-polygon, including island polygons, not merely a rectangular India bounding box.
4. Coordinates within the vetted geometry pass; stale, bad and out-of-bound fixes are rejected. The current polygon was itself simplified, so locations near coastline/international boundaries warrant caution and manual fallback.
5. Fastify derives H3 **resolution 6**, stores the cell ID and **cell center**, source `gps_selected`, label `Approximate location in India`, revision/timestamp/cooldown in DynamoDB. The exact phone GPS fix and timestamp are not persisted or logged. This verifies that submitted *coordinates* are within polygon, not that the phone's user is physically there (spoofing remains possible).
6. Server acknowledges success, Flutter closes Settings and updates its saved summary. The GPS polygon is in `apps/api/assets/geo/`, **not** in S3. Deployment MUST include this file and `ATTRIBUTION.md` in the API release artifact.

## 7. Private data in DynamoDB

- Table `uluv_settings` / key `USER#uid` + `SETTINGS` is the source of truth. Each user has a single current location selection. The user ID appears only in private storage/auth resolution, never in GeoNames asset URLs/log fields.
- `settingsRevision` handles conditional writes across location and discovery preference updates; `localityRevision` changes on effective locality changes. API uses consistent reads and DynamoDB transactional/conditional saves including active/adult user condition, optimistic concurrency and 15-second cooldown.
- Manual rows set `geoGeonameId`, `geoStateCode`, `geoDistrictCode`, `geoSelectionLabel`, `geoApprovedCenter`, `geoH3Cell`, `geoSelectionSource=manual_geonames`, `geoCatalogueVersion`, updated timestamps. GPS rows set `geoSelectionSource=gps_selected`, approximate center and cell, label, and remove manual provenance fields.
- `GET /v1/me/geo/location` returns the permitted private label, selection source, revision, boundary availability, and `discoveryEnabled:false`. `GET /v1/me/settings` also provides `locationName`/`locationSource`, plus preferences and revisions. Public endpoints and CloudFront never return a user's location/H3.
- `geoDistanceBand` and `geoSortMode` are **future** discovery preferences; saving them does not turn on the discovery feed or reveal a profile.

## 8. Backend API table and expected status

| Method / path | Purpose | Typical outcomes |
|---|---|---|
| `GET /v1/me/geo/location` | Authoritative saved selection/revision; called on Settings entry/reopen | `200` (may have `location:null`), `409` not initialized, `503` DB failure |
| `GET /v1/geo/india/delivery` | Trusted versioned public CDN descriptor | `200`, `503` config/canonical integrity |
| `GET /v1/geo/india/manifest` | Authenticated public manifest proxy | `200`, `503` |
| `GET /v1/geo/india/packs/:state/:district` | Authenticated byte-verified fallback when device CDN fails | `200`, `404` unknown pack, `503` CDN/hash/config |
| `PUT /v1/me/geo/manual` | Server-resolved GeoNames ID → private H3 cell save | `200`, `400`, `404`, `409`, `429`, `503` |
| `POST /v1/me/geo/gps` | One-time vetted-boundary GPS → private H3 save | `200`, `400`, `409`, `429`, `503` |
| `GET/PUT /v1/me/settings` | Private discovery preferences and location summary | `200`, `409`, `503` |

Every authenticated geo request follows the existing device/session guard. Never put tokens in URLs or CloudFront requests. Do not bypass the server's canonical shard lookup to save a manual location from Flutter's public point coordinates.

## 9. Developer-readable API logging and diagnostics

Start the backend with `npm run dev:api` and watch **that backend terminal**. In `APP_ENV=local`, Fastify uses the installed `pino-pretty` transport for human-readable, timestamped, single-line messages. Higher environments keep structured JSON so centralized collectors continue to work. We intentionally suppress Fastify's duplicate raw `incoming request`/`request completed` noise and log a summarized request method, route template, status, elapsedMs and request ID once per response. Do not log `req.url` (may contain query strings), body, Bearer headers, user IDs, GPS fixes, selected place names or arbitrary upstream errors.

Typical safe log messages:

```text
[API] GET /v1/me/geo/location → 200 (31ms) [req-a]
[GEO] account.location.read [req-a]  { found: true, source: manual_geonames, revision: 4 }
[GEO] account.location.save.committed [req-b]  { source: manual_geonames, revision: 5 }
[API] PUT /v1/me/geo/manual → 200 (44ms) [req-b]
[GEO] asset.cdn.response [req-c]  { asset: states/01/districts/638.json, status: 200 }
[GEO ERROR] catalogue.bootstrap: canonical_manifest_sha_mismatch [req-d]
```

`[GEO]` events carry safe `geoEvent` values and structured details such as **public** URL/asset, HTTP status, timing, byte count, SHA prefixes and deterministic error categories: `cdn_http_error` (403 is often OAC/origin), `cdn_timeout`, `cdn_network_or_tls_error`, `canonical_manifest_sha_mismatch` (bad pinned SHA/wrong bytes), `public_manifest_mismatch`, `shard_integrity_invalid`, `pack_integrity_failed`, `settings_revision_conflict`. There are no sensitive user identifiers/coords in diagnostic payloads. Request ID `X-ULUV-Geo-Request-Id` is returned for geo API responses and helps match safe Flutter errors with Fastify. **Direct Flutter → CloudFront requests bypass Fastify**, so only a subsequent fallback API request provides a server-side diagnostic for that event.

To diagnose "save succeeded but not visible": check for a `PUT /v1/me/geo/manual → 200` **and** `account.location.save.committed`, then close/reopen Settings and verify `GET /v1/me/geo/location → 200` plus `account.location.read found:true`. If the PUT was 200 but GET is absent, the client never refreshed; if GET returns `location:null`, inspect DynamoDB and account/session identity on the server (without printing IDs in shared logs). If GET succeeds and source/name is correct, inspect Flutter Settings tile rendering. If catalogue is offline, that alone cannot explain missing saved account data.

## 10. Build, tests, and owner acceptance

**From project root in Windows PowerShell** (DynamoDB Local manually started as in P00 docs):

```powershell
npm install
npm run test:p03:geo-visibility:contracts
npm run test:p03:cloud-contracts
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

Use **separate terminals**: `npm run dev:api` for readable Fastify/backend logs, then `npm run dev:flutter` for moto g04s. Verify an authenticated manual selection from State → District → Place, result-list closes on selection, Settings collapses on HTTP 200, label visible while tile collapsed, label still present after full app kill/relaunch, save after catalogue outage retains label, GPS one-tap stores approximate H3, old manual source fields removed after GPS, and the 15-second cooldown/revision conflict works as designed. Verify also that an actual CloudFront 403/404/invalid SHA produces a clear `[GEO ERROR]` category, without revealing secrets.

**Important testing boundary:** Node source-contract tests are not proof that Dart compiles. The Flutter analyzer and widget tests above are mandatory; only the owner can verify physical Android networking, CloudFront distribution, DynamoDB Local, device permissions and production deployment in their environment. Mark any unexecuted gate "unverified", not "passed".

## 11. Rollback, recovery and future changes

- Never overwrite the immutable `geo/india/v1/` release with different bytes. Publish a new version, compare manifests, and update the API's independent SHA and Flutter bundled manifest together. Keep old verified cache until new bytes pass hashing and atomic activation.
- Rolling back app/API code must preserve the matching trusted catalogue release and pinned SHA. Stale manifests cannot authorize newer places; never silently fall back to stale data to **save** a location.
- GPS boundary updates require SHA constant, attribution, geometry/island verification, test fixtures, and backend build asset inclusion. Invalid/missing boundary must disable GPS while allowing manual selection.
- If account GET fails, retain the latest verified UI label for the current session and show a retry diagnostic; do not treat cache as source of truth and do not expose account information before authentication.
- To regenerate/import GeoNames, see `scripts/geo/` and the one-bucket checksum verifier. A future PIN-code feature requires a genuine India Post dataset, a separate importer/attribution/verification contract, and still must resolve to a confirmed GeoNames place before manual save.

**Developer handoff checklist:** always inspect `docs/architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md`, the source paths above, `apps/api/.env.example`, the latest QA report, and the Windows owner logs before editing P03. Preserve P01 session security, P02-5 activation/photo flows, and the single-bucket, zero-user-data-on-CDN contract.
