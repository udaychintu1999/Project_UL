# 03 — Implemented P03-1 HTTP APIs and P03-2 private interfaces

**Authentication:** All listed P03-1 HTTP routes are authenticated through the existing P01-3 session guard; owner location/settings responses use `Cache-Control: no-store`. Do not invent a second login system, send bearer tokens to CloudFront, or claim an internal P03-2 function is a REST endpoint. Full route sources: `apps/api/src/features/geo/routes.ts` and `settings-routes.ts`.

## P03-1 — HTTP routes already registered

| Method + route | Input / behavior | Output / likely errors |
| --- | --- | --- |
| `GET /v1/me/geo/location` | No body; consistent owner settings read | `settingsRevision`, `localityRevision`, `location` (`null` or name/source/IDs for manual), `gpsAvailable`, `discoveryEnabled:false`; 401, 409 uninitialized, 503 |
| `PUT /v1/me/geo/manual` | `geonameId`, `catalogueVersion`, `stateCode`, `districtCode` (nullable where applicable), `expectedRevision` | Validated place + updated revisions/private label, `discoveryEnabled:false`; 400 malformed/provenance, 404 unknown ID, 409 version/revision, 429 cooldown, 503 |
| `POST /v1/me/geo/gps` | One short-lived fix, timestamp, accuracy and `expectedRevision` validated by Fastify | Approximate `gps_selected` location; 400 malformed/outside boundary, 409 revision, 429 cooldown, 503 boundary/storage |
| `GET /v1/me/settings` | Private preferences read | `settingsRevision`, `localityRevision`, `distanceBand`, `sortMode`, `locationSource`, `locationName`, `discoveryEnabled:false` |
| `PUT /v1/me/settings` | `expectedRevision`, `distanceBand` (`0-10`, `10-35`, `35-50`, `0-50`), `sortMode` (`near_band_first`, `recent_first`) | Updated preference view; 400 malformed, 409 concurrent update, 503 |
| `GET /v1/geo/india/delivery` | Authenticated catalogue delivery descriptor | Provider, version, trusted public manifest SHA, manifest path/base URL; 503 not configured |
| `GET /v1/geo/india/manifest` | Authenticated public metadata read | Public State/District/pack metadata; 503 unavailable |
| `GET /v1/geo/india/packs/:state/:district` | Authenticated **SHA-pinned fallback** when direct CDN retrieval fails | Verified JSON bytes; 404 invalid/nonexistent pack, 503 source/integrity unavailable |
| `GET /v1/geo/india/catalogue/:version/*` | **Local-mode-only** authenticated test/static delivery | 404 when CDN mode enabled or pack/version invalid |

Valid error response shape for these handlers is `{ "error": "fixed_error_code" }`; always follow the actual handler for exact codes and status. The P03-1 owner test covers 401, invalid request, 409 optimistic conflicts, 429 cooldown and 503 failure paths. Never log raw GPS, UID, bearer headers, place bodies or secret manifest-hash configuration values.

### Ownership and tests

- Real Fastify/DB: `apps/api/tests/geo/p03-1-local-db-acceptance.test.ts` (synthetic UID, exact-key cleanup), `scripts/verify/p03-1-live-api.test.mjs` (live HTTP unauthenticated rejection).
- CDN/manifest: `apps/api/tests/geo/p03-onebucket-canonical.test.ts`, `apps/api/tests/geo/p03-1-fixture-acceptance.test.ts` and existing GPS/boundary units.
- Android full UI/HTTP: `apps/flutter_app/integration_test/p03_location_acceptance_integration_test.dart` includes real Flutter taps and an isolated, synthetic **localhost HTTP server**. This is not a P01 login test and does not call Fastify or CloudFront.

## P03-2 — internal interfaces only

| Module | Function/use | Security invariant |
| --- | --- | --- |
| `contracts.ts` | Valid R6 cell, distance bands, partition keys and pointer shape | Fixed modes/bands, reject forged IDs |
| `coverage.ts` | Conservative overlapping cover; exact geodesic band calculation | R6 only; strict cover and distance budgets |
| `settings-snapshot.ts` | Consistent owner-private locality read | Never trust client-supplied coordinate/cell |
| `pointer-reader.ts` | Bounded strongly consistent `Query` on `uluv_discovery`, internal unverified pointers | No Scan, no public serialization; bounded work and pagination |
| `cursor.ts` | AES-GCM encrypted continuation + contextual binding | TTL, owner/revision/filter/mode integrity |

**Nonexistent in P03-2:** public `/v1/discovery/*`, people matching cards, eligibility publication, Feed/Activities post APIs, public cursor tokens, and automatic profile pointer writes. These belong to later P03 phases. Do not add mock success routes to satisfy UI tests. Additional details: [`../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md`](../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md).
