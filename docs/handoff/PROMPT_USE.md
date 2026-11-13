# U_luv prompt usage

These two copy/paste prompts are compatible with the full handoff ZIP and both coding agents and regular AI Chat.

1. **First session:** Attach or extract `U_luv_Full_Developer_Handoff_FINAL_v2_0.zip` and send `INITIAL_PROMPT_UNIVERSAL.md`.
2. **Next session:** Supply the current project or base project plus latest update-only ZIP and send `CONTINUE_PHASE_PROMPT_UNIVERSAL.md`.
3. Do not treat update-only ZIPs as complete projects: apply them to the same project root and retain unchanged files.
4. The agent/chat must read the live progress, evidence and next-step documents, follow the current phase guide, and work one complete vertical slice at a time.
5. A Chat without Java DynamoDB Local, Flutter, Android or AWS access may still generate real code, tests, fixtures and scripts and run portable checks; unexecuted integration must remain UNVERIFIED with reproducible runbooks.
6. Archive superseded prompt versions rather than mixing inconsistent instructions; `docs/product/PRODUCT_CONTRACT.md` and current phase docs are authoritative.

Prepared 2026-11-10. This package contains documentation-only prompt additions; it does not claim to execute U_luv source tests.

**Environment v1.1:** For P00–P16 use Java DynamoDB Local. Owner manually configures two DEV S3 buckets and one DEV CloudFront distribution early, but no AWS calls/upload by AI without distinct scoped owner approval. Local media automated tests remain default. P16 payment sandbox; P17 owner-authorized production AWS DynamoDB and separate media/ECS.

**Current P00 startup (2026-11-12):** Owner starts Java DynamoDB Local **manually** in its own terminal, then uses `npm run db:provision`, `npm run dev:api`, `npm run dev:flutter`; owner runs `npm run env:init` once for private `.env`. Full automated verification: `npm run verify:p00`; portable-only: `npm run verify:p00:portable`. See `docs/manual/LOCAL_START_AND_VERIFY.md`. The older `.ps1` startup commands are optional legacy paths.
