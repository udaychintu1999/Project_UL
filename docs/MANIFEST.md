# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

> **Current status as of 2026-11-13:** P00 has owner-confirmed `CORE_FLOW_VERIFIED` evidence; P01 slice 01 is `PARTIALLY_VERIFIED` with real local API/DB and Flutter analyzer/widgets passed on Windows, and a subsequent corrective patch awaiting Windows TypeScript + USB Android rerun. This note supersedes the older P00-focused current-status paragraph below (retained as historical manifest context). See `docs/qa/P01_WINDOWS_REPAIR_2026_11_13.md`, `docs/qa/EVIDENCE_LOG.md`, `docs/NEXT_STEP.md` and `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`. P02 and production AWS/payment integration are not authorized.

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
