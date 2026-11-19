# P03 implemented API contracts — owner location, settings, shell readiness

**Applies to source in `apps/api/src/features/{geo,profiles}/` as of 2026-11-17.** This is an implementation map, not permission to expose discovery. Keep it updated in the same change as route/validation edits. For the maintained storage and recovery reference, see `docs/p03/02_GEO_DATA_STORAGE_AND_H3.md`; for new API updates see `docs/p03/03_API_REFERENCE.md`. This legacy file is temporarily retained because a restored P03 source-contract test references it.

> P03-only API reference. This file does **not** replace the existing P01 authentication APIs or the P02 profile/activation contracts. Keep those files in the owner-provided documentation tree unchanged.

## Trust boundaries

- All `/v1/me/*`, `/v1/geo/india/*` and `/v1/profiles/me` routes in this table require the existing P01 authenticated session guard; `Authorization: Bearer` is sent **only to Fastify**. Never send tokens, user identifiers or coordinates to CloudFront.
- The Fastify GET for `profiles/me` is authoritative for `onboarding.ready`. App shell remains two tabs until this authenticated response is verified. Completed-profile shell has five ordered UI destinations (Dating, Friendship, Local Feed, Connects, Settings), with Local Feed/Activities subsections inside the third tab; this UI change introduces **no new HTTP API**. A person can have an onboarding profile with a typed locality but no validated geographic selection.
- `uluv_settings` row: `PK=USER#<uid>, SK=SETTINGS`, obtained only from authenticated server identity. `settingsRevision` is optimistic concurrency for location/preferences; `localityRevision` increments only on an effective change. 15-second server cooldown protects location mutation.
- Public JSON resides in existing S3 bucket `geo/india/v1/` via CloudFront OAC; server trusts independently pinned `ULUV_GEO_CANONICAL_MANIFEST_SHA256`. Flutter's bundled **manifest** only provides offline State/District labels, with each selected district pack hashed against the public release manifest before cache activation.
- For GPS, the server loads bundled `apps/api/assets/geo/india-boundary.geojson` and verifies its pinned hash. It checks latitude/longitude against the polygon, derives H3 R6 and stores the cell/center, **not the phone's raw fix**. Coordinates can be spoofed; boundary check verifies coordinates, not physical identity.

## Implemented HTTP route map

| Method/path | Source | Input / successful response | Expected error cases |
| --- | --- | --- | --- |
| `GET /v1/profiles/me` | `profiles/routes.ts` | Shared profile, handles, mode drafts and server-computed `onboarding.ready` | Unauthorized / DB unavailable; don't assume incomplete on transport error |
| `GET /v1/geo/india/delivery` | `geo/routes.ts` | Versioned `rootUrl`, `manifestSha256`, `provider`, authorization requirement | `503 geo_delivery_not_configured` when pinned SHA / provider invalid |
| `GET /v1/geo/india/manifest` | `geo/routes.ts` | Authenticated, byte-verified public manifest | `503` if catalogue fails integrity/configuration |
| `GET /v1/geo/india/packs/:state/:district` | `geo/routes.ts` | Verified JSON fallback for a specific district (used only after direct CDN fails) | `404` unknown pack; `503 geo_pack_integrity_failed` or unavailable |
| `GET /v1/geo/india/catalogue/:version/*` | `geo/routes.ts` | Local-development directory provider only, allowlisted JSON | `404` on CDN mode / unknown path |
| `GET /v1/me/geo/location` | `geo/routes.ts` | `{settingsRevision,localityRevision,location,gpsAvailable,discoveryEnabled:false}`; `location` is nullable | `409 settings_not_initialized`, `503 geo_settings_unavailable` |
| `PUT /v1/me/geo/manual` | `geo/routes.ts` | `{geonameId,catalogueVersion,stateCode,districtCode,expectedRevision}`. Server resolves canonical index, validates provenance, derives H3 R6, atomic save; returns revised private label | `400 invalid_geo_selection` or `geo_provenance_mismatch`; `404 geo_place_unknown`; `409` revision/version; `429` cooldown; `503` provider/DB |
| `POST /v1/me/geo/gps` | `geo/routes.ts` | `{lat,lng,accuracyMeters,fixTimestamp,expectedRevision}` on explicit GPS tap. Server checks fresh fix, supported boundary and revision, saves approximate cell; returns label | `400 gps_fix_invalid_stale_or_inaccurate` or `gps_outside_supported_india_boundary`; `409` revision; `429` cooldown; `503` boundary/DB |
| `GET /v1/me/settings` | `geo/settings-routes.ts` | `{settingsRevision,localityRevision,distanceBand,sortMode,locationSource,locationName,discoveryEnabled:false}` | `409 settings_not_initialized`, `503 settings_unavailable` |
| `PUT /v1/me/settings` | `geo/settings-routes.ts` | `{distanceBand,sortMode,expectedRevision}`; server conditional write, returns updated settings | `400 invalid_preferences`, `409 settings_revision_conflict`, `503 settings_unavailable` |

**All of the above** must remain owner-only, with no private H3 cells or raw coordinates returned from public profiles, CDN URLs or request logs. The delivery endpoint's `rootUrl` is a public JSON source, not an authenticated per-user operation.

## Required inputs and enums

- Manual `geonameId` decimal string, release `catalogueVersion` pattern `IN-<16 lowercase hex>`, state GeoNames code or `unresolved`, district GeoNames code or null, nonnegative integer `expectedRevision`.
- GPS fix timestamp is UTC ISO 8601 and must be no more than **120 seconds old** and no more than **30 seconds in the future**. `accuracyMeters` must be finite and 0–10,000. Country polygon is simplified: offer manual selection as fallback near border/coast.
- Distance bands: `0-10`, `10-35`, `35-50`, `0-50`. Sort: `near_band_first` and `recent_first` are *stored preferences*, not activated public discovery.

## Processing and durability

1. Flutter obtains a bearer token only from `RenewingAuthService` / P01-3 secured persistent session controller.
2. It reads `/v1/profiles/me` (onboarding) and `/v1/me/geo/location` (geography) independently. A CloudFront outage must not erase account location.
3. Selecting a State/District loads exactly that pack (verified disk cache → direct CDN → authenticated Fastify fallback). Flutter never downloads all 798 packs for a person.
4. Saving a manual place sends canonical ID+version; Fastify resolves the place against verified 256 lookup shards and checks original state/district membership. A phone-supplied name/coordinate is not a trusted place selection.
5. Server conditional transaction checks active, adult account, revision and cooldown, persists H3 R6 cell + center + label + metadata. HTTP 200 means DB transaction was accepted; Flutter closes picker and shows server-confirmed name. On a later app launch, GET reads DynamoDB, not a client-local private location cache.
6. GPS permission and point collection are strictly user-triggered, single-shot. Fastify checks bundled polygon, then saves H3 R6 with source `gps_selected`, removing manual place provenance fields.
7. Location change increments a client `refreshEpoch` so Settings header and currently active discovery gate refresh. Do not publish people/posts just because a location is present.

## Diagnostics and troubleshooting

The **API terminal**, not the Flutter console, is the primary server diagnostic. `npm run dev:api` in local mode uses readable Pino output; records use `[API]` and `[GEO]`, request IDs, route templates, statuses, public asset paths, SHA verification stage and bounded timings. Do **not** log bearer tokens, headers, request bodies, arbitrary exception strings, user IDs or GPS coordinates. Direct phone→CloudFront HTTP is not observed by Fastify until authenticated fallback.

| Symptom | Inspect |
| --- | --- |
| `Location catalogue unavailable` | Fastify `catalogue.bootstrap` error category; `.env` `ULUV_GEO_PUBLIC_BASE_URL` and `ULUV_GEO_CANONICAL_MANIFEST_SHA256` (do not share values beyond trusted SHA prefix); CloudFront 403/404 and OAC |
| State/District appears, place list fails | Selected pack path, checksum, verified cache, CDN status, authenticated Fastify fallback |
| `PUT /v1/me/geo/manual` 200 but no UI label | Verify server `account.location.save.committed`, GET read `found:true`, and Flutter Settings re-entry; do not blame manifest once GET is successful |
| `gps_india_boundary_not_configured` | API build includes bundled GeoJSON and attribution; checksum and island test fixtures |
| `409` settings revision | Refresh account settings/revision before retry; never blind retry mutating requests |
| `429` location change cooldown | Wait for server cooldown before a new change; don't bypass |

## Route/document maintenance policy

For every P03 backend API change: update **this file** and the P03 handbook if geo storage/trust changes, and add/update a real route test plus the relevant Flutter widget/manual acceptance step. Record verification as **RUN/PASS, RUN/FAIL or NOT RUN**, never implied. For P01 session changes, follow the original P01-3 design references listed in `docs/P03_READ_ME_FIRST.md`; this P03 document does not replace authentication documentation.
