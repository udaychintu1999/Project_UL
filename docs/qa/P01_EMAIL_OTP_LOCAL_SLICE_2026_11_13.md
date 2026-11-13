# P01 slice 01 — local email OTP + self-declared adult eligibility (2026-11-13)

**Status: PARTIALLY_VERIFIED (original delivery; see owner Windows feedback and repair note).** P00 remains owner-confirmed `CORE_FLOW_VERIFIED`. **P01 phase is not complete; P02 is not authorized.** This document records a new local-development implementation, not proof of live Google/email-provider verification or successful Windows Android testing.

## Delivered scope (D1 / D2 / D3)

- **D1:** `POST /v1/auth/email/request` generates a six-digit cryptographically random OTP, stores only a secret-keyed HMAC digest and nonce in **Java DynamoDB Local** (`uluv_auth_links`), expires after 600 seconds, caps incorrect attempts at five, limits issuance to one per 60 seconds and five per rolling hour. The **separate RATE record survives verification**, avoiding rate-limit reset. Issuance uses a conditional transactional compare-and-swap to serialize racing sends.
- **D1:** A local-only, P00-dev-key-protected `POST /v1/dev/otp/outbox` returns the code from an in-process development outbox. **This is a development fixture and is not email delivery, recipient ownership proof, SES integration, or Google Sign-In.** Nothing sends mail. No OTP plaintext is stored in DynamoDB or server logs. Outbox is ephemeral across API restarts; an already issued challenge may require cooldown expiry before reissue.
- **D1:** `POST /v1/auth/email/verify` enforces consent and strict calendar DOB; refuses under-18 registrations based on **self-declaration** (not external age proof). Verification consumes the challenge exactly once and conditionally creates a new UUID `uniqueId`, canonical user row, verified *local-challenge* email auth-link row, reverse link and settings row, together with a hashed opaque 24-hour session in one DynamoDB transaction. Existing authenticated subject re-enters with the same UID; mismatching or restricted accounts are denied. A transaction prevents simultaneous first-OTP completion from creating two accounts. No new tables/GSIs or app-side Scan calls.
- **D1:** `GET /v1/auth/me` rechecks the session and live canonical account eligibility on every call. `POST /v1/auth/logout` revokes the session even if the account has become restricted. Only the opaque token is returned to the Flutter client; DynamoDB stores its keyed digest. Raw DOB is private on the canonical user item; it is never returned to the app's public account response.
- **D2:** Flutter email entry, local-outbox code retrieval (explicitly labelled development-only), date picker, consent, OTP verification, account view, access check and logout with disabled busy buttons, accessible status messages, and clear offline/rejection/cooldown feedback. Keeps P00 diagnostics and USB/ADB reverse untouched. This first slice keeps token **only in memory**; secure persistence/refresh is not yet implemented.
- **D3:** Runnable HTTP/DynamoDB integration test uses a unique synthetic `@example.invalid` account, tests invalid email, unauthorized outbox, cooldown, wrong code, consent/age denial, concurrent verification, immutable UID, replay, restricted account/session behavior, logout, and repeated sign-in; changes only its own synthetic rate fixture for time travel, and attempts to clean up the synthetic data. Device E2E test exercises the Flutter screen through local API/DB.

## Canonical DynamoDB keys used

| Table | PK / SK | Purpose |
|---|---|---|
| `uluv_auth_links` | `OTP#EMAIL#HMAC(email)` / `RATE` | Durable issuance throttle (not removed after successful sign-in) |
| `uluv_auth_links` | `OTP#EMAIL#HMAC(email)` / `CHALLENGE` | HMAC(code + nonce), attempts, expiry; conditional single-use deletion |
| `uluv_auth_links` | `AUTH#EMAIL#HMAC(email)` / `META` | Existing canonical provider mapping, unique UID |
| `uluv_auth_links` | `USER#uid` / `PROVIDER#EMAIL#HMAC(email)` | Reverse provider mapping |
| `uluv_auth_links` | `SESSION#HMAC(token)` / `META` | Session authorization, expiry; no raw token in DB |
| `uluv_users` | `USER#uid` / `META` | Canonical immutable ID, private birthDate, `status`, `ageEligibility` |
| `uluv_settings` | `USER#uid` / `SETTINGS` | Initial private account settings |

`HMAC` keys use the private local development key as a purpose-separated digest key; no credential is included in source or archive. Never use this local/debug dev-token scheme in production. Real provider identity verification, secret management, media and production authorization require separately reviewed architecture.

## API errors (stable codes for this slice)

| HTTP | Error code | Meaning |
|---|---|---|
| 400 | `invalid_email`, `invalid_verification_request`, `consent_required` | Malformed input |
| 400 | `otp_invalid_or_used`, `otp_expired` | Wrong/consumed/expired OTP |
| 401 | `authentication_required`, `session_expired_or_revoked` | Missing, expired, invalid or revoked session |
| 403 | `adult_eligibility_required`, `account_unavailable`, `forbidden` | Underage/self-declaration failure, restricted user, or missing local development key |
| 404 | `otp_not_in_outbox` | Local outbox missing/expired, e.g. after API restart |
| 409 | `otp_used_or_identity_conflict` | Conditional verification conflict, client should request/retry after cooldown |
| 429 | `otp_cooldown`, `otp_rate_limited`, `otp_attempts_exhausted`, `otp_request_conflict` | Issue limit, incorrect-attempt limit or concurrent issuance contention |
| 503 | `auth_store_unavailable` | DB unavailable/failed; no fake success |

## Actual T1 evidence in authoring Linux container

- `npm run verify:p00:portable` **PASS** before edits; **PASS** after P01 source additions, including previous unit/CLI/source/doc/security/cloud guards.
- `npm run test:unit` **PASS**: 14 Node tests in current suite, including five new P01 identity/age/expiry/lockout/session-parser tests.
- `npm run test:p01:contracts` **PASS**: P01 static source contract check.
- `npm run test:dev-cli` **PASS**: 9 existing stubbed Flutter CLI tests after adding the isolated `p01-e2e` action.
- `node --check` on new JS integration/verifier scripts **PASS**.
- TypeScript syntax parsing (global installed TypeScript `transpileModule`) on changed TS files: **0 syntax errors**. **Not** a substitute for semantic `typecheck`.
- `npm run typecheck` **UNVERIFIED/BLOCKED**: npm dependencies and `@types/node` are not installed in the authoring container. `npm ci --offline` failed on missing cached package `undici-types`; `npm ci` also failed (npm exit-handler error). No semantic compilation claimed.
- `npm run test:p01:integration`, `npm run test:db`, `npm run test:integration`, `npm run test:flutter`, `npm run test:flutter:p01:e2e`, and full `npm run verify:p01` **UNVERIFIED**: required running Java DynamoDB Local, Fastify, installed Flutter SDK/device are not available here. No code was executed against production or real AWS/SES/Google/payment.

## Before moving on

The owner reported real P01 Windows execution and two failures (TypeScript `TS2345` and Android OTP widget lookup). A corrective patch has been prepared; see `docs/qa/P01_WINDOWS_REPAIR_2026_11_13.md`. Post-patch Windows validation remains required. The owner must apply the corrective update and execute the Windows runbook: [`docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`](../manual/P01_EMAIL_OTP_WINDOWS_TEST.md). Fix any observed TypeScript, Flutter or real-DynamoDB errors, rerun P00 regression and P01 T2/T3 checks, then record sanitized results in `docs/qa/EVIDENCE_LOG.md`. **No P01 feature should be claimed fully verified merely because these runnable tests were delivered.**

## Remaining canonical P01 requirements

Google Sign-In **with server-verified Google ID claims**, verified-provider-link collision handling and Google test-provider setup, real email delivery integration (SES deferred by canonical schedule; approved non-cloud testing only if documented), secure session restoration/refresh/rotation, deactivation/deletion and administrative restriction workflows with audit/entitlements, full cross-provider account linking and recovery/duplicate tests, and completed physical Android verification. Do not begin P02.
