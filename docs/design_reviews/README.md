# P01 authentication design review — read in order

These documents are a **documentation-only audit**, not implemented features or passed tests. No application, API, DynamoDB schema, or Flutter test was changed by this review.

1. `P01_2_P01_3_DESIGN_AUDIT_READ_FIRST.md` — source-grounded findings and implementation hold.
2. `P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md` — NEW approved password policy; current source mismatch.
3. `P01_2_PASSWORD_AND_OTP_DETAILED_SPEC.md` — exact account/login/OTP/recovery UI and server contracts.
4. `P01_3_30_DAY_PERSISTENT_SESSION_DETAILED_SPEC.md` — proposed session/device lifecycle and unresolved reauth boundaries.
5. `P01_AUTH_STATE_TRANSITION_AND_EDGE_CASE_MATRIX.md` — cross-state permutations and abuse cases.
6. `P01_VERIFICATION_MASTER_MATRIX.md` — mandatory automation first, real DB/device gates.
7. `P01_DECISIONS_RISKS_AND_RELEASE_GATE.md` — approvals, pending decisions, no-code hold, acceptance criteria.

**Confirmed current P01-2 blockers:** login-OTP shows signup DOB/consent (and backend can unintentionally create a UID); Android recovery test’s Reset tap does not hit the button; password policy code/tests still implement superseded 8+punctuation. The previous P01-1 Android E2E exception stays narrow and failed.
