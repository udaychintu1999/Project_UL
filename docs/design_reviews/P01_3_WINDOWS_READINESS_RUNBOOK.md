# CURRENT CHECKPOINT — P01-3 V1 SOURCE IMPLEMENTED, WINDOWS VERIFICATION PENDING (2026-11-14)

P00 historically verified; P01-1 manually accepted with its Android OTP automation exception still FAILED; **P01-2 owner-accepted after all tests/manual QA**; **P01-3 approved V3 design implemented in code but NOT yet owner verified**; P02 not started. See `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md` and `docs/manual/P01_3_IMPLEMENTATION_WINDOWS_TEST.md`. Owner has authorized coding, not AWS, SES, payments or production release. Older checkpoint blocks below are historical.

---

# P01-3 — V3 Windows Implementation and Acceptance Runbook

**State:** OWNER-APPROVED DESIGN; no implementation yet. This document does not claim that the proposed P01-3 commands currently exist. Do not run device tests until corresponding source scripts have been delivered.

## 1. Existing project environment (NO cloud)

Project directory: `C:\Dump\Projects\Project-ULuv-Space`. Java DynamoDB Local is **started manually** on port 8000; Fastify on port 3000; Flutter on physical USB Android with existing ADB reverse. **Do not introduce Docker, AWS, SES, production identity or payment integrations** for P01-3.

Before editing, inspect project files: `apps/api/src/features/auth/{policy,routes,password}.ts`, auth table access patterns, `apps/flutter_app/lib/main.dart`, `features/auth/{auth_screen,auth_service}.dart`, Android manifest and Gradle/minSdk. Read the approved contract and device/refresh companion documents. Check actual SDK versions without upgrading them automatically:

```cmd
node --version
npm --version
flutter --version
flutter doctor -v
adb devices
```

Never paste real `.env`, signing secrets, passwords, OTPs, refresh tokens or Keystore files. If a configuration example needs edits, change `.env.example` with placeholders only; operator config remains owner-managed.

## 2. Baseline checks that exist **today**

From project root, with Java DynamoDB Local manually running and Fastify launched in a separate terminal using `npm run dev:api`:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:p01:email-budget:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

The owner reported all tests and manual UX checks passed after the 2026-11-14 registered-email message fix; **these are historical P01-2 results**. New P01-3 changes must rerun them. P01-1 Android OTP E2E is still a separately recorded failed/owner-excepted local-dev test.

## 3. Commands to CREATE during P01-3 implementation

```cmd
npm run test:p01-3:unit
npm run test:p01-3:contracts
npm run test:p01-3:integration
npm run test:flutter:p01-3:e2e
npm run verify:p01-3
```

`verify:p01-3` must include prior core regression gates and **require** real P01-3 physical Android E2E. A source-contract test or P00 diagnostic button test cannot replace device-bound persisted-session verification.

## 4. Security approval boundaries and implementation order

- No real production or provider secrets may be generated/handled by the assistant or delivered in a ZIP.
- Before implementation: freeze key format/Keystore compatibility, chosen PK/SK access-pattern ADR, CAS transaction, family revocation, device cap, and local secure-store interface; preserve 18 tables.
- Build backend transaction and exhaustive real DB tests first; add Android secure signing/storage and device tests; integrate root AuthGate and safe logout; then full combined regression.
- No V1 grace period, retry receipts, cached rotated responses, or automatic recovery of committed-but-lost refresh. A loss may prompt a normal login.

## 5. Automated-first device manual sequence (after scripts exist)

1. From `npm run dev:flutter`, sign in by password and confirm account home.
2. Fully close app and reopen: neutral restore -> home, no OTP/password.
3. Reboot phone and reopen: same, with active API/DB and ADB reverse.
4. Stop API/disable connectivity and reopen: bounded Retry screen; do not erase securely stored credential; reconnect -> Retry -> account home.
5. Log out while API is reachable; kill app, relaunch: login screen, no stale home or P00.
6. Force a 30-day boundary in **test-only server time**, not by waiting 30 actual days or trusting phone clock: show reauth exactly at the limit.
7. Force an ambiguous committed refresh response-loss using test-only server fixture: it is acceptable to require a new login, **not** acceptable to reuse old token silently or loop forever.
8. If a second physical phone is available, revoke that family; if not, use the real-DB test and mark manual two-device check UNVERIFIED, never fabricate a PASS.

Record expected/actual UI and time (no tokens/code/screenshot of secrets). Manual success is separate from automated gate. Document owner-accepted exceptions precisely and never treat them as production waivers.

## 6. Failure and recovery diagnostics

- **DynamoDB unavailable:** first restart the manually launched Java Local instance, then check Fastify readiness; don't change endpoint to AWS.
- **Android cannot reach server:** ensure ADB is connected and reverse mapped, and Fastify remains running. Do not blame credentials until network evidence exists.
- **Refresh returns explicit 401 consumed/revoked:** expected to prompt login, not a retry grace.
- **HTTP 503 or transport timeout:** Retry state and preserve sealed credential, not an immediate logout.
- **Phone KeyStore lost or backup restored from another device:** fresh interactive login, no crash; server must not accept copied refresh without signer.
- **A test fails:** capture anonymized error and exact command, fix root cause, rerun relevant unit/integration/physical-device tests; follow manual verification escalation only after all feasible automation.

## 7. Exit status

No P01-3 app/runtime result exists yet. Documentation guards and ZIP integrity checks are **not** session verification. P01-3 status stays `DESIGN_APPROVED / NOT_IMPLEMENTED` until a separate coding go-ahead.
