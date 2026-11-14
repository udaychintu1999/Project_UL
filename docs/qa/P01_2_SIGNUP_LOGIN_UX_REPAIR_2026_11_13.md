# P01-2 sign-up / password-login UX correction — 2026-11-13

## Owner-observed defects (before correction)

- The **Sign up** path reached an account view containing both **Create password + Confirm password** and **Current password + New password**, four password fields in a single screen.
- Signing in using an existing email + password also reached the same four-field account view, instead of a straightforward signed-in account page.
- `npm run test:flutter:p01-2:e2e` **FAILED (automated, Windows USB Android)** at the correct-password login after the deliberate wrong-password test: `Incorrect email or password.` This is **not** an Android E2E PASS. Its root cause was not established by the submitted log.
- Backend/API password integration, TypeScript typecheck, Flutter analyzer/widget tests and P00 regression had previously PASSED on the owner's machine. These do not substitute for the failing device test.

## Approved UX invariant

A single account view must never render password creation **and** password change forms together. The states are independent:

1. **Log in:** email + password, sign in, then **account home** with account ID, `Check account access`, explicit `Password settings` and `Log out`; no password editing fields.
2. **Sign up:** email → local OTP and adult DOB/consent → OTP verify → **create password + confirm password only** for a newly created account → account home.
3. **Existing OTP sign in:** go straight to account home, not automatic password-creation/change fields. `Password settings` provides explicit actions for older OTP-only users; no new `uniqueId`.
4. **Password settings:** explicitly opened from account home. Existing password: **current + new** fields only. OTP-verified account with unknown password state: explicit `Add password` or `Change existing password` choice, then the corresponding form.
5. **Forgot password:** independent recovery view. All forms remain usable on narrow screens and keep safe error feedback.
6. **Logout:** invalidate session and return to email/password login. Existing 24-hour opaque sessions unchanged; P01-3 will implement 30-day persistence later.

The Flutter client now propagates the backend's existing `newAccount` boolean from `/v1/auth/email/verify`. The `AuthScreen` uses that to determine whether to display first-time password setup. No backend schema, route, OTP issuance, credential hashing or cloud/payment integration was changed.

## Android test fixture diagnostic hardening

The original fixture set a password via the real local Fastify/DynamoDB API but did **not** verify that password sign-in worked before launching Flutter. The revised fixture performs a **real host-side password login + account-ID assertion + logout**, with no credentials printed, before starting the Android UI test. The device test checks the input widget contains the expected synthetic password before first sign-in and continues to validate wrong-password rejection, session authorization, password change, recovery and logout.

This preflight can separate a broken fixture from an Android-specific 401, but **does not prove** that the previous device failure has been fixed. The device test still runs and must pass separately.

## Test evidence and remaining gate

- Authoring environment: `npm run verify:p01-2:portable` — **PASS** including new UI-state source-contract coverage and the verifier's fail-closed test.
- Authoring environment: Dart/Flutter SDK unavailable — `flutter analyze`, widget tests and physical Android E2E **UNVERIFIED** for this patch.
- Owner Windows: **pending** rerun of `npm run typecheck`, `npm run test:flutter` (new signup/account widget tests), `npm run test:flutter:p01-2:e2e` (real Android), and `npm run verify:p01-2`.
- If the device test still fails after capturing the sanitized result and the successful/failed host fixture preflight, follow the **AUTOMATED-FIRST** escalation policy. Ask for a specific manual check rather than claiming the test is broken or repeatedly making speculative patches.

## Windows commands

Start Java DynamoDB Local manually. In another terminal run `npm run dev:api`, keep it running. Stop interactive Flutter when running device integration. Then:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:flutter
npm run test:p01:password:integration
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

Separate manual UI acceptance **after** attempted automation: `npm run dev:flutter`; verify sign-up has only 2 password fields, returning password login shows 0 password editing fields, explicit settings shows only the correct change form, and logout returns to login. Report sanitized PASS/FAIL only (no OTP, secrets or password).

**Status:** P01-2 PARTIALLY_VERIFIED. P01-1 known Android OTP automated exception unchanged. P01-3 30-day persistence NOT STARTED. P02 NOT STARTED.
