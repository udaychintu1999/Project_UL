# P01-2 — Recovery inline-validation Flutter widget test correction (2026-11-14)

## Owner Windows evidence

`npm run test:flutter`: Flutter analyzer **PASS**; widget suite **FAIL** with `+29 -1` at `apps/flutter_app/test/password_auth_widget_test.dart:244`, case `P01-2 new-password and recovery-code validation updates while typing`.

- Expected `TextField.decoration.errorText` = `Enter all six digits.` after entering `123`.
- Actual `errorText` = `null` at the immediate assertion.
- Production recovery-code `onChanged` uses `touchedField`, which schedules a Flutter `setState`; the rendered `TextField` decoration is not guaranteed to reflect the new state until the tester pumps another frame.
- No backend or real network call was implicated. There is no evidence of a production validation defect from this assertion alone.

## Minimal test-only correction

After each `tester.enterText` for recovery code, password and confirmation, explicitly `await tester.pump()` **before reading the rendered widget's `decoration.errorText`**. Added positive assertions that valid code and acceptable password remove their inline errors. The test still rejects a mismatched confirmation without invoking password-reset API (`service.resets == 0`). Production Flutter, backend, authentication security, and five-per-24-hour quota are untouched.

Added a portable P01-2 contract regression ensuring each relevant input edit is followed by a frame pump and checking the production `onChanged` handler is present. This is structural protection only, not a Flutter test replacement.

## Verification provenance

- Authoring `npm run verify:p01-2:portable`: **PASS** after patch, including this regression.
- Flutter SDK and physical Android device: **UNAVAILABLE** in authoring environment; **no Flutter/device PASS claimed**.
- Windows `npm run test:flutter` after this test patch: **UNVERIFIED**.
- Windows semantic TypeScript compile and live quota test from prior patch: results not supplied here; maintain their existing status.

## Required owner checks (automated first)

1. Extract patch at `C:\Dump\Projects\Project-ULuv-Space` and overwrite relative paths.
2. Run `npm run test:flutter` to verify the specifically failing widget test plus entire Flutter analyzer/widget suite.
3. Run `npm run verify:p01-2:portable` and `npm run typecheck`.
4. With Java DynamoDB Local and Fastify already running: `npm run test:p01:email-budget:integration`, `npm run test:p01:password:integration`, `npm run test:flutter:p01-2:e2e`, and `npm run verify:p01-2`.
5. Only after feasible automated tests: owner manual UX checks under the existing automated-first escalation policy.

P01-2 remains **PARTIALLY_VERIFIED** pending the latest Windows gates. P01-3 and P02 remain not started. P01-1 Android OTP automation exception remains recorded separately.
