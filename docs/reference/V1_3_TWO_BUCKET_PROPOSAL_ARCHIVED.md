# ARCHIVED v1.3 PROPOSAL — superseded by approved v2.0

This is history only. Read `docs/architecture/13_TWO_BUCKET_MEDIA_ARCHITECTURE.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` for current rules.

# U_luv — Two S3 Buckets, CloudFront and Early Development Integration

**Status:** PROPOSED (owner discussion; do not treat as implemented or deployed). Recommends an opt-in AWS *development* media environment from P02. This supersedes the v1.2 blanket ban on early live S3 **only if approved**. It does not move production AWS DynamoDB/ECS/S3 or payments forward from their final phases.

## 1. Resource layout

| Environment | Logical resource | Content | Retention |
|---|---|---|---|
| Development AWS | `MEDIA_PERSISTENT_BUCKET` | Approved Dating/Friendship profile photos and variants | Until changed/deleted or account/policy removal |
| Development AWS | `MEDIA_TEMPORARY_BUCKET` | Chat attachments, Local Feed pictures, Activity pictures and variants | Chat <=7 days after message sent; post <=7 days after creation or activity end |
| Production AWS, P17 | Separate persistent + temporary buckets | Live customer media | Same business rules, isolated from dev |

Use globally unique real bucket names, e.g. `uluv-dev-media-persistent-<unique>` and `uluv-dev-media-temporary-<unique>`. BOTH buckets private: Block Public Access, bucket-owner-enforced ownership, least-privilege IAM, encryption at rest, private SSL/TLS endpoints, no direct GET by clients.

Profiles are *longer lived*, not indelible: replacing a photo or deleting an account still removes it. One approved profile media ID can be referenced by both profiles without storing two objects. Temporary media must not be silently promoted into the persistent bucket; any promotion requires a new backend-approved workflow and object.

Keep unsigned, unvalidated uploads under isolated `staging/` prefixes in their designated bucket and never return signed CloudFront GET until the backend validates and marks them READY. For additional isolation, a third staging-only bucket can be evaluated later; it is not necessary initially.

## 2. One CloudFront standard distribution, two S3 origins

A single standard distribution with two private origins is preferred initially:

- `https://media.<owned-domain>/persistent/*` -> persistent bucket via dedicated path behavior.
- `https://media.<owned-domain>/temporary/*` -> temporary bucket via dedicated path behavior.
- Configure origin paths/prefix mapping carefully to avoid forwarding the wrong key prefix. Verify both paths against real objects.
- All applicable behaviors must require **CloudFront signed GET URLs** using trusted key groups. A safe default behavior must not serve unsigned files.
- Both private S3 origins use **CloudFront Origin Access Control** (OAC); bucket policies restrict distribution access. The backend holds signing private keys in approved secrets management and Flutter receives none.
- Different cache/response policies per path are allowed; short-lived signed URLs do not automatically remove cached bytes or revoke previous issued URLs.

Two distributions are not needed at launch; split them later only if isolation/traffic/operations demand it.

## 3. Exact signed-URL API response contracts

**Upload initiation** (`POST /v1/media/uploads`): Server first verifies identity, type, size, quota, parent eligibility, then returns an upload *S3 presigned PUT* URL and only approved headers.

```json
{
  "mediaId": "MEDIA_123",
  "method": "PUT",
  "uploadUrl": "https://example.invalid/s3-presigned-upload-placeholder",
  "requiredHeaders": {"Content-Type": "image/jpeg"},
  "expiresAt": "2026-11-10T14:05:00Z"
}
```

Client PUTs to S3, then calls `/v1/media/uploads/MEDIA_123/complete`. The backend checks object existence, content and ownership, rejects unsafe/incomplete uploads, and transitions metadata to READY. A presigned PUT token can be reused until expiry; always allocate a unique key for each attempt.

**Media authorization** (`GET /v1/media/{mediaId}/access`): Check viewer eligibility/blocks, active parent, chat entitlement and message-history generation, role, state and expiry, then return only a short-lived *CloudFront signed GET* URL with expiry.

**List and detail API responses:** Dating/Friendship profile views, `Liked You` previews, Local/Activity feeds, and chat message pages should include a signed `url` and `urlExpiresAt` for **authorized visible thumbnails/images on the returned page** so Flutter doesn't need one additional API roundtrip per image. Full-resolution images and older pages may use a batch-access endpoint on demand. Avoid creating URLs for invisible items.

```json
{
  "posts": [{
    "postId": "POST_123",
    "images": [{
      "mediaId": "MEDIA_456",
      "url": "https://example.invalid/cloudfront-signed-url-placeholder",
      "urlExpiresAt": "2026-11-10T14:05:00Z"
    }]
  }],
  "nextCursor": null
}
```

Example hostnames/values are illustrative only. URLs must NOT be persisted in DynamoDB as canonical metadata, returned to unauthorized users, logged with credentials, or treated as permanent references. Flutter refreshes expired URLs and clears local cached expired/deleted chat or post images.

Recommended first-pass signed URL lifetimes (tune with tests): S3 PUT 2–5 minutes; CloudFront GET 1–5 minutes for chat/temp and 3–5 minutes for profiles. Cache TTL is a different control and must be configured/tested. Signed URLs can be shared and remain usable until expiry; block/deletion instantly prevents *new* issuance but cannot guarantee immediate revocation of existing URLs.

## 4. Expiry, deletion and security

- Authoritative `expiresAt` is determined by message/post/activity state, not just an S3 object's age. The API stops issuing URLs immediately at expiry or upon block/delete/hide.
- A backend deletion worker removes S3 originals/variants, updating retry/audit status; S3 Lifecycle provides backup orphan cleanup, not exact seven-day scheduling. Lifecycle operates asynchronously.
- Explicitly test CloudFront stale caches, URL leakage, key rotation, unauthorized direct S3 access, deletion delays, object replacement and local device disk-cache behavior.
- Keep narrowly required moderation/legal evidence separate from ordinary delivery with explicit policy and controls; no indefinite secret copies hidden in the persistent media bucket.
- Never embed AWS credentials or CloudFront signing keys in Flutter, repository, logs, or update ZIPs.

## 5. Recommended phase schedule, opt-in development AWS

| Phase | Database | Media | Payments |
|---|---|---|---|
| P00 | **Java DynamoDB Local** | MediaStorage interface, local adapter; optionally provision isolated dev AWS buckets/CloudFront manually, not a P00 gate | None |
| P02 | Java DynamoDB Local | Profile photo workflow must work locally; **optional real dev S3/CloudFront integration and tests** | None |
| P05 | Java DynamoDB Local | Optional real dev signed-chat-image path, seven-day access semantics | None |
| P10–P12 | Java DynamoDB Local | Optional real dev signed Local/Activity media path, 7-day cleanup and hidden-post checks | None |
| P13–P15 | Java DynamoDB Local | Re-run optional dev AWS security/cleanup tests if configured | None |
| P16 | Java DynamoDB Local | Audit/finalize AWS media adapter, production IaC, IAM, OAC, signing, migration; preserve staging evidence | Official payment sandbox only |
| P17 | Live AWS **staging**, then owner-authorized production tables | Create **separate production** buckets/CloudFront, repeat full real-cloud negative/expiry tests | Release payment checks |

`MEDIA_STORAGE_DRIVER=local|aws` (backend-only) selects implementation; `MEDIA_ENV=development|staging|production` must prevent accidentally mixing credentials/buckets. Local functionality and unit/DB tests remain mandatory. No phase before P17 is allowed to write production customer data or provision production AWS resources. Dev S3 is optional and incurs real AWS charges even while DynamoDB is local. Setup must have budgets/alerts, least-privilege roles, limited test users and cleanup.

**Recommended decision:** Set up isolated development S3 buckets + one CloudFront distribution by P02, not as a blocking P00 prerequisite. Keep payments and production AWS in P16/P17. This is a proposed change until approved.

## AWS sources, checked 2026-11-10

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PrivateContent.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesOrigin.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/troubleshoot-lifecycle.html
