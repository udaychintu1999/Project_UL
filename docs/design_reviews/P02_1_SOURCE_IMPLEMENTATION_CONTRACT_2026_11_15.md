# U_luv — P02-1 Identity and Independent Drafts: Implemented Source Contract

**Date:** 2026-11-15  
**Status:** `SOURCE_IMPLEMENTED / PORTABLE_VERIFIED / LOCAL_DB_ANDROID_UNVERIFIED`  
**Owner acceptance:** pending owner Windows + physical Android evidence. Not a P02 phase completion.

## Source-grounded implementation

- `apps/api/src/features/profiles/validation.ts` validates drafts and normalized handles. The source-grounded P02-0 design proposed, but the owner did **not separately approve**, the technical numeric/default field limits; the limits below are temporary bounded implementation rules, to be explicitly reviewed before launch.
- `apps/api/src/features/profiles/routes.ts` defines the P02-1 routes. They are registered **inside** P01's existing local/test auth module, receiving the exact original `requireSession` callback. P01-3 device/session protocols are untouched.
- `apps/flutter_app/lib/features/profiles/` contains owner DTOs, a local-only authenticated HTTP client and in-place account profile editor. `PersistentAuthGate` passes `sessions.access` to the transport to obtain a fresh device access token; the editor exists only in the authenticated account branch. No pushed profile route survives logout.
- `apps/flutter_app/test/p02_1_profile_workspace_test.dart` tests two-mode editor saves, restored source reads, handle collisions and conflict preservation.
- `apps/flutter_app/integration_test/p02_1_profile_integration_test.dart` and the host runner test real device/session persistence and live local profile APIs. The owner-facing editor's real tapped UI requires separate manual acceptance; the device runner tests network calls through the actual Flutter client, not a mock.

## Exact shipped routes (local/test only, session required)

| Method/path | Behavior | Authorization/concurrency |
|---|---|---|
| `GET /v1/profiles/me` | Own safe dashboard, handle, identity revision, two mode summaries, existing coarse locality label | P01 session guard; exact strongly consistent Gets; no UID/DOB returned |
| `PUT /v1/profiles/me/handle` | Normalize/reserve or atomically rename shared account-level handle | `{handle,expectedRevision}`; transacted Put alias + CAS user Update + conditional old-alias Delete; idempotent same-handle request |
| `GET /v1/profiles/me/:mode` | Owner draft or absent-state DTO | Exact `dating`/`friendship`; no cross-user UID parameter |
| `PUT /v1/profiles/me/:mode` | Create or replace mode draft only | `{expectedVersion,displayName,bio,interests,intention}`; **0** means absent/new; **1+** CAS; account eligibility ConditionCheck; does not activate |

Handles use `uluv_users HANDLE#normalized/META` alias items; account still keeps immutable `uniqueId`. Profiles use `uluv_profiles USER#uid/MODE#DATING|FRIENDSHIP`. There are **no table, index, GSI, auth-token or AWS changes**.

## Temporary bounded technical rules

- `@handle`: 3–24 ASCII characters, lowercase-normalized, first letter, then letters/digits/underscore. Common system/support words are reserved. `expectedRevision` is a positive safe integer; no arbitrary secret/reauth cooldown was introduced.
- Draft save is deliberately permitted with empty `displayName`, `bio` and `intention`; **draft** and **eligible public profile** are different contracts.
- Nonempty display name maximum 60 Unicode code points, bio 500, intention 80. No HTML/control/bidi, links, email, phone numbers, off-platform contact solicitation and common social-network names. Lightweight filtering is **not comprehensive moderation**.
- Interests are currently **provisional user-entered labels**, up to 10 unique nonempty entries of up to 32 code points, from restricted safe characters. **This is not an approved fixed catalog**; choose the eventual interest taxonomy before public activation. Intention is provisional contact-safe free text rather than an invented dating/friendship choice catalog; P02-3 must freeze final enums and migrate as needed.
- New draft version is 1. A stale edit returns 409 and the current **own** resource version. A saved draft never sets `requestedActive=true`; photo IDs initially empty and owned photos cannot be injected in draft updates.
- Owner DTO incompleteness shows `handle`, `displayName`, `intention`, `photos` and `locality` as applicable. Even a syntactically complete draft cannot be visible in P02-1: no photo upload, activation or public preview route is registered.

## Explicitly deferred/review-required details

1. **Locality selection:** The P02-0 draft listed `PUT /v1/profiles/me/locality`, but no approved trusted coarse locality catalog/provider exists in the repository. P02-1 intentionally ships **no writable locality route** rather than accepting precise/private coordinates or inventing a hardcoded global city catalog. Existing server-set locality may be read as a label only. Approve a catalog before P02-3 activation.
2. **Recent-auth handle change:** P02-0 recommended a freshness requirement but set no owner-approved threshold or P01 UX. P02-1 uses P01's authoritative session, transactional identity revision and server-side ownership. Add extra privileged-operation policy only with approved UX; **no silent P01 protocol changes**.
3. **Public viewing/moderation:** No public profile fetch/preview endpoints; avatar filtering, verified age proof, photo policy and discovery safety are future milestones. A self-declared DOB is not identity proof.
4. **Local media:** `.local/media/` remains a strictly development-only concept and is **not implemented by P02-1**. No AWS, real cloud provider or payment system calls.
5. **Transport:** The existing 16 KiB global JSON payload limit remains. Fastify's oversized-body error is now mapped to a safe `413 payload_too_large` response instead of a generic `500`.
6. **Testing:** Local DB/API and Flutter/Android tests were authored but cannot be claimed PASS without executed Windows toolchain/device evidence. P01-1 Android OTP automation exception remains historically FAILED/dev-only accepted.

## Error and recovery behavior

- `401`: no/expired/revoked session, `403`: ineligible account, `400`: invalid input or unsupported mode, `409 handle_taken`, `409 identity_revision_conflict`, `409 profile_version_conflict`, `413 payload_too_large`, `503 profile_store_unavailable`.
- Every response is no-store. Transacted writes and strong reads avoid blind overwrites; on ambiguous network completion the Flutter UI asks the owner to reload/inspect before retrying.
- A `409` never exposes another user's UID. On handle conflict the service reads only the new alias to distinguish a taken handle from stale revision; it does not disclose alias ownership.

**Next:** execute the P02-1 Windows runbook, repair any actual failures, obtain owner acceptance. After that, P02-2 is the local photo-upload milestone; P02-3 handles locality/activation/privacy-safe public profiles.
