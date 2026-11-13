# P00 follow-up — standardized npm commands and owner-only `.env` setup

**Date:** 2026-11-12 · **Scope:** development experience/documentation; P00 still `PARTIALLY_VERIFIED`, P01 remains unopened.

## Owner decisions incorporated

- DynamoDB Local is **always started/stopped manually by the owner**. No npm startup/test command launches Java, a Docker container or any AWS cloud service.
- All everyday backend, database provisioning, Flutter and verification tasks are named **npm scripts** working from project root in either PowerShell or Command Prompt. Legacy `.ps1` wrappers are retained for compatibility but are no longer the documented startup path.
- The `.env` file is necessary for local config but **is not manually authored** in normal first-time setup: `npm run env:init` invokes the existing **OWNER-ONLY** private token generator. It creates `apps/api/.env` from `apps/api/.env.example` and inserts a random local token without printing it. Existing configured tokens are never overwritten. AI agents do not call this command, read actual `.env`, or package it.
- Database provisioning, real direct DB tests and real API integration tests load the owner's local `.env` privately at runtime via Node's `--env-file` (Node 22+); they refuse remote endpoints and use dummy local DB credentials.
- The Flutter npm launcher uses private debug env config to inject a local dev token into a **debug-only** build/test and validates the API address against localhost/Android emulator. Do not distribute P00 debug builds.

## New/standardized commands

| npm command | Effect | Prerequisites |
|---|---|---|
| `npm run env:init` | Owner-only local `.env` initialization | Once, Node 22+ |
| `npm run db:provision` | Verifies/provisions canonical 18 local tables | Manually started DynamoDB Local, `.env`, installed npm packages |
| `npm run dev:api` | Fastify backend | `.env`, installed packages |
| `npm run flutter:setup` | Create Android scaffold only if absent; Flutter pub get | Flutter SDK |
| `npm run dev:flutter` | Flutter Android debug app | `.env`, Flutter/Android SDK, running API |
| `npm run test:flutter` | Flutter analyze + widgets | Flutter SDK |
| `npm run test:flutter:e2e` | Android integration test against real API/DB | `.env`, device/emulator, API, Java DB |
| `npm run test:db` | Real local database assertions | Java DB, local tables |
| `npm run test:integration` | Real Fastify+DB assertions | Running API, Java DB |
| `npm run verify:p00:portable` | Offline/source checks only | Node 22+ |
| **`npm run verify:p00`** | **Full gate** portable + typecheck + DB + API integration + Flutter static/widget + Android E2E | Live local DB/API + Android device/SDK; manual outage checks still separate |

`npm run verify:p00` had meant portable-only in prior handoff documentation. It now genuinely fails when live dependencies/tests are missing. Historical evidence of older `verify:p00` executions is **not** evidence of the new full gate.

## Actual checks in this authoring environment

Environment: Linux, Node v22.16.0; Java available but official DynamoDB Local JAR, Flutter SDK and npm dependencies unavailable. **No private `.env`, AWS credentials, cloud APIs or Java database were read, started or accessed.**

- **PASS:** `node --test scripts/verify/p00-dev-cli.test.mjs` — five CLI/negative/stub-only checks (not a Flutter runtime test).
- **PASS:** `npm run test:portable` — 9 domain/local-safety tests + 2 endpoint tests + 5 new CLI tests = 16 Node tests, plus source, docs, environment, secrets and cloud guards.
- **PASS:** `npm run verify:p00:portable` — repeated the above full portable suite.
- **PASS:** `node --check scripts/dev/flutter.mjs`, `scripts/verify/p00-dev-cli.test.mjs`, `scripts/verify/p00-verifier.mjs` — syntax checks.
- **BLOCKED:** `npm run typecheck` — TypeScript `TS2688` missing `@types/node`; npm packages not present. Previous npm install attempt returned registry DNS `EAI_AGAIN`. **Not a typecheck pass.**
- **BLOCKED (actually attempted):** `npm run verify:p00` — portable gate passed, then stopped at TypeScript `TS2688` with exit code 2, correctly refusing to report full P00 success. DB/API/Flutter gates were not reached (UNVERIFIED).
- **UNVERIFIED:** owner-only `npm run env:init` (intentionally never run by AI), Windows `.bat`/PowerShell runtime semantics, real Java local database, Fastify integration, Flutter SDK/device E2E, failure/restart/retry manual acceptance.

**Decision:** Keep P00 `PARTIALLY_VERIFIED`. Owner should apply update ZIP, run first-time `npm run env:init` privately, manually start Java, provision and start API, initialize/test Flutter, then run `npm run verify:p00` and record redacted acceptance evidence. No P01 / P17 / payment / AWS work authorized or claimed.
