> **MANDATORY FINAL v2.0 SECURITY FIRST:** Read `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` before any tools. NEVER read actual `.env`/secrets or sign/upload test media. NO AWS requests/changes/charges without explicit owner authorization for the **specific** bounded operation; owner may instead do it manually. DEV 2 S3 buckets + 1 CloudFront are owner-created early; Java DynamoDB Local stays through P16; local media defaults for all automated tests; P16 payment sandbox; P17 real AWS DynamoDB/production media. Always run `npm run test:secrets`, `npm run test:cloud-guards`, package via safe script, and report tests honestly. This overrides any older contradictory statement below.

# U_luv — CONTINUE PHASE PROMPT (Coding Agent OR Regular AI Chat)

Continue development of **U_luv — Algorithm-Free Connections** using the latest project ZIP/repository and its `docs/` directory. **Do not restart, regenerate a new project, switch architecture, or repeat finished work.**

## Identify the exact work
1. Read `AGENTS.md` and `docs/START_HERE.md`, then `docs/implementation/PROGRESS.md`, `docs/NEXT_STEP.md`, `docs/qa/EVIDENCE_LOG.md`, and the **current** `docs/implementation/phases/Pxx.md`.
2. Read `docs/product/PRODUCT_CONTRACT.md` and only the architecture, access-pattern and testing documents needed for this slice.
3. Determine the earliest incomplete or failing critical end-to-end slice of the current phase. If I explicitly specify a phase or task, use that target while preserving prerequisites.
4. If the last ZIP is update-only, apply it over the existing project; never treat it as a fresh standalone project or discard unchanged files.

## Deliver one working vertical slice
- **D1:** Implement/update real Fastify + DynamoDB behavior, exact access patterns, validation and atomic operations.
- **D2:** Integrate the usable Flutter UI with the real API and cover visible loading, errors and permissions.
- **D3:** Complete the user journey, retries, duplicates, concurrency, cancellation and recovery.
- **T1:** Generate and execute available lint/typecheck/unit/static tests; repair failures.
- **T2:** Generate and execute real DynamoDB Local + API integration, transaction, security and negative tests when the environment supports it. Do not substitute mocks for a real DB PASS.
- **T3:** Generate and execute available Flutter widget/integration and end-to-end tests; create detailed manual/device/Windows runbooks for unavailable checks.

## Preserve contracts
Follow all existing business rules, especially: 18 feature-aligned DynamoDB tables; H3 Resolution 6 and the 0–10 / 10–35 / 35–50 km user-adjustable bands; algorithm-free discovery; free ordinary Dating Likes; 1-credit explicit Like Back plus separate 1-credit Connect; 4/2 monthly free credits; one-credit nonrefundable successful Friendship requests; seven-day message/post expiry; five-photo local posts; shared wallet; no duplicate paid unlocks. Preserve earlier passing behavior and rerun regressions after changes.

## AI Agent vs regular AI Chat
- **Agent:** edit real files, run every available tool/test, fix defects and preserve evidence.
- **Chat:** produce complete source/test/script updates and a usable ZIP, execute all tests the current session genuinely permits, and mark Java-based DynamoDB Local (no Docker)/Flutter/device/store/payment operations **UNVERIFIED** if unavailable. Provide exact setup and test commands, expected outcomes and troubleshooting steps; do not claim runtime verification by inspection.

## Strict completion contract
1. If a P0 workflow fails, repair it before adding optional features; rerun affected automated tests.
2. Never fabricate tests, command logs, Flutter screenshots or AWS/DynamoDB behavior.
3. Keep phase scope small enough to finish a real Backend → DB → Flutter path, including tests, in this turn.
4. Update `docs/implementation/PROGRESS.md`, `docs/qa/EVIDENCE_LOG.md`, `docs/NEXT_STEP.md` once after the slice; keep the `docs/` folder authoritative.
5. Return an **update-only project-relative ZIP** containing changed source/tests/scripts and updated `docs/`. Exclude secrets, dependencies and cache directories.
6. Summarize what was actually implemented and tested, exact passing/failing commands, `CORE_FLOW_VERIFIED`/`PARTIALLY_VERIFIED`/`RELEASE_BLOCKED` status, remaining unverified manual checks and the precise next task.
7. Move to the next phase **only** when the current phase's critical acceptance criteria have evidence-backed verification. If tooling blocks complete validation, preserve the partially verified status and hand off exact manual checks instead of falsely declaring success.
8. **Manual test escalation is mandatory**: after repeated unresolved automated/device failures or unavailable interactive tooling, **proactively ask me to test the user workflow manually** with exact commands, taps/actions, expected results and what non-secret evidence to return. Record manual PASS and automated FAIL separately. Stop speculative fixes; a locally accepted exception may permit the next slice of the same phase but never silently pass gates or permit production release. See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.

**Continue immediately with the next incomplete, highest-priority vertical slice. Produce code and tests, not just a plan.**

**Environment v1.1:** For P00–P16 use Java DynamoDB Local. Owner manually configures two DEV S3 buckets and one DEV CloudFront distribution early, but no AWS calls/upload by AI without distinct scoped owner approval. Local media automated tests remain default. P16 payment sandbox; P17 owner-authorized production AWS DynamoDB and separate media/ECS.
