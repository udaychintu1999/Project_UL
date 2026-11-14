# P01-3 — Approved V3 Simple Refresh/Rotation Protocol

**Status:** BINDING DESIGN, NOT CODED. **Supersedes:** retry-cache / receipt and two-phase proposals in `P01_3_API_DYNAMODB_TOKEN_PROTOCOL_V2.md` and earlier docs.

## A. State and key model (exact lookup, existing table only)

- `uluv_users`: `USER#<uid> / META` is authoritative for `status`, adult eligibility, `sessionEpoch` (older accounts default to 0).
- `uluv_auth_links`: proposed `FAMILY#<random128+bitLocator> / META`, containing owner UID, active/revoked, current HMAC refresh digest, integer generation, device signing public key/fingerprint, `sessionEpoch`, `authenticatedAt`, `reauthDueAt`, idle/last-used clock, timestamps, key IDs and TTL cleanup hint.
- Existing `SESSION#<HMAC(accessToken)> / META` access record includes `familyId` and expiry. Protected middleware must check **both** access record and active family + user/epoch; access TTL alone cannot outlive device revocation.
- For up to 5 devices, a bounded user-owned exact-key device index or fixed slots lives in `uluv_auth_links` without a GSI/Scan. Enrollment and revocation must keep index and family consistent using DynamoDB transactions. If cap is reached, require explicit selection/revocation; never silently evict a phone. Expired/revoked slots must be reclaimable without a table Scan.
- Public family locator is not authorization. The secret is cryptographically random (>=256 bits) and not encoded with email/UID. Only keyed digest/metadata is persisted on server. Retain rotation generation and status; no cached raw prior/successor refresh material.
- Server key separation (access digest vs refresh digest vs OTP/identity) and key-ID version are mandatory. Do not reuse the P01 development secret for all purposes.

## B. Minimal APIs (design, not existing routes)

| Operation | Contract |
|---|---|
| Interactive login/signup | Existing P01-2 proof + device public-key binding -> family/access/renewal created without duplicate account or extra OTP issuance |
| `POST /v1/auth/session/refresh` | Strict token grammar, device proof, short-access+rotated-renewal response, metadata; `Cache-Control: no-store` |
| `/v1/auth/me` | Existing account read using short access, additionally family/epoch/status checked |
| `POST /v1/auth/logout` | Extended to revoke **current family**; idempotent safe response and client logout fencing |
| `GET /v1/auth/sessions` | Bounded self-only list of non-secret device metadata |
| `DELETE /v1/auth/sessions/{id}` | Revoke owned family, prevent IDOR, requires authenticated proof/step-up where appropriate |
| `POST /v1/auth/logout/all` | Increment epoch (or equivalently revoke all), recent interactive authentication |

No raw refresh/access token in URL, headers of untrusted logs or analytics. OAuth conventions are useful but these are U_luv proprietary routes, not an OAuth certification.

## C. Refresh algorithm (server)

1. Parse bounded versioned opaque credential and exact family locator; rate-limit by safe device/family/IP signals (separate from OTP quota).
2. Strongly-consistent `GetItem` the exact family and canonical user. Verify current generation, constant-time refresh digest comparison, cryptographic device signature and signed request scope, `status=active`, matching `sessionEpoch`, active adult user, and `now < reauthDueAt` and `now < idleExpiresAt`. Server clock only; TTL attribute is NOT authorization.
3. Generate fresh independent refresh secret and 30-minute maximum opaque access token. Build a *single* DynamoDB `TransactWrite`: conditional family Update with old generation/digest/status/epoch/version predicates, conditional user eligibility/epoch check (different item), new access Put, and bounded device-index last-use Update (different item). No duplicate operation against one item in the transaction.
4. On commit return new access+refresh tokens. No tokens returned on failed CAS or partially completed operation (transaction atomic).
5. Concurrent same-generation request: exactly ONE transaction wins; loser gets typed rejection. Previously used token: reject it **unconditionally**; log a non-secret security event. The family may be revoked on confirmed/suspected token compromise; do not mint a successor or accept a grace period.
6. Do not use `ClientRequestToken`/HTTP idempotency as a covert token replay mechanism. Repeating the *exact transaction* or request ID may not return previously generated raw refresh tokens and must never extend the old credential's life.
7. Password reset/change epoch increment revokes old tokens without scanning. Logout revokes family; access middleware checks revocation on every protected operation.

**Device proof:** Bind a Keystore-signed canonical byte sequence to protocol version, operation, endpoint, session locator, digest of credential/request, and unique client nonce. The signature prevents someone with only a copied refresh string from successfully renewing. Rotation CAS prevents reuse of the same proof/request. Use well-tested cryptographic primitives and strict canonical encoding; no signing of flexible user-controlled JSON with ambiguous serialization.

## D. Response-loss and offline table: no grace, no complex recovery

| Event | DB effect | Client action |
|---|---|---|
| Refresh committed and response delivered | Old generation consumed, new generation active | Save **single new** sealed credential durably, then use new access |
| Refresh committed, response lost | New generation active; client only knows old one | Do NOT replay/grace old credential; show a bounded connection explanation. Authoritative old-token rejection -> fresh login |
| Server outage **before** commit | Family remains old active | Preserve secure record; Retry after connectivity recovers, with single-flight and safe retry logic |
| Network timeout, unknown commit | State ambiguous | Never claim token invalid from timeout alone; preserve sealed record and offer Retry; if replayed old is authoritatively rejected, require login |
| Two same-generation requests | Only one CAS winner | Single-flight should prevent local duplicate; reject loser and avoid global logout based solely on a racing UI event |
| Old refresh observed after rotation | No successor | `401 refresh_consumed`/`session_reauthentication_required`; sanitized reuse event, apply security revocation rules |
| Revoked or expired family / 30d deadline | No mutation | Clear unusable credential and prompt interactive sign-in |
| DB 503 / connection failure | No conclusive auth determination | Retry state, retain credential and do not show protected content until validated |

**UX trade-off approved:** A rare server-committed-but-response-lost refresh can require signing in early. V1 prefers auditable, minimal back-end logic over opaque receipt caching or a 30-second grace window. Rate-limit retry attempts, avoid storms, and present a calm explanation rather than “your password is wrong”.

## E. Error/status schema (proposed)

- `401 session_reauthentication_required`: overall deadline, irrecoverable rotated credential, missing/expired credential; next step login.
- `401 refresh_consumed`: old generation reused; reject, log sanitised event; next step login. Avoid revealing whether the account exists to untrusted clients.
- `401 device_proof_invalid`: wrong key or malformed binding; no refresh; security/re-auth.
- `403 account_unavailable`: restricted/deleted/ineligible; do not restore protected content.
- `429 refresh_rate_limited`: bounded backoff; `Retry-After`, no email quota charge.
- `503 auth_store_unavailable`: preserve credential; show Retry.
- Transport timeout/no response: unknown result, **not** a 401. Keep credential until definitive server result.
- `400 invalid_refresh_request`: reject malformed grammar and overlong payload before DB lookup.

Never expose account IDs, token digests or internal device-fingerprint details in error strings. Family-revoke side effects must be explicitly tested; revoking every family merely for bad input can create an attacker-driven DoS.

## F. Testable invariants

- CAS test with 2, 20 and 100 parallel refreshes: exactly one succeeds, one increment, one valid successor; no raw token stored server-side.
- Replay of consumed credential remains rejected at +1ms, +1s, +60s, regardless of same request ID or valid Keystore signer.
- Stolen refresh token without device signer fails, even if otherwise current.
- Successful refresh never advances `authenticatedAt` or `reauthDueAt`.
- On `now == reauthDueAt`, refresh and protected session are rejected, even if prior access/idle expiry would appear valid.
- DB 503/connection failure never clears local session or triggers email; account content stays locked before verification.
- Process death before/after server commit; after durable-save failure the app offers login rather than corrupt credentials or looping.
- Logout during refresh invalidates server family; late refresh response is fenced by local generation and cannot resurrect UI.

## G. Implementation complexity guard

One family item + access record + bounded device metadata, one CAS transaction, short Keystore proof, and one Flutter single-flight coordinator. Do NOT create a retry-receipt table or implement two-phase acknowledgement, encrypted token-response escrow, refresh grants, or background refresh services in V1.
