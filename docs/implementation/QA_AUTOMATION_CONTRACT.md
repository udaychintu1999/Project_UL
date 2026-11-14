> **P01-2 email-quota gate (2026-11-14):** `npm run test:p01:email-budget:integration` is mandatory real DynamoDB Local verification for atomic shared rolling limits, 5th/6th, concurrency, idempotency and no-send privacy. The combined `verify:p01-2` must include it before device/manual QA.

# Test automation contract — all phases (P00–P17)

## AUTOMATED-FIRST: required in every phase

Before asking for manual testing, run **all feasible automated test layers that actually cover the current user journey**: portable/unit/source guards, semantic typecheck/analyzer, real Fastify + Java DynamoDB Local integration, widget tests and available Android device E2E. Inspect test names and steps; P00 button checks cannot substitute for P01 auth UI checks. Do not report a complete automated gate unless every required phase-specific test really ran. For missing or repeatedly failing automation, record `FAILED` or `UNVERIFIED` and ask for manual intervention **after** completing all other feasible automated checks, not in place of them. An explicitly owner-accepted exception must name the precise failing test, leave it runnable and preserve the release blocker where relevant.

For P01-2 specifically, `npm run verify:p01-2` MUST include `npm run test:flutter:p01-2:e2e` (real password login, access, change, recovery, logout on physical Android). `npm run test:flutter:e2e` is a separate P00 regression only. The existing P01-1 OTP Android E2E (`npm run test:flutter:p01:e2e`) is a known unresolved local-development exception, **not a PASS**. No change to P01-3 (30-day sessions) or P02 is authorized by this policy.

## Mandatory manual-test escalation (all P00–P17 phases)

Follow [`docs/qa/MANUAL_VERIFICATION_ESCALATION.md`](../qa/MANUAL_VERIFICATION_ESCALATION.md). AI must **ask the owner to perform an exact manual test** if physical hardware, UI, privileged external checks, or environment limitations prevent automated verification, or if repeated failures persist after a justified diagnosis/repair and the next patch would be speculative. Provide startup commands, actions, expected results, failure evidence request and one clear question to owner. Do not wait for owner to volunteer manual testing. Manual results are separately evidenced; `FAILED (automated)` is never converted to PASS. Owner may accept limited continued development of the same phase with a documented exception; critical security/release gates cannot be skipped, and CI failures must not be disabled.


## Backend (Node.js)

- `npm run typecheck`: compiler strict types.
- `npm run lint`: static rules incl. forbidden Scan in production request paths where enforceable.
- `npm run test:unit`: deterministic business model/sanitization/permissions tests.
- `npm run test:integration`: requires real local `DYNAMODB_ENDPOINT` (loaded privately from `apps/api/.env` by the owner-run npm command) and provisioned tables. Fail explicitly if the server is not reachable; **never auto-fallback to mocked tests**.
- `npm run test:concurrency`: double-debit, idempotency replay, grants and request races.
- `npm run test:security`: unauthorized access, cross-account privacy, blocks and roles.
- `npm run test:geo`: H3 boundary 0/10/35/50 km, R6 cell edges, dedupe, no leaks, cost/query counters.
- `npm run test:expiry`: seven-day visibility + cleanup behavior with controlled clock.

## Flutter

- `flutter analyze`
- `flutter test` (unit/widget and stable goldens only if fonts/assets deterministic)
- `flutter test integration_test` for appropriate target with Android emulator/attached device or supported web test runner.
- Launch permission/location handling, media picker and app lifecycle tests require explicit platform coverage; record unavailable target.

## Browser/admin

- `npm run test:e2e` (Playwright for admin and API-backed web flows); screenshots/traces on failure.

## Repo-level Windows commands required (legacy compatibility, overridden for P00 by npm)

**Current P00 npm entrypoints override the older PowerShell wrappers:** `npm run env:init` (owner-only, once), `npm run db:provision`, `npm run dev:api`, `npm run flutter:setup`, `npm run dev:flutter`, `npm run verify:p00:portable`, `npm run verify:p00`. Java DynamoDB Local is manually started/stopped by the owner and never auto-started by npm. `verify:p00` requires real DB, API, Flutter + Android device; `verify:p00:portable` is offline-only. Legacy `.ps1` files remain for compatibility but are not the default commands.


- `scripts/dev/start-local.ps1`, `run-api.ps1`, `run-flutter.ps1`, `stop-local.ps1`
- `scripts/verify/verify-phase.ps1`, `verify-all.ps1`, `docs-check.ps1`
- `scripts/seed/seed-fixtures.ps1`, `scripts/cleanup/reset-test-fixtures.ps1`

## Assertions and data

- Every script returns nonzero on a failed assertion, prints which environment ran, and produces machine-readable results (JUnit/JSON where practical) plus readable summaries.
- Fixtures are deterministic, namespaced to tests, cleaned after run; avoid leaking secrets or genuine user data into test logs.
- Money flows assert exact ledger entries, no negative wallet, account entitlement and replay under concurrent requests.
- Geo flows assert exact distance band inclusion and stable pages; record Query count and latency rather than guessing.
- Content expiry asserts immediate API invisibility even if physical DynamoDB TTL is delayed.
- Manual script has expected screen state and DB records to inspect where appropriate.

**Status as of 2026-11-13:** P00 was previously owner-confirmed `CORE_FLOW_VERIFIED` on Windows/Android. P01 local OTP has passing previously observed typecheck, real Java DynamoDB Local/API integration, Flutter analyzer/widget checks and owner-observed manual account-access/logout, but the P01 automated Android E2E still **FAILED** after repeated attempts. Overall P01 is `PARTIALLY_VERIFIED`; use the manual escalation protocol, preserve the failure, and do not claim P01 phase completion. Remaining phase-specific scripts are added with implementation.

### P01-2 auth UI journey coverage guard (2026-11-13)
The real-device P01-2 test is mandatory, and the Flutter widget tests must assert *screen transitions*, not just button presence: Sign up gives only the Create + Confirm password pair after new-account OTP verification; successful password login gives an account home with **zero** password-editing fields; Change password appears only after an explicit settings action. Run all possible automation before manual checks. Record the observed `Incorrect email or password` automated Android failure until its rerun succeeds.
