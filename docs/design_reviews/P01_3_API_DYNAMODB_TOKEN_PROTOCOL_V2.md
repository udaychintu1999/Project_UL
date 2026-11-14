> **AUTHORITATIVE 2026-11-14 P01-3 V3 APPROVED DESIGN:** See [`P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`](P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md). Owner accepted simple single-use refresh rotation (one atomic winner; old tokens always rejected; no grace/retry receipts; re-login when unrecoverable), Android Keystore device proof, and purpose-separated server secrets. The earlier candidate lost-response recovery protocol and PENDING decision markers below are **SUPERSEDED HISTORICAL DESIGN TEXT**, not implementation instructions. P01-3 is DESIGN APPROVED but NOT CODED; P01-2 was owner-accepted, and P01-1 Android OTP automation remains a documented local-development-only FAIL.

# P01-3 — Server API, DynamoDB and Token-Renewal Protocol (PROPOSAL v2)

**Review-only; no endpoints/records implemented.** Existing runtime: Fastify / Java DynamoDB Local / 18 tables / opaque session tokens with 24h lifetime. Do not introduce JWT, new table, GSI, Scan, paid external system or production credentials without separate approval.

## A. Contract invariants

1. `uniqueId`/email provider links are never changed by renewal or account installation. A refresh operation must never create a user, register an email or consume an email OTP allowance.
2. Every access token must be unpredictable, bearer-only, scoped to an eligible account and device family; every refresh token must be unpredictable, hashed/HMACed in DB and encrypted at rest on device. **Never persist passwords or OTP.**
3. Every successful interactive authentication records `authenticatedAt` / `reauthDueAt`; silent refresh **does not** update them.
4. Server decides expiry with UTC epoch seconds and `now >= expiresAt` considered expired. DynamoDB TTL is a cleanup hint, never the authorization clock.
5. Single session family is the unit for per-device logout/revocation. All-family epoch rotation is the unit for security/account-wide logout.
6. A username, display name, profile and future provider identity are not part of refresh permission; no P02 logic required.
7. Reserve room for both local-dev and later TLS production: never ship HTTP token handling to remote host; current `HttpAuthService` loopback guard remains and production networking belongs to a future authorized gate.

## B. Chosen direction for exact-key access patterns (not approved as final)

Use opaque token consisting of version + **random public family locator** + independent **256-bit secret**. The locator is not an authenticator; guessing it cannot authenticate. HMAC token proof with a *separate server key* and constant-time comparison. A device-proof signature can be added over a domain-separated request digest using a Keystore-held non-exportable private key; server stores public key fingerprint. Token grammar must be strict and length-limited. No user IDs/emails in token locators.

| Purpose | Table | Proposed PK / SK | Read/write method |
|---|---|---|---|
| Canonical user eligibility/epoch | `uluv_users` | `USER#<uid> / META` | Get, conditional Update |
| Direct renewal lookup | `uluv_auth_links` | `FAMILY#<randomSessionId> / META` | strongly consistent Get; conditional TransactWrite |
| List user-owned device families | `uluv_auth_links` | `USER#<uid> / DEVICE#<randomSessionId>` | bounded Query (`Limit`+LEK), paired with canonical family validation |
| Short-lived access token | `uluv_auth_links` | **existing** `SESSION#<HMAC(accessToken)> / META` | strongly consistent Get, Put, bounded cleanup |
| Idempotent refresh retry receipt | `uluv_auth_links` | `FAMILY#<sessionId> / RETRY#<requestId>` (or equivalent) | bounded Get/conditional Put with TTL |

**Never** Query all partitions or Scan for a family. Listing by user needs a restricted self-only endpoint and canonical verification; simultaneous revoke/list must handle projection staleness. One device may have multiple short-lived access tokens across rotation; avoid unbounded access-token records and ensure revocation checks canonical family status (not just 30m TTL).

Proposed family fields: `uid`, `sessionId`, `kind=device_session_family`, `refreshDigest`, `generation`, `devicePublicKey` or fingerprint, `createdAt`, `lastUsedAt`, `authenticatedAt`, `reauthDueAt`, `idleExpiresAt`, `absoluteExpiresAt`, `sessionEpoch`, `status=active|revoked`, `version`, `revokedAt`, `ttlAt`, `credentialVersion`. **Do not store** unencrypted refresh tokens or password/OTP. Proposed listing projection: `deviceLabel`, `platform`, `createdAt`, `lastSeenAt`, `revoked`, `version`—no IP/location fingerprint by default.

### Tradeoff: HMAC key and crypto

Current P01 dev token is used for HMAC derivation. P01-3 should introduce purpose-separated key material and rotation policy to prevent dev-key reuse from becoming permanent production dependency. Never read existing secrets through an AI; add placeholders in `.env.example` only after approval. A future production issuer must use TLS and secure secret management, not Java local dev config.

## C. New endpoints (proposed; current app does not expose these)

| Operation | Proposed API | Client proof | Outcome |
|---|---|---|---|
| Fresh credential enrollment | Existing password/OTP/signup login | Valid login proof + optional device public key | `accessToken`, `refreshToken`, family ID, deadline metadata |
| Renew | `POST /v1/auth/session/refresh` | Refresh credential, request ID, optionally signed device proof | If valid, rotated tokens, deadlines, `serverTime`; otherwise typed error |
| Current authenticated session | `GET /v1/auth/me` | Short-lived access | Existing account response; no token in body |
| List devices | `GET /v1/auth/sessions?cursor=...` | Access; recent auth for riskier detail | Bounded self-only metadata; no secrets |
| Revoke one | `DELETE /v1/auth/sessions/{sessionId}` | Access + step-up where required | Revoked family; idempotent |
| Logout current | `POST /v1/auth/logout` (extended) | Access + family binding; alternate refresh proof if access expired | Revoke **family**, not access token alone |
| Logout all | `POST /v1/auth/logout/all` | Recent interactive auth; conditional epoch increment | All access and renewal invalidated |
| Reauthentication | Normal password or OTP login | Interactive factor | New 30-day reauth clock and family, replaces or rebinds old appropriately |

Typed error codes (proposal): `session_refresh_required` (client), `session_reauthentication_required` (401), `session_revoked` (401), `refresh_reuse_detected` (401 and family revoke), `account_unavailable` (403), `refresh_rate_limited` (429), `auth_store_unavailable` (503), `auth_response_retryable` (503), `invalid_refresh_request` (400), `storage_unavailable` (client only). **401 means auth failure; 503 or network timeout must not delete a valid local credential.** Stable `Retry-After` when throttled; never leak token or account-existence state.

HTTP guidance: `Cache-Control: no-store`, no token in URL, no secret in logs, body/authorization redaction, bounded body size, no automatic token logging by HTTP proxy. For future production use TLS and explicit allowlist, but do not weaken current loopback-only network guard to prepare for cloud prematurely.

## D. Enrollment transaction

On successful password or existing-email OTP login: strongly validate user status/epoch and password/OTP proof; within transaction create access-session item, device-family record and owner-device index; account/epoch conditional check. Fresh registration transaction currently also writes user, auth link, reverse link, settings and password: add family records without breaking DynamoDB transaction item/action limits and ensure failed transaction means **no partly created account**. Auth responses must only be returned after transaction commits. If device-storage write fails after login, revoke new family when possible and offer sign-in again or bounded ephemeral session only if explicitly permitted (default: fail closed).

Google sign-in remains not implemented and must not be implied in P01-3 tests.

## E. Renewal transaction (pseudocode design, **NOT production code**)

1. Strictly parse token + family ID + version; rate limit independently of OTP budgets; strongly Get `FAMILY#id/META` and `USER#uid/META`; deny revoked/restricted/deleted/non-adult/expired/epoch mismatch.
2. Validate expected generation, token digest, optional device proof, and `now < min(idleExpiresAt, reauthDueAt, absoluteExpiresAt)`.
3. Mint next independent refresh secret and short access secret. Execute `TransactWrite` with `ConditionCheck` user/epoch, conditional family `Update` old generation/digest to next generation/digest and last-used, access `Put`, listing-projection `Update`, and retry-receipt `Put` when using response caching.
4. Only after transaction commit send both tokens with deadlines and serverTime. Client must durably save replacement credential before regarding new access as usable.
5. A second use of the old generation without the *exact approved same-request retry proof* is suspicious. Never issue a second valid successor. Revoke the family under documented reuse policy.
6. Return authorization/family errors separately from DB outages; DynamoDB `TransactionCanceled` must be classified conservatively, not treated as unconditional success.

**DynamoDB constraint:** A transaction cannot perform multiple actions on the *same item*; design the read-check/update actions accordingly. Maintain the transaction 100-item/size limits and provisioning/cost profile. TTL expiry is checked before every sensitive operation.

## F. The most important unresolved issue: response-loss and replay

A mobile client can send refresh, server commits rotation, and the response is lost when the device switches network or the app is killed. Next request presents old token: *the server cannot assume this means theft*. Conversely, accepting any recently-used old token lets a thief replay.

| Strategy | Reliability | Security | Decision |
|---|---|---|---|
| Simple rotation + immediately reject all old tokens | User may be forced to log in after lost response | Strong replay rejection | Too brittle for best P01-3 UX; safe fallback only |
| Blind 30–120s grace for old tokens | Looks resilient | Stolen old token can mint additional sessions | **FORBIDDEN** |
| Two-phase prepare/ack with explicit proof | Complex but can recover | Needs carefully bounded pending state | Candidate; requires threat/test review |
| Exact idempotent response replay **plus independent device proof** | Good bounded retry behavior | Strongest practical candidate; needs protected short-lived cached response and anti-replay tests | **Recommended design to validate before coding** |

Proposed candidate: client creates 128-bit random request ID and signs canonical request with Keystore-held private key; server conditionally advances family exactly once and stores an **encrypted exact committed token response** for that request ID for at most ~120 seconds, using separately managed encryption key. Retry with the *same* request ID and valid device proof gets the same response and no extra generation increment. Different request ID / wrong device proof / expired retry cache cannot mint another successor. Store neither raw token nor plaintext response in DynamoDB, logs or metrics. Retain a short retired-digest/replay record to recognize invalidated token presentation. **Open security detail:** proof nonce/timestamp/anti-replay semantics, key-rotation lifecycle, encrypted receipt binding, simultaneous client restart and same request ID recovery; all must be proven by deterministic and real-DB tests before acceptance. If a secure exact-retry protocol cannot be achieved, choose forced interactive reauth rather than adding a permissive grace window.

## G. Logout, revocation and session caps

- `logout current`: revoke family and mark `revokedAt` before confirming server-side completion; on mobile immediately clear local auth and navigate to login even if network fails. If offline, show “Signed out on this device; other-device security revocation pending” where needed. No false “server revoked” status. A minimal pending-revoke record might be stored without a live token, but this is a threat-model decision: deleting a sole credential prevents later server revocation; remote revoke-all is the recovery alternative.
- `logout all` and password reset/change: increment `sessionEpoch` conditionally; each access and refresh must compare epoch, so no Scan. Races at reauthentication epoch boundary must not mint sessions for stale epoch.
- `revoke one`: flag family revoked; all access tokens referencing it must fail the **next** protected request, not merely after 30 minutes. Existing access record must carry family ID and server middleware must read/check family.
- List devices by `USER#uid/DEVICE#...` projection with pagination, owner-only authorization and a small proposed active cap of 5. Avoid auto-removing a device or touching public profile identity.
- Every renewal validates account restriction, session epoch, user eligibility, device family. Password reset/change of a user's *other* phone must invalidate refresh and access on this phone.

## H. Legacy / rollout / rollback

- Existing 24-hour P01-2 access tokens carry no family ID: verify them until ordinary expiry, but **never** exchange them silently for 30-day renewal. A fresh interactive login issues new-family credentials; no user/UID duplication.
- New clients must distinguish old token-only responses from new access+refresh contract by capability/version and fail safely; old clients should continue 24h flow until upgraded (subject to support policy).
- Backward compatible DB items: `kind='session'` legacy and `kind='device_session_family'` new; strict parser prevents key collision. Feature flags should permit disabling new enrollment/refresh without disabling normal password login.
- Server deployment rollback must revoke or safely expire families rather than leaving devices stuck in refresh loops; document revocation effect, data migration and key-rotation plans.
- Because the current backend **only permits local/test** mode, production migration is a separate future authorization, not a P01-3 test.

## I. Security and complexity release gates

**Must pass before coding is called complete:** family not cloned on copied storage, one-winner concurrent refresh, proof-bound idempotent retry, delayed duplicate replay handling, per-device immediate revoke, all-device epoch revoke, password-reset revoke, account restriction, 30-day server boundary, no renew after deadline, no user data leaked while offline, stable account UID, token redaction, device cap, no DynamoDB scans, no new paid service. See `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md`.
