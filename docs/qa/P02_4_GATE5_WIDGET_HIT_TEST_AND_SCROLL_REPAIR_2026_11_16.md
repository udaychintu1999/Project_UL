# P02-4 Gate 5 — Widget hit-test and scroll-deadlock repair (2026-11-16)

## Owner-reported regression and root cause

The owner completed P02-3 acceptance before P02-4. On a subsequent `npm run verify:p02-4` Windows attempt, Flutter analyzer reported **No issues found**, but Gate 5 `test:flutter` ran into five failures in `apps/flutter_app/test/p02_1_profile_workspace_test.dart`:

- Friendship-only setup
- Both-mode two-photo setup
- Back preserving unsaved mode fields
- Handle collision and retry
- Reopening saved Common Profile

Every failure hit `saveCommon` at the same `p02-gender` helper: a `tester.tap` targeting the gender dropdown did **not hit the control** (`Offset(400.0, 81.0)` intersected the scroll area), after which the test attempted `.last` on a missing menu item and threw `Bad state: No element`. Thus the five failures are a **single shared widget-test interaction defect**, not five independent backend/product regressions. The uploaded log stopped during the `long profile Continue can be scrolled clear of the fixed navigation bar` test at `02:20 +43 -5`; that test also contained an unsafe awaited `Scrollable.ensureVisible` **250ms animation** without test-frame pumping.

These are source-inspected diagnoses; **the supplied log does not demonstrate that the production P02-3 app regressed**.

## Focused test-only changes

1. `apps/flutter_app/test/p02_1_profile_workspace_test.dart`: centralize real pointer taps using `Scrollable.ensureVisible(alignment: 0.5, duration: Duration.zero, alignmentPolicy: explicit)` then pump; require on-screen bounds; make any miss a fatal error using `WidgetController.hitTestWarningShouldBeFatal` (restored after each tap). Introduce `chooseGender` to require the actual dropdown to open, select an approved item, and assert the selected value changed. Stop calling `.last` before verifying a menu exists. The five failing scenarios all reuse this fixed helper.
2. `apps/flutter_app/test/p02_1_account_navigation_test.dart`: replace awaited 250ms `Scrollable.ensureVisible` with immediate alignment and an explicit `pump`. Preserve the bottom-navigation clearance assertion **and** the real Continue pointer tap. This removes the previously encountered class of Flutter test-clock deadlock.
3. `scripts/verify/p02-4-verifier.test.mjs`: add source-contract tests for centered, immediate, fatal-hit-test real control interactions and the no-unpumped-animation rule. No success conditions or stages removed.
4. Keep the earlier P02-4 photo-panel `const` analyzer repair in place.

**Scope:** Test harness and documentation ONLY. Production P02-3 Dart, Fastify, media storage, authentication, DynamoDB tables, privacy, P03 gating, existing data, `.env` and Android package IDs are **unchanged**. Preserve accepted P02-3 behavior.

## Evidence and release state

- Authoring `npm run test:p02-4:contracts`: **7/7 PASS** (5 prior + 2 new).
- Authoring `npm run verify:p02-4:portable`: **PASS**, including 40/40 backend unit tests, historical regression chains, docs, secrets and cloud checks.
- **Not run in authoring environment:** actual Flutter SDK analyzer/widget execution, local Java DynamoDB/Fastify integration or physical USB Android suites. Source/portable tests alone do not establish widget success.
- **Current state:** P02-4 `PARTIALLY_VERIFIED`, Gate 5 Windows retest required, Gates 6–12 unverified in the current run. Do not mark P02 complete, and do not enable P03 discovery.

## Owner validation: Windows PowerShell

Merge update-only ZIP into the existing project root (no `node_modules`, `.env` or local media overwrite). Run the newly repaired **fast isolated tests first** from root:

```powershell
cd apps/flutter_app
flutter analyze
flutter test test/p02_1_profile_workspace_test.dart
flutter test test/p02_1_account_navigation_test.dart
cd ../..
```

All six profile-workspace widget scenarios and the long-scroll navigation suite must pass, **with no missed-hit warnings or hanging scrolls**. Then:

```powershell
npm run test:flutter
```

Only after Gate 5 is green, with Java DynamoDB Local, local Fastify and USB Android running, execute:

```powershell
npm run verify:p02-4
```

Required automated result: `P02-4 AUTOMATED GATES PASSED for local development.` Native Android gallery-picker manual verification and explicit owner closeout remain separate requirements.

### If a further failure appears

Capture the **first new error and its line number**, rather than repeatedly rerunning all 12 gates. Failures should now show a specific unavailable/unhittable control, missing opened dropdown or navigation assertion—not an unbounded animation hang or an unhelpful `.last` StateError. Treat a new failure as unverified and fix its actual cause; never suppress a pointer warning or bypass a UI callback.
