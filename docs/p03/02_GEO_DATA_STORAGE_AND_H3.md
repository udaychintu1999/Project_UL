# 02 — GeoNames, GPS, private locality and H3 R6

## Authority and source boundaries

- **Public reference data:** immutable GeoNames-derived India release `IN-52fd741e8c61b53a` under `geo/india/v1/` in an owner-managed private S3 bucket with Block Public Access and CloudFront Origin Access Control (OAC). GeoNames CC BY 4.0 attribution stays with the release. It contains published place names and approximate GeoNames coordinates, never accounts, media, owner H3 centers or login credentials.
- **Release layout:** 1,058 public-source JSON objects: 798 district/unmapped packs, 256 `server/00.json`–`server/ff.json` canonical lookup shards, and public `manifest.json`, trusted `server-index-manifest.json`, attribution and build report. The public manifest does not disclose `serverIndex`; canonical metadata is independently SHA-pinned by Fastify. Source `IN.txt` and the compiled JSON packs are **not** bundled in Git; Flutter bundles only a small verified State/District index.
- **Trusted canonical SHA-256 (v1):** `8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa`. **Public-manifest SHA-256:** `97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887`. The downloaded manifest MUST NOT supply its own trust anchor.
- **API configuration:** the owner configures private `ULUV_GEO_PUBLIC_BASE_URL=https://<approved-cloudfront-host>/geo/india/v1/` together with `ULUV_GEO_CANONICAL_MANIFEST_SHA256`. No bearer token, S3 credentials or private user settings are sent to CloudFront. Do not include real host/secrets in committed docs.
- **Offline/local provider:** for DEV only, set `ULUV_GEO_PUBLIC_LOCAL_DIR` to an external absolute folder holding the same full immutable release, omit `ULUV_GEO_PUBLIC_BASE_URL`, and retain the same SHA pin. Obsolete `ULUV_GEO_PRIVATE_DIR` must not be used.

## Owner-only CloudFront Console setup (manual; not an automated AWS task)

1. Use the **existing** approved GeoNames S3 bucket and CloudFront distribution. Extract the separate GeoNames data archive, upload its `geo/` folder at the **bucket root**, and verify exact keys such as `geo/india/v1/manifest.json`, `server-index-manifest.json`, `server/00.json`, `states/40/districts/686.json`. Avoid `geo/geo/...` path duplication and do not upload the ZIP or project source.
2. Confirm **1,058 JSON objects**, S3 Block Public Access, CloudFront OAC `Sign requests`, matching S3 SourceArn read policy, no duplicate CloudFront Origin path, HTTPS and JSON content type. No public S3 ACL is required. Do not create a second bucket or use the AWS CLI without separate authorization.
3. In an ordinary browser, inspect the approved CloudFront URLs for public manifest, canonical manifest and one shard/pack. Expect valid JSON; a 403 may indicate OAC/policy and 404 an incorrect key. Do not remove privacy settings to repair them.
4. Change immutable release versions using **new prefixes**, verify every object first, then change trusted SHA **and** URL together. Roll back using the previous pair. Existing checksum-verified Flutter caches remain readable. Console invalidations may incur cost; owner must decide.

## Client → Fastify → private storage

1. Flutter's checksum-pinned ~175 KB State/District index shows 36 State/UT labels offline. An explicit district choice downloads only the selected pack, validates the `sha256` / SHA-256 digest, byte length and schema, and atomically replaces the local cache. No automatic 798-pack download. Failover: authenticated `GET /v1/geo/india/packs/:state/:district` returns independently verified bytes after CDN failure; stale packs may be viewed but do not authorize a fresh unverified Save.
2. Manual Save supplies GeoNames `geonameId`, release version, administrative provenance and `expectedRevision`, **not client coordinates**. Fastify resolves an independently pinned canonical lookup shard (bounded in-memory cache), validates membership, computes H3 R6 and commits a conditional private `uluv_settings` update. Concurrent edits give 409; a 15-second server cooldown gives 429; unavailable/tampered source fails closed.
3. GPS is **single-shot and user-triggered**. Permission denial, stale/future/inaccurate fixes and out-of-India points are rejected or offer manual fallback. Fastify validates against bundled SHA-pinned `apps/api/assets/geo/india-boundary.geojson` India boundary MultiPolygon (mainland, islands), and stores only server-derived H3 R6 cell/approved center/label/source. Raw latitude/longitude and the phone's GPS fix are never persisted. Coordinates can be spoofed; polygon containment is not proof of physical presence.
4. `uluv_settings` key `USER#uid / SETTINGS` holds private `geoH3Cell`, `geoApprovedCenter`, `geoSelectionSource`, `geoSelectionLabel`, `settingsRevision`, `localityRevision`, selected distance band/sort and manual provenance when applicable. `uluv_users` account/age eligibility is transaction-checked. A location change revokes existing P03-3 private pointers for both modes; an explicit new activation is needed to publish a new pointer.

## Internal H3 query and cursor contract

- `uluv_discovery` partition `DISC#DATING#R6#<h3-cell>` or `DISC#FRIENDSHIP#R6#<h3-cell>`, sort key `JOIN#<ISO-date>#<uid>`. Index entries are **unverified internal projections**, not authorization or a response DTO.
- Owner-selected bands: `[0,10]`, `(10,35]`, `(35,50]` km; All `0–50` is staged near-band-first. Exact great-circle distance between **approved approximate centers** follows conservative H3 covering. Never auto-widen beyond 50 km or claim globally closest ordering over unread cells.
- Hard per-request ceilings: **six strongly consistent partition Query calls**, **72 raw index items**, **12 per Query**, **24 internal unverified pointers**, **1,600 cover cells**. Never Scan the entire table or accept arbitrary client partition, resolution or search center.
- AES-256-GCM progress cursor expires after **10 minutes**; binds authenticated viewer UID, mode, selected approved cell/source, band, page size and `settingsRevision`/`localityRevision`. Reject tampering, replay in another context and expired/malformed tokens. Secrets are injected server-side only.
- Future P03-4 public hydration must independently verify candidate canonical account/status/age, mode requestedActive/selection/revisions, READY media, privacy and **both directions** of blocks, plus current approved center/radius; pointer presence alone never authorizes visibility.

## Diagnostics, migration and deferred postal PIN

The local Fastify terminal logs bounded route templates/request IDs/SHA stage and safe outcome categories, **never** GPS fixes, bearer headers, unredacted user IDs or request bodies. A CDN outage must not erase account location. P17 may replace physical media/CDN/data-store deployment via the same typed manifest + hash provider boundary without changing location semantics; DynamoDB Local remains the default through P16.

**India postal PIN search is ON HOLD.** GeoNames contains no postal-to-office authority. Any PIN importer must use separately licensed/verified Department of Posts India directory, handle six-digit PIN and multiple offices, and NEVER fabricate a PIN → exact GPS center or bypass the GeoNames manual save policy. No PIN search UI should be turned on until this dataset has been approved and tested.
