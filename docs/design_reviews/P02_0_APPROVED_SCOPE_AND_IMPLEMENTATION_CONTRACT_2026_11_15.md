# U_luv — P02-0 Approved Product Scope and Implementation Contract

**Date:** 2026-11-15  
**Milestone:** P02-0 — design/requirements freeze (documentation deliverable only)  
**Status:** `DESIGN_DOCUMENTED`; eight product recommendations `OWNER_APPROVED`; API/storage implementation `NOT_STARTED`; exact technical defaults below are implementation proposals unless explicitly identified as owner-approved.  
**Authoritative basis:** `docs/product/PRODUCT_CONTRACT.md`, `docs/implementation/phases/P02.md`, `docs/architecture/{01_DECISIONS,02_PHYSICAL_SCHEMA,04_TRANSACTIONS_AND_IDEMPOTENCY,07_PRIVACY_SAFETY_ADMIN,09_API_QUERY_CONTRACTS,11_MEDIA_STORAGE_ADAPTERS,14_FEATURE_MODULE_STRUCTURE}.md`, `docs/security/00_NON_NEGOTIABLE_GUARDS.md`, current P01-3 source/handoff, and owner P02 decisions confirmed on 2026-11-15.

## 1. Why this milestone exists

Make P02's requirements actionable before implementation, without changing the already owner-accepted P00/P01 code. Subsequent vertical slices are **P02-1: identity/drafts/edit**, **P02-2: local media**, **P02-3: eligibility/activation/public-safe projection**, **P02-4: verification/packaging/acceptance**. Implement backend + real Flutter integration + tests in each executable vertical slice; do not equate a backend-only endpoint with a completed user workflow.

This documentation records the owner's authorization to begin the **first agreed milestone**, P02-0. It does *not* claim that any profiles/media/backend changes are implemented or tested.

## 2. Owner-approved product decisions (2026-11-15)

| ID | Approved requirement | Required consequence |
|---|---|---|
| A01 | One unique account-level public `@handle`, changeable under controlled rules | Keep P01 immutable `uniqueId`; reserve and rename aliases atomically; neither mode has an independent handle |
| A02 | Dating and Friendship have independent display names | Store display names in distinct mode records; never copy edits across modes implicitly |
| A03 | Each active mode needs **minimum two** and may have **maximum six** valid photos | Evaluate mode photo count independently; 0–1 cannot activate; 7 cannot be attached |
| A04 | Images may be reused across modes without duplicate stored objects | Single owner-owned media record/file; each mode stores ordered media ID references; reference-safe cleanup |
| A05 | Mode activation is independent, explicit, reversible | Draft save never activates; deactivating Dating does not deactivate Friendship; eligibility can auto-pause |
| A06 | Age is derived from existing self-declared DOB | P01 signup persists `birthDate`, not independently verified DOB; calculate on server; no editable age/public DOB |
| A07 | Broad locality is P02; full H3 discovery is P03 | One user-selected coarse locality authority in `uluv_settings`; no GPS tracking or full spatial search in P02 |
| A08 | Practical file/image checks, no false claim of comprehensive image moderation | Validate transport/file metadata and implement sensible text/contact guards; no AI moderation or verification badge claims |

**Explicitly confirmed media environment:** `.local/media/` is **temporary local development/test storage only**, not production. Files are private, ignored by Git, not shipped, and retained across normal local API restarts. Local storage is replaceable via the existing adapter contract; production media migration is later, separately authorized work. **No AWS calls or paid providers in P02.**

## 3. Unchanged platform invariants

- P00 and P01-1/2/3 owner-accepted baseline remains intact. Do not alter token protocols, device Keystore signing, 30-day reauthentication deadline, one-time refresh, session epochs, email/password flows, or existing OTP test exception.
- Authenticated UID comes **only** from shared P01 `requireSession`, which currently lives inside `apps/api/src/features/auth/routes.ts`. P02 implementation may safely extract/reuse its *existing* contract; do not clone authorization logic or weaken reauthentication/device-family checks.
- `uluv_users.USER#uid/META` keeps immutable `uniqueId`, self-declared DOB and account eligibility. Only server-derived safe age may appear in public profile projections.
- Exactly 18 DynamoDB tables, **Java DynamoDB Local on loopback**, existing `uluv_` keys, no new GSI/scan, no Docker/new infrastructure. No real AWS, CloudFront, SES, store/payment integration without separate approval.
- Non-eligible/restricted users are never discovery-visible. Blocks and privacy authorization must be enforced whenever a profile is requested by another user.
- Dating/Friendship discovery, ranking, likes, matching, invitations, chat, wallet and Local feed are future phases and **not implemented by P02**.

## 4. Lifecycle model and definition of complete

User account existence is separate from mode-profile existence. Each mode is evaluated independently:

1. `ABSENT`: no `MODE#...` item; can begin a draft.
2. `DRAFT_INCOMPLETE`: item exists; missing one or more requirements; cannot activate.
3. `COMPLETE_INACTIVE`: all required fields/media pass; user has not activated or has explicitly deactivated; private from discovery.
4. `ACTIVE_ELIGIBLE`: user explicitly activated, all eligibility checks pass; discovery visibility may be enabled when pointer/locality requirements are fulfilled.
5. `PAUSED_INELIGIBLE`: previously activated, but lacks required media/fields, account eligibility or privacy requirement; **no public discovery** until explicitly safe to resume under documented behavior.
6. `RESTRICTED`: account/safety state prevents exposure; cannot be overridden by a profile edit.

**Canonical representation recommendation:** store independent `requestedActive: boolean`, an eligibility result/reason computed server-side, and `version` on each mode record. Avoid a stored state string that can drift from actual account/media/locality eligibility. `ACTIVE_ELIGIBLE` is true only when both user intent and current validated eligibility permit it. A removed media assignment immediately suppresses the affected mode, even if an obsolete discovery pointer remains.

No silent automatic public reactivation when a previously paused mode later gains photos: require explicit user activation again (privacy-first technical default, subject to final UX review). Saving changes never secretly changes the user's intent.

## 5. Profile composition and data ownership

- **Account (`uluv_users`)**: UID, existing P01 birthDate, account status, alias and identity revision. Handle mapping is unique and belongs to the account, not to either mode.
- **Mode profile (`uluv_profiles`)**: display name, bio, interests, intention, any approved preference fields, sorted owner-media IDs, independent activation intent, version, timestamps and optionally safe locality revision reference.
- **Shared locality (`uluv_settings`)**: a user-selected **approximate** city/locality ID, display label and server-controlled center/revision, shared between modes; mode-specific settings remain separate if needed. Do not accept arbitrary client coordinates or treat a typed address as a verified location.
- **Media (`uluv_profiles USER#uid/MEDIA#mediaId`)**: owner UID, opaque ID, local adapter key (never a public filesystem path), verified metadata, stage/status, timestamps, deletion checkpoint. Photos are referenced by ID from the two mode records.
- **Discovery (`uluv_discovery`)**: only eligible home-cell pointers per mode. Do not implement discovery querying/pagination in P02. P02 activation must obey existing atomic publish/pointer invariant; implementation cannot declare mode discoverable until valid trusted locality-cell lookup and a synchronized pointer are available, or must keep the mode non-visible. Coordinate H3 pointer generation with P03 without implementing P03 search.

## 6. Profile visibility and safeguarding

**Owner editor** may read their full profile and media assignment information using their own authenticated UID. **Public preview** uses a dedicated allowlist: up to two eligible preview photos, mode display name, calculated age, broad area label, intention, limited interests, contact-safe bio and safe handle if approved for that surface. Do not serialize database objects directly.

Do not leak email, phone, provider subject/hash, DOB, account/device-session keys, `uniqueId`, full selected-locality center, exact coordinates, home address, media local paths, signed bearer URLs in logs, or settings not explicitly approved for a given preview. Reject/neutralize text that looks like contact details, QR/external social linking or off-platform solicitation. Note: *lightweight screening cannot guarantee photo content is free of QR codes, advertising, faces, or harmful material*; production safety requires separate moderation/reporting gates.

P01 `ageEligibility='self_declared_adult'` establishes the signup declaration, **not independently verified adulthood**. Recompute at relevant profile-activation boundaries from the stored DOB and enforce adult eligibility, without displaying DOB.

## 7. Implementation boundaries and dependencies

| Milestone | Integrated user outcome | Explicitly excluded |
|---|---|---|
| P02-0 | This approved-scope/contract package and traceability matrix | No application/API/UI/test runtime modifications |
| P02-1 | Authenticated handle selection and two independent saved/edited drafts in Flutter | Media upload/activation promises |
| P02-2 | Picker → validated local upload → attached media → reordering/removal → persisted reopen | AWS media, public discover, comprehensive moderation |
| P02-3 | Independent explicit activation/deactivation, authoritative eligibility, safe public preview and controlled pointer | H3 multi-cell discovery/ranking, likes/chat/wallet |
| P02-4 | Verified full API/local DB/Flutter/device flow, regressions and owner runbook | P03 and later work |

**Acceptance gate:** P02-0 is documentation-complete when this package is reviewed and safely packaged. P02 overall remains `NOT_IMPLEMENTED`; no `AUTOMATED_VERIFIED`, `MANUAL_VERIFIED` or `OWNER_ACCEPTED` for P02 runtime until actual evidence and owner's real-device testing.

## 8. Remaining engineering defaults to lock in P02-1/P02-2

The owner approved the **eight product choices**, not arbitrary length, time or file format constants. Proposed safe implementation defaults, to be finalized in source/test review: ASCII lowercase case-insensitive handle (3–24, starts with a letter, letters/digits/underscore, reserved-name denylist); text length bounds; exact required field schema and interest choices; bounded JPEG/PNG/WebP uploads (e.g. 8 MiB/file), dimension/pixel ceilings, EXIF removal on processed output; retries and 15-minute recent-auth rule for alias changes; approved coarse locality catalog and trusted H3 derivation. Treat these values as **technical proposals**, not pre-existing contract or user confirmation. API contract companion identifies them as proposed and provides error behavior.

If an unresolved rule affects public visibility/security, fail closed and document the decision rather than opening discovery with guessed data.
