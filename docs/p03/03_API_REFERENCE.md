# 03 — Implemented P03 HTTP and internal API contracts

The app uses the **existing P01-3 authenticated session guard**, not another authentication system. `/v1/me/*`, `/v1/geo/india/*` and `/v1/profiles/me*` are owner-authenticated. Owner responses are `Cache-Control: no-store`. Never send a bearer token to the public GeoNames CDN. Canonical source: `apps/api/src/features/{geo,profiles,discovery}/`.

## Actual registered P03-1 owner routes

| HTTP route | Trust-checked input / response | Failure modes |
| --- | --- | --- |
| `GET /v1/profiles/me` | P02 canonical shared and mode profiles, server-calculated `onboarding.ready`; 2/5 shell depends on verified response | 401/403; transport failure must not imply incomplete |
| `GET /v1/me/geo/location` | Private location, `settingsRevision`, `localityRevision`, nullable label/source, `gpsAvailable`, `discoveryEnabled:false` | 409 missing settings; 503 unavailable |
| `PUT /v1/me/geo/manual` | `geonameId`, `catalogueVersion` (`IN-<16 hex>`), `stateCode`, optional `districtCode`, `expectedRevision` | 400 provenance, 404 unknown ID, 409 revision/catalogue, 429 cooldown, 503 |
| `POST /v1/me/geo/gps` | `lat`, `lng`, `accuracyMeters`, `fixTimestamp`, `expectedRevision` **only after explicit tap**; server rejects stale/out-of-bound fixes and saves approximate H3 only | 400 GPS invalid/outside India, 409, 429, 503 |
| `GET /v1/me/settings` | Private band, sort, label/source, revisions, `discoveryEnabled:false` | 409/503 |
| `PUT /v1/me/settings` | `distanceBand ∈ {0-10,10-35,35-50,0-50}`, `sortMode ∈ {near_band_first,recent_first}`, `expectedRevision` | 400, 409, 503 |
| `GET /v1/geo/india/delivery` | Configured provider, immutable release root and independently verified public manifest SHA | 503 invalid configuration |
| `GET /v1/geo/india/manifest` | SHA-verified public catalogue metadata | 503 unavailable |
| `GET /v1/geo/india/packs/:state/:district` | SHA-verified authenticated fallback for only requested district | 404 missing/invalid, 503 integrity/provider |
| `GET /v1/geo/india/catalogue/:version/*` | Local-mode only, explicitly allowlisted static test assets | 404 in CDN mode |

Manual `geonameId` is a decimal canonical string. GPS fix is UTC ISO and must be ≤120 seconds old, ≤30 seconds in future, `accuracyMeters` finite and ≤10,000. All save writes verify an active self-declared adult account and conditional settings revision. A successful write is not permission to publish a person's profile.

`POST /v1/profiles/me/:mode/activate` and `/deactivate` (existing P02 owner routes) now manage **private P03-3 anchors** in DynamoDB transactions. Both continue to return `discoveryEligible:false`, and no raw H3/pointer is returned. Existing owner setup, handle, mode draft, photo assignment and private geo writes invalidate relevant anchors atomically; details in [05](05_POINTER_LIFECYCLE_AND_SAFETY.md).

## Authenticated P03-4 discovery (new candidate; Windows validation pending)

`GET /v1/discovery/people?mode=dating|friendship&pageSize=1..12&cursor=<opaque>` is registered under the **existing P01/P01-3 verified session guard**. `pageSize` defaults to 8. No other client filter, cell, UID, coordinates, radius, `sortMode` or target identity is accepted. Invalid query: 400; no session: 401; ineligible viewer: 403; expired/cross-viewer/cross-mode/cross-version cursor: 409; canonical DB failure: 503. Always `Cache-Control: private, no-store`.

Response: `{ mode, distanceBand, sortMode, ordering:'page_local_only', items, nextCursor }`. Each `items[]` is **strictly** `{ handle, displayName, age, broadArea, bio, intention, interests, photoCount, distanceBand }`. No uid, H3, GPS fix, precise location, internal media IDs/URLs or pointer timestamps. The count verifies READY assigned media; actual authenticated preview media serving is **deferred to P03-5** and must not reuse the owner-only media route. Third-party `/v1/profiles/:mode/:handle/preview` remains 404 (no arbitrary handle enumeration).

Candidate hydration uses a bounded partition scanner (≤6 Queries, ≤72 pointer reads, ≤12 candidate proofs) and at most 12 **TransactGet** consistent candidate snapshots (up to 20 strongly read items each, including media and blocks; measure costs before production) of both accounts/settings/modes, both directional block edges and assigned READY media. It verifies each mode was explicitly activated, canonical pointer PK/SK/revisions match, selected mode/active-adult account and all READY photos remain valid, both users opted in, no known opt-out, and candidate R6 centroid is within **both users' exact selected distance bands** (reciprocal radius privacy). Stale/orphan/restricted/blocked candidates disappear; an unauthorized pointer is never directly returned. Strong snapshots protect each candidate, but no separate cross-request global consistency promise is made.

`sortMode` is owner-selected, not supplied by HTTP; `near_band_first` traverses the nearest partition centers first and `recent_first` sorts **only the hydrated page**. Neither is a global nearest/recent leaderboard. Query may yield an empty `items` with a nonnull cursor while traversing sparse partitions. Client must not auto-widen the radius; P03-5 UI may allow explicit continuation. Cursor context also binds the viewer's current active mode version, settings/locality revisions and mode; 10-minute expiry.

**Release status:** This endpoint is a new P03-4 implementation candidate, not owner-approved yet. Prove the real local transaction test, full inherited regressions and unauthorized HTTP behavior before accepting it; external AWS tests require fresh approval.

## Internal modules and private facilities

| Module | Server-only purpose |
| --- | --- |
| `discovery/contracts.ts` | Valid H3 R6 pointer, modes/bands, partition keys, hard query caps |
| `coverage.ts` | Conservative R6 circle cover, exact geodesic distance bands |
| `settings-snapshot.ts` | Strong owner-only settings read, never trust client coordinates |
| `pointer-reader.ts` | Bounded consistent partition `Query`; returns **unverified pointers internally** |
| `cursor.ts` | Context-authenticated AES-256-GCM continuation, 10-minute expiry |
| `hydration-policy.ts` / `hydration-service.ts` / `request-policy.ts` / `routes.ts` | P03-4 viewer/candidate transactional re-read, block/media proof, strict query + preview allowlist, session guard |
| `pointer-lifecycle-policy.ts` | Canonical pointer anchor validation, conditional deletion/update/activation barriers |
| `reconcile-restricted-pointers.ts` | Internal bounded repair of known anchors **after** an existing restriction; not a route, no Scan |
| `restrict-account-pointers.ts` | NEW trusted staff-only transaction to restrict active account, deactivate both modes, revoke pointers and create immutable safety audit; **requires external staff authorization and real-DDB acceptance** |

The new trusted restriction function is not registered with Fastify or reachable from Flutter. Its `staffUid` must come from a separately verified privileged principal, and its reason/decision must be authorized independently; a TypeScript call alone is **not** staff authentication. Deletion/appeal/restore endpoints are not implemented here. Both owner and moderator transitions must fail closed under concurrent revision conflicts.

**Still nonexistent interfaces:** arbitrary third-party handle-preview (404), public unauthenticated people listings, Flutter people cards (P03-5), Local Feed/Activities post endpoints and block-admin API. P03-3 owner DTOs intentionally retain `discoveryEligible:false` for backward compatibility; P03-4 is a separately authorized list capability, never permission to expose a raw pointer.

## API diagnostics and tests

A typical fixed error envelope is `{ "error": "fixed_error_code" }`. Use actual handler response codes as source of truth. Log only safe template/status/timing information; private token, UID, H3 and raw fix values are excluded. Tests: `npm run test:p03-1:acceptance:api`, `npm run test:p03-1:acceptance:db`, `npm run test:p03-2:integration`, `npm run test:p03-3:integration`, `npm run test:p03-3:repair:integration`, and the new trusted restriction integration via [04](04_ACCEPTANCE_AND_RELEASE_GATES.md).
