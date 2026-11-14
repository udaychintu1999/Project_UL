# P01-2 — Shared Email Budget + UX Implementation / QA Record

**Date:** 2026-11-14  
**Scope:** P01-2 only; P01-3 persistent authentication is **not** included.  
**Authoring status:** `PARTIALLY_VERIFIED` — portable regression PASS; full TypeScript, local DB and Android gates require the owner workstation.

## Implementation shipped

- Backend: one versioned `OTP#EMAIL#<HMAC-email>/RATE` record in existing `uluv_auth_links` table. Five **actual committed code issuances** per rolling 86400 seconds, shared across signup, existing-email OTP login and password recovery. 60-second cooldown. Reads are strongly consistent; the CAS budget write and challenge write (plus current identity eligibility checks) are in a single DynamoDB transaction. Same UUID request ID is idempotent within the window. Prior hourly counters are conservatively migrated rather than wiped. DynamoDB TTL is cleanup only, not the enforcement clock.
- Existing-account signup, unknown-email login, unknown/restricted/passwordless recovery: **no challenge and no local outbox code**. Public success responses are deliberately neutral (`202`, `delivery: if_eligible`) to limit account enumeration. Code presence is only checked by the existing private *local-development-only* outbox endpoint.
- Frontend: email syntax, empty password, new-password length, confirmation, code, age and consent have inline feedback. The Flutter client does **not** count or enforce email quota. Invalid local forms avoid unnecessary backend calls; all backend validations stay. Request IDs are generated per explicit code-request tap, with no implicit OTP retries.
- Navigation: authenticated Back cannot pop into the P00 diagnostic buttons. **This does not persist login across application restarts** (P01-3).
- Regressions: unit budget math tests; revised P01-1 and P01-2 synthetic fixtures; new real-DynamoDB budget/concurrency integration script; three Flutter widget tests and P01-2 verifier gate.

## Tests and evidence in authoring environment

- `npm run verify:p01-2:portable`: **PASS** (22 Node unit tests, P00 source/security, P01 source/password contracts, 13 P01-2 automation tests).
- `node:module.stripTypeScriptTypes` parsing on changed TypeScript: **PASS** (syntax, not semantic typecheck).
- `npm run test:secrets`: **PASS**; `npm run test:cloud-guards`: **PASS**.
- `npm ci --offline`: **UNAVAILABLE** (Argon2 package not cached). No private `.env` used, no DynamoDB Local or Flutter SDK in authoring environment. Full `typecheck`, live DB test, Flutter analyze/widget and physical Android are **UNVERIFIED here**.

## Mandatory Windows gates — automated first

1. Start Java DynamoDB Local **manually** on port 8000; keep the existing Fastify API on port 3000 running (`npm run dev:api`).
2. `npm run verify:p01-2:portable`
3. `npm run typecheck`
4. `npm run test:db`
5. `npm run test:p01:integration`
6. `npm run test:p01:password:integration`
7. **`npm run test:p01:email-budget:integration`** — actual Java DynamoDB Local atomic cross-purpose race/replay/no-send test.
8. `npm run test:flutter` — inline validation, reset UI and Back widget tests.
9. `npm run test:flutter:p01-2:e2e` — physical Android password path; `npm run verify:p01-2` full consolidated gate.
10. Only after all feasible automated checks: targeted manual signup/account-enumeration-safe response, inline feedback and Android Back (without app restart persistence).

## Accepted limits / production blockers

- Local outbox is **not a production SMTP/SES delivery**; provider-side idempotency, spending caps and durable delivery receipts are **UNVERIFIED**. No cloud/email-provider integration was added.
- Cross-address attacks (sending one email to thousands of distinct addresses), trusted-proxy source-IP controls, WAF/bot defenses, carrier-NAT fairness and cost alarms remain a **separate production readiness gate**. The five-per-address cap alone cannot stop such attacks.
- Public bodies are uniform for eligible/ineligible account cases, but response timing and delivery side channels need additional production hardening and adversarial review. Never reveal a public `email_already_registered` status before address ownership is verified.
- Signup still collects DOB/consent/password **after** requesting verification, matching the agreed registration order. Therefore DOB or password errors cannot prevent that first email request; preventing those costs would require a separately approved registration-order change. This is recorded rather than claiming full pre-issuance signup validation.
- A success response lost after transaction commit can leave the local-only in-memory outbox unavailable on API restart. Durable provider queue and delivery reconciliation are production work; do not call these flows production-ready.
- The legacy P01-1 device OTP E2E failure remains independently documented and is not counted as a PASS.
