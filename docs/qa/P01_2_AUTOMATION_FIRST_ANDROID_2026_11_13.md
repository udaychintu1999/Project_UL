# P01-2 Android automated coverage repair — 2026-11-13

## Problem and owner instruction

Owner reported the combined `npm run verify:p01-2` ran only P00's **Check server** / **Test database** Android buttons. The full verifier indeed lacked a P01-2 device-specific test. The owner required **all feasible automated testing before manual verification**, with a narrow continuing exception only for the independently broken P01-1 OTP Android E2E. This file records the coverage repair and its limits.

## Code and test changes

- `package.json`: adds `test:flutter:p01-2:e2e` and `test:p01:automation:contracts` as real named commands; portable check includes 4 new automation contracts.
- `scripts/verify/p01-2-verifier.mjs`: now requires the P01-2 Android device gate **after** T1/T2/P00 Android regression. The gate returns nonzero if any required command fails. Explicitly discloses P01-1's FAILED (automated) local-development exception.
- `scripts/verify/p01-2-android-e2e.mjs`: creates fixture with real local APIs, launches the USB Flutter integration test, cleans up in `finally`, passes or fails according to the phone result.
- `scripts/verify/p01-2-device-fixture.mjs`: random synthetic `@example.invalid` email/password; local-only Fastify + DynamoDB; OTP code stays internal. No real email, Google, production AWS or payment services. Synthetic user data cleanup runs even on failures.
- `scripts/dev/flutter.mjs`: adds protected P01-2 integration test action and passes only validated synthetic fixture IDs to the debug device build. Existing P00/P01-1 actions remain unchanged.
- `apps/flutter_app/integration_test/password_integration_test.dart`: automated real-device UI taps for incorrect/correct password, account access, password change and revoked old password, recovery/outbox/reset, same immutable account ID, and logout. Uses `WidgetTester.runAsync` for real HTTP calls, no mock backend.
- `apps/flutter_app/integration_test/auth_test_observer.dart`: test-only password service observer queues calls and executes exactly once under real async context; no production auth change.
- `apps/flutter_app/test/password_auth_test_observer_test.dart`: queued password-operation invariants.
- `scripts/verify/p01-2-automation.test.mjs`: offline gate/wiring/fixture/security/source checks; 6 assertions, including actual verifier fail-closed orchestration using a synthetic npm command shim. These are **not a substitute** for physical Android.

## Execution and evidence status

| Test | Evidence / status |
|---|---|
| Owner historical real P01-1 API/DB integration | PASS (owner logs) |
| Owner historical real P01-2 password API/DB integration | PASS (owner logs) |
| Owner historical Flutter analyzer + 21 widget tests | PASS (owner logs, before adding observer unit test) |
| Owner historical P00 USB Android diagnostics | PASS (owner logs; P00 ONLY) |
| Authoring container `npm run verify:p01-2:portable` | PASS after the coverage fix; portable/source/unit only |
| New P01-2 physical Android E2E | **UNVERIFIED** until owner runs it on USB Android |
| Existing P01-1 physical Android OTP E2E | FAILED (owner logs); owner-excepted local development only |
| P01-2 complete gate `npm run verify:p01-2` with new device step | **UNVERIFIED** until owner runs it |

## Windows run sequence

Manually start Java DynamoDB Local on 8000, keep `npm run dev:api` on 3000, connect an authorized Android phone over USB and stop any simultaneous interactive `npm run dev:flutter` process. From project root:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

The P01-2 device test creates a temporary account and deletes its fixture. **Do not share passwords, OTPs, dev keys, bearer tokens, or `.env`** in logs/chat. If the device test fails, report its sanitized error and whether Fastify remains active; investigate based on evidence. If automation continues to fail or is impossible, the AI must proactively ask for the targeted manual P01-2 checklist in `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md` **only after all feasible automated checks**. Manual PASS is not an Android automated PASS.

P01-3 persistent 30-day login: NOT STARTED. P02: NOT STARTED.
