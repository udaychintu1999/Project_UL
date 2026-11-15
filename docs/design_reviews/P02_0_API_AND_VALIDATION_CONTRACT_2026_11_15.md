# U_luv — P02-0 API, Input and Flutter Contract

**Status:** Implementation blueprint (`PROPOSED` endpoint/limit details; product requirements APPROVED in companion scope file). No routes below currently exist.  
**Cross-reference:** `P02_0_APPROVED_SCOPE_AND_IMPLEMENTATION_CONTRACT_2026_11_15.md`.

## 1. API conventions

- All routes use `/v1` and JSON except the explicitly streaming local-media request/response. Normal P01 bearer access remains mandatory; profile operations do not require a dev-key bypass. Only register P02 routes under the existing `local`/`test` environment gate until a later production runtime is expressly designed.
- Responses use P01-style `{ error: 'stable_code' }` on failure, `Cache-Control: no-store` for all user/profile/private-media responses and no raw database item serialization. Return a typed safe DTO; never echo raw input on validation failure.
- Path `:mode` accepts exact `dating` or `friendship`. Authenticated user UID is always derived from P01's validated session; **no UID in mutation path/body**. Incoming `expectedVersion` is a bounded positive integer to enforce compare-and-swap; no blind lost updates.
- Standard mapping: `400` invalid input/unknown mode, `401` missing/revoked session, `403` ineligible/restricted/forbidden, `404` absent or inaccessible record, `409` unique-handle/version/state conflict, `413` excessive upload, `415` unsupported actual image type, `422` validation/incomplete profile, `429` rate abuse, `503` local storage/DB unavailable; `500` safe fallback.
- A `409` response returns stable error code and optional current **own** resource version only; Flutter re-fetches and offers review/retry rather than silently overwriting. Avoid blind retry after an ambiguous commit; re-read authoritative state first.

## 2. Proposed routes, introduced by slice

| Slice | Method/path | Intent | Result |
|---|---|---|---|
| P02-1 | `GET /v1/profiles/me` | Owner dashboard summary | `handle`, Dating/Friendship summaries, coarse locality, completeness and version |
| P02-1 | `PUT /v1/profiles/me/handle` | Reserve/change account handle | `handle`, `identityRevision`; atomic uniqueness enforcement |
| P02-1 | `GET /v1/profiles/me/:mode` | Owner read | safe **owner** DTO or explicit absent state |
| P02-1 | `PUT /v1/profiles/me/:mode` | Create/edit draft | validated mode DTO, `version`, completeness and errors; must not activate |
| P02-1 | `PUT /v1/profiles/me/locality` | Choose a trusted coarse locality | safe label/ID, `localityRevision` (never arbitrary coordinate) |
| P02-2 | `POST /v1/media/profile/uploads` | Begin bounded local image upload | opaque `mediaId`, upload ticket/instructions; authenticated owner |
| P02-2 | `PUT /v1/media/profile/uploads/:mediaId/content` | Stream validated bytes | upload receipt; guarded ticket/session; non-global request limit |
| P02-2 | `POST /v1/media/profile/uploads/:mediaId/complete` | Finalize validated upload | owned media metadata, reusable media ID |
| P02-2 | `PUT /v1/profiles/me/:mode/photos` | Replace ordered list of attached owner media IDs | updated mode version/completeness (0–6 photos) |
| P02-2 | `DELETE /v1/media/profile/:mediaId` | Remove unreferenced owned media / mark deletion | safe receipt or `409 media_in_use` |
| P02-3 | `POST /v1/profiles/me/:mode/activate` | Explicit activation | current computed eligibility, state and mode version |
| P02-3 | `POST /v1/profiles/me/:mode/deactivate` | Explicit pause | requestedActive=false, discovery suppressed |
| P02-3 | `GET /v1/profiles/:mode/:handle/preview` | Restricted public-safe preview | allowlisted DTO only if eligible/authorized; otherwise neutral inaccessible |
| P02-3 | `GET /v1/media/profile/:mediaId/content` | Authorized image delivery | no direct filesystem paths, owner or authorized viewer checks |

Paths are **not shipped endpoints** until corresponding slice is implemented. For `preview`, the server resolves handle mapping to UID, checks both current user statuses, blocks, mode activation, locality/discovery authorization where applicable, and returns at most two photos; an authenticated query alone does not grant indiscriminate browsing.

## 3. Proposed data shapes

Owner draft update example (not final field limits):

```json
{
  "expectedVersion": 1,
  "displayName": "Asha",
  "bio": "I enjoy books and long walks.",
  "interests": ["reading", "walking"],
  "intention": "friendship"
}
```

The mode comes from the path, not the payload. The server ignores/rejects prohibited fields such as `uniqueId`, `birthDate`, `age`, `status`, `visibility`, `sessionEpoch`, `ownerUid`, `mediaPath`, `homeCell` and `requestedActive`. Fields not yet defined by the approved product contract are explicitly **not** accepted until their semantics are reviewed.

Owner mode DTO proposal:

```json
{
  "mode": "friendship",
  "exists": true,
  "displayName": "Asha",
  "bio": "I enjoy books and long walks.",
  "interests": ["reading", "walking"],
  "intention": "friendship",
  "photoIds": [],
  "requestedActive": false,
  "completeness": { "ready": false, "missing": ["photos", "locality"] },
  "visibility": "inactive",
  "version": 2
}
```

Public-safe projection proposal:

```json
{
  "handle": "asha27",
  "mode": "friendship",
  "displayName": "Asha",
  "age": 27,
  "broadArea": "Selected city",
  "intention": "friendship",
  "interests": ["reading", "walking"],
  "bio": "I enjoy books and long walks.",
  "previewPhotos": [
    { "mediaId": "opaque-id-1", "access": "short-lived-authorized-reference-1" },
    { "mediaId": "opaque-id-2", "access": "short-lived-authorized-reference-2" }
  ]
}
```

The example uses a fictional name and example values; it is **not a fixture, seeded identity or proof of an actual account**. In real public results, limit previewPhotos to min(2, available); never expose local paths, precise locality center or canonical UID. A public preview is not emitted if active-mode two-photo eligibility is unmet.

## 4. Exact validation principles; numeric technical defaults still subject to source review

| Attribute | Enforced contract | Proposed bounded implementation rule |
|---|---|---|
| `@handle` | One unique normalized account-level alias; changeable with controls | ASCII lowercase, case-insensitive; 3–24 chars, starts with letter, remaining letters/digits/underscore; reserved words and lookalike/confusable non-ASCII rejected rather than normalized unpredictably |
| Display name | Mode specific, suitable for public display | Trim/canonicalize, 1–60 Unicode characters; no control/bidi spoofing; contact-safe public text |
| Bio | Mode-specific, public/contact-safe | Up to 500 Unicode chars; reject/neutralize URLs, email, phones, QR/social handles and contact solicitation; no markup execution |
| Interests | Mode-specific bounded selections | Up to 10 unique IDs, known catalog only, stable ordering; catalog determined by product UX review |
| Intention | Mode-specific value | Mode-appropriate explicit enum; final choices and mandatory fields not yet locked |
| DOB/age | Immutable P01 DOB input, server-derived age | Calendar-accurate completed years, not `today.year - birth.year` alone; account restrictions prevail |
| Broad locality | User-chosen coarse area only | Approved locality ID/display catalog with server-owned center and revision; no user-supplied GPS or exact street |
| Photo IDs | Owner-owned, uploaded and validated, independent mode order | 0–6 unique IDs per mode; 2–6 valid photo refs to activate, single media may belong to both modes |
| Image transport | Server validates content, size and ownership | JPEG/PNG/WebP, e.g. <=8 MiB, bounded dimensions/pixels; inspect magic bytes AND decode, reject dangerous polymorphic/truncated content; final thresholds decided when image pipeline is chosen |
| Request body | Small JSON mutations, streaming media | Keep existing global 16 KiB body limit for JSON; media route has separately defined maximum and streaming parsers |

**Note:** limits and enums in the rightmost column are engineering proposals, not owner-approved product requirements. Do not introduce a mandatory arbitrary username-change cooldown, unapproved gender field, or locality list silently.

## 5. Username transaction/abuse considerations

- Current identity owner record is `uluv_users USER#uid/META`, alias record is `HANDLE#normalized/META` in the **same table**. In one DynamoDB transaction: conditionally put the new alias (absent), conditionally update the existing user's alias + identity revision, and conditionally delete the old alias only if it points to the same UID. A no-change request should be idempotent. Beware DynamoDB's one-action-per-item transaction rule.
- On races, only one normalized handle claimant wins; the loser receives `409 handle_taken` without leaking the winner's internal UID. Failed transactions must not leave both aliases pointing to the same user.
- Handle edits require valid session and an account-state check; recommend recent interactive authentication for changes, with clear user reauthentication UX rather than silently rejecting P01-3 renewed sessions. Exact freshness threshold is a **technical proposal**, not approval to modify P01.
- Canonical identity mapping is not a substitute for eligibility checks. Old handle routes must fail immediately after a successful rename; cached public references need a re-resolution policy.

## 6. Flutter integration and navigation contract

- Integrate the profile entry point *inside* the existing `PersistentAuthGate` authenticated branch. Reuse `RenewingAuthService` and its session restoration/refreshed token; never persist account data in an unauthenticated widget or bypass offline/restricted state.
- Feature boundary: `apps/flutter_app/lib/features/profiles/` with typed models, API client, controller/state and accessible forms; shared API helper only if reusable. No wholesale auth-screen rewrite.
- P02-1: first entry to profile onboarding, handle selection, mode editor, Save draft, switch modes, reopen after app restart. Incomplete inputs show exact missing fields, without blocking draft saving unless the supplied field is invalid.
- P02-2: use Android system picker with permission-minimizing integration, image preview and cancel/retry, upload progress, reorder, attach/remove, cross-mode reuse. A failed upload must not create a green/success state.
- P02-3: explicit mode activation, independent deactivation, reasoned ineligibility banners, privacy-safe preview. Back navigation preserves last saved state; unsaved changes prompt when destructive.
- Each API call must have busy/disabled/retry and typed error mapping; no dead callback. Async callbacks check mounted state/dispose controllers correctly. Small screen and Android keyboard must not obscure critical Save/Apply controls.

## 7. Dependency and security gates

No local profile route may become an unauthenticated development bypass. No real S3, CloudFront or paid image service. `MEDIA_STORAGE_DRIVER=local` is the only implemented driver in P02. Platform image dependencies must be justified by actual decode/picker needs, tested on Windows/physical Android and reflected in lockfiles. Do not add general body-size overrides, unbounded filesystem paths, remote URLs or arbitrary file extensions.

## 8. Implementation checkpoints

- **P02-1** must demonstrate: a newly authenticated UID can reserve a handle, save/edit each independent mode record and reload on Android; error/conflict/unauthorized cases tested against the **real** local backend and database.
- **P02-2** must demonstrate real bytes uploaded, stored under ignored local media root, assigned to modes and retrieved/removed safely; file integrity and crash-recovery tests.
- **P02-3** must demonstrate a server-authoritative activation gate, safe preview DTO and no visibility on invalid photo count/age/restriction/locality; no premature P03 discover endpoints.
- **P02-4** must pass regressions and owner manual acceptance; no fabricated test evidence.
