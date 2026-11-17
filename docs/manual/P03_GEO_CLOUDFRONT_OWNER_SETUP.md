# U_luv — ONE S3 bucket, all GeoNames JSON: AWS Console + Windows acceptance

**Scope:** AWS Console only for ALL AWS operations. No AWS CLI, no CloudFormation and no agent-side AWS access. Use the existing owner-created S3 bucket + CloudFront OAC distribution. Do not create extra buckets. This guide applies to the code ZIP built from `Project_UL-master(2).zip` (P02-5 baseline), which does not contain the owner's newer P03-1/Gate-5 code.

## 1. Packages and S3 object manifest

- `Uluv_India_Geo_All_JSON_S3_One_Bucket.zip`: **1,058 plain-JSON objects** under `geo/india/v1/`; 798 location/unmapped packs, 256 canonical shards, public `manifest.json`, `server-index-manifest.json`, attribution and build report. **Only this archive's extracted JSON files are uploaded to S3.** Nothing personal or account-linked is inside.
- `Uluv_P03_OneBucket_CDN_Full_Geo_Code_Update.zip`: changed source, Flutter, Fastify, PIN groundwork, importer/exporter, checks and docs. **Never upload to S3; apply to project root after backup and comparison.** It contains no GeoNames data or secrets.

Catalogue version: `IN-52fd741e8c61b53a`.

Canonical `server-index-manifest.json` SHA256: `8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa`.

Public `manifest.json` SHA256: `97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887`.

Zip SHA256: `9cdd471b8c8476f38f3899de1bb344754697ccda3afaa7e7e0ae8b9c92b9a1e7`.

## 2. AWS Console S3 upload, step by step

1. Download the **GeoNames ZIP** above and extract it in Windows File Explorer. Select the outer folder named `geo`. The extracted path should be `geo\india\v1\manifest.json` etc.
2. Open https://console.aws.amazon.com/s3/ and select the EXISTING geographic-data bucket. Under **Objects**, navigate to the **bucket root**. Do **not** enter an existing `geo/` directory before uploading the `geo` folder, or you will create `geo/geo/...`.
3. Click **Upload → Add folder** and choose the extracted **geo** folder. Browser folder-upload behavior may vary; verify the displayed resulting key prefix before confirming. The expected object key is `geo/india/v1/manifest.json`, not `v1/manifest.json` or `geo/geo/india/v1/manifest.json`.
4. The upload should contain **1,058 JSON objects**, all under the `geo/india/v1/` prefix. Choose **Upload**. Do not upload the ZIP itself. Do not select Public Read or modify bucket-level public access.
5. Wait until the S3 upload reports **all successful, zero failed**. If using multiple batches, preserve the exact folder hierarchy; verify the final object count in S3.
6. If you previously uploaded the earlier 800-file public package, the public `manifest.json` and packs here are byte-identical; this new complete upload adds the canonical manifest and `server/` shards. Avoid deleting the previous objects during the upgrade.
7. S3 bucket **Permissions**: keep all four **Block Public Access** settings enabled. Its read policy must permit your CloudFront distribution's OAC principal to fetch `geo/india/v1/*` (or a suitable parent prefix) with a matching `AWS:SourceArn` for this distribution. **No public S3 ACL or bucket policy is required.**
8. CloudFront **Distributions → your distribution → Origins**: verify the intended general-purpose S3 origin, OAC **Sign requests**, and no erroneous Origin path doubling the prefix. Ensure HTTPS viewer access. Objects should have JSON-compatible `Content-Type` (typically `application/json`).
9. Wait until the distribution is **Deployed**, then open these in a browser (use your real host):

   - `https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/manifest.json`
   - `https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/server-index-manifest.json`
   - `https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/server/00.json`
   - `https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/states/40/districts/686.json`

10. Expect valid JSON, not HTML errors or `AccessDenied`. The first has no `serverIndex` field; the second has exactly **256** `serverIndex` entries. The shard `server/00.json` is publicly readable **GeoNames source data**, not personal U_luv data.
11. If only `server/` fails with `403`, check your CloudFront OAC S3 bucket policy read prefix. A `404/NoSuchKey` often indicates incorrect S3 key prefix or CloudFront Origin path. If you previously tested missing shard URLs, cached error responses may expire later; you may optionally invalidate the affected **CloudFront paths through the Console**, which can incur charges beyond free allowances. Do not make S3 public.
12. STOP. No other AWS deployment or region changes are needed. Ordinary S3 storage and CloudFront request/egress costs may apply.

## 3. Apply the COMPLETE geo code update to your Windows repository

1. **Checkpoint:** Create a backup/commit of your actual local project. Your provided ZIP contained P02-5 but not P03-1/Gate-5; if newer Settings work exists locally, manually compare changed files before applying. Do not overwrite a newer working file without resolving differences.
2. Extract `Uluv_P03_OneBucket_CDN_Full_Geo_Code_Update.zip` to the project **root** (same level as package.json), retaining every path. The code update ZIP has no `geo/india/v1/` JSON.
3. In **your private API environment**, set BOTH variables together (do not put actual CloudFront domain into the repository):

   ```dotenv
   ULUV_GEO_PUBLIC_BASE_URL=https://YOUR-DISTRIBUTION.cloudfront.net/geo/india/v1/
   ULUV_GEO_CANONICAL_MANIFEST_SHA256=8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
   ```

   Remove any older `ULUV_GEO_PRIVATE_DIR`: the backend now reads canonical data from the SAME CloudFront dataset. **No AWS keys or S3 SDK needed.** Keep a genuine `apps/api/.env` private; only `.env.example` is versioned.
4. Install project dependencies, resolve changes to dependency lockfiles locally, and run the tests in PowerShell from the project root:

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

5. Run Java DynamoDB Local **manually**, as usual; start Fastify and the physical Android Flutter app using your project's standard workflow. Authentication/device-session handling must remain unchanged.
6. Open Settings → **Location & discovery preferences**, choose State/UT → District → Download → Search → Select → Save. Inspect `GET /v1/geo/india/delivery`: it must indicate `provider=s3_cloudfront`, return the configured HTTPS root and public manifest SHA, and contain **no AWS credentials**. Test one selected district download, checksum, offline cache, and retry after airplane mode.
7. Save a real place on the authenticated API, reopen Settings and confirm it persists. Test nonexistent ID, wrong district, changed catalogue version, concurrent revision conflict and corrupted index rejection: Fastify must fail closed rather than accept client coordinates. User settings are DynamoDB records, never S3 objects.
8. To verify the ZIP locally (no AWS calls), run:

   ```powershell
   python scripts/geo/verify_onebucket_release.py --zip "C:\Downloads\Uluv_India_Geo_All_JSON_S3_One_Bucket.zip" --expected-canonical-sha 8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
   ```

9. GPS manual fallback remains until a vetted licensed India boundary polygon is approved. PIN lookup requires a genuine current India Post CSV; no PIN→GPS fake inference. P03 public discovery remains disabled.

## 4. Optional AWS-free local provider for debugging

Extract the S3 JSON archive into a separate folder, **outside Git**, e.g. `C:\Dump\Uluv-Geo-Local\geo\india\v1`. Unset `ULUV_GEO_PUBLIC_BASE_URL` and set:

```
ULUV_GEO_PUBLIC_LOCAL_DIR=C:\Dump\Uluv-Geo-Local\geo\india\v1
ULUV_GEO_CANONICAL_MANIFEST_SHA256=8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
```

Fastify will read the same canonical shards from this external local folder (not from repository code). It serves only public district assets via its authenticated local endpoints; **not `server/` or the canonical manifest**. This mode is for local testing; CDN remains the intended production data provider.

## 5. New dataset publication / rollback

Use a new immutable `geo/india/v2/` prefix (or next unused version). Build and independently verify the *entire* release first, upload and test all objects through the Console, then change the CDN URL and pinned SHA as one deployment. Never replace the existing v1 bytes with a different source snapshot. Rollback: restore previous URL and its matching pinned SHA, restart/redeploy API, verify the public manifest and real place saves; Flutter retains previously valid offline caches.

## 6. Acceptance state

The generated dataset, reproducible exporter, portable source tests and a real local reader against the 1,058 JSON files have passed in the producing environment. **Not tested here:** the owner's real CloudFront URL/bucket policy, full TypeScript installation/typecheck, Flutter SDK tests, live DynamoDB, physical Android. Mark those **UNVERIFIED** until owner runs them. This delivery does not declare P03 complete.
