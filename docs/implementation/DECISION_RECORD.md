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

## 2026-11-13 — Owner-approved P01 design review policy change (documentation only)

- ADR-IMP-011: P01-2 new password policy is NIST SP 800-63B-4-aligned (15+ Unicode code points for single-factor email+password, no mandatory punctuation/character-class composition, >=64 supported and meaningful compromised-password screening). Replaces the previous owner decision of 8+symbol. **Existing source/tests still enforce the old rule; implementation pending.** See `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`.
- ADR-IMP-012: P01-2/P01-3 implementation is on hold for a full, traceable state-machine/edge-case/design approval. Confirmed P01-2 defect: Email-code login shows signup DOB/consent and can create an account. The latest Android recovery E2E failure is an untappable Reset target, NOT proven reset-API failure. Keep both recorded as failures.
- ADR-IMP-013: P01-3 is 30-day persistent sign-in, NOT P02. NIST AAL1 overall reauthentication (recommended <=30d) and persistence of bearer session secrets require explicit policy/technical review before implementing silent renewal.
