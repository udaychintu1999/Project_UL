# U_luv P02-5 — Physical Android Gate 12: Saved Photo Count Regression Repair

**Date:** 2026-11-16  
**Status:** SOURCE REPAIR + PORTABLE REGRESSION PASSED; **POST-REPAIR PHYSICAL ANDROID GATE 12 PENDING**. P02-4 previously owner-accepted; P02-5 is not yet complete.

## Owner Windows evidence (before this repair)

The owner supplied output from `npm run test:flutter` and the full `npm run verify:p02-5`:

- `flutter analyze`: **No issues found**.
- `test:flutter`: **54 Flutter widget tests passed**.
- P02-5 contract gate 1/2: **10/10 source contracts PASS**.
- The nested P02-4 gates **1–11/12 passed**: full portable regression, TypeScript, ESLint, local media store, Flutter widgets, live Fastify/DynamoDB Local, profile/media/activation integration, and both isolated Android API/media E2E runs.
- The isolated Android *real guided UI* Gate 12 reached checkpoints 01–04; picker preview and upload action were invoked. It then failed at `p02_2_ui_integration_test.dart:357` after 45 seconds with `P02-2 UI timed out: first saved Dating photo`.
- **Checkpoint 05 and later checkpoints were NOT observed.** The log did not include upload/assignment server error evidence, so it did not establish that the real upload failed.

## Actual root cause

The P02-5 redesign changed the visible saved-photo counter to `1 / 6` within a pink/teal badge. The Android integration test still waited for `find.textContaining('1/6 assigned')`, which no longer exists. The same copied-text dependency existed for `2/6 assigned`, Friendship reused-photo counts and removing a photo. As a result, the UI test could time out even if the backend successfully saved the photo.

The existing real `ProfilePhotosPanel` already exposes `Text('${attached.length} / 6', key: const Key('p02-photo-count'))`, where `attached` is taken from the current server-updated `ProfileDraft.photoIds` following the real repository `assignPhotos` operation. A mere picker preview or uploaded-but-unassigned library item cannot advance this count.

## Changes

1. **`apps/flutter_app/integration_test/p02_2_ui_integration_test.dart`** — Added `_savedPhotoCount` to read `p02-photo-count` as the actual Flutter `Text` widget and ignore whitespace. Added `_waitForSavedPhotoCount` that uses the existing bounded 45-second poll, then reports the current displayed count, the photo panel's user-facing status message and in-progress flag if the real operation fails. Replaced all **four copy-dependent checks**: first Dating upload, second Dating upload, Friendship photo reuse, and Friendship removal. The reusable-photo helper also calls the new function; no `1/6 assigned` or `2/6 assigned` lookup remains.
2. **`scripts/verify/p02-2-ui-journey.test.mjs`** — Added a failing-if-reverted regression guard to P02-4's mandatory portable suite, covering the keyed count, all four checkpoints, safe upload-error diagnostics and negative mutations restoring stale copy assertions. No test callbacks bypass the real Flutter buttons or the server.
3. **`docs/`** — Recorded owner evidence, actual root cause, remaining unverified Android state and retest commands.

**Unchanged:** All production Flutter widgets, backend API, authentication, local image storage, saved onboarding rules, image assignment, mode privacy, Keystore, DynamoDB tables and the existing isolated test package protection. No AWS or external services.

## Authoring-environment verification

- `node --test scripts/verify/p02-2-ui-journey.test.mjs`: **9/9 PASS** (8 prior + 1 new guard).
- `npm run verify:p02-5:portable`: **PASS**, including 40 backend unit tests and 10 P02-5 contracts.
- No Flutter or Dart SDK / physical Android in the authoring runtime. **Post-repair Flutter widget and Android execution have NOT been run here.**
- The owner's prior pre-repair `test:flutter` success remains valid evidence for the unchanged production/widget files, but is **not** post-repair Android acceptance.

## Windows execution

Extract the update-only ZIP over the **already patched P02-5 project** (do not revert any earlier P02-5 source files). With Java DynamoDB Local, local Fastify and the isolated USB Android test target running:

```powershell
npm run test:flutter:p02-3:e2e
```

Expect assertion-backed checkpoints **01 through 15** and Flutter `All tests passed!`. A count wait must only succeed when the current displayed server-backed count reaches the expected integer. If an image operation fails, the new error should show the photo-panel status without exposing media bytes or credentials.

Once the focused Gate 12 is green, run the complete regression one last time:

```powershell
npm run verify:p02-5
```

This must pass P02-5 2/2 and all nested P02-4 12/12 stages. Until then, P02-5 remains **NOT VERIFIED**, and public discovery remains fail-closed. The manual native SAF picker and visual checklist remain separate acceptance checks; mocked picker fixtures do not constitute native SAF confirmation.
