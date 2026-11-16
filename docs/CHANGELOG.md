## 2026-11-16 — P02-3 guided Save & Next Android tap-safety repair

- Owner physical Android test reached P02-3 checkpoint 03, then a `Save & Next` tap missed its target because the scrolling form's button was not clear of the fixed bottom navigation.
- Replaced generic Save & Next / Back test taps with real pointer taps preceded by immediate viewport positioning, measured AppBar/bottom-navigation clearance and bounded drag fallback. No production API, Flutter app widget or database change.
- Added executable negative source guards. Portable P02-3 chain PASS; real device Flutter E2E after repair remains UNVERIFIED. See `docs/qa/P02_3_GUIDED_SAVE_NEXT_HIT_TEST_REPAIR_2026_11_16.md`.

## 2026-11-16 — P02-3 activation/privacy + unified Save & Next

- Marked P02-2 owner-accepted for the local-development profile/photo onboarding workflow on owner's explicit report; native system picker manual result remains separately unconfirmed.
- Implemented independent mode activation requests with version/identity/setup/media conditions, owner-only preview with at most two photos, and fail-closed public discovery eligibility.
- Replaced separate onboarding Save/Next controls with one `Save & Next`, retained Back and step gating; expanded Flutter widget, local API and isolated Android E2E tests.
- Added P02-3 regression guards, Windows acceptance guide, privacy architecture record and source evidence. No new table, external service, AWS calls or P03 discovery endpoint.

## 2026-11-16 — P02-2 guided onboarding Flutter compile fix

- Resolved reported `ProfileRepository.photoBytes` undefined-method build failure in final profile review by typing the media read through the existing `ProfileMediaRepository` capability; added an actual Flutter preview widget assertion and negative source guard.
- Removed the redundant `dart:typed_data` import and added `const` to the reported `ProfileMedia` test fixture. Portable regression passes; owner Flutter and Android retests remain pending. No backend, media storage, auth, or database changes.
- See `docs/qa/P02_2_GUIDED_ONBOARDING_FLUTTER_COMPILE_REPAIR_2026_11_16.md`.

## 2026-11-15 — P02-2 Android UI checkpoint-12 freeze repair

- Fixed an awaited animated viewport scroll that could deadlock the physical Android UI test after PASS 12. Uses an instant scroll, one pumped frame and bounded fallback frames, retains the real Continue tap and PASS 13 screen assertion. Added an executable negative regression guard. No production source changes; physical Android retest is pending. See `docs/qa/P02_2_CHECKPOINT_12_ANIMATED_SCROLL_DEADLOCK_REPAIR_2026_11_15.md`.

## 2026-11-15 — P02-2 final Android UI Continue hit-test repair (verification pending)

- Repaired the final real UI E2E interaction after owner Windows tests passed checkpoints 01–12 but missed Continue due to fixed bottom navigation overlapping its hit-test location.
- Added an explicitly aligned and viewport-checked genuine Continue tap, plus small-screen Flutter widget regression and negative source guards. No app authentication, backend, database, production navigation or profile-data modifications.
- Portable regression passed. The real physical Android retest is **UNVERIFIED** until the owner's device prints checkpoint 13 and `All tests passed!`.
- See `docs/qa/P02_2_FINAL_CONTINUE_HIT_TEST_REPAIR_2026_11_15.md`.

## 2026-11-15 — P02-2 genuine screen-driven physical Android verification

- Added independent `p02_2_ui_integration_test.dart` that mounts the actual persistent U_luv app and drives real Android Flutter text fields, mode switches, photo buttons and Continue with real local API/DynamoDB writes.
- Added 13 assertion-backed stage checkpoints, including two-photo gating for each enabled mode, cross-mode reuse, removal/recovery, settings tab and session/profile restoration.
- Uses two deterministic valid PNGs through **only** the native picker MethodChannel. This validates the Flutter pick/preview/upload/assign UX and backend but does not test the OS SAF picker UI; separate manual native-picker check remains mandatory.
- Existing direct-service physical Android media test remains unchanged and required. Full P02-2 verifier now executes both device suites. Added isolated-APK uninstall protection for the new suite, source-contract guard and updated runbooks.
- Authoring portable verification PASS. Flutter analyzer, Dart compilation and real physical UI run unavailable in the authoring environment; owner Windows rerun pending. No changes to authentication protocol, DynamoDB schema, backend media processing, cloud services, or P02-3.

---

> **2026-11-15 P02-2 onboarding persisted-state/visibility repair:** Added backend mandatory explicit gender gate; Flutter saved account preview, required labels, correct mode editor selection, return-state validation and editable-profile restoration on relaunch; strengthened unit/real API/widget/Android integration assertions. Prior green tests had inadequate full-form UI persistence coverage; device and Windows retesting pending. See `docs/qa/P02_2_ONBOARDING_PERSISTENCE_UI_REPAIR_2026_11_15.md`.

## 2026-11-15 — P02-2 Windows lint/media-store/Flutter analyzer repair

- Addressed reported Windows `no-unsafe-finally` in isolated Android fixture cleanup without weakening owner ID checks or skipping account cleanup.
- Made local-media symlink negative test Windows-compatible via NTFS junctions; now requires the exact `unsafe_media_store` error and reports when local policy makes junction testing impossible.
- Removed redundant Flutter `typed_data` import and applied `const` in photo-panel widget fixture, resolving the two reported analyzer diagnostics.
- No changes to P01 authentication, P02 media API/format/ownership logic, production architecture, or private test app isolation. See `docs/qa/P02_2_WINDOWS_LINT_STORE_FLUTTER_ANALYZER_REPAIR_2026_11_15.md`. Windows full verification and manual acceptance are pending.

---

## 2026-11-15 — P02-1 V4 handle-only refresh / Flutter controller-value regression

- Owner reports portable, typecheck, lint, Fastify/DynamoDB and physical Android all PASS. One Flutter widget still FAILS to find unsaved common-name text after handle save.
- Prevent handle-only status refresh from reloading common or mode draft editors, regardless of dirty-flag timing; preserve authorization-failure handling.
- Strengthen widget test to verify keyed `TextField` controllers before and after saving, assert no unrelated writes, and add formatting-tolerant negative structural regression guard.
- Keep local-only/cloud safety and normal Android test isolation; full Flutter/Android post-V4 testing requires owner's Windows environment. See `docs/qa/P02_1_FINAL_WIDGET_STATE_RETENTION_REPAIR_2026_11_15.md`.

---

## 2026-11-15 — P02-1 Flutter widget frame and Android teardown safety repair

- Fixed Flutter test-frame sequencing after text edits; retained strict setup-ready and independent draft/handle assertions with positive repository checks.
- Disabled Flutter's base-app teardown uninstall for isolated P02 integration tests (`--no-uninstall`); exact isolated-package cleanup remains host-owned. Other E2E suites unchanged.
- Added executable Node tests for the P02 CLI safety flag and actual stubbed Flutter invocation. No backend/auth/media/schema changes. Owner Windows Flutter/Android retest pending.
- Full report: `docs/qa/P02_1_FLUTTER_WIDGET_AND_UNINSTALL_SAFETY_REPAIR_2026_11_15.md`.

---

> **2026-11-15 — P02-1 second Windows-test failure repair:** Exact-package ADB inspection now supports never-installed isolated test app without aborting or printing a false cleanup failure. Android cleanup stages are explicit and independent local-fixture cleanup is more reliable. Flutter handle Save is decoupled from unsaved common/mode editors and reloads authoritative readiness without erasing typed fields. Added five offline package tests, a Flutter regression test and updated QA/manual instructions. Owner's real API/DynamoDB integration reported PASS before repair; post-repair Flutter widgets and Android E2E await Windows verification. No backend profile logic, AWS, schema or auth changes. See `docs/qa/P02_1_WIDGET_AND_ANDROID_RUNNER_REPAIR_2026_11_15.md`.

> **2026-11-15 P02-1 regression repair:** Correct contradictory account-isolation integration assertion; isolate physical Android P02 test APK/session from normal app, check actual package ID before test credentials and avoid logging sealed credentials; retain busy state through onboarding-ready refresh; inline handle conflict error; strengthen regression tests. No P02-2 or cloud work. See `docs/qa/P02_1_COMMON_SETUP_WINDOWS_FAILURE_REPAIR_2026_11_15.md`.

# 2026-11-15 — P02-1 continuation: authenticated Home / Settings bottom navigation

- Added Material 3 two-tab signed-in shell: Home directly contains independently persisted Dating/Friendship profile drafts; Settings reuses existing password, account verification, device management and sign-out features.
- `IndexedStack` preserves unsaved profile edits across tab switches; sensitive unsubmitted password fields clear on leaving Settings; Back is contained within the authenticated shell.
- Corrected reported `TS18046` unknown-error guard in Fastify and removed three unused imports. Added widget and negative structural regression checks.
- Owner's pre-continuation P02-1 Fastify/DynamoDB and physical Android tests **PASSED**; owner Windows typecheck failed and now needs retesting. Authoring portable suite **PASS**; Flutter/device tests **not run here**.
- See `docs/qa/P02_1_HOME_SETTINGS_CONTINUATION_EVIDENCE_2026_11_15.md` and `docs/manual/P02_1_HOME_SETTINGS_WINDOWS_ACCEPTANCE_2026_11_15.md`. P02-2 not started. No schema, cloud or dependency changes.

---

# 2026-11-15 — P02-1 handle + independent draft editor (source milestone)

- Added authenticated local-only `GET/PUT` profile routes and real DynamoDB exact-key versioned transactional writes. Unique account-level public handles are conditionally reserved/renamed without changing immutable UID or P01 sessions.
- Added bounded draft input sanitization, no public activation, no photo ID injection, safe owner DTOs, private cache headers and 413 payload-size category.
- Added Flutter local API repository and in-place authenticated account editor (handle, Dating and Friendship drafts, conflict/discard/retry).
- Added policy unit tests, P02 structural security contract, real local DB/Fastify runner, widget tests and physical Android/session runner.
- Authoring portable P01 regression and 30 Node unit tests pass. TypeScript semantic, live local database, Flutter/Android tests require owner Windows/phone evidence. No cloud calls, new tables, photo uploads or P03 features.
- Full details: `docs/qa/P02_1_IMPLEMENTATION_TEST_EVIDENCE_2026_11_15.md`.

---

# 2026-11-15 — P02-0 design/requirements milestone (docs only)

- Captured owner-approved P02 product decisions and the restriction that `.local/media/` is temporary local developer storage, **not production**.
- Documented P02-1..4 vertical-slice boundary, proposed profile API/validation, exact existing DynamoDB keys, media ownership/transaction/race handling, privacy safeguards and test matrix.
- Added P02-1 Windows planned runbook and design evidence/status; updated current checkpoints without rewriting historic P01 results. No app/API/test source, dependencies, DynamoDB provisioner, AWS, Flutter or production configuration changes.
- P02-1 implementation, live integration, Flutter/Android verification, media functionality and owner acceptance remain outstanding.

---

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
