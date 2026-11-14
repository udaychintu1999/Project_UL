# U_luv — P01-3 V3: Approved Implementation Contract

**Date:** 2026-11-14  | **Authority:** owner decisions in current P01-3 discussion  | **Phase:** P01-3 only  | **Status:** DESIGN APPROVED / NOT IMPLEMENTED.  **Next action:** owner reviews this ZIP, then separately authorizes coding.

> **READ FIRST.** This document supersedes all earlier *P01-3 proposals* wherever they conflict, notably the v2 retry-receipt/idempotent replay design and any statement that refresh-failure recovery is awaiting approval. No P01-3 endpoints, devices, session-family records, plugin changes, schema changes, or tests are claimed to exist yet. `docs/qa/P01_3_APPROVED_DESIGN_EVIDENCE_2026_11_14.md` records documentation-only evidence.

## 1. Goal and owner-approved user experience

A user who signs in successfully to U_luv on their Android phone can close the app, allow the OS to kill it, restart the phone, and return to **account home without a password/OTP prompt** for the remaining valid period of a **30 × 24-hour session**, provided the account and that device session are not revoked and the server is reachable. Do not send a routine email OTP when restoring/renewing. Display a short neutral restoring screen; do not expose P00 buttons, old-account content or flicker the login screen. At the **30-day boundary**, explain that sign-in is required again. This is a fixed overall interactive-reauthentication limit, NOT indefinite silent renewal.

**The policy chosen for V1:**

| ID | Behavior | Approved value |
|---|---|---|
| D13-01 | Overall interactive reauthentication | 30 × 24 h from last qualifying interactive login; renewals never extend this deadline |
| D13-02 | Access credential | Random opaque token; 30-minute maximum; memory-first on Android |
| D13-03 | Renewal inactivity window | Up to 30 days since last valid refresh, but **never** beyond overall reauth deadline |
| D13-04 | Refresh behavior | Rotate the refresh credential on **every** successful refresh |
| D13-05 | Refresh concurrency | Atomic DynamoDB compare-and-swap; exactly one successor for one old generation |
| D13-06 | Reuse of old refresh credential | Reject; never accept a previously consumed token, even with same request ID or during grace |
| D13-07 | Lost successful refresh response | No retry receipt, grace, two-phase recovery, or replay. If the updated credential is unavailable, user signs in again |
| D13-08 | Device binding | Android Keystore **non-exportable private signing key**; server verifies proof on enrollment and refresh |
| D13-09 | Server secrets | Separate purpose-derived or independent HMAC keys, key IDs/versioning, explicit rotation procedure |
| D13-10 | Concurrent devices | Maximum 5 active devices, no silent eviction; owner can revoke individual or all sessions |
| D13-11 | Offline/transient outage | Keep securely stored credential, show Retry; do not claim login succeeded or send authenticated writes offline |
| D13-12 | Logout | Instantly lock UI, clear local active access, revoke current server family when reachable, prevent late-response resurrection |
| D13-13 | Password change/reset | Existing `sessionEpoch` makes all old access and renewal credentials invalid; reauthentication required |
| D13-14 | Sensitive operations | Fresh interactive proof within 10 minutes; refresh does not count as reauthentication |
| D13-15 | Install/restore behavior | Local auth removed or key lost => fresh login; no cloned credential via cloud/device transfer |
| D13-16 | Legacy P01-2 clients | Existing 24-hour sessions are not upgraded silently. Next interactive sign-in enrolls the device |
| D13-17 | Product/auth scope | Existing password, OTP login and signup. No Google provider, real email sender, P02, AWS or payments |

The session is **not guaranteed** against explicit logout, password reset/change, restriction/deletion, device revocation, key loss, or credential compromise. If an outage prevents validation, keep the sealed credential but lock protected actions until verified.

## 2. Security constraints, not optional UX knobs

1. **Device proof + rotating credential are both required.** Securely storing a bearer refresh token alone is **not** device binding. No ordinary token or password in Android SharedPreferences, unencrypted files, UI logs or analytics.
2. Android Keystore private key is non-exportable; hardware-backed protection is used **when supported**, without falsely requiring or claiming every supported phone offers StrongBox. Prefer widely supported P-256 ECDSA/SHA-256 signing. Public key can be stored server-side. Validate required device/API support on owner's actual phone before implementation. Do not require biometric confirmation on every routine refresh.
3. Refresh requests include the current opaque refresh credential, family locator, generation/protocol version and a **signed canonical device proof** bound to request purpose, path, family, refresh-token digest or request body, and nonce. Verify signature, token digest, generation, account status, epoch and deadlines before committing. Never trust a client timestamp for authorization.
4. On every successful refresh, atomically condition-update one family item from `(generation, currentDigest, active)` to `(generation+1, nextDigest, active)`, check canonical user eligibility/epoch, and create new short access token. A concurrent loser cannot issue a second successor. No transaction may perform two writes to the same DynamoDB item.
5. A previously consumed refresh token is **always rejected**. Record a sanitized security event; if there is credible replay/compromise, revoke the affected family and require a new login. V1 makes no promise of preserving the session after a lost committed response. Do not design a silent grace period that can revive old credentials.
6. **Differentiate network failure from an explicit invalid-token response.** A timeout/HTTP 503 before receiving a definitive authentication decision must not immediately erase secure material or force sign-out. Show Retry. If the server committed a rotation and the client never obtained the new secret, the next authoritative rejection leads to interactive sign-in. No endless refresh loops or misleading “wrong password” messaging.
7. Local client **single-flight** is mandatory: only one refresh per family at a time; concurrent authorized API calls wait on the same result. Do not automatically retry non-idempotent actions after refresh.
8. Refresh and logout must not consume the backend's **five email codes per rolling 24 h** quota. That quota is exclusively for successful OTP issuance across signup, OTP login and recovery.
9. Preserve 18-table DynamoDB architecture. Add bounded, exact-key family/device records in `uluv_auth_links`; no Scan/new table/GSI. Never use AWS instead of Java DynamoDB Local in P01-3 verification.
10. Production transport needs TLS and approved secret management in a future phase. P01-3 remains loopback Fastify + Java DynamoDB Local + USB/ADB reverse. No cloud actions authorized.

## 3. Most important user journeys

**First login:** Password/OTP/new signup completes existing P01-2 contract -> generate/install Keystore key + proof -> server atomically enrolls family and issues access+renewal -> secure renewal record committed -> enter account home. On a secure storage/enrollment failure, show a recoverable explanation; never claim durable login. Avoid creating duplicate `uniqueId` or charging additional OTP quota.

**Normal reopening:** App launches at single AuthGate root -> brief **Restoring session** state -> Keystore unlock/proof and server validation/refresh -> account home. No navigation back to P00 diagnostics. If no renewal credential or invalid key => login. If offline => **Unable to connect / Retry**, not login or an authenticated home.

**Access expiry:** Before a protected request, one coalesced refresh -> rotate once -> securely commit new renewal material -> safely resume. An access token that expires between client check and server validation uses the same single-flight path.

**Ambiguous response loss:** Request may have committed; no automatic replay of old refresh credential. Preserve the storage record and show a bounded Retry/connection state until the client receives an authoritative outcome. If the server rejects the old token, prompt **Session needs a fresh sign-in**. The user may rarely need to sign in earlier than day 30; that trade-off is explicitly accepted for simplicity.

**Logout:** Immediately transition to signed out and persist local logout intent so kill/relaunch cannot restore; revoke family server-side, delete secure credential. When offline, show local sign-out complete but explain remote revocation is pending; do **not** promise completed server revocation. Document and implement a bounded secure reconciliation mechanism, or require subsequent account-wide revocation; never leave the old credential silently active in UI.

**Day 30:** At server time `now >= authenticatedAt + 2,592,000`, renewal and protected actions require interactive sign-in. Provide **Session expired — sign in to continue**. No fresh email until the user explicitly chooses OTP login.

**Password reset/change:** Increment `sessionEpoch` (P01-2), deny all old families and access, require fresh interactive login for a new family. Device-specific revocation doesn't affect other devices; all-devices logout/password reset does.

## 4. Explicit non-goals of V1

- No cached refresh response, repeated delivery of rotated secret, same-request exception or grace for used tokens.
- No complicated multi-phase refresh transaction or server-held encryption of token responses.
- No unconditional logout on HTTP 503, timeouts, airplane mode or ADB reverse loss.
- No indefinite sliding 30-day *interactive* login or session upgrade from old bearer tokens.
- No live AWS, Google authentication provider, email provider, P02 public profiles or payment functions.

## 5. Acceptance and evidence hierarchy

**Automated-first, required in order:** deterministic state/clock/token tests; TypeScript/type/security; **real Fastify + Java DynamoDB Local** CAS concurrency tests; Flutter analyzer/widget and secure-store test double; **physical Android** installation key, cold start/reboot, restore, refresh, offline, logout, and bad-token tests; then the owner performs a brief manual experience pass. No P01-3 gate may be called green if its required real-device test fails. Don't substitute P00 diagnostics or P01-2 password E2E. Security failures remain hard blocks.

Expected future commands (scripts do **not** yet exist):

```cmd
npm run test:p01-3:unit
npm run test:p01-3:contracts
npm run test:p01-3:integration
npm run test:flutter:p01-3:e2e
npm run verify:p01-3
```

Regression commands that **do** exist (owner ran for P01-2): `npm run verify:p01-2:portable`, `npm run typecheck`, `npm run test:db`, `npm run test:integration`, `npm run test:p01:integration`, `npm run test:p01:password:integration`, `npm run test:p01:email-budget:integration`, `npm run test:flutter`, `npm run test:flutter:p01-2:e2e`, `npm run verify:p01-2`.

**Evidence note:** The owner reported all updated P01-2 automated and manual checks passed after the existing-email-signup message correction. P01-1 physical Android OTP automation remains an explicit owner-accepted **local-development-only FAIL**, not a PASS or production waiver. P01-3 has **NO runtime tests or code yet**.

## 6. Implementation guidance and minimal sequence (future, when separately authorized)

1. `P01-3A`: typed session model, exact-key DynamoDB family state, separate key-purpose secrets, controlled time, atomic refresh/revoke and real DB tests.
2. `P01-3B`: Android Keystore public/private signing interface + protected renewal storage + Android manifest backup exclusions; real device tests for key non-exportability / loss.
3. `P01-3C`: unified Flutter startup/auth gate and coordinator; login integration, single-flight refresh, offline/re-auth states, logout fencing.
4. `P01-3D`: five-device cap and management/revocation flows, migration, deterministic boundary tests, all existing P01 regressions, physical Android E2E, final owner manual pass and docs evidence.

No step may break P01-2 authentication or claim 30-day persistence based solely on static checks. A lost-response **test must prove the approved simple behavior** (reject old token and require sign-in if rotation committed), rather than expecting recovery by replay.

## 7. Links to authoritative companion docs

- `P01_3_REFRESH_SIMPLE_PROTOCOL_AND_SECURITY_V3.md` — exact transaction and failure semantics.
- `P01_3_DEVICE_BINDING_AND_SECRET_ROTATION_V3.md` — Keystore, key lifecycle and operational secret rotation.
- `P01_3_USER_EXPERIENCE_AND_FAILURE_STATES_V3.md` — UI, Android lifecycle and Back handling.
- `P01_3_DECISION_AND_THREAT_REGISTER.md` — approved decisions, residual risks and release blocks.
- `P01_3_PERMUTATION_EDGE_CASE_MATRIX.md`, `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md` — coverage contracts.
- `P01_3_WINDOWS_READINESS_RUNBOOK.md` — exact host commands and manual tests.

**References:** [NIST SP 800-63B-4 session management](https://pages.nist.gov/800-63-4/sp800-63b/session/), [NIST reauthentication requirements](https://pages.nist.gov/800-63-4/sp800-63b/aal/), [RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14). These inform security choices; this custom local application is **not certified** by merely following selected recommendations.
