# ARCHIVED patch note — use FINAL v2.0 media contracts.

# U_luv signed media architecture — v1.2 documentation patch

This is an **update-only** ZIP to overlay onto `U_luv_Full_Developer_Handoff_v1_1_Java_Local.zip`. All paths are project-relative, under `docs/`.

## Why

The v1.1 handoff stated S3/CloudFront, secure delivery and late integration, but did not explicitly contract S3 presigned uploads and CloudFront signed reads. This patch closes that gap.

## Apply

Extract this archive **at the project root**, preserving existing files and overwriting the 5 updated documentation files. New documents: `docs/architecture/12_S3_CLOUDFRONT_SIGNED_URLS.md`, `docs/qa/MEDIA_SIGNED_URL_TEST_MATRIX.md`. No source code was modified.

## Critical timeline

- P00–P15: Java DynamoDB Local plus local media adapter, no real AWS.
- P16: sign/upload/download API contracts, private bucket and CloudFront OAC IaC, failure tests.
- P17: real S3/CloudFront staging tests, then production integration after founder authorization.

## Verification

Docs and ZIP integrity checked. Live S3 and CloudFront tests **UNVERIFIED**.
