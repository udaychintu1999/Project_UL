# U_luv — P02-0 Requirements Traceability and Automated-First Test Matrix

**Status:** Requirements mapped, tests **NOT IMPLEMENTED/NOT EXECUTED**; P02-0 is a design/documentation milestone only.  
**Sources:** approved P02 decisions (2026-11-15), `docs/implementation/phases/P02.md` D1–D3/T1–T3, `docs/product/PRODUCT_CONTRACT.md`, existing local DB/auth architecture.

## 1. Traceability

| ID | Requirement / invariant | Owning implementation | Required verification | Milestone |
|---|---|---|---|---|
| P02-R01 | Retain immutable UID; unique account handle | `uluv_users` alias transaction + Flutter onboarding | Two users race for same alias; rename rollback/conflict | 1 |
| P02-R02 | Independent Dating/Friendship display names/bios/drafts | `uluv_profiles` two separate mode records | Edit one; other unchanged; reopen | 1 |
| P02-R03 | Real P01-2/P01-3 authenticated authorization | Shared `requireSession` integration | expired/revoked/family replay; cross-user attack | 1 |
| P02-R04 | Save drafts without activating | CAS draft editor, per-field validation | Incomplete draft persists; active remains false | 1 |
| P02-R05 | Server-derived age from P01 self-declared DOB | `uluv_users.birthDate` server calculator | Birthday boundaries/leap day/time zone; no DOB leak | 1/3 |
| P02-R06 | Broad chosen locality, no GPS exposure | `uluv_settings` selected locality | No arbitrary coordinate; edit/persist/revision | 1/3 |
| P02-R07 | Local-only private photo upload and storage | `features/media` adapter + Flutter picker | Real bytes, MIME/decode/size/type, restart persistence | 2 |
| P02-R08 | Media reused safely across two modes | owned media + independent ordered ID lists | Attach both; remove one; delete race/other remains | 2 |
| P02-R09 | Two to six valid photos per active mode | server eligibility and atomic updates | Counts 0/1/2/6/7; invalid assignments | 2/3 |
| P02-R10 | Independent explicit activation/deactivation | mode lifecycle + restricted/safety gates | Activate/deactivate both independently; decline when incomplete | 3 |
| P02-R11 | Fail-closed visibility after photo loss | mode state + discovery pointer consistency | Remove second photo and assert no public preview or pointer leakage | 3 |
| P02-R12 | Public preview contact-safe and private-field-free | allowlisted projection + text sanitizer | Banned/private fields absent; contact obfuscation tests | 3 |
| P02-R13 | Locality/discovery responsibility boundary | pointer eligibility only, P03 queries excluded | No P03 discover/match/chat endpoints added | 3 |
| P02-R14 | Recover upload/DB/network errors and app restart | idempotent staged media, Flutter retry | interrupted upload, abort, crash re-open, storage restart | 2/4 |
| P02-R15 | Preserve P00/P01 accepted security/features | regressions, no protocol edits | `verify:p01-3:portable`, typecheck, Flutter, integration | 1–4 |
| P02-R16 | No AWS/cloud/payments; local default | local safety/config and offline guards | offline cloud/secret scans and safe package inspection | 0–4 |
| P02-R17 | Documentation, true status and Windows handoff | docs, evidence, update ZIP | explicit observed command results, no false PASS | 0–4 |

## 2. Mandatory test levels

**T1 — deterministic / unit:** Handle normalization and reserved names; text/contact filters (Unicode confusables, homoglyphs, URL forms, email/phone/social handles); birthdate and adult boundary; profile required-field rules; mode status; photo counts at 0/1/2/6/7; path/media signature validation; idempotency and version conflicts. Tests must assert behavior and include negative cases, not only regex/source formatting.

**T2 — real API + Java DynamoDB Local:** Create real P01 identity; sign in; reserve alias; read/update both modes independently; concurrent aliases and CAS; cross-user profile/media calls; account restricted/revoked/expired; upload actual files; failed/partial upload cleanup; concurrent media attach/remove; controlled database outage/restart and retry; no private projection fields. **Owner starts Java DynamoDB Local manually.** No real AWS provider.

**T3 — Flutter widgets + USB Android:** New-login onboarding → choose handle → save two distinct drafts → app restart and restore → select and upload two distinct photos → assign/reorder/reuse across modes → activate Dating and Friendship → limited preview → remove photo from only one mode and confirm only it pauses → handle offline, slow progress, Back, tiny screen, revoked session and retry. Validate actual backend operations rather than mock-only completion.

**Regression:** Preserve the previously owner-accepted P00/P01 functionality. Maintain P01-1 standalone Android OTP automation `FAILED`/local-development exception (no false PASS). Do not alter P01-3 refresh, device sign-in or 30-day deadline.

## 3. Planned scripts (do not claim these exist now)

Scripts to implement in P02-1..4 following existing conventions, after checking actual package scripts:

```powershell
npm run test:p02:unit
npm run test:p02:integration
npm run test:flutter:p02:e2e
npm run verify:p02:portable
npm run verify:p02
```

Existing regression commands (actual existing package scripts, run when environment is ready):

```powershell
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
```

The complete `verify:p02` should enforce portable checks, semantic backend typecheck, real Java DynamoDB Local/API test, Flutter analyzer/widget tests, actual physical Android E2E and existing applicable regressions. If environment lacks Java/Flutter/USB, report corresponding gates **UNVERIFIED**, never PASS.

## 4. Release and owner gates

| Gate | PASS requirement | Current P02-0 status |
|---|---|---|
| Design approved choices | Eight owner decisions captured | `OWNER_APPROVED` (product only) |
| Implementation ready | Conventions, APIs, DB and media blueprint documented | `DESIGN_DOCUMENTED`; technical defaults may be finalized with P02-1 implementation |
| P02-1 real draft workflow | API, DB, Flutter and automated failure tests | `NOT_IMPLEMENTED` |
| P02-2 media workflow | Private local upload, edit/reuse/recovery with tests | `NOT_IMPLEMENTED` |
| P02-3 eligibility and projection | Explicit activation, privacy, canonical + pointer checks | `NOT_IMPLEMENTED` |
| P02-4 complete automated suite | All actually runnable tests pass | `UNVERIFIED` |
| Owner device/manual acceptance | Windows + USB device manual results accepted | `UNVERIFIED` |
| Production readiness | Release/age/content moderation/provider gates cleared | `NOT_APPROVED`, outside P02 |

## 5. Execution order for next milestone (P02-1)

1. Inspect original P01 auth and Flutter extension points; preserve existing tests.
2. Implement shared auth guard extraction without protocol changes; add regression cases for both legacy/P01-3 sessions.
3. Implement server validation, canonical handle transaction, independent mode draft CRUD, safe age and coarse locality settings with versioned writes.
4. Implement Flutter authenticated profile navigation and real editor through renewing API; persistent app restart and conflict/error handling.
5. Write executable unit/API/database/Flutter tests, run all tools actually available, fix failures and rerun.
6. Update P02-1 docs and QA evidence, run safe packaging/security checks, ship update-only ZIP.
7. Request owner Windows Java DB/USB evidence for unavailable gates; do not call P02-1 verified until observed.
