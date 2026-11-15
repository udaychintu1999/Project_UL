## P02-1 additions (2026-11-15)

`features/profiles/validation.ts`: owner-input draft and @handle parsing. `features/profiles/routes.ts`: GET/PUT `/v1/profiles/me` dashboard/drafts and `/v1/profiles/me/handle`; exact-key DynamoDB operations and conditional transactions. Registration happens via `features/auth/routes.ts` with the existing validated `requireSession`, preventing a parallel token implementation. No photo or public discovery endpoints in this slice.

---

# API module and route map — current local implementation

This is an orientation map extracted from the owner-provided API source. It is not a new routing design.

## Modules and responsibilities

| Module | Responsibility | Important invariant |
|---|---|---|
| `app.ts` | Compose Fastify; live/readiness checks; P00 local DB smoke test; register auth | Diagnostic writes require local mode; cleanup even on failure |
| `config.ts`, `local-safety.ts`, `db.ts` | Validate local/test config and construct DynamoDB Local client | Reject remote/HTTPS/nonloopback backends and unsafe media |
| `domain/rules.ts` | Reusable business rule calculations | Values and inclusivity remain unchanged |
| `features/auth/policy.ts` | Email normalization, OTP rules, hashing and legacy session parsing | Existing identity and OTP semantics |
| `features/auth/routes.ts` | Explicit signup versus existing-user login; OTP verification; auth middleware; /me and /logout | Login never creates a new user; signup is atomic with password |
| `features/auth/email-budget-policy.ts` | Pure rolling-window decision and migration logic | Backend account/address quota, not Flutter |
| `features/auth/email-budget.ts` | Conditional budget+challenge transaction | No issuance before the transaction commits |
| `features/auth/password-policy.ts` | Password validation, normalization and baseline compromise screening | Keep NIST-aligned creation policy and legacy login compatibility |
| `features/auth/password.ts` | Password attachment, login, change and reset | Argon2id; immutable UID; session epoch on credential replacement |
| `features/auth/device-session-policy.ts` | Device proof and token digest primitives | Purpose-separated keys, canonical proof bytes |
| `features/auth/device-sessions.ts` | Device enrollment, rotating refresh, logout, listing and revocation | Keystore proof, single-use generation update and family status |

## HTTP route ownership

| File | Existing routes |
|---|---|
| `app.ts` | `GET /health/live`; `GET /health/ready`; `POST /v1/dev/db-roundtrip` (local only) |
| `auth/routes.ts` | `POST /v1/auth/email/request`; `POST /v1/auth/email/verify`; `POST /v1/auth/signup/register`; `GET /v1/auth/me`; `POST /v1/auth/logout`; `POST /v1/dev/otp/outbox` (local only) |
| `auth/password.ts` | `POST /v1/auth/password/set`; `POST /v1/auth/password/login`; `POST /v1/auth/password/change`; `POST /v1/auth/password/recovery/request`; `POST /v1/auth/password/recovery/reset`; `POST /v1/dev/password/recovery/outbox` (local only) |
| `auth/device-sessions.ts` | `POST /v1/auth/device/enroll`; `POST /v1/auth/device/refresh`; `POST /v1/auth/device/logout`; `GET /v1/auth/device/list`; `POST /v1/auth/device/revoke` |

## High-risk workflows for future maintainers

**Registration:** Verify email OTP intent, age and consent, then atomically create the identity, link and password. Existing email accounts are rejected at signup request before sending a new OTP. The current public signup response reveals existence; treat this as an explicit product/security review item for production.

**Email budget:** All issuance requests for the same normalized email compete for one rolling-24-hour budget. Atomic conditional writes and request idempotency are essential; do not split issuance from budget updates.

**Password lifecycle:** Passwords use Argon2id. Password changes and recovery resets increment the user's session epoch, invalidating old sessions. Legacy historical passwords have login compatibility handling; creation rules are different.

**Renewable sessions:** P01-3 enrolls after recent interactive authentication and signs requests with a device Keystore key. Refresh rotates the credential once via an atomic generation check. A reused token is rejected; no grace period is implemented. Logout/revocation changes the family state, not merely the access-token row. The absolute 30-day reauthentication deadline remains fixed.

**Local operations:** P00 smoke tests are diagnostic only. Dev OTP/recovery outboxes must never be treated as real email delivery or exposed outside local mode. Production AWS, SMTP and payment gateways are separate later phases.
