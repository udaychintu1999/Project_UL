# U_luv — signed media delivery QA contract

**Run local authorization/expiry tests from P02; real DEV AWS media tests only if the owner explicitly approves EACH bounded action or performs it manually. PROD real AWS staging tests P17 only after owner release authorization.** Never auto-upload, LIST/HEAD, consume real signed URLs or invoke CloudFront solely for QA. Do not mark PASSED without actual executions.

| ID | Scenario | Expected result |
| --- | --- | --- |
| MEDIA-01 | Authenticated owner requests upload for permitted scope | Short-lived PUT URL generated for unique staging key |
| MEDIA-02 | Unauthenticated/blocked user requests upload | 401/403; no URL |
| MEDIA-03 | Upload URL expired/tampered or wrong signed headers | S3 rejects |
| MEDIA-04 | Valid PUT then complete | HEAD/validation succeeds, media READY |
| MEDIA-05 | Oversized/wrong MIME/broken image | Complete denied, media not served |
| MEDIA-06 | Reuse old URL to overwrite approved media | Impossible: unique staging key per attempt |
| MEDIA-07 | GET raw private S3 URL | Denied |
| MEDIA-08 | GET unsigned private CloudFront URL | Denied |
| MEDIA-09 | GET valid signed CloudFront URL for eligible user | Allowed |
| MEDIA-10 | Signed CloudFront URL expired/tampered | Denied on new request |
| MEDIA-11 | Blocked user requests post/profile/chat photo signing | No signed URL issued |
| MEDIA-12 | Cross-user chat photo/media ID access | Denied |
| MEDIA-13 | Out-of-radius or expired Local post image | No signed URL issued |
| MEDIA-14 | Chat message older than 7 days | No signed URL issued |
| MEDIA-15 | Delete-history-for-both | No new signed URLs for old generation; existing URL residual window measured |
| MEDIA-16 | Post/profile deleted | Media not newly retrievable; cleanup jobs remove keys and variants |
| MEDIA-17 | Abandoned staging upload | Expired/cleaned, never served |
| MEDIA-18 | Multiple concurrent finalize/delete requests | Safe idempotence and correct state |
| MEDIA-19 | CloudFront key rotation | Old/new signer handling verified, no unapproved leakage |
| MEDIA-20 | S3/CloudFront signers and credentials in mobile bundle/logs | None exposed |

## Evidence template

For every test capture date/Region/environment, request IDs (redacted), intended action, actual HTTP status and media state, commands or script name, result PASS/FAIL/UNVERIFIED, defect references, and remediation/retest result.

**Caveat:** Existing CloudFront signed URLs may remain usable until expiry even after backend revokes access. Do not assert perfect immediate global revocation without separately validated revocation enforcement.

## FINAL v2.0 additional acceptance tests: two buckets + owner-controlled early development (not automatically executed)

- DEV-01: Presigned upload for `profile` writes to persistent bucket only, unique staging key; inaccessible until completion.
- DEV-02: Presigned upload for `chat`/`local_post`/`activity` writes to temporary bucket only.
- DEV-03: CloudFront `/persistent/*` and `/temporary/*` map to correct private origins; unsigned GET denied for both.
- DEV-04: Authorized paginated profile/feed/chat responses contain signed thumbnail `url`, `urlExpiresAt`, and opaque `mediaId`, with no signed URL for unauthorized items.
- DEV-05: Flutter refreshes expired delivery URLs without exposing AWS credentials or leaking signed URLs to telemetry.
- DEV-06: Deletion, expiry and block deny new URL issuance; existing signed URL revocation window is measured honestly.
- DEV-07: Permanent photo replacement and account removal clean originals and derived variants without deleting a photo still legitimately referenced in the other profile mode.
- DEV-08: Temporary object cleanup and backup S3 Lifecycle do not create false exact-7-day deletion claims.
- DEV-09: `MEDIA_STORAGE_DRIVER=local` remains usable in offline AI Chat/local Java-DDB testing; dev S3 does not gate P00.
- DEV-10: Dev buckets/CloudFront isolated from production; budgets, access, key rotation and environment guardrails reviewed.

**Authorization gate:** All DEV-01 through DEV-10 tests that send real AWS requests require scoped, explicit approval or manual owner execution. In its absence record UNVERIFIED. Run `npm run test:secrets` and `npm run test:cloud-guards` before any handoff ZIP. See `docs/qa/CLOUD_AND_SECRET_TEST_MATRIX.md`.
