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
