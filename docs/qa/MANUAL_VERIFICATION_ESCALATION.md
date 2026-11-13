# Mandatory manual-verification escalation and automation-failure exception protocol

**Applies to:** Every U_luv phase (P00–P17), including backend, Flutter, Android, admin/browser, provider, recovery, and release testing. Binding instruction for both coding agents and regular AI Chats. Read with `docs/implementation/QA_AUTOMATION_CONTRACT.md`, `docs/qa/RELEASE_GATE.md`, `AGENTS.md`, and the security guards.

## 1. When the AI MUST propose and ask for a manual test

The AI must **proactively offer a specific, executable manual test** and **ask the owner to run it**, rather than merely saying a tool or environment is unavailable, when any of these conditions holds:

- A physical device, OS permission, GUI, USB/ADB, app lifecycle, external provider, or other interactive step cannot be reliably exercised in the AI's environment.
- An automated test fails more than once (or still fails after one evidence-based repair), but the root cause is uncertain and additional patches would be speculative. Use judgment for critical defects; a test failure is not itself proof of a harness-only defect.
- Automation reports a failure that conflicts with independently passing lower-level checks or a user-observed real workflow, and a manual run can distinguish app behavior from test-runner/environment behavior.
- The owner is the only authorized actor able to perform a gated test (e.g., approved provider sandbox or physical hardware interaction). **Do not propose unauthorized production, payment, or real-cloud actions**; first obtain required approvals or use safe local alternatives.

**Escalation timing:** Investigate the first failure with logs, reproduction, and targeted tests. After repeated unresolved failures, stop the cycle of speculative rewrites, state what remains unknown, and offer the manual procedure **in that same response**. Do not wait for the owner to suggest manual testing. For an absent SDK/device or an owner-only action, request the manual check immediately.

## 2. What the AI must provide

A concise, copyable checklist tailored to the **actual current phase and environment**, including:

1. Prerequisites (exact local services to start, ports/target, clean test fixture, account and state requirements; never reveal secret values).
2. Exact commands to start the app/backend and any safe connectivity preflight (on Windows, use canonical npm scripts; do not automatically launch Java DynamoDB Local).
3. A short sequence of visible user actions, including one success path and the most relevant negative/recovery case where safe.
4. Observable expected result **for each step** and what constitutes failure; specify which results require screenshots/logs and which should be reported as sanitized text only.
5. One clear request to the owner: **“Please run these steps manually and tell me which passed or failed, and the exact non-secret message shown.”**
6. The next diagnostic action conditional on that result. Do not request raw OTPs, session tokens, developer keys, `.env`, private personal records, debug APKs, signed URLs, or other secrets.

**Example (P01 local Android):** Keep manually started Java DynamoDB Local on port 8000 and `npm run dev:api` on port 3000. Stop the automated test and run `npm run dev:flutter` with the authorized USB phone (ADB reverse configured by launcher). Request a local email OTP using a new synthetic address; read the local development outbox; complete adult DOB/consent and sign in; press **Check account access** (expected `Account access confirmed`); press **Log out** (expected `Signed out` and return to email form). Report PASS/FAIL step by step, but not the code/email/token. For an unexpected HTTP problem, record sanitized UI error, whether Fastify remains running, and `adb reverse --list`; do not repeatedly trigger OTP issuance during cooldown.

## 3. Evidence handling and status: separate manual, automated, and inferred results

Record in `docs/qa/EVIDENCE_LOG.md` (or the current phase QA file): **date, owner/environment/device, steps actually performed, expected vs observed result, provenance, and evidence status**. Use distinct labels:

- `PASSED (manual, owner-observed)` — only for actions the owner explicitly confirmed on the real app.
- `FAILED (automated)` — an executed failing test. Preserve command, sanitized failure category, and reproducible issue reference.
- `UNVERIFIED` — steps not executed; do not infer PASS from source/tests or adjacent workflow.
- `INFERRED / NOT SEPARATELY OBSERVED` — a prerequisite implied by reaching a later UI state; do not claim it was directly tested.
- `OWNER-ACCEPTED EXCEPTION` — an **additional tracking note, not a test status**; requires explicit owner acceptance of limited forward progress, named unresolved tests, scope/risk boundaries, and a recheck trigger.

A manual pass **never changes `FAILED (automated)` to `PASSED`**, never makes `npm run verify:p01` (or another failing command) a pass, and never automatically makes an entire phase `CORE_FLOW_VERIFIED`. Maintain `PARTIALLY_VERIFIED` or `RELEASE_BLOCKED` as appropriate. Preserve failing automated tests and their CI/gate behavior; do not delete, skip, weaken, mock away, or silently exclude failures to make the dashboard green.

## 4. Risk boundaries and proceeding with an exception

- **Safe local-development progress:** After a successful manual core workflow **and** relevant real API/DB, typecheck, unit, security and regression evidence, the owner may explicitly accept a **narrow test-automation exception** and authorize the next slice of the **same phase**. Keep the failing automated test listed, and prioritize revisiting it if later changes affect the same transport/UI lifecycle.
- **Never waive P0/security-critical evidence:** Age/identity assurance, authorization/privacy boundaries, money/credits, idempotency, account deletion, real provider verification, and production release require their mandated evidence/authorization. A manual happy path cannot excuse a demonstrated security, billing, privacy or core functional defect, and cannot authorize real cloud/provider activity.
- **Release gate:** Any required failing or unverified gate remains open. Production release stays blocked until the formal `docs/qa/RELEASE_GATE.md` criteria are met and authorized exceptions (if any) have been evaluated. An owner acceptance to continue local development is **not a release waiver**.
- **Diagnose vs workaround:** The AI must state whether a failure is a proven app defect, likely harness/infrastructure issue, or unresolved. Do not call it “test-only” without evidence. Do not make repeated speculative source edits once manual behavior differs from automation; preserve a sanitized repro for later root-cause work.

## 5. Current P01 precedent (2026-11-13)

- Owner-reported Windows checks: `verify:p01:portable`, backend `typecheck`, Flutter analyzer/14 tests and real Fastify/Java DynamoDB Local P01 authentication integration passed in earlier runs; P00 physical Android diagnostics passed during earlier combined verification. Check original dated evidence for per-run provenance.
- Latest owner P01 device automation **FAILED**: `npm run test:flutter:p01:e2e` returned `response_headers_truncated` on OTP request, with subsequent same-device readiness/diagnostic probes failing. A test-harness patch was tried; **the automated test still FAILED**. Root cause remains unresolved; manual app success does not prove it is only a harness defect.
- Owner's interactive Android app showed **`Account access confirmed`** and subsequently **`Signed out`**, returning to the email screen: **two manually observed PASS steps**. Local OTP issuance, outbox retrieval and verification are prerequisites inferred from the signed-in state, **not separately owner-confirmed steps in this exchange**.
- Owner explicitly agreed to **pause this particular automated E2E troubleshooting** and continue within P01 with the failure documented. This is a local-development exception only: current P01 slice manual core workflow accepted; automated failure still open; **overall P01 `PARTIALLY_VERIFIED`, P00 historical `CORE_FLOW_VERIFIED`, P02 not started**.
- Revisit before P01 phase closeout or if another Android API test shows the same symptom; keep a fresh repeatable sanitized failure and independently verify core/security gates. Do not rewrite production auth simply to chase an unproven test-harness cause.
