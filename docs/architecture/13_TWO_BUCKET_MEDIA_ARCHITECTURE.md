# U_luv — APPROVED two-bucket private media architecture (DEV early, PROD P17)

**Status: Approved logical architecture, NOT deployed/verified.** This replaces the archived v1.3 proposal. Owner manually creates DEV resources early; no agent AWS calls without explicit bounded approval. Java DynamoDB Local remains the only database through P16.

## Bucket separation

| Bucket | Data | Typical retention | Scope |
|---|---|---|---|
| `MEDIA_PERSISTENT_BUCKET_DEV` | Dating and Friendship profile images and display variants | Until replacement, account deletion or moderation | DEV only |
| `MEDIA_TEMPORARY_BUCKET_DEV` | Chat photos, Local Feed images and Activity images/variants | Messages 7 days from sent time; posts max 7 days or activity end | DEV only |
| P17 production equivalents | Same classes in entirely separate PROD buckets | Same product rules | PROD only after owner-authorized release |

DEV owner picks globally unique real bucket names. Enforce S3 Block Public Access, private object ownership, no public ACLs, encryption, transport security, restricted IAM and no secrets shared with AI. Neither bucket contains publicly shared thumbnails. One approved profile media ID can be referenced by both Dating and Friendship profiles.

## CloudFront topology

Use **one private CloudFront distribution with two S3 REST origins**, path-based behaviors `/persistent/*` (persistent bucket) and `/temporary/*` (temporary bucket), both with OAC, signed GET required via trusted key group and HTTPS. Verify request routing/path prefix carefully—CloudFront does not automatically strip behavior path prefixes. Default behavior must not expose private objects. Distribution/provisioning/actual access tests are owner-only unless separately authorized. Expired signed links can remain usable to their actual expiry after a block/delete; app disables issuance immediately, cleanup and short TTL mitigate.

## API response-level signed URLs — mandatory interface design

Upload: `POST /v1/media/uploads` verifies identity, media class, quota/size/type/parent and (in DEV) separate owner-configured permission before issuing a short-lived S3 presigned PUT for a **unique new staging key**; client PUT then `POST /v1/media/uploads/{mediaId}/complete` validates HEAD/size/checksum/object and transitions to READY. Upload URL is a bearer token, may be reused until expiry; unique key every attempt.

Access: `GET /v1/media/{mediaId}/access` checks viewer, READY status, active parent/expiry, relationships/blocks, Local area, chat entitlement/history generation and moderation before returning `url` + `urlExpiresAt` for CloudFront signed GET.

**Already authorized list/detail views** (Dating/Friendship profiles, incoming Liked You previews, local/activity posts, chat pages) should embed short-lived signed `url` + `urlExpiresAt` for the currently displayed page's visible media thumbnails, avoiding N+1 backend requests. Do not include for invisible/blocked/deleted items. Flutter refreshes as necessary; full-size image can require on-demand signed URL. **Never store a signed URL in DynamoDB; store only opaque `mediaId`/metadata.** Never include signed URL query strings in logs, screenshots or ZIPs.

Example **nonfunctional fake token** for documentation only:
```json
{"posts":[{"postId":"POST_SAMPLE","images":[{"mediaId":"MEDIA_SAMPLE","url":"https://example.invalid/fake-signed-thumbnail","urlExpiresAt":"2030-01-01T00:00:00Z"}]}],"nextCursor":null}
```

## Test and phase gates

- P00 local media interface/guard tests; founder may manually set up DEV resources, no automatic cloud testing.
- P02 profiles, P05 chat, P10–P12 Local/Activities: functional local tests mandatory, optional **specifically approved limited DEV cloud tests**. No agent may silently upload one object or use SDK credentials simply because they exist.
- P13–P15 moderation/expiry tests locally, optional explicitly approved DEV security checks.
- P16 production IaC review and payment sandbox; P17 owner-controlled real AWS DynamoDB, separate PROD S3/CloudFront/ECS and full security/performance validation.

Temporary media becomes inaccessible at application expiry even if S3 storage deletion is asynchronous; do not claim immediate signed-URL revocation. S3 Lifecycle handles orphan cleanup but is not exact seven-day enforcement. All cloud calls, including read-only, require explicit owner grant or manual execution. See `docs/security/02_CLOUD_ACTION_APPROVAL.md`.
