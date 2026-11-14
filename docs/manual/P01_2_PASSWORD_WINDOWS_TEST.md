
## 2026-11-14 — Shared email quota and UX hardening acceptance (current)

Run **all feasible automated gates** before manual acceptance. Java DynamoDB Local must be started manually and Fastify must remain running; no Docker/AWS or real email provider.

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:db
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:p01:email-budget:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

The backend now enforces **five actual issued codes per normalized email per rolling 24 hours across signup, existing-user code login and password recovery**, with a 60-second cooldown and idempotent UUID requests. Flutter only validates local inputs and displays guidance; it never enforces quota. Public signup responses are neutral for an already-registered email to avoid exposing account membership; no code is issued in that case. Unknown login and ineligible recovery also issue no code. A real production mail provider, source-IP anti-abuse caps and cost controls remain release blockers.

After automation, use `npm run dev:flutter` to verify: typed invalid email shows inline feedback, empty login password stays local, new password gives 15-character feedback, confirmation mismatch stays local, six-digit code/DOB/consent validation is clear, and authenticated Back does not show the diagnostic buttons. App-restart persistence is **P01-3 and not implemented here**. Share sanitized PASS/FAIL for each step; never paste secrets, passwords or OTPs.

**Historical instructions below:** Earlier 8-character-plus-symbol password rules were superseded by NIST-aligned 15-character minimum with no mandatory symbols. Earlier OTP hourly counters were superseded by this shared rolling 24-hour quota.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

> **P01-2/P01-3 design freeze (2026-11-13):** Analysis/documentation only. Owner approved NEW NIST password rules (15 Unicode code points, no mandatory symbol); current code/tests still enforce 8+symbol. Source behavior has NOT been updated. See `docs/design_reviews/P01_2_P01_3_DESIGN_AUDIT_READ_FIRST.md` and `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`. Known P01-2 issues: Email code login incorrectly requires DOB/consent and Android recovery Reset tap did not hit button. Do not mark P01-2 complete or start P01-3 implementation.

## P01-2 Android post-change regression — 2026-11-13

The owner-reported device failure occurs **after successful password change** when logging in with the new password (`password_integration_test.dart:115`), not at the initial login. All available automated checks remain mandatory before manual tests. Updated device test now distinguishes **server/API acceptance of the changed credential** from **Flutter UI value submission**, with no credentials in failure logs. After applying the update-only ZIP, run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:flutter` (new widget wrong→right password regression), `npm run test:p01:password:integration` (requires Java DB + Fastify), and `npm run test:flutter:p01-2:e2e` (authorized physical Android). If Android passes, run `npm run verify:p01-2`, followed by manual UI checks. If it fails, preserve failure and use the exact sanitized stage to choose next action; escalate to owner manual post-change test only after feasible automation. See `docs/qa/P01_2_POST_CHANGE_ANDROID_TEST_DIAGNOSTICS_2026_11_13.md`.

---

# P01-2 — Windows CMD / PowerShell verification and manual fallback

**Safety:** Local Java DynamoDB only; never paste `.env`, passwords, OTP codes, bearer tokens, private dev keys or actual user data into chat. Use new synthetic addresses under `@example.invalid`. Keep the existing Java DynamoDB Local database and P00 ports. No Docker, AWS, real mail, payment, or production identity provider.

## Apply and first-time dependency install
Extract the update-only ZIP into `C:\Dump\Projects\Project-ULuv-Space`, preserving relative paths and overwriting matching files; keep `.env`, local database and existing `node_modules`. Because the package registry is unreachable in the authoring environment, the Argon2 dependency **has not been resolved into package-lock.json here**. On your Windows machine with npm registry access run `npm install` (NOT `npm ci`) once; inspect/commit the updated `package-lock.json` with the source code after verification. Do not claim the dependency is installed before that. No secrets should be committed.

## Start
1. Manually start your existing Java DynamoDB Local process on port `8000`. DO NOT automatically launch it via npm.
2. Run `npm run db:provision` if needed (does not remove existing data).
3. In a persistent second CMD terminal run `npm run dev:api` (port `3000`). Keep the logs visible.
4. For manual Android app, connect phone over USB and run `npm run dev:flutter` from a third terminal; ADB reverse remains automatic. Stop interactive app before automated device tests.

## Verification commands
```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:flutter
npm run test:flutter:e2e
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```
Original `npm run test:flutter:p01:e2e` is **not included in the P01-2 combined gate** because it remains a known P01-1 automated exception. It is NOT silently passed; rerun it independently when investigating that issue. The original `npm run verify:p01` still includes it and is expected to fail until resolved.

## AUTOMATED-FIRST — run P01-2 Android automation before manual tests

Use `npm run test:flutter:p01-2:e2e` with Java DynamoDB Local manually running, Fastify kept running (`npm run dev:api`), a USB-authorized Android device, and **no concurrent interactive** `npm run dev:flutter`. The host creates a fresh synthetic `@example.invalid` OTP-verified password account via the *real local* API and DynamoDB, drives the actual phone through password login, access check, password change, password recovery and logout, then cleans up its fixture. The test does **not** mock authentication responses and it does **not** retest the known-broken P01-1 OTP *device* flow. P01-1 backend/API integration remains a separate required passing step. After the independent P01-2 device test, `npm run verify:p01-2` repeats all current feasible automated gates, including P00 device regression and P01-2 physical Android. This complete verifier must fail if P01-2 Android fails or does not run.

Do not claim the P01-2 Android test passed until it actually passes on the owner's device. If it repeatedly fails, collect sanitized runner/error/adb/API evidence and then request the exact **manual** P01-2 actions below. The P01-1 Android OTP exception applies only to that named older test and does not waive P01-2 automation or a future production gate.

## Owner-run manual acceptance (mandatory fallback when device automation unreliable)
1. Launch the app (`npm run dev:flutter`), enter a fresh synthetic email under `@example.invalid`, select **Sign up** and request code.
2. Read the **local** outbox using the private development-only action. Verify the code, choose an adult DOB, accept consent and sign in. **Do not share the code.**
3. Create a password with at least **8 characters and 1 special symbol** and confirm it. Verify weak/short/no-symbol inputs are rejected.
4. Log out; switch to the default **Email + Password** tab. Log in with correct password **without requesting another OTP**; verify same account ID and `Check account access` succeeds.
5. Wrong password: confirm generic error and no account access. Check recovery tab: request local recovery code, view local outbox, reset password; verify old password fails and new password succeeds on the same account.
6. Log in, change password using current password; verify the app returns to sign-in and previous session is revoked; log in with the newest password. Explicit logout must return to sign-in.
7. Try repeated taps, backend/database outage and recovery as appropriate. No crashes/hangs, unexpected account creation, or leaked private codes/tokens.
8. Reply with **PASS/FAIL per action and sanitized visible messages only**. If failures persist, run `curl.exe http://127.0.0.1:3000/health/ready` and `adb reverse --list` and report status without secrets.

**Important:** P01-3 30-day session persistence is NOT built. After an app restart, authentication still returns to the login screen in P01-2; this is expected until P01-3.

## TypeScript syntax hotfix follow-up (2026-11-13)

The owner completed `npm install` (0 reported vulnerabilities) and passed the portable suite and Flutter 21-test suite, but backend `npm run typecheck` failed with 33 parser errors caused by four extra `}` in `password.ts`. Apply the narrow corrective ZIP and **first** rerun `npm run typecheck`. Do not repeatedly `npm install` unless dependencies change. If typecheck is clean, continue with `npm run verify:p01-2:portable` and the real password integration and manual checks above. The syntax guard is now included in `npm run test:p01:password:contracts`. See `docs/qa/P01_2_PASSWORD_TYPESCRIPT_SYNTAX_REPAIR_2026_11_13.md`.

## 2026-11-13 — Corrected screen acceptance and Android fixture preflight
Before manual testing, execute `npm run test:flutter` and `npm run test:flutter:p01-2:e2e` (after portable/typecheck/API checks). If device testing fails, preserve the exact sanitized failure and follow the automated-first/manual-escalation contract. The fixture now independently verifies the synthetic email/password can authenticate via Fastify on the PC before running the Android UI test.

When checking the UI, **sign-up** shows only Create Password + Confirm Password after new-account OTP verification, **password login** goes straight to the account page with **no password editing fields**, **Password settings** exposes the Current Password + New Password form, and **Forgot password** is separate. If multiple password forms appear at once, this is a UX FAIL even if the API returns 200.
