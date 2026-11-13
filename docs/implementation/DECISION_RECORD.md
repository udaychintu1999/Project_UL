# Implementation planning decisions (2026-11-10)

- ADR-IMP-001: Keep **18 phases**, comparable to original U_Day's developer handoff, but each phase guide remains one focused file, not giant repeated documents.
- ADR-IMP-002: Exactly **D1–D3 + T1–T3** per phase; no testing-only phase until last full regression and no backend-only feature phase.
- ADR-IMP-003: Support **two execution modes**, autonomous coding agent and ordinary AI Chat, with the same source/test/ZIP deliverables and environment-specific execution evidence.
- ADR-IMP-004: Chat must generate **complete code + executable automated tests**, run everything available, fix observed errors and provide exact manual runbooks for unavailable capabilities. No invented runtime claims.
- ADR-IMP-005: P00 creates real local environment and shared test scripts. P01–P16 implement vertical slices. P17 performs system release audit.
- ADR-IMP-006: Preserve **18 feature-aligned DynamoDB tables** from Step 03, H3 R6 and user-adjustable 0–50 km distance bands; no blanket ban on justified indexes after actual query benchmarks.
- ADR-IMP-007: Every step ZIP includes current `docs/` tree, and when implementation begins also changed project-relative source/scripts/tests. Earlier planning-only package did **not** masquerade as implementation; current full handoff ZIP includes P00 source scaffold with explicitly PARTIALLY_VERIFIED status.
- ADR-IMP-008: Source truth = current product contract + physical schema + active phase. Prior archived references never override current rules.
- ADR-IMP-009: Do not require the founder to manually verify every tiny feature during implementation. The agent/AI runs everything it can, and human checks are limited to genuinely inaccessible tests with exact instructions.
- ADR-IMP-010: Cross-phase dependencies allow limited test-only fixture seeding, not production mock bypass. Distinguish Flutter widget tests, real DDB Local, provider sandboxes and production smoke tests.
