# U_luv — P02-0 DynamoDB, Media, Concurrency and Threat Model

**Status:** source-grounded implementation design, not implemented/tested.  
**Security order:** `docs/security/00_NON_NEGOTIABLE_GUARDS.md` > current phase and approved product contract > older proposals.

## 1. Existing source/architecture reconciliation

- The repository currently provisions **18** DynamoDB tables, with string `PK` and `SK`. Do not add tables, GSIs or app-side Scans for P02.
- P01 signup writes `uluv_users {PK:'USER#uid', SK:'META', uniqueId, status:'active', ageEligibility:'self_declared_adult', birthDate, sessionEpoch, identityRevision}` and `uluv_settings {PK:'USER#uid',SK:'SETTINGS', privacyDefault:'private'}`. The UID is UUID-generated and immutable.
- Existing `requireSession` is nested in `apps/api/src/features/auth/routes.ts`, supports P01-2 session digests and P01-3 purpose-separated access digests, checks token expiry, account status/epoch and device-family revocation. Reuse/extract without changing semantics. **Do not implement a profile-only authenticator.**
- `buildApp` in `apps/api/src/app.ts` uses `bodyLimit:16*1024` and local/test feature registration. Do not increase global JSON limit for photo bytes. Introduce route-scoped authenticated streaming with capped size and early abort in P02-2.
- Flutter entry uses `PersistentAuthGate`, `RenewingAuthService`, and `AuthScreen`; profiles must be integrated only after server-validated persistent authentication.
- `.gitignore` already ignores `.local/`; ensure output ZIP never contains local images, metadata, private customer data or credentials.

## 2. Existing-key layout (no schema-breaking migration assumed)

| Table and key | Authorized purpose | Invariant |
|---|---|---|
| `uluv_users`: `USER#uid / META` | Immutable UID, DOB, eligibility/status, mutable normalized handle + identityRevision | Guarded conditional update; never show private fields |
| `uluv_users`: `HANDLE#normalized / META` | Unique handle → UID mapping | Conditional create; old mapping removed atomically after rename |
| `uluv_profiles`: `USER#uid / MODE#DATING` | Dating mode draft/intent/ordered media IDs/version | Owner-only writes; independent of Friendship |
| `uluv_profiles`: `USER#uid / MODE#FRIENDSHIP` | Friendship mode draft/intent/ordered media IDs/version | Owner-only writes; independent of Dating |
| `uluv_profiles`: `USER#uid / MEDIA#mediaId` | Shared user-owned media metadata/lifecycle | Never trust a client `uid` or file path; refs only to owner's READY media |
| `uluv_settings`: `USER#uid / SETTINGS` | User-selected broad locality, revision | Single authoritative setting, not duplicated in mode payload |
| `uluv_discovery`: `DISC#MODE#R6#cell / JOIN#ISO#uid` | One candidate pointer per eligible mode when locality is valid | Pointer not proof of current eligibility; canonical recheck required |

A profile record can start with `version=1`, a timestamp, `requestedActive=false`, empty ordered photos and validated draft fields. `version` changes on every successful mutation. Absent profile creation uses conditional Put; edits use `version = :expected` CAS. Revision conflicts return `409 profile_version_conflict`. Draft saves may preserve genuinely incomplete records; invalid supplied fields are rejected, not silently accepted.

Existing users may have no handle/profile. P02-1 must support adding these records without requiring account re-registration or P01 credential modification. No automatic write migration should run on login.

## 3. Access patterns (direct keys only)

- Own dashboard: Get `uluv_users USER#uid/META`, `uluv_settings USER#uid/SETTINGS`, and two Get/BatchGet mode records.
- Create/edit mode: Get canonical owner record plus conditionally Put/Update exact mode item, preserving all unrelated fields and the other mode.
- Handle availability/claim: Get `HANDLE#normalized/META` for UI hint only; actual uniqueness enforced by conditional transaction when saving.
- Locality: conditionally update `uluv_settings USER#uid/SETTINGS` revision; P02-3 updates relevant active pointers consistently as approved geography becomes available.
- Media access: Get one owner media key (`USER#uid/MEDIA#mediaId`), or bounded Query `PK=USER#uid` with `SK begins_with MEDIA#` for owner's library. No user-wide scan.
- Public handle preview: Get handle mapping → owning mode → owner user state → relevant block keys → media records; reject if any canonical precondition fails. No raw mapping UID in the response.
- P03 location discovery: **not part of P02**; later uses bounded H3 queries and rehydrates authoritative profiles.

## 4. Atomicity and race cases

### Handle rename

One DynamoDB transaction can `Put` new alias if absent, `Update` user's canonical handle with identity-revision CAS, and `Delete` previous alias only if it still maps to that UID. No two actions may operate on the same item. If old == new, do nothing beyond verification. Race with a second rename must fail cleanly and re-read state.

### Profile edits

On PUT, require `expectedVersion`. A conditional Put or Update ensures only one of two concurrent saves wins; the client losing a conflict reloads and displays its unsaved edits for deliberate reconciliation. Mode A's edit must not rewrite Mode B's record or change activation flags through an ordinary draft form.

### Media reuse and concurrent deletion

A photo selected by both modes is still one physical object and one owner-media record. A deletion is permitted only after a strongly consistent check and a **conditional transaction** that proves neither mode references it. In a concurrent photo-attachment/deletion race, both operations must synchronize on the same guard record/version or use a transactional ref counter plus checks; a read-then-delete-only approach is **unsafe**. Suggested strategy: each attachment transaction validates/increments the media record version, each deletion transaction conditions on the same media version and zero references. Never rely only on eventual reads; retain a `DELETING` tombstone until physical cleanup.

### Removing one photo / activation visibility

If a previously active mode drops from two valid photos to one, **mode eligibility and discoverability are suppressed in the same logical mutation**, and any pointer update/removal must be transactionally coordinated with canonical mode state. If pointer removal fails, canonical `requestedActive/eligibility` checks must still hide the profile; record retryable pointer-cleanup state. The other mode is unaffected unless it independently loses its own assigned photo.

### Locality changes

Locality resides in settings with its own revision; any change that invalidates a previously active pointer must move/rematerialize or suppress visibility with revision CAS. Do not create a usable discovery pointer from untrusted client coordinates. Exact H3/cell implementation is an implementation dependency; do not claim active discoverability before this is resolved.

## 5. Local-only media adapter, storage and failure model

P02-2 implements `beginUpload`, `finishUpload`, `getAuthorizedAccess`, `remove`, `purgeExpired`, `inspectMetadata` under the existing `docs/architecture/11_MEDIA_STORAGE_ADAPTERS.md` interface. The default `MEDIA_STORAGE_DRIVER=local` uses ignored `.local/media/` with user-opaque, randomized object paths. Only internal service code constructs absolute paths; normalize/resolve paths under a known fixed root and refuse escapes/symlinks. Never return server paths to Flutter.

Recommended staged flow:

1. Validate authenticated owner and bounded metadata; create `UPLOADING` media record with randomized media ID, upload ticket expiry and request idempotency key.
2. Stream bytes to an unguessable temp file, with size cap while streaming; abort oversized/disconnected uploads and remove temp object.
3. Verify actual detected type and decode image within pixel/dimension bounds; reject malformed, unsupported and unsafe metadata; normalize processed image/strip EXIF when feasible. On errors, record stage/error category and remove temp file.
4. Atomically rename to a private, durable local file under `.local/media/` and transition the owned metadata to `READY` with checksum/bytes/format/version. A crash between filesystem rename and metadata commit must be reconciled by a bounded cleanup/recovery scan of **known pending metadata** or an adapter-local journal, not by public exposure.
5. Attach only `READY` media owned by the session UID to one/both modes via versioned operations. Return no success until authoritative DB state agrees.
6. Removal first blocks new attaches, sets a `DELETING` checkpoint, updates references safely, then deletes the file. If file deletion fails, retry safely; do not resurrect a deleted object by changing a stale record.
7. For local access, use a server-checked authenticated endpoint or short-lived scoped synthetic token after viewer authorization. Tokens expire/revoke; image response should be private/noncacheable and must not reveal the disk path.

**Development-only lifetime:** files survive an ordinary API restart so end-to-end persistence is testable. The owner may explicitly delete `.local/` as disposable test data. Production storage and migration are deferred to P17; DEV S3/CloudFront integrations are optional *only after new narrowly scoped owner authorization*.

**Security caution:** a simple extension check is insufficient. Resource limits must cover bytes, dimension bomb, decoder safety/timeouts, slow uploads, broken streams and excessive concurrent uploads. Real content/QR/NSFW moderation is **not** claimed by file validation.

## 6. Threat register

| Threat / failure | Required protection and acceptance test |
|---|---|
| Client sends another user's UID/media ID | UID derived from session; media owner checked on every write/read; 403/404 no private leakage |
| Forged `requestedActive`, DOB, age, homeCell in JSON | Allowlist keys; reject server-owned fields; activation only explicit endpoint |
| Handle collision or concurrent rename | Atomic conditional transaction, unique normalized alias, CAS and 409 |
| Stolen/revoked P01 access credential | Reuse existing session validation and device family revocation checks, no cloned auth |
| Oversized/polyglot/path-traversal image | Streaming cap, decoder sniffing, sandboxed storage root, randomized IDs |
| Deleting shared media removes other mode's photo | Transactional ref guards, tombstones, race tests |
| Crash after file write / before DB update | Staged journal/record, bounded reconciliation and idempotent retry |
| Removed photo still visible via stale discovery pointer | Canonical eligibility check first, coordinated pointer cleanup, privacy-first fail closed |
| Locality used to infer exact home | Store only user-selected broad location; public DTO gives coarse label, no coordinate |
| Restricted/underage account gets public preview | Strongly consistent account/eligibility read and block gates before response |
| Bio hides phone/external contacts | Backend reject/neutralize, Unicode/canonicalization/format tests; acknowledge imperfect coverage |
| Production endpoint accidentally reaches development files | Config-env register guard, loopback API, no production media driver; security tests |
| Private data leaks in logs or errors | `Cache-Control: no-store`, Pino header/url redaction, safe error codes; test zero accidental DTO/log fields |
| Exhaustion via repeated upload tickets | Per-account bounded outstanding uploads, TTL cleanup and request rate controls (thresholds reviewed at implementation) |

## 7. No-scope-change guarantee

Do not modify the 18-table provisioner, auth token lifetime, password/OTP behavior, session epoch semantics or mobile Keystore for P02. No migration is needed merely to add new **items** into existing tables. If a later measured implementation need truly requires new keys/tables/GSIs, write a separate ADR and request approval *before* changing infrastructure.
