# P02 — Implemented technical, security and privacy contract

**Reference:** Consolidated from the P02-1/P02-2 implemented source contracts and P02-3 activation design. This document is a current guide to P02 behavior, not a claim that source code was re-audited or rerun during documentation cleanup. Use actual source for final API/field naming.

## Storage and ownership

- Reuse existing **18 DynamoDB tables** and P01 device-bound session authorization; no P02 table, index, GSI or unbounded scan was added.
- `uluv_users`: immutable user identity/DOB, user-level public `@handle` alias and CAS revision. Handle map uses an atomic alias transaction (`HANDLE#...`); a handle is not a user UID.
- `uluv_profiles`: owner mode drafts `USER#<uid> / MODE#DATING|FRIENDSHIP`; private media entries `USER#<uid> / MEDIA#<opaque-id>`; optimistic concurrency on expected versions and reference-safe photo changes.
- Broad locality is self-declared shared setup information. It **does not** create a trusted H3 R6 home cell.
- In local development, the media adapter stores normalized private images under Git-ignored `.local/media/`; **not production storage**. The owner's separate DEV media configuration never authorizes automatic AWS calls.

## Current owner-only routes (P01 session required)

| Route | Purpose / rule |
|---|---|
| `GET /v1/profiles/me` | Read own dashboard/setup state, no raw DOB or internal keys |
| `PUT /v1/profiles/me/handle` | Atomically claim/rename shared handle with expected identity revision |
| `GET /v1/profiles/me/:mode` | Own Dating or Friendship draft only |
| `PUT /v1/profiles/me/:mode` | Save draft with `expectedVersion`; does **not** activate |
| `POST /v1/media/profile/uploads` | Begin private upload, server-assigned ID |
| `PUT /v1/media/profile/uploads/:id/content` | Upload bounded bytes; decode/re-encode to sanitized JPEG |
| `POST /v1/media/profile/uploads/:id/complete` | Commit own private `READY` media record |
| `GET /v1/media/profile/mine` | Enumerate own bounded private media library |
| `GET /v1/media/profile/:id/content` | Owner-authenticated media read, no public disk path |
| `PUT /v1/profiles/me/:mode/photos` | CAS replace ordered photo IDs, transactionally manage references |
| `DELETE /v1/media/profile/:id` | Delete only unreferenced owned media; conditional tombstone |
| `POST /v1/profiles/me/:mode/activate` | Explicit versioned activation **intent**, owner/session/eligibility checks |
| `POST /v1/profiles/me/:mode/deactivate` | Independent mode deactivation |
| `GET /v1/profiles/me/:mode/preview` | Private owner-only allowlisted projection |

Routes above summarize source documentation. Do not assume hypothetical P02-0 proposed routes (such as writing authoritative GPS locality) were implemented.

## Existing bounded field rules (not a final product taxonomy)

P02-1 implemented a normalized 3–24 ASCII-character handle (initial letter, lowercase, letters/digits/underscore thereafter), name up to 60 Unicode code points, bio up to 500, intention up to 80, and up to 10 distinct contact-safe interest labels up to 32 code points each. The **interest catalog and free-text intention categories were explicitly provisional**, not owner-approved permanent taxonomies. Source validation takes precedence if later releases have changed field limits; do not treat a P02-0 proposal as a shipped API.

## Media and failure rules

- Modes hold 0–6 ordered unique media IDs; setup/activation require at least two distinct own `READY` attachments **per enabled mode**. Drafts may contain fewer.
- Content upload max **8 MiB**, transport type `application/octet-stream`; decode JPEG/PNG/WebP using Sharp, bound dimensions/pixels, rotate/flatten and re-encode JPEG **without EXIF/GPS**. Unsupported/malformed content rejected. This is technical sanitation, not comprehensive content moderation.
- The P02 Android SAF picker reads granted URI bytes; no broad storage permission is required. Android automated suites may inject image-picker bytes and therefore do not independently verify the real system picker.
- Each mode reference update uses CAS + transactional `refCount` updates. A reused photo may be attached to both modes without two file copies. Referenced media cannot be deleted; stale concurrent requests reject rather than overwrite.
- Upload state tracks `UPLOADING → STAGED → READY`, with expiry/tombstone cleanup for recoverable failures. The **24-item library limit is best-effort**, not a strict concurrency-safe production quota; crash-leftover temporary files may require bounded operator cleanup.

## Activation versus public visibility (critical)

| Owner state | Meaning | Publicly discoverable in P02? |
|---|---|---|
| `inactive` | No active request | **No** |
| `paused_ineligible` | Changed/stale state, missing requirements or restriction | **No** |
| `pending_trusted_locality` | Eligible **intent** but no trusted geographic pointer | **No** |

- Mode activation requires accepted P01 session, selected mode, an eligible adult account (DOB is self-declared), saved shared and mode details, and two valid private photos. It snapshots identity/setup revisions; subsequent changes invalidate earlier requests.
- Edit/reassignment can clear activation; shared/handle edits invalidate the snapshot. Explicit reactivation is required after repair; never resume public visibility silently.
- Public cross-account preview remains **404** and every P02 discovery eligibility result is `false`. No `uluv_discovery` pointer is published by P02 activation.
- Owner preview is an allowlist: approved mode/handle/name/derived age/broad area/intent/interests/contact-safe bio and at most two opaque private photo references. Never return email, raw DOB, precise coordinates, storage paths, UID, session tokens or device secrets.
- P03 must independently implement trusted location/H3 indexing and authorization/blocking/viewer filters before any public profile can appear.

## Limits requiring production work

Full media moderation, abuse prevention, strict quotas, cloud-media migration, privacy reporting/blocks, verified locality and production release approval are **not provided by P02 local acceptance**. The historical P01-1 OTP Android automation failure remains separately documented as local-only waived, not passed.
