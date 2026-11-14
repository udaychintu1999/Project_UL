> **AUTHORITATIVE 2026-11-14 P01-3 V3 APPROVED DESIGN:** See [`P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`](P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md). Owner accepted simple single-use refresh rotation (one atomic winner; old tokens always rejected; no grace/retry receipts; re-login when unrecoverable), Android Keystore device proof, and purpose-separated server secrets. The earlier candidate lost-response recovery protocol and PENDING decision markers below are **SUPERSEDED HISTORICAL DESIGN TEXT**, not implementation instructions. P01-3 is DESIGN APPROVED but NOT CODED; P01-2 was owner-accepted, and P01-1 Android OTP automation remains a documented local-development-only FAIL.

# U_luv — P01-3 Deep Analysis and Implementation Decision Handoff

**Review date:** 2026-11-14. **Work mode:** analysis / documentation ONLY. **Implementation status:** NOT STARTED. **Baseline:** latest available project snapshot after P01-2 existing-email-signup correction; owner subsequently reported all P01-2 automated/manual checks passed, so that checkpoint is *owner accepted* (do not rewrite older QA history). **Legacy exception:** P01-1 Android OTP automation remains a documented FAIL/local-development exception, not a PASS. **P02:** out of scope.

## Executive decision

P01-3 is **not** “increase token expiry from 24 hours to 30 days.” It is a new device-aware authentication lifecycle spanning Fastify, Flutter startup routing, Android secure storage, DynamoDB transactional session records, renewal/replay control, logout, and security reauthentication. The currently shipping local app does not remember sign-in across process restarts.

**Recommended UX:** After the user interactively signs in, the same installed Android app automatically restores authenticated access after normal app closure, system process kill, and phone reboot, during a **30 × 24-hour window**. The user does not need a fresh email code or password at each launch. The server may end sessions early for explicit logout, password reset/change, restriction, security events, user deletion, or revoked device. At the **30-day overall reauthentication boundary**, a user must interactively reauthenticate to continue under the NIST-aligned option. This is a distinct event from silent renewal. Explain “Your session expired. Please sign in again” rather than implying an unexplained logout.

**Security default proposed:** short-lived opaque access token (30 minutes); a separately protected **rotating** opaque renewal token per installation; server-side family state, epoch and account checks; renewal idle expiry 30 days, with an overall 30-day reauthentication deadline (the earlier one wins); Android Keystore-backed secure storage for the renewal credential only; access token memory-first. This is a **proposed architecture**, not owner-signed configuration or implementation.

**Important standards boundary:** NIST SP 800-63B-4 recommends (SHOULD) AAL1 overall reauthentication not exceed 30 days, requires an overall timeout, and advises against bearer session secrets surviving app/device restarts. Secure Keystore storage of an arbitrary bearer refresh token **does not itself** make persisted bearer sessions fully NIST-conformant. A device-bound proof-of-possession design is the stronger route; otherwise document consumer-app risk acceptance. RFC 9700 refresh-token rotation/sender-constraint guidance is relevant security engineering guidance, but a bespoke U_luv session protocol is not automatically OAuth-certified.

Sources: [NIST session management](https://pages.nist.gov/800-63-4/sp800-63b/session/), [NIST AAL](https://pages.nist.gov/800-63-4/sp800-63b/aal/), [RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14), [OWASP mobile security](https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html), [flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage).

## 1. Existing source audit (observed, not inferred)

| Area | Actual file / behavior on snapshot | Impact |
|---|---|---|
| Server session expiry | `apps/api/src/features/auth/policy.ts`: `SESSION_LIFETIME_SECONDS = 86400` | An access token currently lasts 24h, no renewal |
| Session lookup | `apps/api/src/features/auth/routes.ts`: `requireSession` reads `PK=SESSION#HMAC(token), SK=META`, checks `expiresAt`, `uluv_users.sessionEpoch`, active age-eligible account | Preserve opaque token + epoch protections; extend per-device revocation |
| Password login | `apps/api/src/features/auth/password.ts`: `createSession` transacts account-condition check and session Put | P01-3 must issue/enroll an access + renewable family atomically; don't duplicate logic |
| OTP/new signup | `routes.ts`: successful login/signup transaction includes session Put; new signup also creates user/email link/password/settings atomically | Ensure persistent-session enrollment never leaves a half-created account; DynamoDB transaction item cap |
| Revocation | `password.ts` reset/change increment `sessionEpoch`; `/logout` deletes one access-token item | New session families must become invalid on epoch changes; logout must revoke the family, not one token |
| Flutter auth state | `auth_screen.dart`: `String? token, uid` stored only in widget state; server `me` method uses that token | No cold-start/phone-reboot persistence; scope needs a testable session controller |
| Startup/navigation | `main.dart` starts `DiagnosticsHome`; user pushes `AuthScreen` from “P01 Sign in / Register” button | A signed-in user still starts on P00. P01-3 must make bootstrap/auth-root primary and keep P00 diagnostics development-only |
| HTTP client | `auth_service.dart` does isolated requests and returns `AuthResult` with token/uid; no shared 401 renewal/interceptor | Introduce typed session API + single-flight renewal and safe request retry |
| Flutter packages | `pubspec.yaml` lists Flutter only; no secure-storage plugin | Select audited compatible plugin + mockable storage interface; avoid unreviewed dependency upgrade |
| Android backup | `android/app/src/main/AndroidManifest.xml` has no explicit backup exclusion | Must prevent export/restore of privileged storage; ensure reinstall cannot clone a session |
| Environment | `apps/api/src/config.ts` refuses non-local/test mode, binds loopback, Java DynamoDB Local | No AWS/SES/prod/TLS implementation authorized in P01-3; local USB runs via ADB reverse |
| Tables | `docs/architecture/02_PHYSICAL_SCHEMA.md`: 18 existing tables; `uluv_auth_links` contains identity/session-related records | Add explicit items/access-pattern ADR; do NOT add tables/GSIs or run scans |

**Source-backed exclusions:** Google provider integration and actual email delivery are not complete here; P01-3 must not claim them. The P01-2 five-email/rolling-24h backend budget is independent and must not be charged for session refresh. P02 display name/@handle/profiles are deliberately deferred.

## 2. Product and security boundary decisions

### 2.1 “At least 30 days” and standards consistency

- **PREFERRED P01-3 contract:** fresh interactive login anchors `authenticatedAt` and `reauthDueAt = authenticatedAt + 2,592,000 seconds`. Automatic restore works continuously *before* the deadline if device credentials, account, and server are valid; at the deadline show reauthentication. Renewal itself must never change `authenticatedAt`/`reauthDueAt`.
- **A 30-day *sliding* refresh idle limit does not imply unlimited interactive session age.** With a strict 30-day reauthentication boundary, `min(idleExpiresAt, reauthDueAt)` is authoritative. Idle life can be reset on successful refresh, but cannot circumvent the overall clock.
- A user who needs uninterrupted **more than 30 days** without interaction requires a separate explicit consumer-product variance and risk acceptance. Avoid promising “permanent login” or claiming NIST conformance for indefinite bearer renewal.
- “30 days” is 2,592,000 server-clock seconds, not 30 local midnight transitions. Disallow client time changes extending it.

### 2.2 What P01-3 delivers / does not

**In:** authenticated app boot router, persistent device session, renewal, session controls/revocation, server security, offline and failure UI, migration, real phone tests, local-only operation. **Out:** P02 public profile, username, DOB change, federated Google, email sender, real AWS, Cloudflare, payment, background push, biometric login as a separate identity provider, unlimited offline protected access.

## 3. Exact lifecycle cases

1. First successful password login, existing-user OTP login, and completed new registration all create the same session-family contract. **Never require an OTP for routine renewal.** P01-1 legacy OTP-only users remain eligible to enroll after successful OTP login.
2. Access expires while app stays open: obtain fresh token through a single in-flight refresh; protected requests wait; retry only replay-safe operations.
3. App swipe-away / force stop / process kill / phone reboot: renewal credential remains protected on that device, while the memory-only access token is discarded. App boots to a neutral splash/restore state, not diagnostics or a flash of login.
4. Token revoked/expired: secure credential is erased or quarantined appropriately; show sign-in with retained non-sensitive routing intent.
5. Offline / API unavailable / Java DB down: never interpret 503/network as “invalid session”; preserve valid encrypted renewal material, show Retry, withhold protected account content and actions until server check. No infinite refresh spinner.
6. Logout: immediately clear UI/access and prevent stale async responses from restoring the user. Attempt server revocation; offline logout must not falsely claim remote revocation, and revocation remains a security obligation for reconciliation.
7. Password change/reset: `sessionEpoch` invalidates all old access/renewals. Sign in again; only a *fresh qualifying authentication* starts a new 30-day window.
8. Restricted/banned/deleted account: deny access and renewal, never show cached personal profile while server is unreachable, and require admin recovery rather than automatic login.
9. More than one phone: each installation has its own session family; revoke one device without breaking other devices, except explicit all-session or password reset/change.
10. App reinstall/data wipe/key loss/backup restore: no silent cloning. Clear stale sealed material; prompt normal login, preserving server revocation if possible.

## 4. Release-blocking unanswered choices (recommended defaults)

| ID | Decision to approve | Recommended default | Risk of omission |
|---|---|---|---|
| D13-01 | Overall reauthentication | **30 days from interactive auth**; no silent bypass | Inconsistent NIST claims / indefinite captured session |
| D13-02 | Access token lifespan | **30 minutes** (not 30 days) | Stolen bearer useful too long |
| D13-03 | Renewal idle lifespan | **30 days since last successful use, bounded by reauth deadline** | Premature logout or perpetual bearer |
| D13-04 | Renewal replay | **Rotate every use + family generation CAS**; lost-response protocol must pass threat review | Double mint / false takeover or lockout |
| D13-05 | Device binding | Prefer **Android Keystore non-exportable signing key + renewal rotation**, not a plain device-id field | Theft / backup clone of bearer refresh |
| D13-06 | Device count | Proposed maximum **5 active installations**; user picks one to revoke when full (do not silently evict) | Unbounded records / surprise sign-outs |
| D13-07 | Offline UI | Neutral authenticated-data-free retry screen; no deferred payments/OTP calls | Private content visible before validation |
| D13-08 | Lost / revoked device | Per-family revoke and all-session revoke; immediate server enforcement | Stolen phone stays active |
| D13-09 | Migration | Existing 24h tokens expire naturally, **no silent refresh-token upgrade**; explicit reauth enrolls P01-3 | Privilege escalation / crash after rollout |
| D13-10 | Step-up | Require recent interactive proof for password/account deletion/email/payment operations; default 10 min pending approval | Stolen renewal authorizes sensitive changes |
| D13-11 | Storage failure | Fail closed, clear corrupted credential, show sign-in; distinguish transient storage errors | Startup crash / accidental unsafe fallback |
| D13-12 | Retry semantics | Stable request ID, bounded proof-bound idempotency and secure encrypted response cache **or** explicit reauth when unresolved | Recovery races and unsafe replay |
| D13-13 | Backup policy | Exclude auth secure-storage material across Android backup/transfer; no auto restore on reinstall | Session cloning |
| D13-14 | Device labels | Non-sensitive platform model + owner-editable label, no invasive hardware fingerprint | Privacy/permission creep |
| D13-15 | Provider mode | P01-3 supports currently implemented password/OTP; future Google must enroll under same contract later | Phantom Google functionality |
| D13-16 | Server crypto key lifecycle | Purpose-separated HMAC/encryption keys with rotation/backward verification under explicit migration | Key rotation logs users out or weakens confidentiality |

**Gate:** no irreversible implementation until D13-01, 04, 05, 08, 09, 12, 13 and 16 have concrete accepted answers. All remain **recommendations**, not silently owner-approved implementation decisions.

## 5. Design deliverables included in this package

- `P01_3_API_DYNAMODB_TOKEN_PROTOCOL_V2.md`: exact proposed keys, operations, transactions, idempotency, error/status codes, migration and revocation.
- `P01_3_FLUTTER_ANDROID_LIFECYCLE_V2.md`: startup and secure-storage rules, single-flight refresh, navigation, backup and lifecycle concerns.
- `P01_3_PERMUTATION_EDGE_CASE_MATRIX.md`: state/attack/failure permutations with expected outcomes.
- `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md`: deterministic, real-DB, widget, device, security, manual checks and release criteria.
- `P01_3_DECISION_AND_THREAT_REGISTER.md`: default choices, risk acceptance, no-go gates, evidence ownership.
- `P01_3_WINDOWS_READINESS_RUNBOOK.md`: future automation and owner phone steps; commands marked *proposed*, not fabricated current npm scripts.

## 6. Why we must not code first

- **A leaked renewal token** can act as a long-term sign-in credential unless device bound and rotated appropriately.
- **A lost refresh response** can strand the legitimate client after the server advances a generation. Blindly accepting the old token breaks replay protection; revoking every retry makes real-world mobile networks painful.
- **Device logout** cannot use the existing single-access-token delete alone; refresh and all access tokens from that family must stop authorizing.
- **Android backup** can copy ciphertext without its Keystore key, causing crashes or credential loss; it must be explicitly excluded, tested on actual supported API levels.
- **Current `main.dart` app root** will never automatically launch a signed-in user without a bootstrap-routing change.
- **Compliance wording** must not equate 30-day silent renewal with interactive reauthentication.

## 7. Review conclusion and precise next action

**P01-2:** owner accepted based on owner-reported latest automated and manual passes; P01-1 Android local-development automation exception remains documented. **P01-3:** `DESIGN_REVIEWED / NOT IMPLEMENTED`. **P02:** not started. **No production/cloud permissions** implied.

**Next gate:** approve or modify the sixteen decisions in the decision register, especially the authentication deadline and loss-of-response security protocol. Then authorize a bounded P01-3 implementation slice with automated-first tests as the release contract. Merely issuing this document does not approve code or create sessions.
