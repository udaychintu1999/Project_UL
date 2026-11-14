# P01-2 — OTP widget account-transition test repair (2026-11-13)

**Status:** TEST-ONLY FIX PREPARED; Flutter SDK and physical Android checks are **UNVERIFIED** in the authoring environment. P01-2 overall remains `PARTIALLY_VERIFIED`. P01-3 and P02 are not started.

## Owner failure evidence

`npm run test:flutter` completed Flutter analysis without issues but FAILED two tests:

1. `test/auth_widget_test.dart`, “P01 email request, local code, sign in and logout are functional”: expected `fixture-uid` after verification but found no matching widget.
2. `test/password_auth_widget_test.dart`, “P01-2 existing OTP user goes to account rather than password setup”: expected `auth-me` on the account page, but the widget was absent.

Both failed after the test entered six OTP digits and tapped `auth-verify`; their fake services are written to return valid synthetic sessions. These failures do not establish a backend or real Android transport problem. The widget tests previously called `ensureVisible` and then immediately tapped, without allowing a scroll transition to settle. A tap occurring during scrolling or while the text input is focused is a **plausible**, not yet proven, reason for the missing account page.

## Change (test-only)

- Before OTP verification, unfocus the editable code field and let pending frames settle.
- `ensureVisible(auth-verify)` followed by `pumpAndSettle` **before** a real `tester.tap` (not a direct callback invocation).
- Assert the `FilledButton` is enabled, the fake verification method was called exactly once, and the correct email and code were submitted.
- Assert an account access control is present and registration-only fields are absent in returning-user login.
- Allow logout-button scroll to settle in the P01-1 legacy widget test.
- Add a portable contract guard to detect deletion of the real-tap settling/assertion coverage.

No production Flutter widget, HTTP client, backend, DynamoDB, session, OTP, or password policy code was modified. **A portable structural check cannot substitute for running the actual Flutter tests.** The known P01-1 physical Android E2E exception remains separate.

## Required owner Windows checks (automated first)

```cmd
npm run verify:p01-2:portable
npm run test:flutter
npm run typecheck
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:flutter:p01-2:e2e
```

Start Java DynamoDB Local manually and `npm run dev:api` for the real API and device tests. If all required gates pass, run `npm run verify:p01-2`. The P01-1 physical Android OTP E2E is not automatically rerun due to its owner-accepted local-development exception and must not be represented as PASS.

If `npm run test:flutter` fails again, the new checks will differentiate disabled verify button, tap not reaching the service, wrong verification arguments, or missing account UI after successful verification. Report the **first failed assertion** and sanitized logs before changing production authentication behavior.

## Evidence from this authoring execution

- `npm run verify:p01-2:portable`: **PASS**, including 11 P01-2 automation source-contract checks and the existing P00/P01 portable regressions.
- Mutation check: deliberately removed the `pumpAndSettle()` immediately after `ensureVisible()` in a temporary copy. The automation contract runner returned a **nonzero exit code** as expected; source was restored. This confirms the guard detects the known regression pattern, **not** that Flutter widget runtime passes.
- Flutter SDK was not installed in this container; `npm run test:flutter`, the physical Android E2E, and live API/DynamoDB integration have **not been executed here**.
