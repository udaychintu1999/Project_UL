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

## Internal modules, never public routes

| Module | Server-only purpose |
| --- | --- |
| `discovery/contracts.ts` | Valid H3 R6 pointer, modes/bands, partition keys, hard query caps |
| `coverage.ts` | Conservative R6 circle cover, exact geodesic distance bands |
| `settings-snapshot.ts` | Strong owner-only settings read, never trust client coordinates |
| `pointer-reader.ts` | Bounded consistent partition `Query`; returns **unverified pointers internally** |
| `cursor.ts` | Context-authenticated AES-256-GCM continuation, 10-minute expiry |
| `pointer-lifecycle-policy.ts` | Canonical pointer anchor validation, conditional deletion/update/activation barriers |
| `reconcile-restricted-pointers.ts` | Internal bounded repair of known anchors **after** an existing restriction; not a route, no Scan |
| `restrict-account-pointers.ts` | NEW trusted staff-only transaction to restrict active account, deactivate both modes, revoke pointers and create immutable safety audit; **requires external staff authorization and real-DDB acceptance** |

The new trusted restriction function is not registered with Fastify or reachable from Flutter. Its `staffUid` must come from a separately verified privileged principal, and its reason/decision must be authorized independently; a TypeScript call alone is **not** staff authentication. Deletion/appeal/restore endpoints are not implemented here. Both owner and moderator transitions must fail closed under concurrent revision conflicts.

**Nonexistent public interfaces:** `/v1/discovery/people`, public `/v1/discovery/*` hydration, public third-party preview (returns 404), public listing/people cards, Local Feed and Activities post endpoints, and any block-admin API. Do not invent success responses or silently set `discoveryEligible:true` before P03-4 authorization is proven.

## API diagnostics and tests

A typical fixed error envelope is `{ "error": "fixed_error_code" }`. Use actual handler response codes as source of truth. Log only safe template/status/timing information; private token, UID, H3 and raw fix values are excluded. Tests: `npm run test:p03-1:acceptance:api`, `npm run test:p03-1:acceptance:db`, `npm run test:p03-2:integration`, `npm run test:p03-3:integration`, `npm run test:p03-3:repair:integration`, and the new trusted restriction integration via [04](04_ACCEPTANCE_AND_RELEASE_GATES.md).
