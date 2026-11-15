# P02-1 Common Setup — Owner Windows Failures and Targeted Repair

Date: 2026-11-15. Scope: current P02-1 onboarding continuation, not P02-2. Local-only testing. **No AWS, payments, new DynamoDB tables, or authentication protocol changes.**

## Reported evidence (owner Windows/physical Android)

- `npm run verify:p02-1:portable`: PASS; 33 unit tests, P01 regressions, profile and navigation contracts passed.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test:flutter`: analyzer PASS; 44 total widget tests in owner log, two FAILED (handle collision notice and setup-Continue readiness).
- `npm run test:p02-1:integration`: FAILED on the check `other account cannot see private draft` because the fixture *first created* account B's own Friendship draft, and subsequently asserted it did not exist. This assertion contradicts the test setup. **This does not establish a real privacy leak.** The corrected test asserts that B reads its own Friendship record, B cannot read account A's Dating record, and B's writes do not change A's Friendship record.
- `npm run test:flutter:p02-1:e2e`: FAILED because the normal Android app had an existing Android Keystore-backed session. The test correctly refused to overwrite it, but the `expect(existing, isNull)` failure printed a sensitive sealed session value. **Never copy this value into diagnostics or documents.** Treat it as exposed and revoke affected dev-only sessions if still valid.

## Repair implementation

1. Replace contradictory cross-account test assertion with ownership checks. No backend authorization changes were justified by the log alone.
2. P02 physical Android E2E now uses a separately installed `com.example.uluv.p02isolated` application ID (Gradle suffix enabled only by its dedicated runner). The runner uses ADB to remove **only that synthetic test package** before/after testing, never the developer's normal `com.example.uluv` app. Before accessing any credentials, the Flutter Android test asks native Android for its *actual* runtime package ID and refuses to proceed unless it is exactly the isolated package. Failed device assertions no longer serialize sealed credentials.
3. Hold the Flutter save operation busy until the post-save authoritative dashboard fetch completes. This prevents users and widget tests observing a briefly stale, disabled Continue state.
4. Display a rejected public handle inline next to the Save handle action while retaining the existing error text. Widget test checks that Save invokes the repository and the conflict is visible locally.
5. Keep the strict negative tests, profile privacy requirements and server-derived setup gate intact. No test is skipped or loosened to hide failure.

## Required owner Windows verification

Keep Java DynamoDB Local manually running. Start Fastify in its own terminal with `npm run dev:api`. From the existing project root run:

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

Android E2E uses the same USB/ADB reverse workflow, but a **dedicated isolated app package**. Its native platform-channel package-ID check fails closed if the actual installed package is not isolated. It may uninstall only that test package and its disposable data. **Do not run `adb shell pm clear com.example.uluv`, `adb uninstall com.example.uluv`, or clear the phone's normal app storage.** No `npm ci` or schema re-provision is required if dependencies/tables are already healthy.

If the fresh Android build still shows an existing session, confirm the generated APK is installed as `com.example.uluv.p02isolated` and not `com.example.uluv`; do not suppress the guard. If a widget fails again, provide only the test name, failing line, and non-sensitive diagnostic text. The Android Gradle isolated package variant has not been compiled in this authoring environment.

## Verification status

- **OWNER_REPORTED_PASS before repair:** portable, TypeScript and lint.
- **OWNER_REPORTED_FAIL before repair:** real database integration, Flutter two widget cases, Android E2E.
- **AUTHORING_PORTABLE_VERIFIED:** `npm run verify:p02-1:portable` passed in the authoring environment after the repair, including 33 unit tests and the new repair guards. JavaScript syntax checks passed. Flutter/Gradle and real local DynamoDB/Android were unavailable here.
- **WINDOWS_RECHECK_PENDING:** TypeScript, Flutter, real local API/database, physical Android.
- **MANUAL_VERIFIED:** prior two-tab Home/Settings continuation; the new common-setup form itself is not yet owner-accepted.

P01-1 standalone Android OTP automation remains the historically owner-excepted failure for local development and is not silently marked PASS.
