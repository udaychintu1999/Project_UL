# ARCHIVED setup proposal — use `docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md` instead.

# Optional development-only S3 + CloudFront setup (PROPOSAL)

**Preconditions:** This is NOT part of the P00 completion gate and is not a request to deploy production. Owner must explicitly opt in. Keep Java DynamoDB Local for all local data workflows. Do not use real user photos in shared test environments.

1. Use a dedicated AWS development account or tightly isolated dev resources, choose a fixed Region for S3, configure AWS Budgets alerts and a least-privilege development IAM principal. Never put long-lived access keys in Flutter or source.
2. Create globally unique **private** `persistent` and `temporary` dev buckets. Enable Block Public Access and bucket-owner-enforced ownership; configure encryption. Separate staging prefixes and cleanup policies.
3. Create one **standard** CloudFront distribution with two S3 REST origins, one behavior per media URL prefix, Origin Access Control and bucket policies limited to the distribution. Require signed URLs using trusted key groups for both private behaviors. Set safe default deny behavior.
4. Store CloudFront signing private key in restricted secret management. Configure its public key/key group in CloudFront. Rotate/test key management according to the app environment. Do not expose secrets to Flutter.
5. Provide backend-only environment variables for media driver, names, region, distribution domain, public key ID and secret reference. Preserve `MEDIA_STORAGE_DRIVER=local` as the default unless developer opts into dev AWS. Java DynamoDB Local remains the DB.
6. Implement `POST /v1/media/uploads` -> presigned PUT -> `complete`; verify owner and file content. Implement `GET /v1/media/{id}/access` -> authorized signed CloudFront GET. Embed signed image URLs in authorized paginated feeds/profiles/chat as defined in `docs/architecture/13_TWO_BUCKET_EARLY_AWS_PROPOSAL.md`.
7. Test: both origins route correctly; direct S3 GET denied; unsigned CloudFront GET denied; valid signed GET works; tampered/expired tokens fail; wrong owner/post/blocked conversation fails; TTL and delete behavior; cleanup of abandoned uploads; key rotation; fallback local driver still passes.
8. Record exact AWS resource IDs and configurations in private environment management, **never** in source ZIP or public docs. Record command, timestamp, and result in `docs/qa/EVIDENCE_LOG.md`. Treat any unexecuted AWS test as UNVERIFIED.
9. P16 audits all infrastructure and freezes production IaC; P17 provisions separate production resources with owner approval and reruns full security tests before launch.

**Cautions:** This path incurs real usage charges. AWS S3 Lifecycle expiry is asynchronous. Signed CloudFront URLs cannot instantly be revoked individually simply by modifying the app database. A chat deletion requires immediate application access denial, followed by media deletion/cache handling and expiry of already issued URLs.
