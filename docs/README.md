# U_luv docs — canonical handoff

This repository includes complete 18-phase **planning documents** and P00 **source scaffolding** in `apps/`, `scripts/`, and `infra/`. The application is not production complete. See `docs/START_HERE.md` and `docs/qa/EVIDENCE_LOG.md` for actual execution status.

# U_luv — AI-ready architecture and phase implementation handoff

**Version:** Implementation Plan v1.0 · **Date:** 2026-11-10 · **Status:** PLANNING-ONLY ZIP

This ZIP packages the current **18-table Step 03 architecture**, product contract, 90 access patterns and an **18-phase implementation plan** with exactly three development and three testing sections per phase. It is the first documentation milestone before producing the complete Project U_Day-style application handoff ZIP.

## Read only what you need

1. `START_HERE.md` — environment-specific workflow and truthfulness.
2. `product/PRODUCT_CONTRACT.md` — latest business rules.
3. `implementation/PHASE_MASTER.md` — all 18 phases.
4. `implementation/phases/Pxx.md` — current phase only.
5. `implementation/AI_CHAT_MODE.md` OR `implementation/CODING_AGENT_MODE.md`.
6. Relevant `architecture/` docs + `qa/RELEASE_GATE.md` + `manual/LOCAL_START_AND_VERIFY.md`.

## Delivery modes

- **Coding Agent:** Run actual source edits, Docker/DynamoDB Local, Flutter, integration suites; evidence-based fixes.
- **AI Chat:** Generate complete code, automated tests and scripts; run all available tools; for inaccessible runtimes, include exact human-run scripts and mark checks UNVERIFIED. Never claim executed tests based on code alone.

## Current architecture

18 feature-aligned DynamoDB tables; Flutter, Fastify/TypeScript monolith, S3/CloudFront, ECS, SES; H3 R6 home-cell pointers; user-selected 0–10,10–35,35–50/All 0–50 km; no hidden popularity ranking; no request-facing Scan or unnecessary indexes. Current schema and access patterns remain proposals pending actual test.

## Current verification

Planning docs were generated and ZIP structure can be validated; source files, tests, DynamoDB Local, Flutter, Android, real AWS, and payments have **not** been executed. See `qa/EVIDENCE_LOG.md`.

## Next

Review this plan, then generate the **full Project U_Day-style handoff bundle** with root README/AGENTS, P00 project scaffolding, code/test harness entrypoints and current docs. Do not claim project foundation exists until P00 is actually implemented.

**Latest P00 developer runbook (2026-11-12):** [Local start and verify](manual/LOCAL_START_AND_VERIFY.md); [manual Java DynamoDB Local](manual/JAVA_DYNAMODB_LOCAL_SETUP.md). Use `npm run env:init` once privately, **manually** start Java every session, `npm run db:provision`, `npm run dev:api`, `npm run dev:flutter`. `npm run verify:p00:portable` means offline tests; `npm run verify:p00` means complete automated live DB/API/Android gate.
