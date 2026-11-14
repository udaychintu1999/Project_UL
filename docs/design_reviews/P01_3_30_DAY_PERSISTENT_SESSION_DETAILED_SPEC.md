> **AUTHORITATIVE 2026-11-14 P01-3 V3 APPROVED DESIGN:** See [`P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`](P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md). Owner accepted simple single-use refresh rotation (one atomic winner; old tokens always rejected; no grace/retry receipts; re-login when unrecoverable), Android Keystore device proof, and purpose-separated server secrets. The earlier candidate lost-response recovery protocol and PENDING decision markers below are **SUPERSEDED HISTORICAL DESIGN TEXT**, not implementation instructions. P01-3 is DESIGN APPROVED but NOT CODED; P01-2 was owner-accepted, and P01-1 Android OTP automation remains a documented local-development-only FAIL.


> **2026-11-14 superseding design addendum:** The deeper code-specific design, test matrix and unresolved decisions are in `P01_3_DEEP_ANALYSIS_MASTER_2026_11_14.md`, `P01_3_API_DYNAMODB_TOKEN_PROTOCOL_V2.md`, `P01_3_FLUTTER_ANDROID_LIFECYCLE_V2.md`, `P01_3_PERMUTATION_EDGE_CASE_MATRIX.md`, `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md`, and `P01_3_DECISION_AND_THREAT_REGISTER.md`. The following 2026-11-13 proposal remains historical context, not authorized implementation. P01-2 has since been owner-accepted.

# P01-3 — Secure persistent sign-in: complete design and acceptance contract

**Status:** PROPOSED DESIGN, NOT IMPLEMENTED. **Date:** 2026-11-13. **Dependency:** P01-2 identity, eligibility, password and OTP semantics must be reviewed and stabilized before implementation. **No code, database, or cloud operations authorized by this document.**

## 1. Product goal and NIST boundary

- Owner goal: a normal U_luv Android user remains signed in across app restarts and phone restarts for **at least 30 days**, without daily OTP or password prompts. Active use should generally feel uninterrupted; explicit logout, restriction, revocation, lost-device events and risk decisions override convenience.
- Do **not** make the access token live for 30 days. Preserve the existing opaque server-side session architecture and introduce a short-lived access token plus a separately protected, rotating renewal credential. **NIST §5.1 warns that persistent bearer *session secrets* SHOULD NOT survive app/reboot; a long-lived bearer renewal token stored in the Keystore does not automatically satisfy NIST session-binding guidance.** Review a device-bound proof-of-possession approach or document and mitigate a considered consumer-product deviation; also enforce separate reauthentication deadlines. Source: https://pages.nist.gov/800-63-4/sp800-63b/session/ .
- **Standards nuance:** NIST SP 800-63B-4 §2.1.3 recommends an **AAL1 overall reauthentication timeout no more than 30 days**. Merely rotating a refresh token without fresh user authentication is **not** an equivalent reauthentication event. The owner-requested "indefinitely renewed without credentials for active users" can conflict with a strict 30-day reauthentication interpretation. **Decision pending:** choose a 30-day reauthentication boundary (recommended for NIST alignment), or explicitly accept and document the deviation for the consumer product. Do not claim NIST-conformant indefinite silent renewal.
- "30 days" refers to a durable device sign-in window, not a promise that a credential revoked for security remains usable. TTL expiration must be evaluated in application code (DynamoDB TTL cleanup is not immediate).

## 2. Recommended token and device model (design proposal)

| Concern | Proposed decision | Testable requirement |
|---|---|---|
| Access token | Opaque cryptographically random value; e.g., 15–60 minutes, with conservative default **30 minutes** | Sent only to API as `Authorization: Bearer`; server lookup validates expiry, status, eligibility, `sessionEpoch`, device session |
| Renewal token | Opaque 256-bit random credential; hash/HMAC digest at rest, never raw in DB/logs | Bound to one device/session family; never reused after successful rotation |
| Idle retention | Up to **30 days since last valid use**, subject to reauth ceiling | Idle users beyond policy lose refresh ability; no arbitrary 24-hour logout |
| Reauthentication ceiling | Proposed <=30 days since qualifying interactive authentication | Refresh rotation does not reset this clock; reauth UX resumes through password/Google/OTP |
| Device data | Android Keystore-backed encrypted/secure storage for renewal token; access token memory-first | App and phone restart restores; uninstall/reinstall must not silently restore a privileged session without platform-policy review |
| Server persistence | Existing `uluv_auth_links` session-family/item namespace; 18-table invariant | Conditional transactions by exact PK/SK; no Scan/new GSI without ADR |
| Multiple devices | One family per authorized installation, configurable cap proposed | Revoking one device leaves other devices unless all-devices action chosen |
| Clock | Server is expiry authority | App wall-clock changes/time zones cannot extend expiry |
| Offline | No server-authenticated action while offline | May show guarded cached shell; do not claim account verification or submit queued sensitive changes silently |
| Unlock | Optional app PIN/biometric local protection belongs to separate explicit product decision | Biometrics alone are not a remote login; device enrollment must not bypass server auth |

**NIST source:** https://pages.nist.gov/800-63-4/sp800-63b.html (session management and AAL1 reauthentication). **OWASP:** https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html.

## 3. Explicit session state machine

`SIGNED_OUT` → interactive login → `ACTIVE` (access+renewal available) → access expires → `REFRESHING` → `ACTIVE` (new tokens atomically installed); refresh unavailable/expired/revoked → `REAUTH_REQUIRED` → interactive login. `ACTIVE` → explicit logout → `REVOKING` → `SIGNED_OUT`. `ACTIVE` → app background/kill → `DORMANT_ON_DISK` (only renewal persisted) → launch → `RESTORING` → `ACTIVE` or `REAUTH_REQUIRED`.

**Other states:** `OFFLINE_RETRYABLE`, `ACCOUNT_RESTRICTED`, `PENDING_SECURITY_REAUTH`, `TOKEN_REUSE_DETECTED`, `STORAGE_UNAVAILABLE`, `SERVER_UNAVAILABLE`. Never conflate a 503 with invalid credentials: preserve tokens while transient failure is safe; fail closed for protected actions until server validation.

| Trigger/current state | Mandatory outcome | Forbidden behavior |
|---|---|---|
| Fresh login | Create one server session family, set interactive-auth timestamp | Store plaintext password/OTP for later convenience |
| Relaunch within valid window | Read secure credential and renew as needed; show account after authenticated response | Force unnecessary OTP every launch |
| Access token expiry during foreground request | One in-flight refresh, then replay **only safe idempotent request** | Automatic replay of purchases, OTP issuance, password resets or payments |
| Expired renewal / overall deadline | Clear or quarantine credentials, prompt reauth with explanation | Infinite refresh attempts or silently extend past approved reauth ceiling |
| Explicit logout | Server revoke; clear secure local tokens; navigate to login | Consider local clear alone proof of server revocation when offline |
| Logout while offline | Immediately lock local account; persist narrowly scoped pending revocation job or require session-expiry/reconcile | Continue protected offline access or falsely report server deletion |
| Account restricted/deleted | All future access and refresh denied; local credential purged on confirmation | Reopen restricted account from cached UID |
| Password change/reset / epoch increment | All old access and renewal sessions invalid | Continue refresh under stale epoch |
| Same refresh token used twice | Treat as potential replay; distinguish retry race vs theft as feasible | Silently issue two valid successor tokens |

## 4. Renewal protocol, races, and idempotency

**Proposed endpoints** (names subject to P01 API review): `POST /v1/auth/session/refresh`, `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{deviceId}`, `POST /v1/auth/logout/all`. Existing `/me` and logout remain available. Refresh request carries only a renewal token in an authenticated protected channel; response contains short-lived access token, rotated renewal token, absolute auth/renewal deadlines and server-time metadata (no personal profile or secret logs).

**Server transaction for refresh** (conceptual, only after access-pattern review): strongly read exact session-family key → check token digest, active family, expiry, auth deadline, account status/age, epoch and generation → conditionally advance generation/replace digest + timestamp in transaction. Concurrent refresh: only one generation wins; second caller cannot mint a second active successor. Carefully design a **bounded idempotent retry protocol** for response-loss so valid refresh does not erroneously trigger theft handling; a naive second use of old credential can be either attacker replay or client retry. Candidate: request-scoped idempotency proof stored for a short finite window without returning tokens to another device; document threat model and storage trade-off. **Unresolved security decision; do not ship without testable design.**

**Client atomicity:** write replacement renewal token atomically to secure storage **before** discarding last known recoverable state, but never retain two active refresh secrets indefinitely. Crash after server commits but before durable storage write is an explicit case: recovery must be clearly defined, bounded and secure. Multiple Flutter requests share one refresh `Future` and do not start races. A refresh in flight must be canceled/ignored after logout or account switch; any late response must not reauth a signed-out user.

## 5. Data keys, fields and migration impact

Proposed new **items** in existing `uluv_auth_links`, not new tables: `PK=USER#<uid>, SK=SESSION#<deviceSessionId>` *or* random-digest lookup key for direct refresh access (choose through actual Query/PK access-pattern study); store `uid`, device-session ID, renewal HMAC digest, generation/version, created/last-used timestamps, `authenticatedAt`, `reauthDueAt`, `idleExpiresAt`, `absoluteExpiresAt`, `sessionEpoch`, revoked state, and TTL. Do not use an unbounded user-session scan; if both lookup-by-token and list-by-user are required, duplicate small indexed items transactionally under explicit keys within the existing table.

Migration design must cover legacy 24-hour access sessions and users without `sessionEpoch` (default 0), rolling deployment compatibility, old clients, forced logout vs upgrade handoff, and partial failure rollback. Never automatically convert an arbitrary old access token into a 30-day renewal credential without fresh authorization.

## 6. Complete device / time / security edge-case inventory

### Installation and lifecycle

- Cold start, warm start, background resume, rapid repeated resume, force stop, OS low-memory kill, Android process death, phone reboot, timezone change, clock moved forward/backward, daylight saving changes, app update, app reinstall, data-clear, backup/restore to same/different device, hardware security key change, biometrics enrollment changes, device lock removed, secure-storage library exception, storage write interrupted.
- Two app processes/multiple isolates, parallel outbound requests, simultaneous launch+logout, session restore and user switches, deep link before authentication, Android back stack after logout, splash-screen race, stale spinner/no-network, notification tap without valid session, app cache showing another user's data.
- Android backup exclusion for token material and secure-store migration decisions; explicit device-identifier privacy and permissions. No persistent tokens in SharedPreferences, plaintext files, screenshots, app logs or crash telemetry.

### Network and API

- Token refreshed just before request; access expires between send and server check; 401 vs 403 vs 429 vs 503; malformed/partial JSON; server restart, DynamoDB outage, ADB reverse interruption, TLS cert failure (production), captive portal, slow mobile network, retry after response lost, duplicated response, refresh while user logs out.
- Keep bearer token out of URL query strings and analytics; use Cache-Control no-store on auth responses. No automatic replay of non-idempotent financial/credit or profile mutations. Respect safe retry and bounded exponential backoff, no refresh storms.

### Account/security

- Password reset/change from another device; account restricted mid-refresh; duplicate phones sharing accidentally cloned backup credential; refresh token theft, rotation replay, device lost/revoked, all-device logout, expired family, server key rotation, removed provider link, email change, authentication method switch, user deletion/reactivation, too many sessions; access controls on session-list endpoint and audit logs with pseudonymous identifiers only.
- Sensitive operations (password change, email change, account deletion, money actions) require **recent interactive authentication** independent of merely owning a 30-day renewal token. Define session `authTime` vs `lastRefreshAt` distinctly.

### Usability and accessibility

- Do not flash the login form briefly during silent restore. Show finite progress then offline/retry/reauth. User understands "Session expired" vs "Can't reach server" vs "Account restricted"; restore intended destination after authentication; secure locale/large-text layouts; biometric unlock is optional convenience, not identity proof; two phones display consistent revocation behavior.

## 7. P01-3 automated-first acceptance plan

| Gate | Checks required | Result criteria |
|---|---|---|
| Unit/state | Token state machine, clock boundaries, atomic storage adapter, null/failed secure storage, UTF-8/schema errors, operation coalescing | No unintended signed-in state or raw secret logs |
| Backend real DB | Concurrent refresh same credential (single winner), replay detection, family isolation, bad/expired digest, epoch revocation, account restriction, device list, logout all | Real Fastify + local DynamoDB; conditional writes actually exercised |
| Migration | Old session compatibility and expiry, no renewal for unknown legacy token, app version skew, schema item shape | No duplicate account or privilege extension |
| Flutter widget | Cold start states, silent refresh, keyboard/back, loader, retry, revoke, deep link, navigation | No login flicker or stale account exposure |
| Physical Android | Sign in → close app → reopen → account access; reboot phone → reopen; simulated access expiry → refresh; network outage → recovery; logout → reopen requires login | Must use actual secured storage and real API/DB, not only P00 diagnostic buttons |
| Security | Device token storage, revocation, replay, server logs, privacy, concurrency and secret guard | No plaintext/unencrypted renewal secret, no indefinite token continuation |
| Human | After feasible automation, owner checks the phone close/relaunch and possibly reboot; report explicit PASS/FAIL | Manual pass is separate from automated evidence |

**Time-bound tests:** Do not sleep 30 real days. Inject a controlled server clock/test-only TTL in local API harness; verify day 0, day 29, day 30 and boundary seconds, plus idle/absolute deadline and server/client skew. A scheduled real-world long-duration smoke test may supplement, never replace deterministic time tests.

## 8. Decision points required before P01-3 code

1. Reauthentication ceiling: NIST-oriented <=30 days from strong interactive sign-in (recommended) versus consumer indefinite silent extension (explicit variance if selected).
2. Renewal idle expiry: sliding 30 days proposed; whether total absolute session-family age has an upper bound independent of activity.
3. Device cap and UI for listing/revoking sessions; all-devices logout defaults after password reset/change.
4. Recovery from response-loss after token rotation without a replay vulnerability; exact idempotency design.
5. Local secure-storage behavior on OS backup/reinstall; wipe/cross-device restoration policy.
6. Offline behavior and whether read-only cached UI is allowed; protected data exposure limits.
7. Privacy/telemetry schema, non-secret security event logs, retained revocation records and TTL.
8. Provider-login refresh integration (Google authorization is a distinct credential; U_luv must not assume Google ID token is forever valid).

## 9. Non-goals and freeze

No JWT migration, password-storage-on-device, paid actions, cloud production deployments, new DynamoDB tables, or P02 implementation. No claims of real 30-day login in current binaries. This spec documents work; owner approval and implementation request are separate.
