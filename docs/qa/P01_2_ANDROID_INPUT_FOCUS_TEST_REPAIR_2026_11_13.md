# P01-2 Android — repeated-password input / focus test repair (2026-11-13)

## Latest owner evidence

`npm run test:flutter:p01-2:e2e` **FAILED** at `password_integration_test.dart:158` **before** the changed-password login HTTP call was executed. The test-only observer rejected the values supplied by the real Flutter login callback as not matching the expected fixture. This happened after the original login, account access, password change, direct changed-password API probe, and intentional old-password rejection. The latest supplied log did **not** establish whether the unexpected field was email, password, or both.

The observation does not demonstrate a backend password-validation failure. Flutter's `WidgetTester.enterText` works through a simulated text-input connection; Flutter's own documentation warns of interactions with the real IME during integration tests. The precise input/IME cause is **not proven**.

## Test-only remediation

- The P01-2 physical Android test **refocuses the requested `TextField` before every `enterText`** and asserts that its controller contains the intended value. No raw input is logged.
- For each password login (initial, old-password rejection, changed-password acceptance, post-reset rejection, post-reset acceptance), it re-enters **both** email and password instead of assuming the email controller was preserved through prior UI and IME transitions.
- The test checks both controllers **before the submit button tap** and the test observer compares the exact submitted arguments **after the tap**. Error reporting identifies only whether the email and password independently matched the expected fixture, without printing either value, length, hash, OTP, token or developer key.
- Added test-only observer unit assertions and an offline P01-2 automation-contract guard for these invariants. No app/backend/session/database behavior changed. Do not bypass a failing equality check or substitute fake API responses.

## Verification and next step

Authoring environment can run source/Node regression checks, but **Flutter analyzer/device tests are not executable here**. Record the exact commands and outputs once run on the owner's Windows workstation. Required sequence:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:flutter
npm run test:p01:password:integration
npm run test:flutter:p01-2:e2e
```

If the Android E2E passes, run `npm run verify:p01-2` and then the agreed manual sign-in/change/recovery checklist. If it still fails, use the new **before tap / during tap** and **email match / password match** category to diagnose or escalate to a focused owner manual test after exhausting feasible automation. Preserve the automated FAIL and do not claim `CORE_FLOW_VERIFIED` from a test-only patch. P01-1's existing Android automated exception remains separate. P01-3 (30-day sessions) and P02 are untouched.
