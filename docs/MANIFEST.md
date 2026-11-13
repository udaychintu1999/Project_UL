# U_luv documentation and source manifest — current P00 handoff

**Current baseline:** FINAL v2.0 source + P00 command-standardization update, 2026-11-12. The older documentation-only v1.0 manifest was superseded; do not treat this repository as planning-only or production-ready. A P00 starter exists, but the genuine Java DB / Fastify / Flutter run remains `PARTIALLY_VERIFIED` pending owner-run evidence.

## Canonical reading

1. `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` — no secret access or unapproved AWS calls.
2. `docs/START_HERE.md` and `docs/manual/LOCAL_START_AND_VERIFY.md` — current npm commands, owner-only `.env` initialization and manual Java DynamoDB Local startup.
3. `docs/product/PRODUCT_CONTRACT.md` and `docs/implementation/PHASE_MASTER.md` — business contract and 18 phases.
4. `docs/implementation/phases/P00.md` — current slice; D1/D2/D3/T1/T2/T3 expectations.
5. `docs/implementation/PROGRESS.md`, `docs/qa/EVIDENCE_LOG.md`, `docs/NEXT_STEP.md` — active status and actual evidence.
6. Relevant `docs/architecture/` design and `docs/qa/RELEASE_GATE.md` only when needed.

## Technical inventory

- Fastify/TypeScript P00 API (local-only) and Flutter P00 diagnostics starter; 18 DynamoDB table definitions in `docs/architecture/TABLE_CATALOG_v0_3.json`.
- Cross-platform npm commands: `env:init` (owner only), `db:provision`, `dev:api`, `flutter:setup`, `dev:flutter`, `verify:p00:portable`, and full `verify:p00` (plus individually named tests).
- `scripts/dev/flutter.mjs` provides validated debug-only emulator/USB entrypoints; existing PowerShell helpers remain in repo for backward compatibility.
- Owner manually starts DynamoDB Local from the official Java JAR. No Docker, AWS cloud database, AWS billing action, provider payments, or automated resource provisioning.

## Honesty of evidence

`npm run verify:p00:portable` executes only source, unit and offline guard checks. **`npm run verify:p00` now runs real API/DB and Android Flutter gates and fails if unavailable.** Full P00 end-to-end and manual outage/retry evidence are not yet established. P01–P17 are roadmap phases, not completed implementations. See `docs/qa/P00_COMMAND_NORMALIZATION_2026_11_12.md` for the latest verified scope.
