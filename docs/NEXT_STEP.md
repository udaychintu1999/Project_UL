> **2026-11-13 — Current next gate: Flutter OTP widget transition regression.** Owner `npm run test:flutter` analyzed successfully but 2 widget tests FAILED after OTP Verify (missing `fixture-uid` and `auth-me`). Test-only patch settles the code-input and scroll transitions before a real Verify tap, then asserts callback count and submitted OTP/email. Run portable checks and **`npm run test:flutter` on Windows first**; follow with real API/device checks as applicable. No production authentication modifications and no Flutter PASS claimed for this patch. See `docs/qa/P01_2_OTP_WIDGET_TAP_TRANSITION_REPAIR_2026_11_13.md`. P01-2 remains `PARTIALLY_VERIFIED`; P01-3/P02 not started.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

> **P01-2/P01-3 design freeze (2026-11-13):** Analysis/documentation only. Owner approved NEW NIST password rules (15 Unicode code points, no mandatory symbol); current code/tests still enforce 8+symbol. Source behavior has NOT been updated. See `docs/design_reviews/P01_2_P01_3_DESIGN_AUDIT_READ_FIRST.md` and `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`. Known P01-2 issues: Email code login incorrectly requires DOB/consent and Android recovery Reset tap did not hit button. Do not mark P01-2 complete or start P01-3 implementation.

# CURRENT (2026-11-13) — P01-2 Android input equality failure

Owner P01-2 device test failed at the second login after password change, **before** the real login request, because the observed Flutter UI arguments were not the expected synthetic fixture credentials. Apply the test-only refocus/re-entry/equality-classification update; start local Java DynamoDB and Fastify, then run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:flutter`, `npm run test:p01:password:integration`, and `npm run test:flutter:p01-2:e2e`. A device failure now reports `before tap` versus `during tap` and whether the email or password comparison differed (never credentials). If it passes, run `npm run verify:p01-2`; manual acceptance follows automation. If it still fails, avoid speculative app changes and follow manual escalation after feasible automated checks. P01-2 `PARTIALLY_VERIFIED`; P01-3 and P02 untouched. See `docs/qa/P01_2_ANDROID_INPUT_FOCUS_TEST_REPAIR_2026_11_13.md`.

---

# CURRENT (2026-11-13) — P01-2 post-change Android login test

Owner P01-2 automated Android E2E **FAILED** at the **login with changed password after an earlier successful change and old-password rejection**. Backend/real DB password test, TypeScript, portable contracts and 25 Flutter widget tests PASS on Windows. Apply the targeted **test-only** post-change Android diagnostics ZIP; keep the working app/backend unchanged. Run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:flutter`, then `npm run test:flutter:p01-2:e2e` with Java DynamoDB Local and `npm run dev:api` running. The test checks updated-password login directly from Android before the later UI login, and verifies the UI arguments without logging secrets. If physical Android passes, run full `npm run verify:p01-2`. If it fails, use the exact classified error; ask for focused manual verification only after all feasible automation, while keeping the device test FAILED. See `docs/qa/P01_2_POST_CHANGE_ANDROID_TEST_DIAGNOSTICS_2026_11_13.md`.

P01-1 previous Android E2E failure remains a separately recorded owner-accepted local-dev exception; P01-2 is **PARTIALLY_VERIFIED**, P01-3 (30-day sessions) and P02 NOT STARTED. No AWS, payment or real email service authorized.

---

# CURRENT (2026-11-13) — P01-2 automated-first Android acceptance

P01-2 password API integration, TypeScript compilation and 21 Flutter widget tests were reported **PASS on owner Windows** in the latest logs. However, the existing `verify:p01-2` ran only the P00 two-button Android diagnostic suite and **did not exercise P01-2 password UI on the phone**. That was a coverage gap, not full acceptance.

Apply the P01-2 Android automation update-only ZIP. Start Java DynamoDB Local manually and run `npm run dev:api` in a persistent terminal; connect an authorized USB Android phone. With no competing `npm run dev:flutter`, run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:flutter`, then **`npm run test:flutter:p01-2:e2e`**. It provisions/cleans up a temporary real local API/DB account and exercises password login → check account → change password → login → logout → recovery → login → logout on the device. If it passes, run `npm run verify:p01-2` for the full repeated automated gate. Manual verification is **after** feasible automation, per `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.

P01-1 Android OTP E2E remains FAILED with the owner's explicit **local-development-only exception**, not marked PASS; it remains runnable separately. P01-2 device E2E is mandatory and must not be replaced by P00 buttons. P01-2 currently PARTIALLY_VERIFIED until the owner runs the new device test. P01-3 30-day persistence and P02 are NOT STARTED. Do not access production AWS, email services or payment providers.

---

## Immediate P01-2 action after TypeScript syntax hotfix (2026-11-13)

Apply the targeted syntax-fix update ZIP over the current P01-2 source without overwriting the Windows-generated lockfile or private local configuration. With the prior `npm install` already successful, do **not** reinstall packages unnecessarily. First run `npm run typecheck`, then `npm run verify:p01-2:portable`. Keep Java DynamoDB Local running manually and Fastify running to execute `npm run test:p01:password:integration`, then `npm run test:flutter` and owner-run manual password registration, login, recovery and change checklist. Collect sanitized FAILs rather than proceeding or repeatedly guessing. See `docs/qa/P01_2_PASSWORD_TYPESCRIPT_SYNTAX_REPAIR_2026_11_13.md`. P01-3 30-day sessions and P02 remain unstarted.

---

# 2026-11-13 — Continue P01 with documented manual-verification escalation

**The owner authorized pausing repeated P01 Android E2E troubleshooting**, after manually observing `Account access confirmed` and `Signed out` / return to email screen. The latest automated P01 Android E2E nevertheless **FAILED** with truncated OTP HTTP response headers and failed same-device probes. Root cause unresolved; leave the automated test in place, **do not represent it as PASS or make the combined `verify:p01` green by omission**. Record the local-development exception, and revisit before P01 phase closeout or when related Android transport changes occur. **Overall P01 remains `PARTIALLY_VERIFIED`; P00 historical `CORE_FLOW_VERIFIED`; P02 is not authorized.**

**Next implementation work:** Inspect canonical `docs/implementation/phases/P01.md` and choose the next missing, testable P01 slice (e.g. within authorized provider/session/eligibility scope, subject to actual spec and provider availability). Maintain the existing successful local email OTP/manual account access/logout workflow and P00 regressions. Do not start external provider or production/cloud operations without the correct owner authorization. Run all feasible non-device tests; when device/UI automation cannot validate a workflow, **proactively ask the owner to perform a short, explicit manual test**, rather than issuing speculative fixes. Use the policy `docs/qa/MANUAL_VERIFICATION_ESCALATION.md` and current Windows commands in `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`. Record manual vs automated results separately; neither P01 completion nor release is implied by manual acceptance of one slice.

**Current change is docs-only:** No application edits, schema change, test skips or new dependencies.

---

# 2026-11-13 — Verify P01 test-harness-only repair on Windows

Manual physical-device P01 account access and logout succeeded: user saw `Account access confirmed` and `Signed out` with return to email screen. **Do not change the working application code.** The prior automated Android P01 failure showed `response_headers_truncated` and then failed local readiness/diagnostic probes. Underlying transport/ADB/Fastify cause is **unconfirmed**.

Apply the test-only Android harness ZIP (all relative paths) over existing project root, preserving local `.env` and DynamoDB Local. Keep Java DynamoDB Local manually running on 8000 and Fastify `npm run dev:api` in a visible terminal on 3000. Do not run interactive `npm run dev:flutter` simultaneously with device tests. In project root:

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

The Flutter suite should include four additional harness tests (latest snapshot before patch: 15 expected (owner last confirmed 14); expected new total: 19, **not verified**). If P01 Android E2E PASS, run `npm run verify:p01` and `npm run verify:p00` and record real logs. If FAIL, immediately check whether the Fastify terminal stayed up; run `curl.exe http://127.0.0.1:3000/health/ready` and `adb reverse --list`, share only sanitized statuses (no OTPs/keys/tokens). Don't issue further speculative production-code changes.

No P02, external provider, production AWS, SES, or payment work. QA details: `docs/qa/P01_ANDROID_E2E_HARNESS_2026_11_13.md`.

---

# Next required action — P01 Slice 01 physical Android HTTP response validation

Owner's P01 `test:flutter:p01:e2e` still fails on physical USB Android after the header-order repair: `Local API HTTP transport failed during code request (response)`. The local API/database pass prior tests; actual cause of Dart `HttpException` awaits device-level evidence. Apply the small P01 fixed-length JSON/nonpersistent connection patch, then with Java DB running manually and Fastify kept running, run `npm run verify:p01:portable`, `npm run typecheck`, `npm run test:flutter` and `npm run test:flutter:p01:e2e`. If P01 device succeeds, rerun `npm run verify:p01` and `npm run verify:p00`. If it fails, provide only the sanitized line containing both GET readiness and signed P00 diagnostic POST results. See `docs/qa/P01_ANDROID_POST_FRAMING_REPAIR_2026_11_13.md`. P00 historical `CORE_FLOW_VERIFIED`; P01 `PARTIALLY_VERIFIED`; no P02, cloud or payments.

---

# CURRENT NEXT ACTION — P01 Android outbox HTTP header-order fix

The owner confirmed that API/DB readiness succeeds while local outbox POST fails at HTTP `send`. `HttpAuthService` incorrectly assigned `x-uluv-dev-key` and bearer headers **after** `request.write`. Apply the targeted update ZIP to your existing project root; do not delete your `.env`, data or re-provision unnecessarily. The repair puts headers before body writes and adds a regression assertion. Keep Java DynamoDB Local (8000) manually running and `npm run dev:api` (3000) active.

Run `npm run verify:p01:portable`, `npm run typecheck`, `npm run test:flutter`, and `npm run test:flutter:p01:e2e` on the authorized Android device, with no concurrent `dev:flutter` process. After Android success, run `npm run verify:p01` and `npm run verify:p00`. For a separate manual session use `npm run dev:flutter`. Record new Windows evidence in `docs/qa/EVIDENCE_LOG.md`. P00 historically `CORE_FLOW_VERIFIED`; P01 remains `PARTIALLY_VERIFIED`; P02 not started. See `docs/qa/P01_ANDROID_HTTP_HEADER_ORDER_REPAIR_2026_11_13.md`.

---

# 2026-11-13 — P01 local outbox Android error classification (third owner device report)

- Latest owner Windows `verify:p01:portable` **PASS**, `test:flutter` analyze + 10 widgets **PASS**, and full `verify:p01` reached P01 physical Android E2E after **PASS** for typecheck, real 18-table DB operations, P00/P01 API integration, P00 USB Android E2E, and Flutter static/widget checks.
- P01 physical Android E2E **FAIL twice**, specifically at **local development outbox retrieval**, after the code-request action completed. Observed UI status `Connection failed. Check Fastify and DynamoDB Local, then retry.` The previous Flutter client mapped *all* exceptions to this status, so this does **not prove a network outage**.
- The test-runner closing the application after the failed test is not by itself evidence of an Android app crash; logs contain no fatal native exception.
- Patch: pure HTTP JSON response parser and four unit tests; non-secret operation/stage-specific HTTP/transport/error categories; same-device read-only API readiness probe *on outbox failure* in E2E. No backend, table, auth security, production/provider, or P00 flow modifications.
- **After-patch** `verify:p01:portable` test result will be recorded in `docs/qa/P01_ANDROID_OUTBOX_ERROR_CLASSIFICATION_2026_11_13.md`. Flutter post-patch, real device post-patch and full gate are **UNVERIFIED** until owner rerun. P00 historical `CORE_FLOW_VERIFIED` and P01 `PARTIALLY_VERIFIED`; P02 not started.

---

# CURRENT NEXT ACTION — P01 slice 01 Android asynchronous outbox E2E re-verification (2026-11-13)

**P00 remains CORE_FLOW_VERIFIED (owner evidence); P01 remains IN PROGRESS / PARTIALLY_VERIFIED; P02 is not authorized.** The owner re-ran `npm run verify:p01` after the prior TS/Flutter rendering patch. **Backend typecheck, P00 real 18-table DB/API integration, P01 real DB/API integration, Flutter analyzer + 9 widget tests, and P00 real USB Android diagnostics now all PASS.** The only supplied failing gate is `test:flutter:p01:e2e`: the outbox UI success message did not appear after the test tapped the button. The old test used `pumpAndSettle()` to infer real HTTP completion and did not include the actual UI error text.

Apply the latest **P01 Android asynchronous outbox repair** update-only ZIP to project root. This patch changes the Android test's real HTTP waiting/diagnostics, adds a pending-outbox widget regression, updates a P01 source guard and documentation; no backend/DB/app runtime code changes. Keep Java DynamoDB Local manually running on port 8000 and Fastify `npm run dev:api` on 3000. Stop interactive `npm run dev:flutter` on the same phone before the automated device E2E; it starts Flutter/ADB reverse itself. Run:

```powershell
npm run verify:p01:portable
npm run test:flutter
npm run test:flutter:p01:e2e
npm run verify:p01
```

If E2E fails, copy only the sanitized action/status failure reported by the new test. Full diagnosis: `docs/qa/P01_ANDROID_ASYNC_WAIT_REPAIR_2026_11_13.md`. No owner post-patch Android success has been supplied; keep `PARTIALLY_VERIFIED`. Google server claim verification, real email delivery, session restore/refresh, cross-provider collisions and administrative/deactivation workflows remain P01 work. **Do not start P02.**

---

# NEXT ACTION — P01 slice 01 Windows re-verification after corrective patch (2026-11-13)

**P00: CORE_FLOW_VERIFIED (historical); P01: IN PROGRESS / PARTIALLY_VERIFIED, device/typecheck repair unverified on Windows; P02: NOT AUTHORIZED.** Apply the **P01 slice 01 corrective update-only ZIP** over the existing project, without touching `.env`, DynamoDB data or native Android folders. Run `npm run typecheck` and `npm run test:flutter` first. Manually start Java DynamoDB Local (same existing data directory; port 8000), keep `npm run dev:api` running (port 3000) and use the authorized USB phone. For **manual interactive checks**, run `npm run dev:flutter` in its own terminal; this launches the Flutter app and sets ADB reverse. Stop the interactive Flutter run before using the **automated** `npm run test:flutter:p01:e2e` on the same device; the E2E command itself builds/launches its test app and configures ADB reverse. Then run `npm run test:p01:integration`, `npm run test:flutter:p01:e2e`, `npm run verify:p01` and optional complete `npm run verify:p00`. If a Flutter test still fails, record the sanitized user-facing status; new E2E asserts outbox success explicitly before looking for the OTP. Full runbook: `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`; detailed diagnosis: `docs/qa/P01_WINDOWS_REPAIR_2026_11_13.md`. Do not report the repaired T1/T3 gates PASS until owner confirms successful rerun. No P02 work.

---

# NEXT ACTION — P01 slice 01: owner Windows compile / live API + Android verification (2026-11-13)

**P00: CORE_FLOW_VERIFIED. P01: IN PROGRESS / PARTIALLY_VERIFIED. P02: NOT AUTHORIZED.** The owner has now explicitly authorized P01, superseding the older P01 hold text preserved below as P00 historical context.

Apply `U_luv_P01_Email_OTP_Slice01_Update_2026-11-13.zip` to project root **without deleting `.env`, local data or existing files**. On the owner Windows PC, follow `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md` precisely. Start Java DynamoDB Local **manually**, keep Fastify on port 3000 and the same USB phone/ADB reverse. First run `npm install`, `npm run verify:p01:portable` and `npm run typecheck`; fix any true compile errors and rerun. With live local DB+API and phone, run `npm run test:p01:integration`, `npm run test:flutter`, `npm run test:flutter:p01:e2e`, `npm run verify:p00` and `npm run verify:p01`. Manually exercise code request/retrieval, age rejection, sign-in, restricted/expired responses, logout, DB stop/restart/recovery, and rapid taps. Record sanitized statuses in `docs/qa/EVIDENCE_LOG.md`. No external email is sent and Google is not yet connected.

**Next exact P01 slice (after current T1/T2/T3 gates pass):** strengthen Google ID-token verification and account/provider collision resolution using validated test-provider claims, then secure Flutter session restore/refresh and deactivation/admin eligibility workflows. Provider-dependent checks remain UNVERIFIED without actual authorized Google test configuration. Do not start P02, real AWS or payments.

---

# Next action — HOLD (owner has explicitly requested no P01 yet)

**Current state (2026-11-13): P00 CORE_FLOW_VERIFIED; P01–P17 NOT STARTED. DO NOT START P01 without a separate explicit owner instruction.**

P00 closure is supported by the owner's complete Windows/USB Android automated test output, successful use of both Flutter diagnostic buttons, and manual database stop/restart observation: **database unavailable** when DynamoDB Local was stopped, then **normal operation** after restart. The closeout has been recorded in `docs/qa/P00_CLOSEOUT_2026_11_13.md` and the evidence log.

**No active development slice is authorized.** Maintain the current P00 code and 18-table schema; continue starting DynamoDB Local manually. If the owner wants extra P00 hardening later, optional checks are: explicitly record `/health/live` and `/health/ready` responses during outage, repeated rapid-tap behavior, and a new `npm run test:db` plus `npm run test:integration` after recovery. These checks were not separately evidenced and must not be reported as PASS. No AWS, payments, or P01 work.

---

# Historical next steps — superseded by P00 closure above

# NEXT exact action — P00 manual outage/recovery acceptance only (2026-11-13)

**State:** The owner's Windows `npm run verify:p00` passed **all automated P00 gates** with real Java DynamoDB Local, Fastify, and physical USB Android. Both Flutter diagnostic buttons were manually reported working. **P00 stays PARTIALLY_VERIFIED** until one human-observed database outage/restart test passes. **Do not start P01 yet.** No new schema, code fix, AWS action or payment work is needed for this check.

1. Keep Fastify (`npm run dev:api`) and the USB Android app running; verify both buttons succeed while DynamoDB Local Java is running. If you wish, tap a button repeatedly while it is busy and confirm it only runs one request and remains responsive.
2. **Stop only the locally running Java DynamoDB Local process**, using Ctrl+C in its own terminal. Do **not** remove/delete its data folder, reset tables or stop Fastify. Leave the Android app installed/open.
3. On Windows check `http://127.0.0.1:3000/health/live` (expected **HTTP 200**, since Fastify is still live), and `http://127.0.0.1:3000/health/ready` (expected **HTTP 503** while DB is unavailable, possibly after SDK retry delay). Tap **Check server** and **Test database** in Flutter: both must show a clear error/unavailable state, **not a false green**; there must be no crash/hang.
4. **Restart the same Java DynamoDB Local process with the same existing data directory** using your usual manual command. It is not necessary to edit the Flutter host config or reinstall the phone app. If your setup needs the P00 sentinel, execute `npm run db:provision` without dropping any tables.
5. Tap both buttons again and expect success; verify repeated taps do not create overlapping requests. Run `npm run test:db` and `npm run test:integration` to confirm the existing table schemas and normal roundtrip are intact after restart.
6. Provide a brief sanitized result (which state appeared when the DB was off, successful retry after restart, any hang/crash, and whether rapid taps were guarded). Never paste `.env`, dev token, signed URLs or secrets. Only after the owner reports these observations should the P00 state be updated to `CORE_FLOW_VERIFIED` and P01 become the next authorized slice.

**P00 evidence report:** `docs/qa/P00_FULL_STACK_AUTOMATED_PASS_2026_11_13.md`. **General Windows/USB runbook:** `docs/manual/LOCAL_START_AND_VERIFY.md`. Existing P00 source is left intact. For auditing, the historical follow-up instructions follow below.

---

# Next exact slice — owner physical-Android verification, P00 only (2026-11-13)

**P00 is PARTIALLY_VERIFIED** despite confirmed owner-side TypeScript and 18-table direct DB PASS. Do not begin P01. Apply this update-only ZIP to existing root. Connect authorized physical Android via USB; keep Java DynamoDB Local manually running. In a persistent second terminal run `npm run dev:api` and check `http://127.0.0.1:3000/health/live` plus `/health/ready`; in a third terminal, with `target: 'usb'` in `apps/flutter_app/dev_connection.config.mjs`, run `npm run dev:flutter` (automatic `adb reverse`). Use the **Check server** and **Test database** buttons. In a fourth terminal run `npm run test:integration`, `npm run test:flutter`, `npm run test:flutter:e2e`, then `npm run verify:p00`.

If any fail, record redacted messages and fix; repeat. Simulate Java stop/restart while API and Flutter remain open; confirm error handling and recovery without reinstall, repeated taps, all 18 tables still valid. Record owner evidence in `docs/qa/EVIDENCE_LOG.md`. Do not share `apps/api/.env`, private tokens, debug APK or signed URLs. Device setup and one-line emulator switch are documented in `docs/manual/LOCAL_START_AND_VERIFY.md` and `docs/qa/P00_USB_ANDROID_CONNECTION_2026_11_13.md`. No AWS, schema changes or payments authorized.

---

# NEXT — complete P00 T2/T3 after Windows error repair (2026-11-13)

**Patch first:** extract `U_luv_P00_Windows_Error_Repair_2026-11-13.zip` over the existing project, preserving relative paths. Existing `apps/api/.env` stays untouched; `npm run env:init` is unnecessary if it already exists, and will now safely report that it was preserved. DynamoDB Local is started/stopped manually by the owner; never via npm.

1. With manual Java DB running and Fastify running, `npm run typecheck` (must resolve TS18046) and `npm run test:db` (real local 18-table DB assertions).
2. `npm run test:integration` while API stays running, then check `http://127.0.0.1:3000/health/live` and `/health/ready` (must return OK with real DB).
3. `npm run test:flutter` (analyze/widget tests can run without attached Android hardware).
4. Launch an Android Studio AVD emulator (or attach an authorized USB Android phone); confirm `flutter devices` shows Android; run `npm run dev:flutter` (USB requires `adb reverse tcp:3000 tcp:3000` + `--api-base-url http://127.0.0.1:3000`). Then `npm run test:flutter:e2e` for the emulator or equivalently configured USB target.
5. `npm run verify:p00`; manually test Java stop/restart, 503 UI, retry/recovery and duplicate taps; record sanitized results. P00 stays `PARTIALLY_VERIFIED` until true T2/T3 gates and recovery pass. P01/production AWS/payments remain gated.

Runbook: `docs/manual/LOCAL_START_AND_VERIFY.md`; evidence: `docs/qa/P00_WINDOWS_FEEDBACK_2026_11_13.md`.

---

# P00 next exact action — manual Java startup + standardized npm gate (2026-11-12)

**Do not enter P01 until real T2/T3 verification passes.** The owner starts/stops DynamoDB Local **manually** (no Docker, no npm Java starter), using the official JAR and a persistent local data folder. From the repository root:

1. **First time only:** `npm install`; owner runs `npm run env:init` to create private `apps/api/.env` with local placeholders and a generated token. Install Flutter/Android SDK; run `npm run flutter:setup`.
2. **Each session:** manually start Java DynamoDB Local on `127.0.0.1:8000`; in another terminal `npm run db:provision`, then `npm run dev:api` (leave API running).
3. **Flutter:** emulator → `npm run dev:flutter`. USB → `adb reverse tcp:3000 tcp:3000` then `npm run dev:flutter -- --api-base-url http://127.0.0.1:3000`.
4. **Verify:** `npm run verify:p00:portable` for offline-only; `npm run verify:p00` for **real full gate** (TypeScript + 18 DynamoDB tables + API/DB integration + Flutter analyzer/widget + Android E2E). Manually test Java stop/restart, 503 UI state, retry/recovery and duplicate actions; record **sanitized** results in `docs/qa/EVIDENCE_LOG.md`. Never disclose `.env`/token.
5. Fix failures, rerun and report. P00 remains `PARTIALLY_VERIFIED` until verified; AWS/P17/payments/cloud media remain separate approval-gated future stages.

**Runbook:** `docs/manual/LOCAL_START_AND_VERIFY.md`. **Change/evidence details:** `docs/qa/P00_COMMAND_NORMALIZATION_2026_11_12.md`.

---

# Historical previous P00 next step — superseded by current npm runbook (2026-11-12)

**Do not begin P01 yet.** The current step hardened the P00 source and passed 11 portable Node tests, but real integration remains unverified. The next slice is **local Java DynamoDB Local → 18 tables → Fastify readiness/roundtrip → Flutter buttons and failure/retry** on the owner's Windows developer machine.

1. Read `docs/qa/P00_SLICE_2026_11_12.md` and `docs/manual/LOCAL_START_AND_VERIFY.md`; install npm dependencies, official Java DynamoDB Local distribution, Flutter/Android toolchain.
2. Run `npm install` and the owner-only token setup; run `start-local.ps1` and `run-api.ps1`. Then execute `npm run typecheck`, `npm run test:db`, and `node --env-file=apps/api/.env scripts/verify/p00-integration.mjs` **only in the owner's private terminal**. Never share/read tokens in AI chat.
3. Run `flutter analyze`, `flutter test`, and Flutter integration test on an Android emulator; verify both green diagnostics are backed by real API/DB operations, test wrong token, loss/restart of Java, retry and concurrent calls.
4. Fix observed failures and rerun; record sanitized command exit statuses and results in `docs/qa/EVIDENCE_LOG.md`. Only after all three layers truly pass, mark P00 `CORE_FLOW_VERIFIED` and decide P01.
5. AWS, actual development S3/CloudFront, production database provisioning and payment integration are **outside this slice** and remain separately approval-gated.

---

# Next action — complete P00 end-to-end, with security/cost gates

1. Read `AGENTS.md`, `docs/security/00_NON_NEGOTIABLE_GUARDS.md`, `docs/implementation/PROGRESS.md`, `docs/implementation/phases/P00.md`.
2. On a developer workstation, start **Java DynamoDB Local**, provision 18 LOCAL-only tables and run real Fastify/API/Flutter tests. No Docker, no real AWS DynamoDB.
3. Owner may separately and **manually** create DEV two private S3 buckets and one DEV CloudFront distribution by following `docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md`. This is independent of P00 core completion, and it never grants AI/test automation permission to upload or call AWS.
4. Add code/fixtures/tests in one small vertical slice, run `npm run test:portable`, unit/API/database/Flutter tests where actually available. Fix defects, rerun, record evidence. Label missing runtime checks UNVERIFIED.
5. Run `npm run test:secrets` and `npm run test:cloud-guards`; build safe update ZIP with changed sources + updated docs, not `.env` or secrets. Do not proceed to P01 unless P00 critical end-to-end verification is evidenced or the actual environment blocker is clearly recorded.

No real S3 object transfers, AWS CLI calls, cloud provisioning or payments are authorized by this document.

## Next exact action — owner P01-2 Windows verification (2026-11-13)
Apply the P01-2 update ZIP and run **`npm install` once** to resolve `@node-rs/argon2` and update `package-lock.json` (npm registry unavailable to authoring container). Commit the resulting lockfile after checking. Manually start existing Java DynamoDB Local, leave Fastify running (`npm run dev:api`), then run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:p01:password:integration`, `npm run test:flutter`, and `npm run verify:p01-2`. Perform the exact manual Android password/OTP/recovery checklist in `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md`. Report sanitized results. P01-1 automated OTP E2E remains known FAIL; do not mark it passed. After P01-2 acceptance, next **P01-3** will implement secure 30-day persistent session renewal; **do not start P01-3 or P02 yet**.

## Current P01-2 next action — corrected signup/login UX (2026-11-13)
Apply P01-2 UI correction ZIP; run `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:flutter`, `npm run test:p01:password:integration`, then **mandatory** `npm run test:flutter:p01-2:e2e` on USB Android with Java DynamoDB Local + Fastify. The fixture will now self-check password sign-in on PC before device testing. `npm run verify:p01-2` must not claim success if this device test fails. After automation, manually check **signup: 2 password fields**, **password login: 0 editing fields**, **password settings: 2 change fields**, **logout: sign-in**. Preserve P01-1 known E2E exception, no P01-3 or P02 work. See `docs/qa/P01_2_SIGNUP_LOGIN_UX_REPAIR_2026_11_13.md`.
