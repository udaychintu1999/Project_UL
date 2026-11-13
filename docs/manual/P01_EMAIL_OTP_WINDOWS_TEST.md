# Manual fallback protocol — owner-accepted P01 E2E exception (2026-11-13)

The owner manually observed `Account access confirmed` and then `Signed out` with return to the email screen on the physical Android app. The latest `npm run test:flutter:p01:e2e` **still FAILED** (`response_headers_truncated` at OTP request; follow-up readiness/diagnostic probes failed). The cause has not been isolated; do not retry endless speculative app patches or claim the E2E/combined `verify:p01` passed. AI must request manual testing when device E2E repeatedly fails; the universal rule is `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`. The owner accepted **local-development continuation within P01 with this recorded exception only**; P01 `PARTIALLY_VERIFIED`, no P02 or release waiver.

For **new/manual verification** on Windows, start Java DynamoDB Local manually (port 8000), keep Fastify running (`npm run dev:api`, port 3000), stop automated device test and run `npm run dev:flutter` on the USB Android device. Confirm P00 readiness if needed, then with a synthetic fresh test email request code → read local outbox → complete adult eligibility and sign in → `Check account access` (expect `Account access confirmed`) → `Log out` (expect `Signed out` and email form). Record each tap's PASS/FAIL separately and the exact sanitized visible error, never OTP/email/developer key/token. **Do not repeat OTP requests during cooldown.** If manual test fails, stop and diagnose actual app/API; if manual succeeds but automation fails, retain the automated FAIL and investigate the harness/connection later. Nothing in this procedure substitutes for required security, provider or release checks.

---

## Android E2E test harness repair — 2026-11-13

The owner manually verified account access and logout on a physical USB phone (`Account access confirmed` → `Signed out` and email sign-in screen). Do **not** modify the production Flutter auth screen or service while investigating the Android test. The previous automation reported a truncated HTTP response and two failed local probes: a runtime connection interruption is possible, but not proven.

The new `integration_test/auth_test_observer.dart` is **test-only**. Every button tap still queues a real `HttpAuthService` call; the E2E harness starts and awaits it exactly once from `tester.runAsync`, then checks the rendered status and account screen. Never auto-retry OTP requests or print emails, OTPs, bearer tokens or developer keys.

With manually started Java DynamoDB Local and `npm run dev:api` visibly running in a separate terminal (and **no concurrent** `npm run dev:flutter` session), run:

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

The previous Flutter suite had 15 tests; four additional test-only observer checks are present in this patch. Treat the new suite count and all Android results as **UNVERIFIED** until they actually run on Windows. If Android E2E passes, run `npm run verify:p01` and `npm run verify:p00`. If it fails, leave Fastify terminal visible, and immediately in another terminal run:

```cmd
curl.exe http://127.0.0.1:3000/health/ready
adb reverse --list
```

If Fastify is down or ADB reverse mapping missing, repair that runtime issue rather than changing the OTP logic. Report only sanitized status and non-secret service logs. The test runner may exit the app upon a test failure; that alone is not a native Android crash. Reference: `docs/qa/P01_ANDROID_E2E_HARNESS_2026_11_13.md`.

---

## P01 fourth Windows Android failure — OTP request HTTP response stage

Owner's P01 USB E2E after the header-order fix fails at OTP request, while typecheck and 14 Flutter tests pass. The subsequent limited patch sets `Content-Length`, UTF-8 bytes, nonpersistent connections and diagnostic same-phone GET+authenticated POST probes. Detailed facts/limits: `docs/qa/P01_ANDROID_POST_FRAMING_REPAIR_2026_11_13.md`. No credential or database restart is prescribed merely because this client-side response-stage exception occurred. Stop only concurrent `npm run dev:flutter` sessions before automated tests; leave manual Java DB and Fastify running.

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

If it fails, the test's sanitized error now compares readiness GET with the P00 authenticated database POST on the **same Android device**. This is to isolate whether HTTP POST transport itself works; it cannot prove that the OTP route completed. Do not repeatedly tap/retry the same email without checking the OTP cooldown. If the Android test succeeds, run combined `verify:p01`, full `verify:p00`, and `npm run dev:flutter` separately for manual testing.

---

# Current corrective patch: Android local outbox HTTP header ordering (2026-11-13)

The owner Android test reproduced `Local API HTTP transport failed during outbox read (send)` while its API/DB readiness probe passed. Source inspection located headers being assigned after the JSON body write in Dart `HttpClientRequest`; this can throw `HttpException` once headers have been sent. The updated Flutter client sets `x-uluv-dev-key`/bearer headers **before** writing the body. Do not alter DB data, Java startup, Fastify ports, or private `.env`.

With Java DB manually running and `npm run dev:api` left active, run:

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

No `npm run dev:flutter` prerequisite is needed for automated device E2E. Stop any interactive Flutter session on the same phone first. If Android E2E passes, run `npm run verify:p01` and `npm run verify:p00`. To interact manually with the app, separately run `npm run dev:flutter`. The full evidence and remaining unverified gate are in `docs/qa/P01_ANDROID_HTTP_HEADER_ORDER_REPAIR_2026_11_13.md`.

---

# P01 — Windows / USB Android email-OTP test runbook

**Scope:** P01 local development slice only. Does not send emails, run Google Sign-In, or authorize AWS/SES/payments. Keep the current P00 install, existing `.env`, Java manual startup, 18 tables, ports and USB workflow. **Never share your `.env` or debug APK.**

## Applying the P01 Windows repair ZIP

If P01 slice 01 is already installed, extract the **corrective update-only ZIP** over the existing project root. Do not delete/recreate the private `.env`, local database data, native Android project or any P00 files. Restart `npm run dev:api` if it is running after applying source edits. The newly reported `TS2345` and Android `auth-local-code` failures are documented in `docs/qa/P01_WINDOWS_REPAIR_2026_11_13.md`.

For the already configured P01 project, run these first:

```powershell
npm run typecheck
npm run test:flutter
npm run verify:p01:portable
```

A passing `test:flutter` now includes the additional small-viewport OTP regression. Full live tests remain necessary.

## First time after applying P01 update ZIP

From **project root** in CMD or PowerShell:

```powershell
npm install
npm run flutter:setup
npm run verify:p01:portable
npm run typecheck
```

Existing `apps/api/.env` is preserved; do **not** run `npm run env:init` if already set up. npm `typecheck` must PASS before trying the live P01 sign-in. If it fails, capture **sanitized diagnostic text**, fix and rerun.

## Every development session

1. **Terminal 1:** Start the same Java DynamoDB Local JAR yourself, on port 8000, using the existing data directory and instructions in `docs/manual/LOCAL_START_AND_VERIFY.md`. Leave it running. No Docker and no automatic npm Java starter.
2. **Terminal 2, project root:**

```powershell
npm run db:provision
npm run dev:api
```

Keep Fastify running at `http://127.0.0.1:3000`. The original `/health/live`, `/health/ready`, and `/v1/dev/db-roundtrip` stay available.

3. **Terminal 3, project root (required for manual/interactive app testing):** Connect an authorized Android phone with USB debugging; verify `adb devices` lists `device`. Then run:

```powershell
npm run dev:flutter
```

The existing USB launcher automatically runs `adb reverse tcp:3000 tcp:3000`. For Android Studio emulator instead: `npm run dev:flutter -- --target emulator`. Do not use LAN IPs or distribute the local debug app.

**Note:** `npm run dev:flutter` was omitted from the earlier summary. It **is required to manually open/use the interactive app**, but **not required as a prerequisite for `test:flutter:p01:e2e`**, which builds and launches its own app. Before an automated Flutter device E2E run, stop the interactive `dev:flutter` process on the same phone (Ctrl+C in Terminal 3) to avoid competing device sessions. Leave Java and Fastify running.

4. In Flutter, first confirm P00 **Check server** and **Test database**. Tap **P01 Email sign-in**. Enter a disposable development email, request a code, tap **Read local test outbox**, enter the six digits, choose an age of 18 or older, check consent, then tap **Verify code and sign in**. Observe the `uniqueId`, tap **Check account access**, then **Log out**. The outbox is only in-process development data: **no email is sent** and it is **not real email ownership verification**.

## Second Windows failure: P01 Android outbox confirmation (2026-11-13)

Owner reran `verify:p01` after the previous correction. **TypeScript typecheck now passes.** P00 18-table DB, API, original Android USB diagnostics, P01 backend DB/API and Flutter analyzer/widget checks all pass. The one observed failure is P01 Android E2E: the outbox-success UI text was not observed. The new Android integration test polls for **real HTTP result completion** instead of assuming `pumpAndSettle()` waits for `HttpClient`. It reports the action and already-sanitized UI status if a request fails or times out; it never prints a code, developer token, bearer token or birth date. A synthetic pending-outbox widget test also checks busy state, rejection display and disabled repeated taps.

After applying the current update-only ZIP, **do not** start `npm run dev:flutter` as a prerequisite for automated integration. Keep manually started Java DB and `npm run dev:api` running; stop any already-running interactive Flutter CLI session on the USB phone and run:

```powershell
npm run verify:p01:portable
npm run test:flutter
npm run test:flutter:p01:e2e
npm run verify:p01
```

There should be **10 Flutter widget tests** (9 owner-verified prior + 1 new). Do not mark the Android test as verified based on source tests; it must pass on the device. If the new E2E still fails, report just its sanitized `... failed: <visible status>` / `... timed out. Last visible UI status: ...` message. Follow `docs/qa/P01_ANDROID_ASYNC_WAIT_REPAIR_2026_11_13.md` for provenance and limitations. No new DynamoDB tables, backend changes, npm dependencies or `.env` replacement are needed.

## T1/T2/T3 verification in a fourth project-root terminal

```powershell
npm run verify:p00:portable
npm run typecheck
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:flutter
npm run test:flutter:e2e
npm run test:flutter:p01:e2e
```

`test:flutter:e2e` continues to run the original **P00 diagnostic** device test only; `test:flutter:p01:e2e` runs the P01 sign-in device test. Both require a live local API and DB. For a single combined fail-fast gate, run either `npm run verify:p01` or the PowerShell wrapper `./scripts/verify/verify-phase.ps1 -Phase P01` (which calls the same npm gate):


```powershell
npm run verify:p01
```

If using emulator, pass `-- --target emulator` to each Flutter E2E npm script individually; the combined `verify:p01` uses your configured default target. `test:p01:integration` reads the privately configured local dev key itself, uses only synthetic disposable fixtures, and does not print codes/tokens. If the API is not running, the test must FAIL and is **not** a pass. If the P01 device test fails to find `auth-local-code`, the repaired test first checks for `Local development code retrieved.`: a failure there indicates an outbox/API response issue; check the user-visible UI status and local API restart/outbox expiry, **without copying any raw code or token**. For a restarted API, use a fresh disposable `@example.invalid` email to avoid a challenge/outbox state mismatch. If the outbox-success check passes but the code widget is missing, report the Flutter failure and viewport details. After any code edit rerun `typecheck` and affected integration/widget tests.

## Manual P01 negative/recovery checklist

- Try a malformed email (rejected), immediate OTP repeat (cooldown), wrong OTP (rejected), missing consent (disabled/rejected), and a date of birth under 18 (denied). Do not use another person's identity.
- Sign in, tap **Check account access** and **Log out**; repeat account access with revoked session in automated integration; the same verified local email must retain the same `uniqueId` on re-entry after allowed resend.
- During a new request, stop only Java DynamoDB Local. The UI should show database/connection unavailable, not fake success. Restart Java with the **same data folder**; retry after the database returns and any remaining cooldown. No app reinstall or table recreation should be needed.
- Repeated taps must not overlap while busy. Inspect code expiry, attempt lockout, account restriction, and concurrent registration through `test:p01:integration`. **Session persistence after app restart, Google and external email-provider delivery are not delivered yet**; log them as remaining P01 work, not failures of completed functionality.
- Run `npm run verify:p00` when both P00 test prerequisites and the original P00 physical Android device are available; run `npm run verify:p01` for all current P01 tests. Preserve the P00 closeout result as **historical owner-confirmed**, and record new run results with their actual provenance.

Record command exit statuses (PASS/FAIL), observed error categories and manual success/recovery in `docs/qa/EVIDENCE_LOG.md`. Do not paste raw OTPs, authentication bearer tokens, `.env`, code-bearing debug APKs, or personal data into logs/chats.

## Third Windows feedback: specific outbox transport/parsing diagnosis (2026-11-13)

P01 outbox E2E failed repeatedly with `Connection failed` after successful code issuance. That wording came from an overbroad catch and does not prove actual phone-to-PC connectivity failed. See `docs/qa/P01_ANDROID_OUTBOX_ERROR_CLASSIFICATION_2026_11_13.md`. Current update discriminates socket, timeout, response encoding/JSON and HTTP status/shape issues and adds a same-device readiness probe on outbox E2E failure. The failure message never prints the OTP or key.

Reapply the latest targeted ZIP and run with Java DB/Fastify on in separate terminals and no interactive Flutter session on the phone:

```powershell
npm run verify:p01:portable
npm run test:flutter
npm run test:flutter:p01:e2e
```

Expect **14** Flutter widget/unit tests (10 prior + 4 response parsing tests). If device E2E fails, capture only the operation-specific, sanitized error and `local API probe` result. If device E2E passes, run `npm run verify:p01` and `npm run verify:p00`, and manually launch the app using `npm run dev:flutter` for UI confirmation. Automated `test:flutter:p01:e2e` launches its own app: do not keep an interactive Flutter run open concurrently.
