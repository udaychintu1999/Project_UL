# U_luv — MediaStorage adapters, local-first

**Final decision:** `MEDIA_STORAGE_DRIVER=local` by default for P00–P15 real media UI and all automated QA. Owner manually creates DEV 2 S3 private buckets and 1 DEV CloudFront distribution during initial phases; real AWS adapter validation from P02 is opt-in with explicit, separately scoped owner approval for every AWS operation. Java DynamoDB Local stays until P17.

Implement a narrow interface: `beginUpload`, `finishUpload`, `getAuthorizedAccess`, `remove`, `purgeExpired`, and `inspectMetadata` (local adapter operations by default). Local adapter stores files only under ignored `.local/media/` and uses synthetic time-limited URLs/tokens for tests, with authorization/expiry parity. Never call real S3 or CloudFront merely because AWS credentials/region are present.

AWS adapter uses S3 presigned PUT to new randomized staging key, backend-verified upload completion/HEAD, then CloudFront signed GET for authorized media. Backend may embed signed short-lived image URLs in authorized paginated profile/liked-you/local/activity/chat responses; fullsize via access endpoint. Store only opaque media IDs/metadata in DynamoDB; signed URLs never persisted or logged.

Persistent bucket: Dating/Friendship profile photos and variants. Temporary bucket: chat photos and Local/Activity images/variants, 7-day max visibility/deletion rules; S3 Lifecycle is backup, not exact deletion clock. Private bucket, Block Public Access, OAC and signed CloudFront behaviors mandatory in both.

Real AWS calls, including reads/HEAD/signing verification, require explicit action authorization or owner manual execution. Agents and automated tests must not load AWS profiles or `.env`; AI tools only inspect `.env.example`. Production separate buckets and CloudFront in owner-authorized P17. See `12_S3_CLOUDFRONT_SIGNED_URLS.md`, `13_TWO_BUCKET_MEDIA_ARCHITECTURE.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.
