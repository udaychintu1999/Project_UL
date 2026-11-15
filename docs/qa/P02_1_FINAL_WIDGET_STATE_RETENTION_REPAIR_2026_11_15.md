# P02-1 — V4 Follow-up: Handle-Only Save / Unsaved Form State

**Date:** 2026-11-15  
**Scope:** P02-1 common-profile onboarding widget regression only. **No P02-2, P03, auth, database, schema, media or cloud change.**

## Latest owner Windows evidence (before V4)

- `npm run verify:p02-1:portable`: **PASS** — all existing source and QA guards.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run test:flutter`: **FAILED** — one test: `P02-1 handle saving preserves unsaved common and mode fields`; `find.text('Unsaved Common Name')` matched zero widgets at the post-handle-save assertion. All other reported Flutter tests passed; Flutter analyzer reported no issues.
- `npm run test:p02-1:integration`: **PASS** — real local Fastify/DynamoDB setup, privacy, username, drafts and restrictions.
- `npm run test:flutter:p02-1:e2e`: **PASS** — physical Android, real API/DB, session and profile persistence; isolated test app cleanup confirmed by runner. No base-app uninstall warning in latest log.

These are owner-supplied results, not execution in the authoring environment.

## Cause and protection

The reported `find.text` failure is **not alone proof** of a lost `TextEditingController` value. Flutter's text finder supports `EditableText`, but only matches widgets currently found in the active widget tree; render/visibility and actual state loss must be distinguished. The existing `saveHandle()` already attempted to rely on `dirty` and `commonDirty` to protect form text during the authoritative dashboard refresh. A handle-only write is *account identity*, not a common/mode draft save, and should not reload either editor at all.

V4 changes:

1. Add explicit `preserveEditors` to the dashboard/status refresh. **Handle Save calls `refreshAfterDraftSave(preserveEditors: true)`** to retain all controller values, regardless of dirty-flag timing.
2. Leave normal draft-save refresh behavior unchanged, and continue to clear controls on authorization failure as before.
3. Strengthen the widget regression to read the **keyed `TextField.controller.text`** both before and after saving the handle. This asserts actual editable data retention, not merely a text lookup. It also verifies the unrelated common/draft records were not accidentally persisted, the common Save remains available, and handle Save becomes disabled after success.
4. Add a formatting-tolerant source safety check and a negative mutation: removing the handle-only `preserveEditors: true` boundary fails the guard.

**Uncertainty:** Flutter tests could not run here because Flutter/Dart SDK is not installed. If the controller checks still fail on Windows, treat this as a real state-loss defect, preserve the failure and request a targeted manual reproduction before another speculative patch. Do not delete or bypass the widget test.

## Windows test sequence

In the existing project root, merge this changed-files update and run:

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
```

The real local integration and physical Android tests **already passed in the latest owner run**. Rerun those only if `npm run test:flutter` passes and the owner wants a fresh full post-patch signoff; keep Java DynamoDB Local and Fastify running:

```powershell
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

## Manual diagnostic if Flutter still fails

With Java DynamoDB Local and Fastify running, `npm run dev:flutter` on the normal phone (do not clear app data). On the Common Profile screen, enter a **synthetic** unsaved name, then a synthetic Dating bio; change and **Save handle** without saving either editor. Expected: both unsaved values remain, Common Save remains available, and username is saved. Return to Settings and Home: the two-tab shell should preserve the unfinished editors. If any value disappears, report the exact step and non-sensitive UI message; **do not share real usernames, personal profile content, tokens or device session data**.

## Status

`SOURCE_REPAIRED` / authoring `PORTABLE_VERIFIED` (when green) / owner Flutter `UNVERIFIED after V4`. P02-1 not fully closed; P02-2 not started. P01-1 Android OTP automation exception unchanged.
