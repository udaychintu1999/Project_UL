> **MANDATORY FINAL v2.0 SECURITY FIRST:** Read `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` before any tools. NEVER read actual `.env`/secrets or sign/upload test media. NO AWS requests/changes/charges without explicit owner authorization for the **specific** bounded operation; owner may instead do it manually. DEV 2 S3 buckets + 1 CloudFront are owner-created early; Java DynamoDB Local stays through P16; local media defaults for all automated tests; P16 payment sandbox; P17 real AWS DynamoDB/production media. Always run `npm run test:secrets`, `npm run test:cloud-guards`, package via safe script, and report tests honestly. This overrides any older contradictory statement below.

# Mode A — Autonomous coding agent: live development and verification

Use if the agent has filesystem, terminal, Java DynamoDB Local/Flutter and appropriate permitted credentials or emulators. Connection to external systems is not implied; require authorization for deployments/payments/account changes.

1. Read `docs/START_HERE.md`, product contract, current phase, relevant 18-table physical schema; avoid full docs rescans.
2. Before changing code, inspect current repository state and rerun affected smoke/tests to establish baseline.
3. Implement **one complete vertical slice** (real BE + Flutter + DynamoDB operations + tests) per iteration.
4. Run T1 tests, run T2 against real DynamoDB Local, and run Flutter widget/integration plus browser tests for T3 where available.
5. Exercise happy and failure paths: import/select image, process/save, view/paginate, connect/message, delete/expire as relevant; test repeat, concurrency, negative and recovery behavior.
6. Repair, rerun. Do not skip failed tests or mark a failure as known acceptable without explicit decision record.
   - **Escalate for human observation:** If a device/GUI/provider check cannot be exercised or repeated failures persist without a proven app defect, the agent **must proactively ask the owner to run a specific manual test** (commands, steps, expected result, non-secret evidence). Halt speculative patch loops. Keep failing automation explicit; only the owner may accept a bounded local-development exception, never an automatic PASS/release waiver. See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.
7. Record commands, environment, exit codes, duration where available, logs or fixture IDs, actual pass/fail and truly inaccessible tests.
8. Update only affected docs, evidence, phase progress; package changed code + `docs/` ZIP, with a concise next-step handoff. STOP at phase boundary.

Tests involving actual production SMS/email, Google auth, payment stores, age assurance, restricted content, S3 or deployment must be distinguished from local stand-ins; perform only with explicit permissions and test accounts.


**v1.1 environment/phase override:** Use official Java 17+ DynamoDB Local JAR, not Docker. P00–P15 use local media storage by default, with owner-created early DEV 2-bucket S3/CloudFront only for separately approved limited tests; real AWS DynamoDB and production media remain P17, payment sandbox P16. AI must never read `.env`/secrets or call AWS without scoped owner approval. See `docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md` and `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md`. Never claim provider/cloud verification from local fixtures.
