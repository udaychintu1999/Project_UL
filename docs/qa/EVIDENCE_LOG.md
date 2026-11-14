> **Owner Flutter evidence, 2026-11-13:** `npm run test:flutter` Flutter analyze PASS; **2 OTP widget tests FAIL** at successful-login account transition: missing `fixture-uid` (legacy widget test) and `auth-me` (existing-user login widget test). New test-only focus/scroll settle and verify-call assertions added; **repaired Flutter tests have not been executed in this authoring environment**. `docs/qa/P01_2_OTP_WIDGET_TAP_TRANSITION_REPAIR_2026_11_13.md`.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

> **P01-2/P01-3 design freeze (2026-11-13):** Analysis/documentation only. Owner approved NEW NIST password rules (15 Unicode code points, no mandatory symbol); current code/tests still enforce 8+symbol. Source behavior has NOT been updated. See `docs/design_reviews/P01_2_P01_3_DESIGN_AUDIT_READ_FIRST.md` and `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`. Known P01-2 issues: Email code login incorrectly requires DOB/consent and Android recovery Reset tap did not hit button. Do not mark P01-2 complete or start P01-3 implementation.

## 2026-11-13 — P01-2 Android login argument mismatch after intentional old-password rejection

Owner device `npm run test:flutter:p01-2:e2e` **FAILED** at `password_integration_test.dart:158`: observer mismatch **before login HTTP request**. Exact field at fault was not reported. Earlier owner checks: `npm run typecheck`, portable QA, Flutter analyzer/widgets and real Fastify/DynamoDB password integration PASS. Test-only input refocus/complete-form entry plus no-secret before/during tap classification is prepared; physical-device retest **UNVERIFIED**. Detailed evidence: `docs/qa/P01_2_ANDROID_INPUT_FOCUS_TEST_REPAIR_2026_11_13.md`. No production source changed. P01-2 PARTIALLY_VERIFIED.

---

# 2026-11-13 — P01-2 device post-change credential failure (owner-reported)

Owner Windows evidence: `verify:p01-2:portable` **PASS**, `typecheck` **PASS**, `test:flutter` **PASS (25 widget tests)**, `test:p01:password:integration` **PASS (real Java DynamoDB Local/Fastify)**, `test:flutter:p01-2:e2e` **FAIL**. `password_integration_test.dart:115` is login with the **new password after a successful password change** and expected rejection of the old password. It is not initial login. No source evidence yet proves whether this is device/API behavior or UI credential text submission.

Current test-only update: Android updated-password API probe, UI argument equality checks without printing synthetic credentials, new widget change→wrong→right regression. Physical Android and Flutter tests **after update UNVERIFIED** pending owner. No production app/backend changes; no fabricated automated PASS. See `docs/qa/P01_2_POST_CHANGE_ANDROID_TEST_DIAGNOSTICS_2026_11_13.md`.

---

# 2026-11-13 — Manual-verification escalation policy and latest P01 Android evidence

**Owner request:** AI must suggest and request a step-by-step manual test when automation repeatedly fails or lacks physical/GUI access. Implemented as a documentation-only policy (`docs/qa/MANUAL_VERIFICATION_ESCALATION.md`) and cross-referenced from agent instructions, both operating modes, QA contract, phase template and handoff prompts.

| Evidence and provenance | Result | Interpretation |
|---|---|---|
| Owner Windows physical USB Android: latest `npm run test:flutter:p01:e2e` after test harness patch | **FAILED (automated)** | OTP code-request HTTP response ended with `response_headers_truncated`; subsequent same-device readiness GET and diagnostic POST could not connect. Cause remains unknown; do **not** classify as proven harness defect or app defect. |
| Owner physical USB Android, interactive `npm run dev:flutter`: pressed `Check account access` | **PASSED (manual, owner-observed)** | Visible message `Account access confirmed`. |
| Owner physical USB Android, interactive `npm run dev:flutter`: pressed `Log out` | **PASSED (manual, owner-observed)** | Visible message `Signed out` and returned to email screen. |
| OTP issuance, development outbox, OTP verification and eligibility individual taps | **INFERRED / NOT SEPARATELY OBSERVED** | Reaching the authenticated screen implies a successful sign-in path; the individual intermediate interactions were not independently reported as manual outcomes. |
| Owner's statement to skip continued troubleshooting of this Android E2E | **OWNER-ACCEPTED EXCEPTION (local-development only)** | Pause speculative fixes; retain failing test and P01 partial status. Recheck before P01 closeout or if later Android API tests fail similarly. |
| This turn's `npm run verify:p01:portable` | **PASS (authoring Linux; documentation change only)** | Portable unit, source, security/cloud and doc checks. No fresh live Android, Flutter SDK, or Java DynamoDB Local test in this authoring run. |

No test has been removed or disabled; no P02/cloud/payment code started. **P00 historical `CORE_FLOW_VERIFIED`; overall P01 `PARTIALLY_VERIFIED`.** Any production release and phase completion require the appropriate still-open acceptance evidence.

---

# 2026-11-13 — Owner manual P01 success + test-only E2E harness patch

- **Owner physical-device manual:** `npm run dev:flutter` reached authenticated P01 screen. Owner specifically observed **“Account access confirmed”** after account-access check and **“Signed out”** followed by return to email screen. These two UI results are **PASS (manual observation)**, independent of automated E2E. Earlier logged P01 API/database integration, typecheck, Flutter analyzer/widget suite, P00 diagnostics remain previously reported owner PASS.
- **Owner latest automated device before patch:** `test:flutter:p01:e2e` **FAIL** at OTP request; sanitized client error `response_headers_truncated`. Both same-device readiness GET and authenticated diagnostic POST failed afterward. This does not prove a specific backend, socket or ADB root cause.
- **Patch:** test-only `ObservedAuthService` starts all five actual HTTP operations inside `WidgetTester.runAsync`, using actual UI taps, real service delegation, and one-shot operation guards. No app/server/database code modified; no secret-bearing logs.
- **Authoring machine:** `npm run verify:p01:portable` **PASS** after code/docs edits; includes P00 portable/static/secret/cloud guards and P01 source contract. Test-only source inspection **PASS**. Flutter SDK, Android hardware, Java local database and runtime build unavailable here: Flutter test suite and new device E2E **UNVERIFIED**. These must be run by owner after applying ZIP.
- Phase remains **P01 PARTIALLY_VERIFIED**, not P01 complete. P00 historical `CORE_FLOW_VERIFIED`, P02 not started.

---

# 2026-11-13 — P01 Android OTP HTTP response-stage failure (fourth owner report)

- Owner after previous header-order patch: `verify:p01:portable` PASS, `typecheck` PASS, `test:flutter` analyzer + 14 tests PASS. USB Android `test:flutter:p01:e2e` FAIL: **OTP request** now reports `Local API HTTP transport failed during code request (response)` (Dart `HttpException` while awaiting the HTTP response). This is not evidence the server or database is unavailable. Raw exception and exact route receipt were not supplied, so the underlying socket fault is **unconfirmed**.
- Current patch: P01 Flutter sends UTF-8 fixed-length JSON in nonpersistent local HTTP requests, retains header-before-body rules, classifies transport errors with finite safe tags, and E2E compares GET readiness against signed P00 diagnostic POST on any P01 failure. See `docs/qa/P01_ANDROID_POST_FRAMING_REPAIR_2026_11_13.md`.
- New authoring portable verification PASS; live Android success **UNVERIFIED** pending owner run. No backend, P00 or database change. P00 historical `CORE_FLOW_VERIFIED`, P01 `PARTIALLY_VERIFIED`; P02 not started.

---

# 2026-11-13 — P01 local outbox Android header-order repair

- Owner latest: `verify:p01:portable` PASS; Flutter analyzer + **14** tests PASS twice; physical Android E2E FAIL at `Read local test outbox` with **HTTP transport failure at stage send**, while same-device API/DB probe succeeds. This is **not** an API/DB outage.
- Source-confirmed `HttpClientRequest` bug: `request.write(jsonEncode(body))` was before developer/bearer headers. Source fix now sets ALL headers first, then writes the JSON body. The same bug could affect authenticated logout.
- Added a source-contract regression for the header-before-body invariant. Authoring-container tests and owner Android retest statuses are recorded in `docs/qa/P01_ANDROID_HTTP_HEADER_ORDER_REPAIR_2026_11_13.md`.
- No backend, database, cloud, payment or P00 source changes. P00 remains historically `CORE_FLOW_VERIFIED`, P01 `PARTIALLY_VERIFIED` until physical E2E + combined verification pass, P02 not started.

---

# 2026-11-13 — P01 local outbox Android error classification (third owner device report)

- Latest owner Windows `verify:p01:portable` **PASS**, `test:flutter` analyze + 10 widgets **PASS**, and full `verify:p01` reached P01 physical Android E2E after **PASS** for typecheck, real 18-table DB operations, P00/P01 API integration, P00 USB Android E2E, and Flutter static/widget checks.
- P01 physical Android E2E **FAIL twice**, specifically at **local development outbox retrieval**, after the code-request action completed. Observed UI status `Connection failed. Check Fastify and DynamoDB Local, then retry.` The previous Flutter client mapped *all* exceptions to this status, so this does **not prove a network outage**.
- The test-runner closing the application after the failed test is not by itself evidence of an Android app crash; logs contain no fatal native exception.
- Patch: pure HTTP JSON response parser and four unit tests; non-secret operation/stage-specific HTTP/transport/error categories; same-device read-only API readiness probe *on outbox failure* in E2E. No backend, table, auth security, production/provider, or P00 flow modifications.
- **After-patch** `verify:p01:portable` test result will be recorded in `docs/qa/P01_ANDROID_OUTBOX_ERROR_CLASSIFICATION_2026_11_13.md`. Flutter post-patch, real device post-patch and full gate are **UNVERIFIED** until owner rerun. P00 historical `CORE_FLOW_VERIFIED` and P01 `PARTIALLY_VERIFIED`; P02 not started.

---

# P01 slice 01 — second owner Windows regression evidence (2026-11-13)

**Owner-reported logs from the previous TypeScript/Flutter patch (before current asynchronous-wait repair)**, sanitized and without dev keys, tokens or OTPs:

| Executed on owner Windows machine | Actual status |
|---|---|
| `npm run test:p01:integration` | **PASS** — full real Fastify + Java DB OTP, limits, account/eligibility, concurrent signup/reentry, session/restriction workflows |
| `npm run test:portable` during `verify:p01` | **PASS** — 14 unit, 2 local guards, 9 CLI stubs, 3 env-init tests; static/docs/security/cloud checks |
| `npm run typecheck` | **PASS** — prior TS2345 no longer occurs |
| `npm run test:db` | **PASS** — all 18 tables, conditional data operations |
| `npm run test:integration` | **PASS** — original P00 real API/DB |
| `npm run test:flutter` | **PASS** — analyzer clean, 9 widget tests |
| `npm run test:flutter:e2e` | **PASS** — original P00 real Android physical-device diagnostics over ADB reverse |
| `npm run test:flutter:p01:e2e` | **FAIL** — outbox success text not found at `auth_integration_test.dart:26`; exact UI error unknown in provided logs |
| `npm run verify:p01` | **FAIL** — stopped at P01 Android integration; earlier stages above passed |

**Authoring patch in this turn:** Android test polls real HTTP completion/status and reports a sanitized operation-specific UI error or timeout; adds widget pending/denial regression and source-contract guard. `npm run verify:p01:portable` **PASS** after the current repair in the authoring Linux container (14 Node unit, 2 local guards, 9 CLI, 3 env-init and all P00/P01/static/security/doc guards). Flutter/Android **post-patch** checks are unverified pending owner rerun. These owner outcomes cannot be marked post-patch PASS. P00 status remains `CORE_FLOW_VERIFIED` from owner real-device/outage evidence; P01 status `PARTIALLY_VERIFIED`. Details: `docs/qa/P01_ANDROID_ASYNC_WAIT_REPAIR_2026_11_13.md`.

---

# P01 slice 01 — Windows owner feedback and targeted repair (2026-11-13)

**Status: PARTIALLY_VERIFIED (patch must be rerun on owner Windows machine).** P00 historical `CORE_FLOW_VERIFIED` retained. This entry supersedes the earlier statement that no owner P01 tests had been reported. Current owner evidence was provided as sanitized console text; no authentication secrets or OTPs were shared.

| Owner-run check (pre-repair) | Observed result | Evidence classification |
|---|---|---|
| `npm run test:p01:integration` | PASS: real Java DynamoDB Local + Fastify validation, OTP, rate limit, eligibility, concurrent signup, immutable ID, restriction, logout/re-entry, session revocation | **PASS** — owner Windows real integration |
| `npm run test:flutter` | Flutter analyzer: no issues; 8 widget tests passed | **PASS** — owner Flutter SDK |
| `npm run verify:p01:portable` | 14/14 Node unit, 2/2 local guards, 9/9 CLI stubs, 3/3 env tests, static/contracts/docs/security/cloud guards including P01 all PASS | **PASS** — owner Windows portable |
| `npm run typecheck` | TS2345 at `apps/api/src/features/auth/routes.ts:131`: secret used in nested `requireSession` still `string | undefined` | **FAIL** — repair prepared, owner rerun required |
| `npm run test:flutter:p01:e2e` | Real USB Android + ADB reverse built and launched app, then missing `auth-local-code` widget after tapping development outbox | **FAIL** — repair prepared, owner rerun required; precise cause not proven by log |
| `npm run verify:p01` | Portable tests passed; stopped at typecheck error, later gates not reached | **FAIL** — rerun required after repair |

**Authoring-container repair and checks:** `apps/api/src/features/auth/routes.ts` gives the development signing secret an unambiguous `string` type after defaulting and still throws for missing/short secrets. The Flutter auth form now uses an eagerly built, scrollable `Column` instead of a lazily constructed `ListView`; it dismisses the keyboard before request/outbox actions. The device test asserts successful outbox retrieval before reading the code, so any actual network/auth error is reported instead of appearing as a missing widget. A new narrow-viewport widget regression test targets the off-screen OTP scenario. The exact source of the original Android error is not proven without device rerun. `npm run verify:p01:portable` **PASS** in authoring container after patch (14 Node unit, 2 local guard, 9 CLI, 3 env tests plus static/documentation/secret/cloud/P01 contracts). No Flutter SDK, Java DB/runtime, Android target or installed npm backend dependencies were available here; **post-patch** TypeScript typecheck, real API/DB integration, Flutter analyzer/widget test and physical Android E2E remain **UNVERIFIED**. See `docs/qa/P01_WINDOWS_REPAIR_2026_11_13.md` and the updated `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`.

---

# P01 slice 01 — evidence recorded 2026-11-13 (authoring container)

**Current P01 status: PARTIALLY_VERIFIED.** New owner authorization for P01 supersedes the older P01-on-hold P00 closeout header below; P00's historical `CORE_FLOW_VERIFIED` still stands. No actual owner Windows P01 tests have been reported yet.

| Run/check | Observed outcome and provenance | Classification |
|---|---|---|
| `npm run verify:p00:portable` before and after edits | Offline unit, CLI stub tests, source contracts, docs, environment, secret and cloud checks pass in Linux authoring container | **PASS** (portable only) |
| `npm run test:unit` after adding P01 policy tests | 14/14 Node unit tests including new age, email, digest and parser cases | **PASS** (offline) |
| `npm run test:p01:contracts` | P01 source/security/Flutter integration contract assertions | **PASS** (static only) |
| `npm run test:dev-cli` | 9/9 existing Flutter CLI stub tests after adding P01 command action | **PASS** (offline stub) |
| `node --check` new MJS and TS transpiler syntax check | JS parses; 0 syntax errors for changed TS source | **PASS** (syntax only) |
| `npm run typecheck` | Local npm `node_modules` and Node type definitions unavailable; `npm ci --offline` had missing cached dependency and regular `npm ci` failed; no semantic TypeScript checking completed | **UNVERIFIED** (environment dependency) |
| `npm run test:db`, `npm run test:integration`, `npm run test:p01:integration` | No manually started local Java DB and Fastify in Linux authoring runtime | **UNVERIFIED**, run on owner Windows PC |
| `npm run test:flutter`, `npm run test:flutter:e2e`, `npm run test:flutter:p01:e2e` | Flutter SDK / authorized Android device unavailable in Linux authoring runtime | **UNVERIFIED**, run on owner Windows PC |
| Google Sign-In, real email delivery, session refresh and all remaining P01 scope | Not implemented or not available; no real-provider identity verification claimed | **NOT IMPLEMENTED / UNVERIFIED** |

New verification and manual recovery instructions are in `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`. Detailed scope, keys and limits: `docs/qa/P01_EMAIL_OTP_LOCAL_SLICE_2026_11_13.md`.

---

# P00 closeout — owner-confirmed manual database outage and recovery (2026-11-13)

**Phase status: CORE_FLOW_VERIFIED; P01–P17 NOT STARTED / P01 ON HOLD.**

| Check | Evidence and provenance | Result |
|---|---|---|
| Full `npm run verify:p00` (typecheck, 23 portable Node tests, 18 real DB tables, real API/DB, 7 Flutter widget tests, physical Android E2E) | Windows console output provided by owner in conversation | **PASS (owner-run)** |
| Flutter diagnostics in USB debug app | Owner manually pressed both buttons and reported both working | **PASS (owner-observed)** |
| Database outage shows unavailable error | Owner reported: “Got database unavailable error” after stopping DynamoDB Local | **PASS (owner-observed)** |
| Database restart recovers | Owner reported: “after restarting dynamodb local it is working normally” | **PASS (owner-observed)** |
| HTTP 200/503 during outage, repeated rapid taps, DB/API rerun after restart | No specific result supplied | **NOT SEPARATELY VERIFIED** |

The owner-reported recovery evidence is sufficient for the **P00 core vertical-flow** closeout; the outstanding edge-case checks remain available for later P00 maintenance. No private environment file, tokens, live cloud data, AWS accounts, payments, or new application code were accessed or changed. Previous dated entries below are historical, not the current gate outcome. Detail: `docs/qa/P00_CLOSEOUT_2026_11_13.md`.

---

# 2026-11-13 — owner-provided P00 full automated gate PASS (physical USB Android)

**Evidence source:** Windows terminal text pasted by the owner in chat and owner's observation of the running Android app. These checks were executed on the owner's workstation, **not rerun in the authoring container**. No screenshot, token, private env file or raw machine identifiers are stored in this report. Previous P00 failure reports are historical; successful reruns supersede them for the indicated checks.

| Owner-executed command or action | Reported observed result | Evidence classification |
|---|---|---|
| `npm run test:integration` | `PASS: live/DB readiness, missing/wrong token rejected, 5 real sequential/concurrent Put/Get/Query/Delete roundtrips` | PASS — owner log, actual running local Fastify + DB |
| `npm run test:flutter` | Flutter analyzer `No issues found!`; 7 widget tests, `All tests passed!` | PASS — owner log, Flutter SDK |
| `npm run test:flutter:e2e` | `ADB reverse active: Android localhost:3000 -> PC localhost:3000`; Android debug APK built; 1 device integration test `All tests passed!`; real API/DB integration PASS | PASS — owner log, real Android target (not synthetic) |
| `npm run verify:p00` | Full orchestrator reaches `P00 automated full-stack gates PASSED`; portable 9 unit + 2 local guard + 9 dev CLI + 3 env-init = **23/23 Node tests**; contracts/docs/environment/secrets/cloud-guards all PASS | PASS — owner log, real full gate |
| TypeScript stage in `verify:p00` | `tsc --noEmit -p tsconfig.json` completes without error | PASS — owner log |
| Real DB stage in `verify:p00` | `PASSED: all 18 real DynamoDB Local table schemas + conditional Put/Get/Query/Delete` | PASS — owner log |
| Fastify integration stage in `verify:p00` | Same 5 real sequential/concurrent roundtrips and invalid-token checks PASS | PASS — owner log |
| Flutter analyze/widgets/device stages in `verify:p00` | Analyzer 0 issues; 7/7 widget tests; real USB Android integration 1/1 PASS | PASS — owner log |
| Android app, **Check server** and **Test database** | Owner confirms both buttons work on phone over USB | PASS — owner manual observation; no screenshot supplied |
| Java/Gradle warnings | Nonfatal restricted-method/native-access warnings during Android build; tests/build still completed | WARNING only — monitor toolchain updates; not a P00 failure |
| DynamoDB Local stop → 503/error → restart → successful retry without reinstall | **No result provided yet** | UNVERIFIED — manual T3 acceptance still required |
| Rapid duplicate taps and recovery persistence | **No result provided yet** | UNVERIFIED — manual T3 acceptance still required |

**Outcome:** automated full-stack gate PASSED on owner's Windows environment and real USB Android, but overall **P00 stays PARTIALLY_VERIFIED** pending the manual outage/restart/retry/double-tap checks. `CORE_FLOW_VERIFIED` is not yet claimed. All 18 canonical table names and security gates remain unchanged; no production/cloud/payment activity was performed or authorized. Exact remaining steps: `docs/NEXT_STEP.md` and `docs/qa/P00_FULL_STACK_AUTOMATED_PASS_2026_11_13.md`.

---

# P00 USB Android configuration patch — 2026-11-13

**Status: PARTIALLY_VERIFIED.** Evidence provenance: owner-provided Windows console for real DB/typecheck; agent-run Linux offline checks are recorded separately; **no real Android/network result invented**.

| Check | Evidence | Result |
|---|---|---|
| `npm run typecheck` on owner's Windows PC | Console output completed `tsc --noEmit` without errors | **PASS (owner report)** |
| `npm run test:db` on owner's Windows PC | `PASSED: all 18 real DynamoDB Local table schemas + conditional Put/Get/Query/Delete` | **PASS (owner report)** |
| `npm run test:integration` on owner's Windows PC | `ECONNREFUSED 127.0.0.1:3000` | **BLOCKED**; Fastify not listening at test time |
| `npm run test:flutter` on owner's Windows PC | Flutter analyze `prefer_const_constructors` in `lib/main.dart:65` | **FAIL before widget tests**; addressed by patch, rerun required |
| Flutter app opened on physical Android via USB | User report without diagnostic button results | **PARTIAL device startup only** |
| `npm run test:dev-cli` in authoring Linux container | 9/9 stub/negative checks, including simulated USB/emulator/ADB failure | **PASS (simulation only)** |
| `npm run test:portable` in authoring Linux container | 23/23 Node tests, source contracts, docs, environment, secret scan and cloud guard | **PASS (portable only)** |
| `node --check` modified JS modules/tests | All parsed without syntax errors | **PASS (syntax)** |
| Local API refused-connection fixture (port 65534, synthetic token) | Script exited 2 with actionable BLOCKED guidance | **PASS (negative behavior only)** |
| Post-patch real TypeScript, Flutter analyze/tests, USB E2E, API live roundtrip, outage/recovery | Not available in this container; owner must rerun | **UNVERIFIED** |

Next: leave Java DynamoDB Local and `npm run dev:api` running in separate terminals, verify `/health/live` and `/health/ready`, launch physical USB app with auto `adb reverse`, rerun `npm run test:integration`, `npm run test:flutter`, `npm run test:flutter:e2e`, full gate, and manual outage/recovery. `docs/qa/P00_USB_ANDROID_CONNECTION_2026_11_13.md` contains exact Windows steps. No P01 or AWS/payment access.

---

# P00 Windows owner evidence + repair execution — 2026-11-13

**Status: PARTIALLY_VERIFIED.** This entry distinguishes **owner-reported Windows output pasted into chat** from **direct authoring-container execution**. No private env file or secret values were accessed; no Java DB / Flutter SDK runs were performed in the authoring container.

Owner-reported Windows terminal (Node 22.14.0):

| Command | Owner-reported result | Proof/limit |
|---|---|---|
| `npm run env:init` | FAIL on existing token/no placeholder guard | Owner's `.env` already existed. No actual contents viewed; existing file must be preserved |
| `npm run flutter:setup` | PASS Flutter Android scaffold and dependency resolution | Not an Android device test |
| `npm run dev:flutter` | BLOCKED: no supported Android devices (Windows/browser only) | Emulator/device needed; no UI/API result |
| `npm run verify:p00` | Portable PASS (9+2+5=16 Node tests, contract/docs/environment/secret/cloud checks), then TS18046 | Full P00 gate not completed; direct DB/API and Flutter gates not reached |
| `npm run db:provision` | PASS: all 18 `uluv_` tables CREATED, P00 sentinel ready | Real owner-machine DynamoDB Local provisioning, as shown in the console, but does not prove API roundtrip |
| `npm run dev:api` | PASS: Fastify listening at http://127.0.0.1:3000 | Backend process startup, not evidence of `/health/ready` response or client E2E |

**Authoring-container execution after patch (Linux, Node v22.16.0):**

- PASS `node --test scripts/verify/p00-env-init.test.mjs` — 3/3 tests using only temporary synthetic fixture files, no owner env or tokens.
- PASS `npm run test:portable` — 19/19 Node tests total (9 unit + 2 endpoint + 5 CLI + 3 env fixture); source contract, docs, environment, source secret and cloud-guard scans also PASS.
- PASS `node --check` for changed JavaScript utilities/tests.
- **BLOCKED:** `npm run typecheck` requires unavailable npm dependencies in this Linux authoring environment; NOT counted as PASS.
- **UNVERIFIED here:** Fastify and real DynamoDB Local on owner's Windows installation, Flutter analyzer/widget/device E2E, API failure/recovery, USB/emulator commands.

See `docs/qa/P00_WINDOWS_FEEDBACK_2026_11_13.md` and `docs/manual/LOCAL_START_AND_VERIFY.md` for exact next commands. No P01, cloud, payments or real AWS operations were attempted.

---

# P00 follow-up command-normalization evidence — 2026-11-12

**Status: PARTIALLY_VERIFIED.** Verification is **portable/source/CLI tests only**, not a real DB/Flutter device test. No owner-private `.env` read or created by an AI tool. All commands executed from the Linux project root.

| Command | Actual outcome | What it does NOT prove |
|---|---|---|
| `node --test scripts/verify/p00-dev-cli.test.mjs` | PASS 5/5 tests (invalid action, URL, token, device, controlled fake Flutter failure propagation, npm names) | Real Flutter SDK or Windows `.bat` behavior |
| `npm run test:portable` | PASS: 16 Node tests (9 unit, 2 endpoint, 5 CLI), contracts/docs/environment/offline secret/cloud checks | Any real database or mobile API roundtrip |
| `npm run verify:p00:portable` | PASS: repeat of the same portable suite | Full P00 gate |
| `node --check scripts/dev/flutter.mjs`, `scripts/verify/p00-verifier.mjs`, `scripts/verify/p00-dev-cli.test.mjs` | PASS: syntax | Runtime platform commands |
| `npm run typecheck` | BLOCKED: TS2688 missing `@types/node` (npm install previously blocked by EAI_AGAIN) | A successful TypeScript typecheck |
| `npm run verify:p00` | BLOCKED with exit 2: portable stage passed; TypeScript TS2688 missing `@types/node`; DB/API/Flutter gates not reached and UNVERIFIED | `CORE_FLOW_VERIFIED` |

**UNVERIFIED:** owner-only `npm run env:init` (intentionally not run), actual Java DynamoDB Local and 18 table operations, Fastify API, Flutter analyzer/widget/device tests, Windows commands and manual outage/recovery. **No AWS or payment actions.** Current command reference: `docs/manual/LOCAL_START_AND_VERIFY.md`; detailed slice: `docs/qa/P00_COMMAND_NORMALIZATION_2026_11_12.md`. Historical logs below refer to the earlier portable-only `verify:p00` behavior.

---

# Current P00 evidence — 2026-11-12

**Status: PARTIALLY_VERIFIED; NOT CORE_FLOW_VERIFIED.** Authoring environment: Linux, Node v22.16.0, Java 21; no installed Flutter SDK, DynamoDB Local distribution or npm dependencies.

- **PASS (executed):** `npm run test:portable`: 9 Node business/local-safety unit tests + 2 local endpoint guard tests; source contract, 18-phase/18-table documentation contract, Java-only local-environment, source secret scan, source cloud guard.
- **PASS (executed):** `npm run verify:p00` reran all portable checks, including the endpoint tests and offline security checks.
- **PASS (executed):** `node --test scripts/verify/p00-local-endpoints.test.mjs` (2/2) and `node --check` of changed `.mjs` files.
- **BLOCKED (executed):** `npm install --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=12000` — npm registry DNS `EAI_AGAIN`.
- **BLOCKED (executed):** `npm run typecheck` — dependency `@types/node` missing; **not** a successful typecheck.
- **UNVERIFIED (not executed):** actual DynamoDB Local/18 table creation/conditional operations, Fastify API roundtrip/concurrency/outage, Flutter analyze/widget/device E2E, Windows PowerShell runtime checks, dev S3/CloudFront and any AWS/payment/provider calls. No AWS requests or actual secret-file reads were performed.

Full acceptance commands and change scope are in `docs/qa/P00_SLICE_2026_11_12.md`. Historical authoring runs below are retained for provenance, not evidence of today's runtime tests.

---

# CURRENT evidence log — v2.0 FINAL packaging (2026-11-10)

**Actual portable execution performed in packaging authoring container** (NOT the user's Windows machine):
- `npm run test:unit`: **PASS 9/9** (5 prior domain + 4 fail-closed local-endpoint/media-driver tests).
- `npm run test:contracts`: **PASS** (static P00 source/Flutter contract checks; not an API runtime test).
- `npm run test:docs`: **PASS** (18 phases, D1–D3/T1–T3, 18 DynamoDB tables).
- `npm run test:environment`: **PASS** (Java/no-Docker/local-only provisioner source contract).
- `npm run test:secrets`: **PASS** (offline source/docs scan; never reads actual secret files).
- `npm run test:cloud-guards`: **PASS** (offline cloud-script and config safety checks, no AWS network calls).
- `npm run test:portable`: **PASS** as combined suite, after fixing a false-positive cloud-script scan on descriptive test strings.

**PASS additional security negative tests:** synthetic AWS-key-shaped fixture rejected by source scanner and safe packer (without echoing value); explicit `.env` update packing refused without file read. All synthetic fixtures removed. Global TypeScript transpile-only syntax 8/8 passed; no full typecheck.

**UNVERIFIED:** npm dependency install/full TypeScript typecheck, Fastify running API, actual Java DynamoDB Local creation/integration, Flutter SDK/widget/device tests, DEV S3/CloudFront signed URL live tests, any AWS DynamoDB production tables, any payments or AWS production integration. No AWS account was accessed, no files were uploaded, and no cloud resources were created. Owner will manually set up DEV two S3 buckets and CloudFront independently; that does not authorize agent tests.

For the signed URL and AWS cost policy read `docs/security/00_NON_NEGOTIABLE_GUARDS.md`, `docs/qa/CLOUD_AND_SECRET_TEST_MATRIX.md`. Old v1.1 outputs have been archived; do not mistake them for v2.0 tests.

---

## Historical earlier versions (archived for traceability)

# Evidence log — U_luv handoff authoring environment, 2026-11-10

Verification status: **P00 PARTIALLY_VERIFIED**; P01–P17 NOT STARTED.

| Check | Executed command | Status | Actual result / limitation |
|---|---|---|---|
| Domain rules | `npm run test:unit` | PASSED | 5 Node tests; 0 failed. Covers pair IDs, monthly 4/2 credits, separate paid Like Back/Connect, distance bands, limits/expiry. |
| Source contract | `npm run test:contracts` | PASSED | Real-DynamoDB route/source presence, local-only diagnostics guard, Flutter screen definitions; **static only**. |
| Documentation/phase structure | `npm run test:docs` | PASSED | 27 required paths, 18 phase guides with D1–D3/T1–T3, 18 unique table names. |
| Combined portable suite | `npm run verify:p00` | PASSED | Three checks above all passed after repairing a test regex bug found on first run. |
| JavaScript script syntax | `node --check` for all `.mjs` scripts | PASSED | All parse cleanly. |
| TypeScript source syntax | Global TypeScript transpileModule diagnostics | PASSED | 6 TS source/test files parsed without TS syntax diagnostics; **not full typechecking**. |
| Full backend TypeScript typecheck | `npm run typecheck` | UNVERIFIED | npm dependencies not installed; container cannot resolve npm registry (`EAI_AGAIN`). |
| Fastify process/API | `npm run dev:api` | UNVERIFIED | Fastify/AWS SDK packages unavailable locally. |
| Actual DynamoDB Local 18-table provision | `npm run db:provision` | UNVERIFIED | Java DynamoDB Local not installed in authoring environment. |
| DynamoDB Direct test | `npm run test:db` | UNVERIFIED | Requires DynamoDB Local + installed AWS SDK. |
| API/DynamoDB roundtrip | `npm run test:integration` | UNVERIFIED | Requires running API, DynamoDB Local, token. |
| Flutter analyze / widget | `flutter analyze && flutter test` | UNVERIFIED | Flutter SDK not installed. |
| Flutter Android device integration | `flutter test integration_test` | UNVERIFIED | Flutter/Android SDK or emulator unavailable. |
| OAuth, photo uploads, chat, payments | Relevant later phases | NOT_APPLICABLE | Not implemented in P00. |

**Do not claim P00 CORE_FLOW_VERIFIED until the real API ↔ DynamoDB Local ↔ Flutter flow, with failure-recovery checks, has passed on a supported machine.**


### 2026-11-10 v1.1 handoff update (portable, authoring container)

- **PASS** `npm run test:portable`: 5 domain unit tests, source contract, 18-phase/18-table docs validation, Java-only environment contract.
- **PASS** `npm run verify:p00`: same portable suite rerun.
- **PASS** `node --check` on modified `.mjs` files.
- **UNVERIFIED** Windows PowerShell AST parsing, real Java DynamoDB Local JAR startup/provisioning, actual Fastify↔DB and Flutter E2E.
- **NOT_APPLICABLE** real AWS production DynamoDB/S3/CloudFront/ECS (P17), Google Play Billing sandbox (P16), Apple StoreKit (later iOS).
- No actual provider or production deployment was performed. See `docs/qa/V11_VERIFICATION_REPORT.md` and `ARCHIVED_V11_PORTABLE_TEST_OUTPUT.md`.

## P01-2 source implementation — 2026-11-13
Authoring-run Node password policy tests and P00/P01-1/P01-2 portable/static/security checks PASS. Real Argon2 dependency installation, TypeScript semantic build, Fastify+Java DynamoDB Local password integration, Flutter widget/device testing UNVERIFIED; package registry unavailable here. Owner manual password signup/sign-in/reset/change acceptance requested in `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md`. Existing P01-1 Android OTP E2E FAIL remains separate from owner-reported manual account-access/logout PASS. Overall P01 PARTIALLY_VERIFIED; P01-3 persistent login not begun.

### 2026-11-13 P01-2 owner Windows parser failure and targeted correction

Owner `npm install` **PASS** (2 packages added, 0 reported vulnerabilities), `npm run verify:p01-2:portable` **PASS**, Flutter analyzer + 21 widget tests **PASS**. `npm run typecheck` **FAIL** with 33 syntax/parser errors in `apps/api/src/features/auth/password.ts` (four malformed DynamoDB transaction closing delimiters). Authoring environment corrected exactly four delimiters and added a true syntax gate to the P01-2 contract. Authoring `node --experimental-strip-types --check` **PASS** and `npm run verify:p01-2:portable` **PASS** post-fix. **Do not claim** owner Windows typecheck or live password integration PASS until rerun. See `docs/qa/P01_2_PASSWORD_TYPESCRIPT_SYNTAX_REPAIR_2026_11_13.md`.


## 2026-11-13 — P01-2 physical Android coverage gap, correction and owner evidence

- Owner Windows **PASSED** `npm run typecheck` (post-syntax-fix), `npm run verify:p01-2:portable`, `npm run test:p01:password:integration` (real Fastify/Java DynamoDB Local), and `npm run test:flutter` (Flutter analyzer, 21 tests). Full `npm run verify:p01-2` also passed the P00 diagnostics physical Android test but **did not execute P01-2 password UI Android tests**. This is a **missing coverage / UNVERIFIED P01-2 Android E2E**, not a pass.
- New command `npm run test:flutter:p01-2:e2e` orchestrates a temporary local API/DB password-enabled account and a real Flutter integration test. `npm run verify:p01-2` now requires that new gate and **fails closed** if it fails or cannot execute. This is separate from P01-1 known failing OTP Android E2E (owner-accepted local-development exception only, recorded `FAILED (automated)`, never PASS).
- Portable source/test-contract results and any Android result **must be recorded separately**. New owner Android result: **UNVERIFIED** until Windows runs the command. Do not ask for manual P01-2 acceptance before this possible automated test is attempted. If it repeatedly fails, record actual sanitized details and then proactively request a manual test. No P01-3 work or production provider access.

## 2026-11-13 — P01-2 four-password-fields UX defect and Android login rejection
**Owner-observed manual defect:** Sign up and successful password login displayed Create + Confirm and Current + New password together (four password fields). **Owner-run automated Android E2E:** `npm run test:flutter:p01-2:e2e` **FAILED** at `passwordLogin` correct-credential step with sanitized UI `Incorrect email or password`; temporary fixture cleanup completed. **Authoring repair:** Separate Flutter account/form states; forward backend's existing `newAccount` flag; add Flutter widget state-transition tests; host fixture validates password login before device test. **Authoring automated:** `npm run verify:p01-2:portable` **PASS**. **Pending owner:** Flutter analyzer/widget/device; possible repeated failure remains visible. No backend or 18-table schema changes. See `docs/qa/P01_2_SIGNUP_LOGIN_UX_REPAIR_2026_11_13.md`.


## 2026-11-13 — P01-2/P01-3 documentation-only design audit (not a new implementation PASS)

- **Owner observation:** Selecting the **Email code** login tab still exposed DOB/consent registration controls, contradicting the Login heading and intent. Current Flutter source (`auth_screen.dart`) renders a shared `signup || otp` branch; Fastify `/v1/auth/email/verify` requires DOB/consent and can create a new UID when email is unknown. This is a confirmed design/UI/API contract blocker.
- **Owner Android log:** `npm run test:flutter:p01-2:e2e` progressed to password recovery and found `auth-recovery-reset`, but Flutter reported the target not hit-testable/possibly obscured and `passwordReset` sent **no request**. **Automated Android E2E: FAIL**, not a reset-backend FAIL or manual PASS. Gradle restricted native-access warning is unrelated. Temporary local account cleanup was reported.
- **NIST owner decision:** Previous 8+punctuation requirement superseded by 15+ Unicode code points, no composition rules for single-factor password. Code/tests still enforce legacy policy; source migration pending.
- **Deliverable:** `docs/design_reviews/` detailed P01-2/P01-3 design, decision register, risk assessment, state/edge matrix, automated-first verification matrix, approved password-policy decision. Documentation only, source/DB/schema/test implementation untouched.
- **Verification in authoring runtime:** `node scripts/verify/docs-check.mjs`, `secret-guard.mjs`, `cloud-operation-guard.mjs`, `local-environment-contract.mjs` PASSED; no real Windows/Android run claimed for this package.
- **Status:** P01-2 `PARTIALLY_VERIFIED` and blocked by named issues; P01-3 `NOT STARTED`; P02 `NOT STARTED`. P01-1 Android exception remains separately FAILED and owner-accepted solely for local development.
