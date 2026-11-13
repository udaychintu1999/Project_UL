> **MANDATORY FINAL v2.0 SECURITY FIRST:** Read `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` before any tools. NEVER read actual `.env`/secrets or sign/upload test media. NO AWS requests/changes/charges without explicit owner authorization for the **specific** bounded operation; owner may instead do it manually. DEV 2 S3 buckets + 1 CloudFront are owner-created early; Java DynamoDB Local stays through P16; local media defaults for all automated tests; P16 payment sandbox; P17 real AWS DynamoDB/production media. Always run `npm run test:secrets`, `npm run test:cloud-guards`, package via safe script, and report tests honestly. This overrides any older contradictory statement below.

# Reusable prompts to give any AI Chat or coding agent

## One phase kickoff

> Implement U_luv **Phase PXX**, using `docs/START_HERE.md`, `docs/product/PRODUCT_CONTRACT.md`, `docs/implementation/PHASE_MASTER.md`, `docs/implementation/phases/PXX.md` and only necessary domain design/test docs. Use the existing repo as source of truth; do not restart work or change product rules. Deliver **one small complete Flutter + Fastify + DynamoDB feature slice** with functioning APIs/UI. Complete D1/D2/D3, author T1/T2/T3 runnable automated tests, run every test truly available, fix all observed P0 bugs, and accurately mark unavailable runtime checks UNVERIFIED with exact Windows human commands. Update docs only once after completion; deliver a ZIP with changed project-relative code plus updated `docs/`. Stop after one slice. No fake test results, no mock-only green checks, no unnecessary table Scan/GSI/Lambda/microservices.

## Continue an interrupted phase

> Resume the current U_luv phase from `docs/implementation/PROGRESS.md`, `docs/qa/EVIDENCE_LOG.md`, and `docs/NEXT_STEP.md`, plus the active phase guide. Don't repeat completed work. Address the next incomplete end-to-end slice and preserve all existing product/architecture rules. Re-run affected tests; complete handoff and ZIP as above.

## QA repair / no new features

> Execute the current phase verification commands. Inspect actual failures and log evidence. Repair P0 FE↔API↔DynamoDB Local workflow regressions before any feature work. Never replace real integration assertions with mocks. If runtime unavailable, supply fully executable scripts and an exact manual runbook, with status UNVERIFIED. Deliver only changed files plus updated docs in a ZIP.

## Final release audit

> Perform P17: all product-critical flows (registration → profiles → geo discovery → ordinary Like / paid Like Back → paid Connect → real chat; Friendship paid request → acceptance → chat; Local photos/comments/reactions/Activities; admin blocks/reports; 7-day visibility; purchases and wallet). Run real backend+DynamoDB Local, Flutter/Android, admin and payments sandbox when available; document actual results and any unavailable checks. Block release on unverified P0 flows, money/security failures or missing safety procedures. Deliver evidence, final docs and manual operations guide.


**v1.1 environment/phase override:** Use official Java 17+ DynamoDB Local JAR, not Docker. P00–P15 use local media storage by default, with owner-created early DEV 2-bucket S3/CloudFront only for separately approved limited tests; real AWS DynamoDB and production media remain P17, payment sandbox P16. AI must never read `.env`/secrets or call AWS without scoped owner approval. See `docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md` and `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md`. Never claim provider/cloud verification from local fixtures.
