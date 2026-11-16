# U_luv P02-2 — Android UI stopped after checkpoint 12 (root-cause repair)

**Date:** 2026-11-15  
**Status:** Source repaired and portable guards verified; Windows Flutter and physical Android RETEST REQUIRED.  
**Scope:** P02-2 UI integration test and regression guard only. No production UI, backend, authentication, database, media, or eligibility changes.

## Evidence from the owner's Android run

The physical Android P02-2 media/API test PASSed. The new screen-driven Android suite PASSed checkpoints 01–12, including account login, handle, common/mode fields, two image uploads through the real Flutter controls, cross-mode image reuse, photo removal, UI refresh, and Keystore-backed restore. The earlier failure at checkpoint 13 showed that `tester.tap()` hit the fixed navigation area rather than Continue. After a subsequent viewport-positioning patch, the owner reported the test simply stopped after checkpoint 12 with no further action.

## Verified source defect

`_tapReadyContinue` called `await Scrollable.ensureVisible(... duration: const Duration(milliseconds: 250))` **before** `tester.pumpAndSettle()`. Under Flutter widget/integration tests, scheduling a scroll animation and then awaiting its completion before advancing any test frame can deadlock. The code never reaches the frame-pumping call and therefore never taps Continue or prints checkpoint 13. A general 12-minute test timeout is not a meaningful substitute for a frame-safe scroll.

## Fix

1. Replace that animated scrolling operation with a zero-duration `Scrollable.ensureVisible` and then pump an explicit layout frame.
2. Retain the render-rectangle check that the real Continue button sits below the AppBar and above the fixed bottom navigation; keep bounded retry drags if needed.
3. Replace the fallback's `pumpAndSettle` with a bounded 100 ms frame to avoid waiting on unrelated persistent animations.
4. Print a progress message before positioning the button and another only after it is confirmed unobstructed, immediately before the real pointer tap.
5. Keep the final assertion requiring the actual `p02-setup-ready` screen; do **not** call `onPressed()` directly, disable hit-test warnings, or pretend a UI pass from an API-only test.
6. Add a negative regression check that fails if a nonzero awaited scroll animation is reintroduced.

## Executed here

- `npm run test:p02-2:ui:contracts`: executed, all checks PASS.
- `npm run verify:p02-2:portable`: run and report its result separately in the delivery.
- Flutter SDK and Android/Java DynamoDB Local are unavailable to this environment; physical-device execution remains UNVERIFIED.

## Windows recheck

With Java DynamoDB Local and Fastify already running, phone attached, and ADB reverse configured by the test runner:

```powershell
npm run test:flutter:p02-2:ui:e2e
```

Expected final sequence:

```text
P02-2 UI PASS 12: cold widget restart restores real session, fields and ready state
P02-2 UI STEP 13: positioning Continue for a real pointer tap
P02-2 UI STEP 13: Continue is visible; performing real tap
P02-2 UI PASS 13: Continue opens private completion screen, not discovery
All tests passed!
```

If either `STEP 13` line is followed by a failure, that failure is meaningful; capture the **sanitized** relevant log and any screenshot of the isolated app. Do not share passwords, refresh tokens, session JSON, or personal photos. Do not clear/uninstall the normal U_luv app. If automated GUI testing remains unreliable after this targeted fix, complete the manual native picker/Continue acceptance with exact steps and maintain the automated test as FAILED until its own check passes.
