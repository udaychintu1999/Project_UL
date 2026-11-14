# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# P01-3 V1 — Windows 10 implementation verification and manual acceptance

**2026-11-14 current outcome:** The owner ran the full automated pipeline on Windows/USB Android and reported final manual testing working as expected; P01-3 is **OWNER_ACCEPTED_LOCAL_DEV**. The following procedure is kept for repeat verification and regression, not because first acceptance is pending. See `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md`.

## Setup (existing local environment only)

1. Extract update-only ZIP at `C:\Dump\Projects\Project-ULuv-Space`, preserving paths. Keep `.env`, `node_modules`, existing lockfile and Java DynamoDB Local data untouched.
2. Start the **owner-managed Java DynamoDB Local** on port 8000 exactly as P00 documented; no Docker required.
3. Start Fastify in a separate terminal: `npm run dev:api` (loopback port 3000).
4. Connect an Android phone with USB debugging and `adb devices`; the Flutter runner manages ADB reverse for localhost port 3000. Do not run the native physical device tests on a real production account or with actual provider secrets.
5. Check SDK versions `node --version`, `flutter --version`, `flutter doctor -v`, `adb devices`; **do not upgrade Flutter** merely because of a banner.

## Automated tests in this order

```cmd
npm run verify:p01-3:portable
npm run typecheck
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:p01:email-budget:integration
npm run test:p01-3:integration
npm run test:flutter
npm run test:flutter:e2e
npm run test:flutter:p01-2:e2e
npm run test:flutter:p01-3:e2e
npm run verify:p01-3
```

`npm run test:p01-3:integration` is a **real** local Fastify/DynamoDB test: actual P-256 signatures, enrollment, atomic refresh race (one 200, one 401), stolen-token rejection, old-token rejection, five-slot limit, revocation, day-30 boundary and `sessionEpoch`. Synthetic records are cleaned afterward; failures remain FAIL until resolved. Never claim the static contract test proves live transactions.

`npm run test:flutter:p01-3:e2e` provisions a disposable local account, checks that Android secure storage is initially EMPTY (refuses to overwrite a prior login), tests signed enrollment, two fresh Dart-controller restores, rotation, account access, logout and absence of restoration. It does not physically reboot the phone or simulate true OS process death; those remain manual gates.

`npm run verify:p01-3` **fails closed** on any required prior-regression / TypeScript / Fastify / Flutter / real-device failure. P01-1 separate OTP Android E2E remains an explicitly recorded owner-accepted local-development-only exception, not PASS.

## Manual checks (only after feasible automated tests)

- [ ] With a personal **local test account**, launch the actual app through `npm run dev:flutter`: login goes directly to account home, not P00 buttons; password login sends no OTP.
- [ ] Home → Back must not reveal diagnostics. Close/reopen app; kill process; restart phone; all restore to account after server check, without asking for OTP/password.
- [ ] A 30-minute access expiry (use controlled clock/fixture, not wall-clock waiting) renews without UI flicker or extra email; expired/invalid renewal requests require login.
- [ ] Turn off internet or stop local Fastify temporarily; open app → Retry, no local token destruction. Restart server and Retry → account home.
- [ ] Sign out → immediate login UI. Kill/relaunch → no restoration. Test offline signout and confirm remote revocation eventually reconciles after server restarts.
- [ ] Password change/reset invalidates all previous device sessions (including access within 30 minutes). Verify sign-in again needed.
- [ ] Device list displays up to five; revoke another device; that device's next access/refresh fails. Revoking current device signs out.
- [ ] No plaintext refresh secret in app logs, unencrypted preferences, clipboard or screenshots. Android backup/transfer/reinstall does not restore an active session onto another installation.
- [ ] Test storage/Keystore invalidation and a lost committed refresh response: clear sign-in guidance, never silent token replay.

**Record** PASS/FAIL per check with date, device/Android version and console evidence in `docs/qa/EVIDENCE_LOG.md`. Do not start P02 on the strength of authoring-only tests.
