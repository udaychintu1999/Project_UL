# P03-2 — Internal H3 discovery interfaces (NOT HTTP API)

P03-2 does **not** add a public REST endpoint. Existing P03-1 routes (`/v1/me/geo/manual`, `/v1/me/geo/gps`, `/v1/me/geo/location`, `/v1/me/settings`, `/v1/geo/india/*`) remain unchanged, as do P01 sessions and P02 profile routes.

## Backend-only modules

| Interface | Input | Output | Guard |
|---|---|---|---|
| `readTrustedLocality(db, uid)` | Authenticated server-side UID | Private H3 R6 center, selected band, source, settings/locality revisions | Consistent `uluv_settings` GetItem; rejects missing/invalid setting |
| `conservativeCellCover(center, radiusKm)` | Trusted center + fixed radius 10,35,50 | Sorted unique intersecting R6 cells | Geodesic circle + overlapping H3 fill; max 1,600 cells |
| `planBandCovers(center, band)` | Trusted center + `0-10` / `10-35` / `35-50` / `0-50` | Staged band-specific covers | Exact final distance filter still required |
| `discoveryPartition(mode, cell)` | DATING/FRIENDSHIP + R6 cell | `DISC#MODE#R6#cell` | Mode/shape validation; caller must use `isR6Cell` first |
| `buildPointer(...)` | Trusted canonical publication inputs | DynamoDB projection shape | Shape/revision validation only; **does not write** |
| `dynamoPointerQuery(db)` | PK, optional LEK, bounded limit | Raw pointer page | Existing `uluv_discovery` table, Query only, consistent reads, no Scan |
| `scanPointerPage(query, params, covers?)` | Server-authenticated UID/mode, trusted locality, bounded page size, optional token | **Internal unverified pointers**, opaque continuation, work counters | AES-GCM cursor, exact distance filter; **never serialize raw result to Flutter** |
| `encodeCursor` / `decodeCursor` | Internal state/context and dedicated secret | Authenticated opaque token / validated resume state | UID, mode, selected band, R6 cell, settings/locality revision, TTL bound |

`max pageSize = 24`, `max Query = 6`, `max raw items = 72`, `per Query Limit <= 12`, `cursor TTL = 10 minutes`. A continuation token is normal even when no eligible pointer is found because the per-request work budget is finite.

## Reserved future public API

No `/v1/discovery/*` route is registered in P03-2. P03-3/4 will specify routes, error-code mapping, authenticated preview projection, opt-in/eligibility, blocks, pagination and idempotency before enabling results. The `unverifiedPointers` type must never become a client DTO.

## Local database contract

Exact keys: `uluv_discovery` `PK=DISC#DATING#R6#<h3>` or `DISC#FRIENDSHIP#R6#<h3>`, `SK=JOIN#<ISO-UTC-millis>#<uid>`; no new GSIs or tables. Synthetic fixture tests do not call AWS. Local bootstrap must have created the 18 documented tables.
