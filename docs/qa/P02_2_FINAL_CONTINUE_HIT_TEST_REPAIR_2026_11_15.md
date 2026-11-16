# U_luv — P02-2 Android UI E2E final Continue hit-test repair

**Date:** 2026-11-15  
**Milestone:** P02-2 local photo management  
**Status:** Implemented and portable-verified; real Android UI retest pending  
**Scope:** Test interaction and regression coverage only; no API, data model, authentication, P01 or user media changes

## Evidence from owner's Windows/Android run

- `npm run test:flutter:p02-2:e2e`: **PASS**, real API, device and local DB.
- `npm run test:flutter:p02-2:ui:e2e`: PASS checkpoints 01–12. Checkpoint 13 failed.
- Flutter detected an enabled `p02-continue` button but reported `tap()` center at `(205.7, 799.1)` did **not** hit the widget.
- The fixed `NavigationBar` occupied that hit-tested region; the following wait for `p02-setup-ready` timed out because the tap did not reach Continue.
- Earlier real assertions establish that the server-backed two-photo requirement and mode reuse worked. This is **not** grounds to weaken onboarding eligibility or skip checkpoint 13.

## Root cause and resolution

The shared `_tap()` helper called `tester.ensureVisible()` **before** removing keyboard focus, and did not verify that an enabled control was within the usable viewport above the fixed navigation bar. On a physical device, a target can be mounted and enabled yet be hit-test-obscured.

A dedicated `_tapReadyContinue()` now:

1. Unfocuses the active field before determining the scroll position.
2. Waits until the real server-derived onboarding state enables Continue.
3. Uses `Scrollable.ensureVisible` with explicit center-biased alignment.
4. Checks the button's actual Flutter render rectangle against both the AppBar and bottom `NavigationBar`.
5. If needed, drags the existing Home scroll viewport and rechecks the geometry; a persistent obstruction is a hard test failure with an explicit message.
6. Performs `tester.tap` on the **real button** and still requires `p02-setup-ready` and the profile-completion text to appear.

No `warnIfMissed: false`, direct `onPressed()` invocation, fake repository, synthetic success, or skipped UI assertion was introduced. The native Android system chooser remains a separate manual gate; test image bytes are deliberately deterministic.

## Regression coverage

- Added a Flutter widget regression: a long Home form at `360 × 640` must scroll its Continue control above the fixed bottom bar and receive a real tap.
- Expanded the P02-2 UI source contract with the final-tap visibility and hit-test invariants, including negative mutations.
- Preserved the existing real P02-2 UI end-to-end script and its 13 required checkpoints.

## Verification and remaining gates

**Executed here:** `npm run test:p02-2:ui:contracts` (5/5 passed), `npm run verify:p02-2:portable` (PASS, including P00/P01 regressions). No Flutter SDK, physical Android device or running Java DynamoDB Local in this environment; do not claim an Android pass after this change.

**Windows commands** from project root with manually started DynamoDB Local, running Fastify API and USB-debugging phone:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:flutter
npm run test:flutter:p02-2:ui:e2e
```

Expected final output:

```text
P02-2 UI PASS 12: cold widget restart restores real session, fields and ready state
P02-2 UI PASS 13: Continue opens private completion screen, not discovery
All tests passed!
```

If checkpoint 13 fails again, capture the precise message and screen. Do **not** bypass the button with a callback invocation; investigate real viewport geometry, overlapping overlays, or user-facing accessibility. Run the native picker once manually and verify local photos in the normal app without clearing that app's session.

## Acceptance status

Source: `IMPLEMENTED`. Portable: `AUTOMATED_VERIFIED`. Flutter widget and physical Android after patch: `UNVERIFIED`. Owner acceptance: `PENDING`. P02-3 is not started.
