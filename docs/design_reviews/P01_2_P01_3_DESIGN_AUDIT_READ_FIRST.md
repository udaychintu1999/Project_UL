> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# U_luv — P01-2 / P01-3 design audit and implementation hold

**Date:** 2026-11-13  
**Type:** DOCUMENTATION + DESIGN ANALYSIS ONLY. No application source, schema, tests, or runtime modified.  
**Reference baseline:** latest available `U_luv_P01_2_Android_Login_Text_Input_Repair_2026-11-13.zip` applied to the historical repository, cross-checked with its corresponding source snapshot; owner's latest physical Android log and manual UI observation.  
**Status:** `DESIGN_REVIEW_REQUIRED` (proposed planning label, not an executable verifier status). P01 overall remains `PARTIALLY_VERIFIED`. P01-3 is `NOT STARTED`. P02 is `NOT STARTED`.

## Purpose and instruction

**STOP new feature implementation.** The next action is to review and resolve the open decisions and contradictions in this package. Do not implement P01-3 or move to P02 merely because backend password tests pass. In particular, do not issue another isolated Android test patch before the state machine, user journeys, API semantics, and acceptance matrix are approved.

Read in order:
1. This file: evidence, blockers, order of work.
2. `P01_2_PASSWORD_AND_OTP_DETAILED_SPEC.md`: registration, password login, optional OTP sign-in, change/recovery, UI/API/DB/security.
3. `P01_3_30_DAY_PERSISTENT_SESSION_DETAILED_SPEC.md`: session restoration and rolling renewal, storage, atomic token rotation, device lifecycle.
4. `P01_AUTH_STATE_TRANSITION_AND_EDGE_CASE_MATRIX.md`: detailed flow/state matrix, exceptions and cross-phase interactions.
5. `P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`: owner-approved replacement policy and legacy credential migration.
6. `P01_VERIFICATION_MASTER_MATRIX.md`: precise automated-first, device, manual, and security acceptance gates.
7. `P01_DECISIONS_RISKS_AND_RELEASE_GATE.md`: approved rules, recommendations requiring approval, blockers and sign-off.

## Evidence-based findings (not assumptions)

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F-01 | OTP **login** screen currently renders DOB selection and account registration consent after requesting a code. Sign-in must not require entering DOB again. | Owner manual observation; `apps/flutter_app/lib/features/auth/auth_screen.dart`, shared `mode == 'signup' || mode == 'otp'` branch; backend `routes.ts` email `/verify` requires `dateOfBirth` and consent. | **CONFIRMED UX + API contract defect**; must redesign intents and enforce on server. |
| F-02 | Current `/v1/auth/email/verify` can create an account when no mapping exists, even when user reached it from the **Email code / Log in** path. | `routes.ts` uses `link ? uid : randomUUID()` and conditionally writes user/link. | **ACCOUNT-CREATION INTENT DEFECT**; login and registration intents need explicit server distinction, not UI-only labels. |
| F-03 | After OTP verification, account is already created and authenticated before a new user sets a password. | `routes.ts` transaction writes user/session; `auth_screen.dart` selects `accountPanel='setup'` from `newAccount`. | **ONBOARDING ATOMICITY DECISION**; mandatory-password signup vs optional OTP-only and incomplete-account semantics are unresolved. |
| F-04 | The P01-2 device test progressed through initial password login, account access, password change, old-password rejection, new-password login, and recovery-code retrieval, then attempted to tap a Reset button outside a hittable region. No reset request was observed. | Owner Flutter log: `auth-recovery-reset` widget exists; `tap()` warns offset would not hit; `passwordReset: UI did not trigger a request`; `password_integration_test.dart` taps without guaranteed tappability. | **AUTOMATION/UI INTERACTION DEFECT; app reset behavior NOT VERIFIED by that test.** Do not suppress warning or claim backend failure. |
| F-05 | The source offers password login, OTP, registration and recovery in one stateful screen, with a shared `email` controller and mode strings. | `auth_screen.dart`, `chooseMode`, `run`, and `build` branches. | Explicit state-machine and input retention/clearing rules required to prevent cross-flow confusion. |
| F-06 | Returning password login and real local DB password integration have independently passed on owner's Windows environment, with 25+ Flutter tests in prior runs. | Owner logs, `docs/qa` dated records; latest Android log above is a later failure at Reset step. | Preserve working backend; verify defects before changing business rules. |
| F-07 | P01-1 Android OTP E2E is separately known failing with owner-accepted local-development exception. | `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`. | Continue to record as **FAILED (automated)**; do not silently turn into PASS or generalize exception to P01-2. |
| F-08 | P01-3 30-day persistence is **not implemented**. Current sessions expire in 24 hours and Flutter token stays in memory. | `apps/api/src/features/auth/policy.ts`, `auth_screen.dart` state, `P01_PASSWORD_AND_SESSION_PHASE_SPLIT.md`. | P01-3 must be designed independently and implemented only after decision sign-off. |
| F-09 | Local development email outbox does not demonstrate real email identity delivery. | `routes.ts` and `password.ts` in-memory outboxes, local-dev key gate. | Provider verification / HTTPS / production-delivery gates remain outstanding. |
| F-10 | Owner **superseded** 8+special-character policy and approved NIST SP 800-63B-4-aligned password requirements: 15+ Unicode code points, no composition rules. **Current source remains 8+punctuation.** | `password-policy.ts`; NIST SP 800-63B-4 §3.1.1.2; owner decision 2026-11-13. | **BLOCKING POLICY/IMPLEMENTATION DRIFT**: future implementation + tests must migrate; see password-policy decision document. |

## Immutable baseline and scope boundaries

- 18 existing feature-aligned DynamoDB tables; no new table/GSIs or unbounded Scan without approved architecture/migration decision.
- `uluv_users` is immutable-UID authority; `uluv_auth_links` maps emails, credentials, challenges, and session digests; do not create duplicate accounts or alter existing IDs.
- Fastify/TypeScript, Flutter Android, Java DynamoDB Local manual start on port 8000, Fastify port 3000, USB ADB reverse; no Docker requirement.
- No Google provider success claims without actual token verification; no real email delivery claims from local OTP outbox.
- No AWS, SES, cloud media, payment integration, account provisioning or production action without separate authorization. Respect security guards and secrets policy.
- No implementation of P01-3 during P01-2 design stabilization; no P02 development from this review.

## Work-order proposal (not authorization to code)

1. **Approve the UX/account-state decisions** in the Decision Register, particularly distinct login/signup intents, signup completion and session duration semantics.
2. Freeze a **P01-2 implementation contract**: independent screens, API schema/errors, account states, verification and test keys, security invariants.
3. Repair P01-2 only in cohesive slices: (a) login vs registration/OTP intent correctness, (b) password setup and account home, (c) recovery/change, (d) full verified testing. Each slice: unit/source -> TS -> real local DB/API -> Flutter analyzer/widget -> physical Android E2E -> manual when justified.
4. Record all observed failures and any scoped owner-accepted exceptions; do **not** mark P01-2 verified from source contracts alone.
5. After P01-2 is accepted against its own gates and outstanding blockers are dispositioned, implement **P01-3** secure persistent sessions, migrations, refresh rotation, storage and device state, per its design specification.
6. P02 remains on hold until the actual P01 phase gate and release-readiness dependencies are assessed separately.

## External guidance (research, not an automatic product decision)

- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Forgot Password: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Mobile App Security: https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html

**Reading status:** Source-derived statements above are grounded in files and owner's logs. New implementation proposals in the companion documents are marked **PROPOSED** and must not be represented as agreed decisions unless approved.
