# U_luv P02-5 — Consolidated Flutter Widget Runtime Failure Repair

**Date:** 2026-11-16  
**Status:** SOURCE FIX IMPLEMENTED; PORTABLE REGRESSION PASS; **WINDOWS FLUTTER / ANDROID RECHECK PENDING**. P02-4 remains owner-accepted; P02-5 must not be declared finished without passing the full native verification. No P03 public discovery enabled.

## Evidence from the owner's latest Flutter output

`npm run test:flutter` successfully analyzed the code (`No issues found!`) but recorded **eight failing widget tests** (`+45 -8`) after the P02-5 visual changes. These errors share four actual causes rather than eight unrelated business-logic failures:

1. **Flutter Material ink violation / production bug:** `UluvSectionCard` was a colored, rounded `Container`, which inserts a painted `DecoratedBox` between `SwitchListTile` and its nearest `Material` ancestor. Flutter 3.44 and later emit `ListTile background color or ink splashes may be invisible.` This affected multiple profile scenarios and is not merely a test issue.
2. **Blocked-swipe test missed the view:** `p02-swipe-region` occupies a tall, vertically scrolled wizard page; its *center* may lie at negative `y` outside the 800x600 test surface. `tester.drag(finder, ...)` aimed at that center instead of a visible element, so the test's drag did not exercise the real swipe handling.
3. **Stale photo-label assertions:** the visual upgrade intentionally changed the photo counter from `0/6 assigned` to `0 / 6` (and corresponding one-photo text), leaving an old widget test expecting text no longer rendered.
4. **Auth test used an off-screen control:** the taller signup layout puts `auth-signup-go-login` beneath the 600-pixel test viewport. A direct `tester.tap()` misses, then the test incorrectly expects the password-login screen to appear.

## Source changes made

| File | Repair | What stays unchanged |
|---|---|---|
| `apps/flutter_app/lib/design/uluv_design.dart` | `UluvSectionCard` now paints its tint and rounded border on an actual **Material**, with clipped corners and the existing padding. | Palette, rounded card appearance, same children and callbacks |
| `apps/flutter_app/lib/features/profiles/profile_photos_panel.dart` | Added a stable `p02-photo-count` key to the existing real `N / 6` display. | Upload, private library, versions, references, two-photo gate, backend |
| `apps/flutter_app/test/p02_1_profile_workspace_test.dart` | Position a visible static page banner before a genuine velocity-bearing horizontal fling and assert that incomplete wizard steps still block forward progression. | Swipe/Save & Next production behavior |
| `apps/flutter_app/test/p02_2_photo_panel_test.dart` | Assert the actual 0/6 and 1/6 count using the stable key and rendered value. | Real upload/assignment interactions |
| `apps/flutter_app/test/password_auth_widget_test.dart` | Center `Go to Log in` with zero-duration scrolling, assert viewport geometry, and fail hard on a missed tap. | P01 signup, login, account and password behaviors |
| `apps/flutter_app/test/p02_5_visual_reference_test.dart` | Added a real widget regression with pink and teal `SwitchListTile` cards and actual successful toggles, confirming no Material ink assertions. | Existing responsive, theme and private media checks |
| `scripts/verify/p02-5-visual-contracts.test.mjs` | Two new source contract tests for Material tile wrappers, stable photo count and safe test interactions. | Existing 8 contracts and fail-closed phase verifier |

### Why the Material change is necessary

Official Flutter release guidance says `ListTile` paints ink and background on the closest `Material` and a colored `DecoratedBox` in between hides them. The fix follows that guidance **in the production component**, not by suppressing exceptions or weakening widget tests.

Reference: <https://docs.flutter.dev/release/breaking-changes/list-tile-color-warning>.

## Verification evidence and limits

- Authoring environment: `npm run verify:p02-5:portable` **PASS**, including P00/P01/P02 unit, guards, and **10/10** P02-5 verifier/visual contract tests.
- Dart/Flutter SDK **is not installed** in this environment. Therefore Dart analyzer, actual widget rendering, Android build and real physical-device results for this patch **are not claimed**.
- Do not run or modify real AWS, IAM, payments, environment tokens, or local owner media. No database migrations or new external dependencies.

## Windows retest order

From project root after merging this update-only ZIP:

```powershell
cd apps/flutter_app
flutter test test/p02_5_visual_reference_test.dart
flutter test test/p02_1_profile_workspace_test.dart
flutter test test/p02_2_photo_panel_test.dart
flutter test test/password_auth_widget_test.dart
cd ../..
npm run test:flutter
```

The four targeted files must pass **all** tests without `ListTile background color` assertions, missed taps, stale photo text, or overflow. No `warnIfMissed: false` and no ignored exceptions.

Then with manually running local **Java DynamoDB Local**, local Fastify, and a USB connected Android phone:

```powershell
npm run verify:p02-5
```

The verifier must complete P02-5 2/2 and all nested P02-4 12/12 gates; failure at any stage remains a failure. Finally do the **manual native Android SAF photo picker**, multi-width layout and accessibility review in `docs/manual/P02_5_WINDOWS_VISUAL_ACCEPTANCE_2026_11_16.md`; automated controlled photo fixtures do not substitute for the native picker.

## Failure policy

If a new failure occurs, retain the complete **first exception**, file and test name, not just the final number. P02-4 stays accepted, P02-5 stays pending; do not claim later gates passed or patch out real assertions to get a green counter.
