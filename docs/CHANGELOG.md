# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# CURRENT CHECKPOINT — P01-3 V1 SOURCE IMPLEMENTED, WINDOWS VERIFICATION PENDING (2026-11-14)

P00 historically verified; P01-1 manually accepted with its Android OTP automation exception still FAILED; **P01-2 owner-accepted after all tests/manual QA**; **P01-3 approved V3 design implemented in code but NOT yet owner verified**; P02 not started. See `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md` and `docs/manual/P01_3_IMPLEMENTATION_WINDOWS_TEST.md`. Owner has authorized coding, not AWS, SES, payments or production release. Older checkpoint blocks below are historical.

---

## 2026-11-14 — P01-3 V3 approved design package (DOCS ONLY)

Owner confirmed simple refresh rotation, CAS single-winner, no grace/recovery receipts and fresh login on irrecoverable failure; approved Android Keystore device proof and server secret key isolation. Updated 84-case matrix, mandatory real DB + Android acceptance tests, UX/runbook, project checkpoint and threat register. No app/backend/scripts/dependencies/DB changed; no P01-3 test results. P01-2 owner accepted; P01-1 Android OTP automated local exception retained. See `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`.

---

> **2026-11-14:** P01-2 existing-signup-email notice + Go to Log in; preserves no-send quota and session behavior; public enumeration risk documented; authoring portable PASS, Windows pending. See `docs/qa/P01_2_EXISTING_EMAIL_SIGNUP_MESSAGE_2026_11_14.md`.

## 2026-11-14 — P01-2 Android recovery status and local fixture cooldown

- Updated the real-device test to expect the existing privacy-safe recovery acknowledgement, not the obsolete promise that a code was issued. Preserved the subsequent actual outbox-code proof and reset checks.
- Synthetic LOCAL-only Android fixture now verifies exactly one already-counted signup email issuance and advances just its shared 60-second cooldown with version check; no production quotas, API, Flutter UI or schema changed.
- Added a regression guard and QA runbook/evidence. Owner Android retest pending; no unverified full-stack PASS claimed.

## 2026-11-13 — Design review / no runtime changes

- Comprehensive P01-2 and P01-3 source-grounded analysis, detailed state transitions/permutations, decision and risk register, automated-first verification matrix, and NIST SP 800-63B-4 password policy override.
- Owner's prior 8+punctuation password requirement superseded; **code not yet migrated**. Known Email-code DOB/consent defect and Android Reset target missed tap remain OPEN. No P01-3 or P02 implementation authorized by this documentation update.

## 2026-11-13 — P01-2 Android integration-test input focus and equality diagnostics
- Test-only re-focus and both-field re-entry for repeated password login on physical Android, with sanitized pre-submit/post-submit comparisons.
- New observer regression and automated-first source-contract protection; production Flutter/backend/security/session/schema untouched.
- Documented remaining owner physical-device verification and manual escalation if another test-harness failure occurs.

## 2026-11-13 — P01-2 distinct signup/login/password screens and stronger Android fixture validation
- Fixed account page displaying four password fields (Create+Confirm and Current+New) after both signup and returning-user password login.
- Sign-up now distinguishes a newly created account using the existing `newAccount` API result; password setup, account home, password management and recovery render separately.
- Added explicit Flutter widget transitions and local Android fixture password-login preflight, without changing backend authentication rules or database schema.
- Recorded owner Android E2E 401 as FAIL until reverified; portable suite passes; manual verification follows automation.

# 2026-11-13 — P01 Android E2E test harness isolation

- Preserved all functioning production Flutter/Fastify/DB code after owner verified P01 account access and logout manually on USB Android.
- Replaced P01 test's fake-clock network/status polling with a test-only `ObservedAuthService` that executes the actual request once inside `WidgetTester.runAsync`, then checks the rendered UI. Added four Flutter test regressions and strengthened P01 source-contract check.
- Recorded prior `response_headers_truncated` automated failure, owner manual success, still-unverified post-patch Android result, and troubleshooting steps. No schema/ports/secrets/cloud or P02 changes.

---

## 2026-11-13 — P01 slice 01 Android asynchronous outbox polling repair

- Owner confirmed previous TypeScript fix: `typecheck` PASS; real P00 DB/API/Android and P01 API/database tests PASS; Flutter analyzer and 9 widget tests PASS. Only the P01 phone test still failed, at missing outbox confirmation text.
- Replaced device E2E network-response `pumpAndSettle` assumptions with bounded real I/O-aware status polling and explicit sanitized action/error reporting; kept the real outbox/API/database route.
- Added pending-outbox denial/disabled-controls Flutter widget regression and source-contract guard. Updated current evidence and Windows runbook. No backend/runtime schema or provider integrations changed. Physical Android post-patch result pending.

# 2026-11-13 — P01 slice 01 Windows verification repair

- Fixed local auth signing-secret TypeScript narrowing in nested session handler (TS2345).
- Made Flutter auth form eagerly built and scrollable, dismissing keyboard on submit; added narrow-screen widget regression and explicit outbox success assertion in Android E2E.
- Recorded owner real API integration PASS, Flutter analyzer/widget PASS, failed TS/Android checks and required reruns.
- Clarified `npm run dev:flutter` manual interactive step versus the self-launching automated Android E2E command. No production/AWS/payment/schema changes.

---

## 2026-11-13 — P00 CORE_FLOW_VERIFIED closeout only; P01 ON HOLD

- Recorded owner's P00 outage/restart observation: database-unavailable error while DynamoDB Local was stopped; normal operation restored after restart. This completes the minimum core recovery acceptance after the earlier full Windows/USB Android automated PASS.
- Updated P00 phase/progress/evidence/next-step records to `CORE_FLOW_VERIFIED`; clearly marked optional rapid-tap, exact HTTP status and post-restart reruns as not separately evidenced.
- Owner expressly requested **do not begin P01**. P01–P17 remain NOT STARTED. No source/runtime code, table schema, private `.env`, AWS or payments were modified.

---

## 2026-11-13 — Owner's P00 real Android/full-stack automated gate passed

- Recorded owner-provided Windows logs: **23/23 portable Node tests** plus security/source/docs guards, backend typecheck, real 18-table DynamoDB Local operations, Fastify integration and invalid-token/concurrency checks, Flutter analyzer + 7 widget tests, and real USB Android device integration all passed. Owner manually confirmed both diagnostic buttons working.
- Updated P00 status/evidence/runbooks to keep historical failure logs clearly superseded and manual database outage/restart/retry **UNVERIFIED** until explicitly observed. No application code, schema, cloud, payment, or private `.env` changed. No `CORE_FLOW_VERIFIED` claim yet.

## 2026-11-13 — P00 USB Android debug connection

- Added documented non-secret `apps/flutter_app/dev_connection.config.mjs` with USB/Android emulator localhost URL modes; USB is now the default. `dev:flutter` and `test:flutter:e2e` auto-run `adb reverse` for USB endpoints, fail closed on ADB failure, and preserve explicit local-only endpoint restrictions. No shared Wi-Fi/IP or public API binding needed.
- Fixed the Flutter analyzer `prefer_const_constructors` finding and improved API integration failure instructions for a stopped Fastify process.
- Added guarded stub CLI tests plus USB/Windows acceptance documentation and owner-reported evidence. **Still PARTIALLY_VERIFIED**, real phone full-stack/recovery not yet confirmed.

# U_luv handoff change history

## 2026-11-12 — P00 standardized commands, private env init and manual Java startup

- Added named npm commands (`env:init`, `flutter:setup`, `dev:flutter`, `test:flutter`, `test:flutter:e2e`, `verify:p00:portable`) and normalized `db:provision`, `test:db`, `test:integration` to privately load local `.env` through Node 22's `--env-file`.
- Changed `verify:p00` from portable-only to **fail-closed full real API/DB/Flutter automated gate**. Offline-only verification is `verify:p00:portable`. No false `CORE_FLOW_VERIFIED` from source checks.
- Added cross-platform Node/Flutter launcher and 5 CLI negative/stub tests; user starts/stops Java DynamoDB Local manually. Kept legacy PowerShell scripts as optional compatibility.
- Updated root/Flutter READMEs, Windows and Java runbooks, P00 phase/QA/progress/evidence/next-step docs; fixed Flutter README's stale public-bind advice. Owner-only env generator is never invoked by agents or committed/packed.

## v2.0 FINAL — approved early DEV two-bucket topology + strict secret/cost gates (2026-11-10)
- **Authoritative** owner decision: Java DynamoDB Local (no Docker) remains the database through P16. AWS DynamoDB production tables and ECS remain P17 and require distinct owner authorization.
- Owner manually creates **two private DEV S3 buckets** (persistent profiles and temporary chat/Local/Activity) and **one DEV CloudFront distribution with two private OAC S3 origins and signed URL behaviors** in early phases; local media adapter remains default and is required for offline QA.
- Strict **deny-default AWS**: no AWS request, upload, HEAD/List, create/delete, real signed URL use, IAM/Secret access, provider charge or cloud deployment by agent/scripts without fresh bounded explicit owner approval; offer manual operator runbook instead.
- Strict environment secret rules: never AI-read actual `.env`, AWS profiles, signing PEM, keys, payment/store credentials; exclude secrets from ZIP, logs, screenshots, telemetry. Add safe package script, repo secret scanner, cost-guard checks, and local DB fail-closed config.
- Signed S3 PUT and CloudFront GET architecture and authorized **list/detail response signed URL embedding** mandated. No signed URLs persisted in database or logs. Seven-day temporary media deletion/visibility and residual URL validity acknowledged.
- U_Day-style small feature folders for Fastify/Flutter explicitly specified; 18 phases still D1/D2/D3 + T1/T2/T3 with evidence-based validation.
- Promoted v1.3 proposal into current architecture; old proposal files moved to docs/reference as archived. v1.0–v1.3 docs/handoffs superseded.

## v1.3 proposal — historical, now approved with stronger guards
Two-bucket early dev S3/CloudFront proposal. Archived in `docs/reference/`.

## v1.2 — historical
Added signed S3 upload / signed CloudFront delivery model.

## v1.1 — historical
Java 17+ DynamoDB Local instead of Docker; production AWS/real billing late.

## v1.0 — historical
Initial 18-phase project, 18-table key design and P00 scaffold.
