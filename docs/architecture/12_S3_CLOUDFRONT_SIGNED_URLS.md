# U_luv — S3 uploads, CloudFront signed delivery and private-media security

**Status:** FINAL v2.0 contract. Owner manually creates development two-bucket/CloudFront resources early; no AI AWS activity without separate scoped approval. Real AWS DynamoDB production tables and production media remain P17. Details: `13_TWO_BUCKET_MEDIA_ARCHITECTURE.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.

## 1. Mandatory deployment topology

```text
Flutter app -> authenticated Fastify API (JWT/session, ownership and visibility checks)
  -> issue short-lived S3 presigned PUT URL for one unique staging object key
Flutter app -> HTTPS PUT directly to private S3 (no AWS credentials in Flutter)
Flutter app -> API finalize-upload (server HEAD/checks + ownership + valid size/type)
API -> marks media READY only after validating metadata and image-processing policy
Flutter app -> API request media access using opaque mediaId
API -> authorize requester against post/profile/conversation state and expiry
API -> issue short-lived CloudFront signed GET URL
Flutter -> CloudFront (HTTPS, trusted key group validates signature)
CloudFront -> private S3 origin via Origin Access Control (OAC)
```

**Never** use public S3 ACLs, publicly accessible object URLs, or AWS keys embedded in Flutter. S3 Block Public Access remains enabled; bucket ownership is bucket-owner enforced; distribution uses an S3 REST origin (not S3 website endpoint) and CloudFront OAC with least-privilege bucket policy. CloudFront behavior for private media requires valid signed URLs; configure trusted **key groups** rather than legacy trusted account signers. The backend signing private key is held in restricted secrets management (not in client, docs ZIP or repository).

## 2. Upload protocol

Proposed endpoints (media contract; adjust naming while retaining behavior):

1. `POST /v1/media/uploads` — authenticated. Request `{scope: "profile"|"local_post"|"chat", parentId?, mime, sizeBytes, checksum?}`. Validate user, target, quotas (2–6 profile photos, <=5 local photos/post), allowed content types/size, per-user rate limits and pending-upload quota. Return `{mediaId, method:"PUT", uploadUrl, requiredHeaders, expiresAt}`.
2. Backend allocates a **random, unique, unguessable object key per attempt**, e.g. `staging/<uid>/<randomId>`, no user-supplied filename path; short TTL (proposed 2–5 minutes). For Flutter use SigV4 S3 presigned PUT for an exact key and signed matching headers; POST with content-length-range is a possible browser-specific variation if needed.
3. Flutter performs HTTP PUT to private S3 with the exact required headers. Upload signing grants narrowly scoped PUT access; URL is a bearer capability and may be reusable until expiry, so never sign over an existing production key. Consider checksum validation and immutable unique keys; use short expiration and stale-upload garbage collection.
4. `POST /v1/media/uploads/{mediaId}/complete` — authenticated. Backend checks upload intent owner, S3 HEAD existence, expected size/type/checksum (as available) and configured media checks; validates actual decoded file safety where supported. Do not trust client-reported success or MIME type alone. Mark READY and attach to the permitted profile/post/chat only after verification. Incomplete and rejected staging objects are never served.
5. `DELETE /v1/media/{mediaId}` — authoritative authorization; immediately marks unservable in application, then schedules S3 object deletion and cache cleanup.

Choose explicit size caps per media class during P16, record limits in settings; do not upload original EXIF/location metadata for display variants. Where processing is necessary, prefer backend process/workers within existing ECS monolith deployment rather than introducing Lambda by default.

## 3. Private read protocol

`GET /v1/media/{mediaId}/access` checks a caller's authenticated identity, media state READY, canonical parent visibility/expiry, blocks, account restrictions, deleted post/chat history generation, and chat entitlement where relevant. Return a time-limited CloudFront URL and expiry, **never** raw S3 keys, bucket URLs, or signing secrets. Suggested initial signed GET TTL: 1–5 minutes, tune to UX.

Different scopes:

| Scope | Authorization before signing |
| --- | --- |
| Dating / Friendship profile photo | Only viewers eligible to see that mode/profile (including a free Liked You preview where product rules permit), respect blocks and hidden/paused modes. |
| Local post photo | Parent post is active, unexpired, not hidden, and viewer locality/band meets location policy; respect blocks. |
| Chat photo | Caller is one of two authorized participants with permitted connection, message unexpired and still in current conversation generation; respect blocks and restrictions. |
| Admin review | Explicit role/permission and auditable purpose; never assume admins have universal unrestricted download links. |

Signed URLs are bearer tokens **usable by anyone possessing the URL until expiry**, independent of later application state changes. They do NOT provide instantaneous revocation on their own. For deletion/block/unmatch, disable issuance immediately, use very short TTL and object deletion as needed, and test remaining exposure. If instantaneous denial of previously signed URLs is a hard product requirement, design an edge/backend per-request authorization or revocation mechanism and get explicit product acceptance of its cost/complexity. Never claim a CloudFront invalidation is instantaneous or that a signed URL can be revoked individually with ordinary application flags.

CloudFront cached content may remain briefly during cache invalidation. Set suitable cache policies and object versioning/key strategy so old deleted variants cannot be unexpectedly re-served; do not assume DynamoDB TTL or S3 lifecycle gives exact deletion time. Explicitly test before declaring product deletion guarantees.

## 4. Object lifecycle and cost

- Profile media: persistent while authorized profile photos are used, delete on replacement/account deletion as product/legal policy requires.
- Local post media: unservable at min(createdAt+7d, activityEnd); cleanup physical objects and obsolete variants.
- Chat media: unservable at message sentAt+7d or on global history-clear (subject to narrowly scoped incident/retention exceptions); delete physical objects and variants.
- Staging media: short-lived, never accessible to viewers, delete abandoned uploads with bounded cleanup.
- Keep only opaque `mediaId`, owner/parent/scope, object key, state, size/type, timestamps, expiry/checksum and relevant deletion status in DynamoDB; not public URLs.
- S3 encryption at rest, TLS, least-privilege backend IAM, server-side logging/monitoring. Prevent signed URLs and auth tokens entering analytics, crash logs or support exports.
- No forever-public thumbnails: thumbnails use the same guarded delivery model.
- Use prefix/ownership policies and optional bucket separation for staging versus approved private media if justified by cost and operations; always prohibit public access.
- Keep image delivery bandwidth, signing calls, cache-hit behavior and invalidation cost in the P17 budget test; short TTL signed URL does not necessarily imply zero CDN caching.

## 5. Local development and phase gates

**P00–P16 database:** Java DynamoDB Local only. **P00–P15 media:** functional local media adapter is mandatory; owner sets up separate DEV S3 persistent/temp buckets plus DEV CloudFront distribution early, without granting scripts permission to use them. Limited DEV real signed URL verification is permitted only after separate owner approval, otherwise UNVERIFIED. **P16:** production IaC review and payment sandbox. **P17:** separate owner-authorized production AWS DynamoDB/media/ECS resources and final security/live verification. Never send any AWS request, upload a fixture, or use real credentials by default. Refer to `docs/security/02_CLOUD_ACTION_APPROVAL.md`.

API list/detail pages MUST include signed CloudFront GET thumbnail URLs only for authorized visible media, plus expiration; fallback `GET /v1/media/{mediaId}/access` for on-demand full-size. Signed URLs never belong in DynamoDB, logs, screenshots or ZIPs. The real AWS signer uses owner-managed secrets outside AI access.

## 6. Official AWS references (verified 2026-11-10)

- S3 presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- CloudFront signed URLs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
- CloudFront trusted key groups: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html
- CloudFront OAC: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- Signed URLs vs cookies: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-choosing-signed-urls-cookies.html
