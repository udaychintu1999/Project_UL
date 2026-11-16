# P02-2 — Mandatory two-photo onboarding Continue gate (2026-11-15)

## Approved rule and the corrected defect

The owner confirmed that **minimum two valid photos per enabled mode** are required **before the onboarding Continue action**, not just before future public discovery. Each selected Dating and/or Friendship mode must have a saved bio, intention, at least one interest, and **two distinct owner-owned photos uploaded, normalized and assigned to that mode**. The maximum is six per mode; the same uploaded object may be reused across modes. Incomplete drafts remain savable. With no enabled mode, Continue remains locked.

The original Dating design remains unchanged: gender identity is separate from romantic preferences, with the original gender options (including `prefer_not_to_say`); Dating discovery preferences are user-controlled, not compulsory opposite-gender matching. The owner-level username, display name, explicit gender selection and self-declared broad city are required. Public discovery activation, trusted location, moderation and future Home/discovery remain separate later work.

**Root cause:** the previous `onboardingMissing` only checked shared details and text drafts; it never counted per-mode photos. The P02-2 Flutter photo panel updated its local photo list but did not refresh the authoritative onboarding status. Those defects allowed Continue with zero photos and could leave its state stale after uploading or removing a photo.

## Source changes

- `apps/api/src/features/profiles/validation.ts`: requires two distinct verified IDs for **every enabled mode**, reports `dating.photos`/`friendship.photos` in `onboarding.missing`. Drafts still accept 0–1 photos.
- `apps/api/src/features/profiles/routes.ts`: a bounded, strongly consistent BatchGet (maximum 12 unique photo IDs) validates owner PK/SK, UUID, `READY` state and positive `refCount`. Uploaded-but-unassigned, pending/deleted, foreign and duplicate photos cannot satisfy the gate. Incomplete/unprocessed reads fail closed instead of claiming success. Per-mode completeness also uses the validated subset, though discovery eligibility still remains inactive.
- `apps/flutter_app/lib/features/profiles/profile_workspace.dart`: clear photo requirements and missing-field guidance. Photo-assignment callback immediately closes a potentially stale Continue gate, then fetches a fresh dashboard while preserving unsaved Common/Dating/Friendship editors. If the refresh fails, Continue remains disabled until a successful reload.
- `apps/flutter_app/lib/features/profiles/profile_photos_panel.dart`: wording clearly distinguishes the onboarding two-photo rule from later discovery activation.
- Tests: deterministic backend unit cases for 0/1/2/duplicates, one vs two enabled modes, and disabled-mode independence; real local API/DynamoDB transitions for READY vs library-only, 0/1/2 assigned, both-mode reuse, removal, persistence and no discovery; Flutter widget tests for actual photo-panel callbacks and gate re-lock; isolated physical Android media E2E checks authoritative status. P02-1 real integration and E2E expectations updated to correctly remain incomplete with zero photos.

## Verification at package creation

- **EXECUTED / PASSED:** `npm run test:unit` (36 backend unit tests); `npm run verify:p02-2:portable` including P00/P01/P02-1/P02-2 source/unit/safety checks; JavaScript syntax checks.
- **NOT EXECUTED:** semantic `npm run typecheck`, ESLint, Flutter analyzer/widgets, Fastify against Java DynamoDB Local, physical Android E2E or manual native chooser on the owner workstation. npm offline install was unavailable (`ENOTCACHED` for an unrelated dependency). Do **not** report these checks as passing for the new patch.
- Prior owner P02-2 tests passed against earlier source; they are valuable historical evidence but **do not verify this new change**.

## Security, migration and operational boundaries

Only existing 18 tables and owner partition keys are used. No new table, AWS service, paid provider, credential, payment, P01 session change, new gender rule, P03 discovery or activation bypass is introduced. `.local/media/` remains local-only development storage; existing data is preserved. A photo is counted if its metadata is an owner-owned READY record and it is assigned to that mode; a corrupted/deleted-on-disk local object despite intact metadata needs separate operational reconciliation and cannot be inferred from metadata alone. No public media read is introduced.

## Mandatory Windows tests and acceptance

Run from project root after merging patch (no new dependencies):

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
# Manually start your usual Java DynamoDB Local, and launch the API: npm run dev:api
npm run test:p02-1:integration
npm run test:p02-2:integration
npm run test:flutter:p02-1:e2e
npm run test:flutter:p02-2:e2e
```

Then confirm manually on **only your test account**: save common details and one mode's text; Continue disabled at 0/1 assigned photos; upload and assign 2 validated photos; Continue enabled after server confirmation; remove one and Continue disables; enable another mode and Continue disables until that mode has 2; reuse existing photos in both modes; disable an incomplete mode and verify the remaining complete mode unlocks; close/reopen and confirm status persists. Verify no profile has become public. See `docs/manual/P02_2_TWO_PHOTO_CONTINUE_WINDOWS_ACCEPTANCE_2026_11_15.md` for full step-by-step.

**Status: SOURCE_IMPLEMENTED / PORTABLE_VERIFIED / WINDOWS_AND_OWNER_ACCEPTANCE_PENDING.** P02-3 has not begun.
