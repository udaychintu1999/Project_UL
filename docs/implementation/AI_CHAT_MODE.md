**AUTOMATED-FIRST (mandatory):** Run every feasible *phase-specific* automated test (including live local API/DynamoDB and real-device Flutter UI) before asking the owner for manual testing. Verify what the tests actually tap: P00 diagnostics do not count as P01-2 password UI coverage. An owner-excepted P01-1 Android automation failure does not waive P01-2's required `npm run test:flutter:p01-2:e2e`. Failed/absent tests stay FAILED/UNVERIFIED, and owner manual testing is requested only after feasible automation or when that behavior truly cannot be automated. See `docs/implementation/QA_AUTOMATION_CONTRACT.md`.

> **MANDATORY FINAL v2.0 SECURITY FIRST:** Read `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` before any tools. NEVER read actual `.env`/secrets or sign/upload test media. NO AWS requests/changes/charges without explicit owner authorization for the **specific** bounded operation; owner may instead do it manually. DEV 2 S3 buckets + 1 CloudFront are owner-created early; Java DynamoDB Local stays through P16; local media defaults for all automated tests; P16 payment sandbox; P17 real AWS DynamoDB/production media. Always run `npm run test:secrets`, `npm run test:cloud-guards`, package via safe script, and report tests honestly. This overrides any older contradictory statement below.

# Mode B — Regular AI Chat: maximum useful coding/testing without false runtime claims

Use when the assistant can write/generate files and execute some local shell/Python commands but lacks full Flutter, Java DynamoDB Local JAR, Android emulator, AWS keys, network access or long-running services.

## Mandatory behavior

1. **Generate actual source code**, not pseudocode: complete files, imports, package declarations, typed contracts and project-relative paths. For changed-file handoff, include enough context to apply without guessing.
2. **Generate runnable QA automation** with real assertions and deterministic fixtures: TypeScript unit tests, Flutter widget tests, API integration suite, DynamoDB Local suite, concurrency/credit tests, negative/security tests, Playwright tests when applicable, scripts for clean bootstrap and all checks.
3. **Run every test the environment really supports.** If Python/shell is available, perform file validation, JSON/TS source consistency and script lint as feasible; if Node is available, run TS tests; if Java DynamoDB Local is available, run real CRUD/Query/transactions; if Flutter is available, run `flutter analyze` and tests. Never substitute a mock and call it a real DynamoDB Local test.
4. **Repair failures immediately** when possible. Rerun tests. Record the actual command, environment, exit code and observed output; if no executable runtime, record `UNVERIFIED` with reason.
5. **Deliver executable test scripts and exact manual commands** for remaining real-environment tests; give expected outcomes and failure remediation. Do not ask the human to invent missing setup files.
   - **Mandatory manual escalation:** When Android/interactive/provider testing is unavailable, or an automated check still fails after evidence-based diagnosis and further patches would be speculative, ask the owner **in the current reply** to run a short manual end-to-end checklist. Specify commands, taps/inputs, expected UI state and sanitized feedback, then update manual-vs-automated evidence. Never claim the manual outcome as an automated PASS or relax a security/release gate. See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.
6. **Only claim actual verification**: Code generated ≠ compiled; unit tests passed ≠ Flutter works; source-level audit ≠ live API; mocked DynamoDB ≠ DynamoDB Local; widget tests ≠ physical Android test; sandbox receipt mocks ≠ real purchase.
7. For each feature, generate both positive and negative tests, concurrency/idempotency where money or permissions are involved, cleanup of fixtures, and repeated-use tests.
8. Explain no background/async work and do not promise testing later; provide the usable artifacts and available evidence in this response/step.

## Response/ZIP requirements

- Deliver one ZIP per requested step containing changed project-relative source files, test scripts, seed data, bootstrap scripts, and updated `docs/`.
- `docs/qa/EVIDENCE_LOG.md` records each test and exact status: `PASSED`, `FAILED`, `UNVERIFIED`, `NOT_APPLICABLE`.
- `docs/manual/LOCAL_START_AND_VERIFY.md` gives Windows PowerShell commands, prerequisites, secrets setup, Flutter targets, real DB setup and troubleshooting.
- If it cannot make a ZIP, provide exact source files in responses and report packaging limitation; never fake a download link.
- Status must be honest: `PARTIALLY_VERIFIED` when critical real runtime paths were unavailable. Release is blocked until P0 is verified by an agent or human.

## AI Chat work loop

Read current phase → generate BE+FE+DB code → generate T1/T2/T3 tests → run all available → fix → generate scripts/manual tests for missing capabilities → update docs once → ZIP → STOP. One small complete story at a time; do not attempt to implement all 18 phases in one response.


**v1.1 environment/phase override:** Use official Java 17+ DynamoDB Local JAR, not Docker. P00–P15 use local media storage by default, with owner-created early DEV 2-bucket S3/CloudFront only for separately approved limited tests; real AWS DynamoDB and production media remain P17, payment sandbox P16. AI must never read `.env`/secrets or call AWS without scoped owner approval. See `docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md` and `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md`. Never claim provider/cloud verification from local fixtures.
