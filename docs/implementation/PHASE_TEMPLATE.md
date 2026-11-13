# Template for new or changed phase sections

**Phase:** PXX  
**Feature:** [name]  
**Prerequisites:** [finished phases]  
**Tables:** [real names]  
**Product rules:** [source links]  
**Status:** NOT STARTED

## D1 — Backend + Database
- Real endpoints, validation, data model, access patterns, transactions where needed.
- Deliver source files and deterministic seed fixtures.

## D2 — Flutter/UI
- Screens, typed API client, states, accessible actions.
- Deliver source files and widget tests.

## D3 — Workflow & Recovery
- Integrate, handle permission failures/retries/cancellation/concurrency.
- Deliver full main user journey and negative paths.

## T1 — Static/Unit
- Generate tests and run all available locally; log exact command/result.

## T2 — DynamoDB Local/API
- Real provisioned tables and API round trips; record expected DB state. Mock-only tests not accepted as substitute.

## T3 — Flutter E2E + Manual
- Run widget/device/browser integration where available. Otherwise runnable scripts, exact human start commands and unverified evidence.
- If unavailable or repeatedly unreliable after targeted diagnosis, AI **must ask owner to perform manual workflow** with exact commands, steps, expected results and sanitized feedback. Record manual vs automated outcomes separately using `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`; retain failing test and unresolved gate.

## Exit gate
- P0 user journey works, all tests evidence-backed, unresolved coverage called out, changed code/test scripts+docs ZIP, stop after phase.
