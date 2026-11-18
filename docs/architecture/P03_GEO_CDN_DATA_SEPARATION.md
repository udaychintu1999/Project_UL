> **Decision record, not current instructions.** For active operations use [P03 geo-storage guide](../p03/02_GEO_DATA_STORAGE_AND_H3.md) and [../P03_READ_ME_FIRST.md](../P03_READ_ME_FIRST.md). The one-S3-bucket GeoNames decision remains active; subsequent one-time GPS work superseded the GPS-disabled statement in this older note.

# U_luv P03 — ONE S3 bucket / CloudFront GeoNames catalogue, canonical Fastify authority

## Accepted owner decision (2026-11-17)

All **public-source** GeoNames JSON, including the 256 server lookup shards, lives in the **same private S3 bucket** and is read through the existing **CloudFront OAC distribution**. The `server/` JSON contains published GeoNames identifiers, approximate gazetteer coordinates, names and GeoNames-native administrative codes—not account or user data. It is therefore publishable as GeoNames-derived CC BY 4.0 data. **Public availability is not authorization**; Fastify must cryptographically verify what it reads before using it to authorize a private location selection.

No raw `IN.txt`, district packs or canonical index shards reside in the Git repository or Flutter application. The data release ZIP is a transport archive for AWS Console upload; **upload its extracted `.json` objects, not the ZIP itself.** No S3 SDK, AWS access keys or deployment automation are needed in this application.

## Source-of-truth and data layout

```
S3 bucket (Block Public Access ON; CloudFront OAC read-only)
  geo/india/v1/
    manifest.json                    # Flutter-public, no shard metadata
    server-index-manifest.json       # full canonical meta; SHA independently PINNED in Fastify config
    attribution.json                # GeoNames CC BY 4.0
    build-report.json               # no user data
    country-unmapped.json
    states/<GeoNames-state-code>/districts/<GeoNames-district-code>.json
    states/<GeoNames-state-code>/unmapped.json
    server/00.json ... server/ff.json    # 256 canonical lookup shards
```

The release uses **1,058 JSON objects**: 798 state/district/unmapped packs, 256 canonical shards and four other JSONs (public manifest, canonical manifest, attribution, build report). The original full `manifest.json` from the importer is renamed `server-index-manifest.json` by the exporter. The new `manifest.json` is its exact public projection without `serverIndex`.

Version: `IN-52fd741e8c61b53a`.

- Trusted canonical manifest SHA-256: `8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa`.
- Public manifest SHA-256: `97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887`.

**Do not derive the trusted SHA from the remote JSON itself.** Deployment configuration must independently pin the expected canonical bytes. A successful download from CloudFront is not sufficient for backend authority.

## Trust flow

1. Flutter authenticates with Fastify and calls `GET /v1/geo/india/delivery`.
2. Fastify lazily loads `server-index-manifest.json` from its configured CloudFront base URL and checks its bytes against `ULUV_GEO_CANONICAL_MANIFEST_SHA256`. It then fetches `manifest.json`, verifies its JSON structure matches the trusted canonical projection and returns the **SHA-256 of the actual public manifest bytes** plus the CDN root URL to Flutter.
3. Flutter fetches only the public manifest and selected district JSON directly from CloudFront, without sending API bearer tokens. It verifies SHA-256 and schema; valid older offline cache is retained until replacement succeeds atomically. State/district search and cache keys are provider independent.
4. On confirmed manual Save, Flutter sends the ID, source catalogue version, codes and expected revision to authenticated Fastify. No client-chosen coordinates are accepted.
5. Fastify fetches the correct `server/<id modulo 256>.json` on a cache miss, checks its SHA-256 and exact byte length from the pinned canonical manifest, validates the record, computes H3 resolution 6 privately and performs a conditional DynamoDB settings update. It keeps up to 64 validated shards in memory and deduplicates concurrent downloads.
6. Owner-only settings may include private H3 cell and center; **no user settings, H3 location, login token, photo or account metadata are published to S3**. CloudFront never decides whether a user may save a location.

Only the first valid shard cache miss hits CloudFront for that shard; subsequent location operations reuse the checked in-process shard, subject to the bounded cache. No S3 API calls occur from the application.

## Configuration

For CDN mode, in the owner's **private API runtime environment**:

```
ULUV_GEO_PUBLIC_BASE_URL=https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/
ULUV_GEO_CANONICAL_MANIFEST_SHA256=8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
```

For offline Windows DEV without AWS, omit `ULUV_GEO_PUBLIC_BASE_URL` and instead set `ULUV_GEO_PUBLIC_LOCAL_DIR` to an absolute **external folder** holding the *same exported complete release* (including `manifest.json`, `server-index-manifest.json`, `states/`, and `server/`). The canonical SHA pin remains mandatory. `ULUV_GEO_PRIVATE_DIR` is removed; no separate index folder is needed. Do not put external geographic files under the project root or commit them.

## Integrity, unavailability, migration

- CloudFront requests enforce HTTPS, configured origin, fixed relative paths, no auth credentials, no redirects, 12-second deadline and decompressed byte ceilings. Invalid/changed assets **fail closed**, returning 503 from Fastify rather than accepting a forged place. Clients get retry messages; manual search can still use previously validated offline packs, but offline selection is not a confirmed server save.
- Immutable version prefixes keep CDN caching safe. Never overwrite `geo/india/v1/` with a different dataset. Generate `v2/` or a new unused prefix, upload and verify **all** JSON objects, set the new trusted canonical SHA and base URL together, then switch the application. Roll back by restoring the previous **pair** (URL + expected SHA); Flutter retains checksum-identical older cached packs.
- CORS may need explicit CloudFront response-headers configuration if supporting web clients later. Native Flutter Android does not require browser CORS. S3 stays private behind CloudFront OAC; CloudFront GET/HEAD access is public to the **GeoNames data only**.
- Never expose private settings through static JSON, logs or CDN. Neither a PIN code nor GeoNames name proves a person's residence. India GPS country verification now uses the reviewed, locally bundled `apps/api/assets/geo/india-boundary.geojson`, loaded once per Fastify process. The GPS endpoint remains restricted to one-shot, fresh, accurate user-triggered fixes; no boundary file is fetched from S3 on each request.
- PIN search is a separate P03-1C importer and API; no official postal CSV was supplied, so real PIN lookup is fail-closed until imported.

## Baseline note

Integration was prepared against the owner's attached `Project_UL-master(2).zip`, which contains accepted **P02-5** but not the separately implemented P03-1/Gate-5 branch. This update ZIP is **all changed code relative to the provided source**; do not blindly replace a newer local P03-1 branch. These were the original release gates; newer owner-reported UI acceptance is tracked separately from this historical CDN decision. The current P03 navigation/Settings correction still needs its full Windows/Android gate. P03-wide discovery remains disabled.
