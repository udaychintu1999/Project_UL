# Test automation contracts P00 must implement

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

**Status:** P00 source and core test scripts are included and portable Node tests executed. Live DynamoDB Local, Flutter and backend dependency typecheck remain UNVERIFIED. The remaining phase-specific scripts and code must be added as each phase is implemented.
