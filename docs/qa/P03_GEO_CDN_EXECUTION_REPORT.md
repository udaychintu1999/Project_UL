# P03 India GeoNames ONE-BUCKET CDN source and dataset verification — 2026-11-17

## Fixed scope and owner constraints

- Source baseline: attached `Project_UL-master(2).zip` (accepted P02-5; P03-1/Gate-5 **not present** in this ZIP).
- One owner-managed S3 bucket with existing CloudFront OAC distribution. **NO AWS calls or resource changes performed by builder.** AWS Console upload is an owner action.
- All 1,058 public-source GeoNames JSON objects stored in S3; NO data files in code repository or Flutter APK; server canonical index is fetched from the same CDN but pinned/verified before authorizing a place.
- No user data is published, no new DynamoDB tables, no PIN-to-coordinate inference, GPS stays disabled pending licensed India boundary dataset.

## Actual results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Full GeoNames data in one S3 ZIP | PASS | 1,058 `geo/india/v1/*.json` objects (nested paths); 798 location packs; 256 server shards; manifest, canonical manifest, attribution and build report |
| Record and index reconciliation | PASS | Independent ZIP verifier found 549,046 distinct populated-place IDs in both public packs and canonical index shards |
| SHA-256 pin verification | PASS | `server-index-manifest.json`: `8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa`; public manifest: `97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887` |
| Reproducible exporter | PASS | Two independent ZIP generation paths produced exact same SHA `9cdd471b8c8476f38f3899de1bb344754697ccda3afaa7e7e0ae8b9c92b9a1e7` |
| Full extracted real-data reader | PASS | `IndiaCatalogue.open` using external local complete JSON tree and trusted hash read version, states, and 3 real place IDs: Teghra (1254813), Warangal (1252948), Vijayawada (1253184) |
| Canonical hash mismatch rejection | PASS | Independent trusted SHA mismatch failed closed before lookup |
| Canonical-index test cases | PASS | 5 cases on TS-transpiled Node modules: valid resolution, tampered canonical manifest, swapped public manifest, corrupted shard, concurrent shard fetch deduplication |
| Cloud config, URL/path and strict manual validation | PASS | 9 Node 22 strip-types tests (including original P03-1B/1C payload/unit cases separately) |
| New source security contracts | PASS | 4 Node tests; no bundled Geo JSON, no AWS SDK, CloudFront requests without token |
| Frozen inherited P02-5 portable regression | PASS | `npm run verify:p02-5:portable` completed after moving canonical test out of inherited unit glob |
| GeoNames Python full catalogue and PIN importer tests | PASS | Python test scripts run against existing external source catalogue (see execution notes) |
| Full `npm run typecheck`, npm dependency install, npm lint | UNVERIFIED | Original workspace Node dependencies unavailable in builder; system global TypeScript emitted/transpiled but lacked @types/node / project modules. Do not treat this as typecheck PASS |
| Flutter analyzer, widgets, Android USB | UNVERIFIED | Flutter SDK/physical device not available in builder |
| AWS S3 upload, CloudFront origin policy and live DNS | UNVERIFIED | Owner created infrastructure; builder performed no AWS operations or remote traffic |
| Authenticated Fastify + DynamoDB Local manual Save | UNVERIFIED | Requires owner to start Java DynamoDB Local and run the latest working repo |
| India PIN lookup with actual India Post data | UNVERIFIED / DATA MISSING | Source foundation included, but government postal CSV not supplied |
| One-time GPS India boundary validation | BLOCKED BY DESIGN | No approved boundary polygon supplied; GPS endpoint fails closed |

## Windows commands for owner acceptance

At project root:

```powershell
npm install
Push-Location apps/flutter_app
flutter pub get
Pop-Location
npm run test:p03:cloud-config
npm run test:p03:cloud-contracts
npm run verify:p02-5:portable
npm run typecheck
npm run lint
npm run test:flutter
```

From the project root, with the downloaded data ZIP at the real chosen file location:

```powershell
python scripts/geo/verify_onebucket_release.py --zip "C:\Downloads\Uluv_India_Geo_All_JSON_S3_One_Bucket.zip" --expected-canonical-sha 8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
```

Then start DynamoDB Local manually, start the API, run Flutter on Android USB, verify `/v1/geo/india/delivery`, manual location Save/Reload and offline cached search. Confirm CloudFront manifest, canonical manifest, shard and district URLs in browser through the AWS owner-created distribution. Mark each step PASS/FAIL with real logs; nothing here asserts owner acceptance or full P03 completion.
