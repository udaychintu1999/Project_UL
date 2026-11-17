# P03-2 — H3 R6 private geographic discovery infrastructure

**Implementation scope:** Backend infrastructure only. This is **not** a public discovery release. No new user-facing discovery endpoint, no profile publication, no Flutter discovery UI, no new DynamoDB table, no Scan, no production AWS actions. P03-1 manual place selection, one-time GPS, saved locality and five-tab shell are preserved.

**Authoritative source:** latest owner-uploaded `Project_UL-master(3).zip` and the P03 spec in `docs/implementation/phases/P03.md`. This document supplements `03_H3_GEO_DISCOVERY.md` and `P03_GEO_LOCATION_COMPLETE_HANDBOOK.md` without rewriting P01/P02 contracts.

## Data ownership and trust

| Source | Contents | Trust / responsibility |
|---|---|---|
| `uluv_settings`, `USER#uid / SETTINGS` | `geoApprovedCenter` (H3 R6 center, not raw GPS), `geoH3Cell`, `geoSelectionSource`, `localityRevision`, `settingsRevision`, selected `geoDistanceBand` | **Private authoritative selection.** Consistent GetItem for authenticated viewer; never accept a client-chosen query center/cell. Existing P03-1 writes only. |
| `uluv_discovery`, `DISC#DATING#R6#cell` or `DISC#FRIENDSHIP#R6#cell / JOIN#<UTC ISO>#uid` | Pointer: `uid`, `mode`, `homeCell`, `localityRevision`, `profileVersion` | **Untrusted index projection.** Canonical profile/user/blocks still required. P03-2 only defines and reads pointers; **no automatic publishing**. |
| `uluv_profiles`, `uluv_users`, `uluv_blocks` | Canonical eligibility, mode visibility, account status, blocked pairs | **Not yet wired for external discovery.** These checks are mandatory before a future P03-3/4 API exposes any candidate. |
| S3 + CloudFront GeoNames JSON | India reference catalogue and canonical index | Used by P03-1 place validation; **not used for discovery query execution**. |
| Bundled Fastify `india-boundary.geojson` | India national boundary | Used by P03-1 one-shot GPS validation; loaded into API memory. |

## Region and distance accuracy

- All grid identifiers must be actual `h3-js` **resolution 6** cells; arbitrary hex strings are rejected.
- Every approximate center must equal the actual R6 cell center within a small floating-point tolerance; no raw phone fix or user-submitted arbitrary query center is trusted.
- Distance is computed with the haversine formula using a spherical mean Earth radius of 6371.0088 km, between approved R6 centers. This is an **approximate geographic distance** and can differ from actual travel distance or the user's actual position.
- Exact inclusive boundaries: `[0, 10]`, `(10, 35]`, `(35, 50]` km; `All 0–50` stages those bands. The server does not widen a user's selected radius.
- Conservative candidate-cell cover uses `h3-js` `polygonToCellsExperimental(..., containmentOverlapping, isGeoJson=true)` around a 96-point geodesic circle with 250 m outward *query coverage only*. It includes overlap cells that center-only polyfill would miss. **The 250 m does not widen final visibility**; each candidate must pass exact approved-center distance classification and later canonical eligibility.
- H3 R6 is a planning approximation. False positives are filtered after query. Sampling tests for center, ring edges, islands, border and dense-city centers are included. Any unverified geometry library/runtime is marked unverified in QA.

## Work budget and query safety

- Max **6** DynamoDB Query calls per page; max **72** raw items read; max **12** items from a single partition query; max internal output **24** pointers; max **1,600** R6 cells in one planned radius cover. Exceeding cover budget **fails closed**.
- Each Query uses `PK = :pk AND begins_with(SK, 'JOIN#')`, `ConsistentRead=true`, `ScanIndexForward=false`, with an explicit Limit and only `uluv_discovery` table. No Scan or unbounded all-cell fanout.
- Multi-cell traversal stores band index, cell index and **one** `LastEvaluatedKey` in the encrypted cursor. An empty page with a continuation cursor is valid when the bounded work budget is consumed scanning empty/filtered partitions. This must be reflected in future UI rather than incorrectly promising globally exhaustive results.
- Rows from this step are `unverifiedPointers` internal to Fastify. **Never return them directly to Flutter**. P03-3/4 must independently check canonical profile visibility, account active/adult state, mutual blocks, applicable preference/mode filters, precise approved-center distance and pointer revision/cell match. No population of the index implies eligibility by itself.
- Within one processed page, pointer results can be sorted by approximate distance + stable ID. This is **not** globally nearest-first across unvisited partitions, and P03-3/4 must not claim it is.

## Cursor safety

- AES-256-GCM authenticated encryption using a dedicated server-owned high-entropy secret supplied explicitly to a future private handler (never logged, never in app or S3).
- 10-minute TTL; maximum encoded data ~3 KiB; stale/altered/expired or cross-user tokens fail closed.
- Encrypted context is bound to viewer UID, discovery mode, selected distance band, R6 cell and coordinates, location source, `localityRevision`, `settingsRevision`, and page size. Any location or settings update invalidates a prior cursor.
- One authoritative read of settings is needed before querying. Do not let a client choose arbitrary partition keys or radius >50 km.

## What is NOT implemented in P03-2

1. **No publication lifecycle**: atomic create/delete/move pointers on profile active/pause, photo eligibility, moderation, account block, change of place, consent, or account deletion belongs to P03-3. Publishing now would expose users before the privacy contracts are complete.
2. **No public query route or Flutter results**: canonical hydration, block/privacy filtering, projection and UI belong to P03-3/4/5.
3. **No Local Feed posts or Activities publication**: later Local phases, with separate canonical tables and proper end-of-life handling.
4. **No new S3, CloudFront, payments, production DB, additional geo catalogue, new DynamoDB table or live AWS test**.

## Developer map

- `apps/api/src/features/discovery/contracts.ts` — distance and PK/SK canonical construction.
- `coverage.ts` — H3 validated R6 center and conservative circle covers.
- `cursor.ts` — encrypted, bound, short-lived progress cursor.
- `settings-snapshot.ts` — consistent private settings read, context validation.
- `pointer-reader.ts` — bounded internal Query adapter and resumable page traversal.
- `apps/api/tests/discovery/p03-2-foundation.test.ts` — real H3 geometry, boundary, cursor, pointer, pagination tests.
- `apps/api/tests/discovery/p03-2-dynamo-local.test.ts` — synthetic owner-run DynamoDB Local fixture with cleanup.
- `scripts/verify/p03-2-infrastructure-contracts.test.mjs` — offline source/privacy guard.

## Validation and integration handoff

- Portable+regression: `npm run verify:p03-2:portable` (requires npm deps/Node, but no live DB).
- Full owner workstation gate: `npm run verify:p03-2` (real typecheck, lint, GPS API/P03-1 Flutter tests, DynamoDB Local integration).
- DynamoDB integration only: `npm run test:p03-2:integration` with Java DynamoDB Local and owner's private `apps/api/.env` already in place. No agent reads `.env`.
- See `docs/manual/P03_2_WINDOWS_ACCEPTANCE.md` and `docs/qa/P03_2_IMPLEMENTATION_REPORT.md` for exact status and manual checks.

**P03-3 prerequisite:** Implement and prove transactional pointer publication/invalidation and canonical hydration before registering any public discovery endpoint. Keep P02-3 `discoveryEligible:false` unchanged until then.
