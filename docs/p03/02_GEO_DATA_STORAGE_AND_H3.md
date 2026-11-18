# 02 — P03-1 geo data, GPS, private storage and P03-2 H3

## Geographic reference-data lifecycle

1. **Build/deploy input:** immutable GeoNames-derived India JSON release with public State/District/Place packs and separate canonical lookup shards; source licensing and CC BY attribution retained. The server independently pins the canonical manifest SHA-256 and explicit `ULUV_GEO_PUBLIC_BASE_URL` through its private environment. Never use a newly retrieved manifest's hash as its own authority.
2. **Public distribution:** the owner's approved single DEV S3 bucket and CloudFront OAC serve `geo/india/v1/` immutable static files. They are *reference data*, not account data. Public CDN GETs carry no user JWT. P17 may replace deployment infrastructure without changing the typed manifest/pinned-hash interface.
3. **App bootstrap:** Flutter has a ~175 KB checksum-pinned State/District index (`apps/flutter_app/assets/geo/india-manifest.json`) so choices can render without a CDN. The app obtains signed-off delivery metadata from authenticated Fastify; it loads only selected district packs, verifies byte length/SHA-256 (`sha256` field in the pack metadata) and schema before atomic private cache activation.
4. **Failure recovery:** on CDN timeout/403/bad SHA, the app requests the *same* verified pack from authenticated Fastify `/v1/geo/india/packs/:state/:district`. A cached old pack may support reading/search, but an older unapproved release must not enable an untrusted new save.
5. **Private selection:** manual save sends GeoNames IDs/version/provenance and the owner's expected `settingsRevision` to Fastify. The server resolves the canonical place, checks account adult/active status and 15-second cooldown, computes H3, and commits a conditional transaction into the owner's `uluv_settings` row. Reference JSON never becomes user profile data.
6. **GPS:** one explicit device capture goes only to Fastify over authenticated API. A bundled, SHA-pinned India MultiPolygon is loaded by the API for boundary checks. Fastify derives a resolution-6 cell; only its approximate cell center and source are saved, never the raw fix/timestamp. GPS does not depend on S3, CloudFront or a third-party geocoder.

**Existing storage:** `uluv_settings` key `PK=USER#<uid>, SK=SETTINGS` holds `geoH3Cell`, `geoApprovedCenter`, `geoSelectionSource`, `geoSelectionLabel`, `settingsRevision`, `localityRevision`, selected distance band/sort and manual provenance fields when applicable. `uluv_users` is consulted transactionally for write eligibility. No new table was introduced for P03-1/P03-2.

## P03-2 private query foundation

- `uluv_discovery` contains *potential* index projections keyed `DISC#DATING#R6#<cell>` or `DISC#FRIENDSHIP#R6#<cell>`, with SK starting `JOIN#`. P03-2 defined the pointer shape and private reader without publishing. The later P03-3 candidate now writes *private* pointers on explicit activation, but has no public reader and is not accepted.
- `h3-js` R6 centers drive conservative cell coverage. Allowed bands are `[0,10]`, `(10,35]`, `(35,50]` and combined `0–50` km, approximate great-circle distance between approved cell centers (not road distance). Exact distance classification happens after broad H3 coverage; no radius widening.
- Caps: **6** DynamoDB Query calls/page, **72** raw items/page, **12** items/query, **24** internal pointers/page, **1,600** planned H3 cells; no table Scan. A page may legitimately contain zero pointers and a continuation cursor.
- AES-256-GCM cursor, ~10-minute expiration, bound to owner UID, mode, location H3, distance selection, locality/settings revisions and page size. Reject tampering and cross-owner/stale replay. The cursor secret belongs only on the backend.
- P03-2 returns **internal unverified pointers**, never a Flutter/public DTO. P03-3 now has an **unaccepted private pointer publication/invalidation candidate** on owner activation/profile/media/setup/identity/locality routes. Moderation/account deletion hooks and mutual-block reader policy are not complete. P03-4 must still implement canonical eligibility, account age/status, privacy/block/media/mode and revision checks before anyone becomes publicly discoverable.

## Data-flow diagram

```text
GeoNames public release (approved immutable version)
         → private S3 source → CloudFront public JSON
                                      ↓ (no JWT)
Flutter bundled State/District index → selected verified district cache
                                      ↓ selected place ID/version only
Authenticated Fastify → canonical index SHA verification → conditional DynamoDB write
                                      ↓
                        uluv_settings private H3 R6 locality
                                      ↓ server-only
                    P03-2 bounded H3 Query planner / encrypted cursor
                                      ↓
                    UNVERIFIED internal pointers — private P03-3 writes only
```

DynamoDB Local remains the P00–P16 test backend; do not run owner tests against AWS. P17 is where production DynamoDB/data migration is to be separately planned. See detailed [`../architecture/P03_GEO_CDN_DATA_SEPARATION.md`](../architecture/P03_GEO_CDN_DATA_SEPARATION.md) and [`../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`](../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md) for data schemas and edge cases.
