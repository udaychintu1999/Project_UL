# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# CURRENT CHECKPOINT — P01-3 V1 SOURCE IMPLEMENTED, WINDOWS VERIFICATION PENDING (2026-11-14)

P00 historically verified; P01-1 manually accepted with its Android OTP automation exception still FAILED; **P01-2 owner-accepted after all tests/manual QA**; **P01-3 approved V3 design implemented in code but NOT yet owner verified**; P02 not started. See `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md` and `docs/manual/P01_3_IMPLEMENTATION_WINDOWS_TEST.md`. Owner has authorized coding, not AWS, SES, payments or production release. Older checkpoint blocks below are historical.

---

# CURRENT PROJECT CHECKPOINT — 2026-11-14 (P01-3 V3)

**P00:** historical owner `CORE_FLOW_VERIFIED`. **P01-1:** manual core accepted, Android OTP automated FAIL accepted only for local development (not a PASS). **P01-2:** owner explicitly reported all latest automated and manual checks PASS, accepted. **P01-3:** design and security decisions APPROVED, **NO CODE YET**; owner requested complete docs before authorizing coding. **P02:** not started.

**Current P01-3 authority:** `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` and companion simple-refresh/device/UX/QA docs. V2 proposals and archived `PENDING` markers are historical, not present directions. No AWS, live email, Google, or payment authorization.

---


> **2026-11-14 clarification:** P01-2 is owner accepted based on reported full Windows/Android and manual checks. P01-3 is separately planned, NOT CODED; `docs/design_reviews/P01_3_DEEP_ANALYSIS_MASTER_2026_11_14.md` supersedes prior unreviewed implementation assumptions. NIST-aligned <=30-day interactive reauthentication is a **proposed**, not finalized parameter. Device binding and lost-response recovery remain release-blocking decisions.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# Approved P01 slice boundaries — 2026-11-13

## P01-1 — Email OTP + immutable identity (already developed)
Retain OTP sign-up/sign-in, 18+ self-declaration, consent, opaque server-side session, all prior tests and manual acceptance evidence. The physical Android automated OTP E2E is still a documented FAIL / owner-accepted LOCAL-development-only exception; no claim of automated PASS or full P01 closure.

## P01-2 — Email/password integration (this slice)
- Primary returning-user path: **email + password**, no OTP delivery on normal successful login.
- New user verifies email by existing P01-1 OTP flow, accepts adult eligibility/consent, then creates a password on the **same immutable account**. Existing OTP-only accounts may sign in with OTP and attach a password; no second account or new `uniqueId`.
- **UPDATED owner-approved password policy (2026-11-13):** NIST SP 800-63B-4-aligned single-factor minimum **15 Unicode code points**, **no mandatory symbol/digit/letter-category composition**, accept spaces/passphrases/Unicode, support >=64 characters, password managers/paste, common/compromised whole-password blocklist, and no routine forced change. Historical note superseded: P01-2 NIST 15+ character rule and tests were implemented and owner accepted P01-2 by 2026-11-14. See `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`.
- Argon2id credential hashing and unique salts via vetted library. No plaintext, reversible password or JWT. Credentials are separately stored in `uluv_auth_links`; no new DynamoDB table/GSI or Scan.
- Incorrect sign-in returns generic credentials error; per-normalized-email atomic throttling (10 attempts per fixed 15-minute window starting at the first attempt); no mail on routine login. Recovery issuance is non-enumerating, local-dev-outbox only, 60-second cooldown and 5/hour, challenge expiration 10 minutes, 5 invalid attempts; replay prohibited. Real delivery provider remains absent.
- Password set requires an eligible active signed-in account and recent authentication <=10 minutes. Password change requires current password; reset requires a recovery OTP. Both increment `uluv_users.sessionEpoch` to invalidate all preexisting sessions at their next request without scanning session records. No 30-day persistence in this slice.
- Flutter primary password sign-in, OTP alternative, recovery and password set/change; original P00/P01-1 UI and tests preserved.
- All backend and Flutter features remain **LOCAL-ONLY** until production identity, email provider, transport TLS, telemetry hardening, compromised-password corpus, external provider, persistence and security reviews complete.

## P01-3 — Persistent 30-day signed-in experience (NOT in this update)
Implement Android Keystore-backed secure token persistence, 30-day rotating renewal tokens with reuse detection and revocation, automatic session restoration/refresh across app/phone restarts, and security-driven reauthentication. Normal active users should remain signed in 30+ days; do not extend the existing 24-hour access token in P01-2 as a shortcut.

## Completion policy
P01-2 is **PARTIALLY_VERIFIED** until owner completes TypeScript, real Fastify + Java DynamoDB Local, Flutter analyzer/widget, real device/manual acceptance and documents evidence. A recurrent automation failure triggers concrete manual test escalation and remains a visible automated FAIL. Overall P01 remains PARTIALLY_VERIFIED; P02 not authorized by this document.

## Binding P01-2 UI workflow (owner correction, 2026-11-13)
Explicit **Log in**, **Sign up**, **Email code**, **Forgot password** paths. Newly registered OTP-verified users see only **Create password + Confirm password**, then account home. Existing password login and existing OTP login go directly to account home with no edit fields. Password change (Current + New) is shown only after tapping **Password settings**. Never show both forms simultaneously. `newAccount` from the existing email-verify API is the source of truth for newly created accounts. Keep older OTP-only accounts on their existing immutable ID. P01-3 persistence remains separate. See `docs/qa/P01_2_SIGNUP_LOGIN_UX_REPAIR_2026_11_13.md`.
