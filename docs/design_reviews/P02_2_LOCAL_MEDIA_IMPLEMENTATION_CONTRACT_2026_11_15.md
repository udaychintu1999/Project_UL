> **LATEST P02-2 gate repair (2026-11-15):** Owner confirmed the original Dating/gender-preference contract and mandated **two valid saved photos for EACH enabled Dating/Friendship mode before Continue**. Source now checks owner READY media records via bounded batch read, requires photo assignments per selected mode and refreshes Flutter readiness after photo writes. Draft saves (including incomplete photos) remain allowed; public discovery is still inactive. Authoring unit/portable checks PASS; Windows semantic/Flutter/live DB/Android/manual verification remains UNVERIFIED for this patch. Read `docs/qa/P02_2_TWO_PHOTO_CONTINUE_GATE_REPAIR_2026_11_15.md` and `docs/manual/P02_2_TWO_PHOTO_CONTINUE_WINDOWS_ACCEPTANCE_2026_11_15.md`. Historical status below is not superseding this latest contract.

# P02-2 — Local Profile Photo Management (Implementation Contract)

**Date:** 2026-11-15  
**Status:** SOURCE_IMPLEMENTED / PORTABLE_VERIFIED; Windows TypeScript + Flutter + real database + physical Android tests **UNVERIFIED after P02-2**. Prior P02-1 owner checks remain historical evidence.

## Approved scope and isolation

Owner-approved contract: max **6** photos per Dating/Friendship mode; **2 valid** photos required for later mode discovery activation; one photo object can be referenced by both modes. Modes remain independently editable and inactive in P02-2. Development storage `.local/media/` is **temporary**, ignored by Git, project-relative and **never production storage**. No new DynamoDB tables/GSIs, P03 discovery, public profile previews, real AWS, S3, CloudFront, payment or email-service changes.

## Data records and isolation

* Existing `uluv_profiles` table, same `USER#<authenticatedUid>` partition. `MEDIA#<serverUuid>` items hold `state` (`UPLOADING`, `STAGED`, `READY`, `DELETING`/`EXPIRED`), `refCount`, `version`, byte count, sanitized format/dimensions, checksum, and expiry during upload. Owner-only, never returned with disk path.
* Existing `MODE#DATING` / `MODE#FRIENDSHIP` `photoIds` arrays are ordered, unique, 0–6, with existing version-based compare-and-swap.
* Replacing an ordered array is a single DynamoDB transaction that changes the mode version and updates **every affected media's `refCount`** atomically. An unknown, deleted, uploading or other-owner ID fails the transaction; both-mode reuse increments reference counts once per mode. Concurrent photo changes reject with 409. A failed delete never removes referenced files.
* All endpoints use the already accepted P01 authentication/authorization guard, including account restrictions and device revocation. They **never trust body-supplied `uid`**.

## Authenticated endpoints

| API | Function |
|---|---|
| `POST /v1/media/profile/uploads` | Start empty-JSON upload, assign server UUID, create `UPLOADING` record, cap library (24 records best-effort) |
| `PUT /v1/media/profile/uploads/:id/content` | `application/octet-stream` streamed at 8 MiB cap, decoded and converted to JPEG, journal `STAGED` |
| `POST /v1/media/profile/uploads/:id/complete` | Atomically publish metadata as owner-only `READY`; idempotent retry |
| `GET /v1/media/profile/mine` | List bounded owner `READY` images; tombstone/cleanup expired unready uploads |
| `GET /v1/media/profile/:id/content` | Owner-only authorized JPEG bytes with `private, no-store`, no filesystem path |
| `PUT /v1/profiles/me/:mode/photos` | Replace ordered IDs with `expectedVersion`, transact references and mode version |
| `DELETE /v1/media/profile/:id` | Only zero-ref READY objects; `DELETING` tombstone then disk deletion/conditional metadata deletion |

No unauthenticated static server, preview URLs or public read endpoint exists. Private images are not included in JSON or logs. Global Fastify JSON limit stays 16 KiB. Photo content route has an explicit independent byte counter and abort on overflow. Incoming JPEG, PNG and WebP are decoded by Sharp with pixel and dimension caps, flattened/reoriented, and re-encoded as JPEG without EXIF/GPS. Unsupported SVG, animated/multipage and corrupt images are rejected. File extension or MIME label is not considered proof of format. This is **technical validation, not human/AI content moderation or protection against all decoder vulnerabilities**. P02-3 must separately consider moderation and verified geography before discovery.

## Failure/recovery invariants

1. An upload ticket expires after 30 minutes; incomplete items are not attachable. `GET /mine` marks expired tickets before deleting their bytes; `purgeExpired()` supports temporary-file cleanup. Abandoned files after a full process crash may still require operator maintenance.
2. Crash after atomic local-file rename but before STAGED DB acknowledgment: a subsequent content retry can inspect/confirm the already normalized object and stage it. STAGED completion is idempotent; READY is immutable.
3. File deletion follows a conditional `DELETING` tombstone. Disk failure returns an error while preserving a retryable tombstone. A referenced object cannot enter DELETING.
4. Upload and copy-to-mode never silently enable activation or discovery. The 2-photo count is a **future activation requirement**, not a condition for saving drafts or completing P02-1's common-profile onboarding.
5. The Android system document picker returns bounded bytes, not a raw file path; Kotlin streams URI data under the system-granted read permission. It adds no broad Android storage/media permission.
6. No AWS service or external image service is called, and local storage must be migrated/replaced at the explicitly approved production stage.

## Known limits / follow-up

* Up to 24 private library records is a **non-transactional best-effort anti-abuse bound**; simultaneous first-upload requests can exceed it. A strict per-account quota and periodic cleanup must be finalized before public production. Physical filesystem quotas, deep harmful-content review and production media migrations are not part of this slice.
* The native picker is available in the real Android app; JVM/widget tests inject a picker response. Automated Android integration tests exercise real bytes across Flutter/Fastify/DB, while **manual system-picker selection** is a separate owner gate.
* A file may survive if a database write fails and reconciliation cannot recover; the recovery model requires bounded local operator cleanup before production use. `.local/` remains ignored and disposable.

## Test gates

`npm run verify:p02-2:portable`, `npm run typecheck`, `npm run lint`, `npm run test:p02-2:store`, `npm run test:flutter`, `npm run test:p02-2:integration`, `npm run test:flutter:p02-2:e2e`. Older P00/P01/P02-1 checks must not be weakened. Use `docs/manual/P02_2_WINDOWS_LOCAL_PHOTO_ACCEPTANCE_2026_11_15.md` for the owner-driven phase gate.
