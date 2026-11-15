# P02-1 — Flutter Widget Render Timing and Android Uninstall Safety Repair

**Date:** 2026-11-15  
**Scope:** Existing P02-1 Home/Settings and common-profile onboarding. No P02-2/P03 work.

## Latest owner-provided Windows evidence (before this update)

| Gate | Result | Notes |
|---|---|---|
| `npm run verify:p02-1:portable` | PASS | 33 backend unit tests, existing auth/QA contracts and 5 Android package tests |
| `npm run typecheck` | PASS | Semantic TypeScript compile |
| `npm run lint` | PASS | API + scripts |
| `npm run test:flutter` | **FAIL** | Analyzer PASS; 3 widgets failed, while 44 other checks passed |
| `npm run test:p02-1:integration` | PASS | Real local Fastify/DynamoDB profiles and setup gating |
| `npm run test:flutter:p02-1:e2e` | Test assertions PASS, **tool teardown UNSAFE** | Flutter attempted `adb uninstall com.example.uluv` (normal package), failed with `DELETE_FAILED_INTERNAL_ERROR`; runner separately removes exact P02 test package |

## Root-cause analysis and changes

### Widget tests — assert the rendered frame, not a pending setState

The three failures share a missing precondition: two tests inspect `OutlinedButton.onPressed` immediately after `WidgetTester.enterText` without waiting for the scheduled `TextField.onChanged` rebuild. The setup test then taps Save handle while the pre-rebuild button is still disabled; its fake repository never gets a saved handle, making `onboarding.ready` **false** even if the mode draft is saved.

This patch adds `pumpAndSettle()` **after the text edits and before inspecting/tapping buttons**. It does not force a fake ready result or relax any existing backend/Flutter assertion. It strengthens the setup test to require that each of the following really persists in its fake repository: public handle, common name, locality, mode selection, and mode draft. The independent-handle-save preservation test remains intact.

The shipped UI already schedules widget rebuilding via `setState` inside `onChanged`, and `saveHandle` is independent of unrelated unsaved common/mode fields. No production profile behavior is changed here, pending the owner's Flutter rerun.

### Android — Flutter can uninstall the wrong application with applicationIdSuffix

The native P02 APK is isolated as `com.example.uluv.p02isolated`, which the integration test verifies at runtime. However, Flutter tooling can use the **base** Android package when performing its own `flutter test` tearDown; the owner's log proves an attempt to uninstall `com.example.uluv`. This is a known Flutter tooling issue (Flutter issue `flutter/flutter#88690` and `flutter/flutter#192777`). The preceding `DELETE_FAILED_INTERNAL_ERROR` was fortunate and cannot be treated as a safety guarantee.

**Repair:** The P02 CLI now passes `--no-uninstall` to Flutter integration tests for P02-1 *only*. The existing host-side `resetP02TestApp` remains solely responsible for uninstalling `com.example.uluv.p02isolated`. The new helper is covered by functional Node tests and a fake Flutter/ADB process test that asserts the real CLI argument is passed; other suites receive no flag. If the installed Flutter SDK does not support this flag, the test should fail before running; **do not remove the flag** to make it pass. Check `flutter test --help` on Windows.

**Known limitation:** Flutter's `--no-uninstall` may still attempt to *force-stop* the base app at teardown, but prevents the dangerous base uninstall. Closing the regular app during a test does not delete its stored login. Never `adb uninstall com.example.uluv` or `adb shell pm clear com.example.uluv` as a workaround. Recheck its actual installed state and session by manual launch.

References:
- https://github.com/flutter/flutter/issues/88690
- https://github.com/flutter/flutter/issues/192777
- https://flutter.googlesource.com/mirrors/flutter/+/04db01f3000a2779e299a8a7ba48489cf90a02f3

## Executed checks in the authoring environment

- `npm run verify:p02-1:portable` — PASS (includes 33 backend unit tests and all established portable P00/P01/P02 checks)
- `node --test scripts/verify/p02-1-android-package.test.mjs` — **6/6 PASS**
- `node --test scripts/verify/p00-dev-cli.test.mjs` — **10/10 PASS**, including actual Flutter CLI argument capture using an isolated synthetic SDK
- `node --check scripts/dev/flutter.mjs` — PASS
- `node --check scripts/lib/flutter-integration-cleanup.mjs` — PASS
- `npm run test:secrets` and `npm run test:cloud-guards` — PASS through the portable suite

**Not executed here:** `npm run test:flutter` (Flutter SDK absent), real local database and physical Android E2E (owner Windows required). These tests must not be marked PASS until actually run.

## Windows retest (PowerShell/CMD, project root)

Before testing, merge the changed-files ZIP over the existing project checkout. Do **not** wipe the app, `.env`, database or Keystore.

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
```

With Java DynamoDB Local and `npm run dev:api` already running:

```powershell
npm run test:p02-1:integration
flutter test --help | findstr /I uninstall
npm run test:flutter:p02-1:e2e
```

Expected: the Flutter help includes `--no-uninstall`; all widget tests pass; API integration passes; Android reports PASS with no `adb uninstall failed ... com.example.uluv` and only the exact test package is cleaned by our host runner. **If the Flutter flag is absent, stop and share its version, rather than bypassing package safety.**

Finally, open the normal U_luv app manually to verify its saved login still works. Test the shared-profile setup: save handle, common details and one mode, check Continue remains disabled until those are saved, and ensure Dating/Friendship details remain separated. Do not post any tokens, passwords, OTP or sealed sessions.

**Status:** Source/test/runner patch prepared; portable verified; owner Flutter and Android retest **PENDING**. P02-2 NOT STARTED. P01-1 local-dev Android OTP exception unchanged.
