# P02 design reviews — consolidated after owner acceptance

The P02-0 design decisions, P02-1/P02-2 implemented contracts and P02-5 visual reference are now in [`docs/p02/README.md`](../p02/README.md), with separate product, technical, UI, verification and incident-history guides. Original P02 review filenames remain as compatibility pointers where still referenced; they are **not** current `NOT IMPLEMENTED` instructions. P02-0–P02-5 are locally owner-accepted as of 16 November 2026; the separate native SAF/visual checklist remains unconfirmed. The P01 design-review index below is preserved unchanged.

---

# U_luv — Design Review Index (2026-11-14)

## Current approved P01-3 V3 design — read these first

1. `P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` — **single source of truth**, owner decisions, scope and handoff.
2. `P01_3_REFRESH_SIMPLE_PROTOCOL_AND_SECURITY_V3.md` — single-use rotation, CAS, reuse rejection, offline/error behavior.
3. `P01_3_DEVICE_BINDING_AND_SECRET_ROTATION_V3.md` — Keystore signer, protected storage, purpose-separated server secrets and migration.
4. `P01_3_USER_EXPERIENCE_AND_FAILURE_STATES_V3.md` — startup, 30-day UX, Back, logout, offline, phone lifecycle.
5. `P01_3_DECISION_AND_THREAT_REGISTER.md` — **approved** choices, residual risks and security/release blockers.
6. `P01_3_PERMUTATION_EDGE_CASE_MATRIX.md` — 84 state/failure/attack scenarios aligned to V3.
7. `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md` — real Fastify/DynamoDB, Flutter and physical-device gates.
8. `P01_3_WINDOWS_READINESS_RUNBOOK.md` — actual baseline commands, future script names, owner manual acceptance.
9. `../qa/P01_3_APPROVED_DESIGN_EVIDENCE_2026_11_14.md` — documentation evidence and next authorization boundary.

**V2/historical context (not authoritative when conflicting):** `P01_3_DEEP_ANALYSIS_MASTER_2026_11_14.md`, `P01_3_API_DYNAMODB_TOKEN_PROTOCOL_V2.md`, `P01_3_FLUTTER_ANDROID_LIFECYCLE_V2.md`, `P01_3_30_DAY_PERSISTENT_SESSION_DETAILED_SPEC.md`, and the P01-2/P01-3 early audit. Their complex same-request retry receipt/cached response options were **rejected** for P01-3 V1.

**Status:** P01-2 owner-accepted. P01-3 design-approved **NOT IMPLEMENTED**. No new P01-3 tests executed. P01-1 Android OTP E2E local-development-only exception remains an automated FAIL. No AWS/provider/payment work authorized.
