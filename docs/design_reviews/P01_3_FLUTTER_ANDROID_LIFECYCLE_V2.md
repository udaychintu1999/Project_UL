> **AUTHORITATIVE 2026-11-14 P01-3 V3 APPROVED DESIGN:** See [`P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`](P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md). Owner accepted simple single-use refresh rotation (one atomic winner; old tokens always rejected; no grace/retry receipts; re-login when unrecoverable), Android Keystore device proof, and purpose-separated server secrets. The earlier candidate lost-response recovery protocol and PENDING decision markers below are **SUPERSEDED HISTORICAL DESIGN TEXT**, not implementation instructions. P01-3 is DESIGN APPROVED but NOT CODED; P01-2 was owner-accepted, and P01-1 Android OTP automation remains a documented local-development-only FAIL.

# P01-3 — Flutter / Android Persistent-Login Lifecycle (PROPOSAL v2)

**Document-only.** Current `main.dart` starts P00 diagnostics; `auth_screen.dart` keeps `token` in widget memory and uses a `PopScope` Back guard. P01-3 must establish one session controller with deterministic state; it must not treat an `AuthScreen` rebuild as authentication or show diagnostics to a signed-in user.

## 1. Bootstrap architecture

`main()` initialises Flutter bindings and constructs `SessionCoordinator`/`SessionRepository` with injectable clock, typed API, secure storage and connectivity adapter. A **single** `AuthGate` is the root UI; in local development P00 diagnostics remain reachable through a conspicuous **developer-only** route, not a back-stack step after signed-in account home. A `restore()` Future is coalesced and cancellable by logout/account switch. Do not create a second silent session in `AuthScreen` and do not duplicate token refresh in each service.

```
App launch
  -> BOOTSTRAPPING (neutral splash; no account content)
     -> no credential / corrupt storage -> SIGNED_OUT
     -> credential present -> RESTORING (one server request)
         -> ACTIVE (valid auth response, account ID matches)
         -> OFFLINE_RETRYABLE (network/503; credential retained)
         -> REAUTH_REQUIRED (401 expired/revoked/overall deadline; clear protected material)
         -> ACCOUNT_RESTRICTED (403; restricted notice and local lock)
         -> STORAGE_UNAVAILABLE (safe login fallback)
```

Never flash the login page while waiting to restore; never show the previous account's content before the server confirms identity. Persist only safe UI preferences (e.g., theme) outside secure storage. The current account UID may be cached as a **hint only**, never authorization or proof. After account switch, do not display stale UID/profile data.

## 2. Session states and legal transitions

`SIGNED_OUT`, `AUTHENTICATING`, `BOOTSTRAPPING`, `RESTORING`, `ACTIVE`, `REFRESHING`, `OFFLINE_RETRYABLE`, `REAUTH_REQUIRED`, `ACCOUNT_RESTRICTED`, `SIGNING_OUT`, `STORAGE_UNAVAILABLE` and `SECURITY_REVOKED` are distinct typed states (not a `bool signedIn`). `ACTIVE` carries access token in memory, server-verified UID, access expiry, family ID, auth deadline and *monotonic local generation* for stale-request cancellation. `RESTORING` never grants feature access.

| Event | Desired UI | Authority |
|---|---|---|
| Fresh sign-in | Account home once durable storage and server response valid | Backend + secure storage |
| App background for 5 min | Keep session; do not create duplicate refresh | Coordinator |
| App cold/reboot start | Neutral splash → server restore → account home | Backend |
| Access expires | One refresh; allow read request retry if safe | Server time/epoch |
| API offline or 503 | “Can't connect. Retry” with credential retained, no protected actions | Transport state |
| Revoked 401 | Clear secret; “Please sign in again” | Backend |
| Restricted 403 | Locked account message, no cached content | Backend |
| User hits Back while signed in | Stay in authenticated app; never reveal P00 diagnostics | Root router |
| Logout while refresh pending | Clear UI immediately; late refresh response discarded | Local generation guard |
| Sign-in as another account | Clear/partition all previous account state; fresh credentials | Controller |

## 3. Secure storage design

- Store **renewal credential only** (and essential non-secret family/attempt metadata), encrypted and Keystore-protected. Access token stays memory-first; never store email password, OTP or local dev token as session material.
- Choose versioned, namespaced record e.g. `{schemaVersion, familyId, sealedRefreshCredential, requestIdPending, serverAuthDeadline}` with atomic read/write/commit and explicit recovery semantics. **Do not assume a secure-storage plugin provides true multi-key transactions**. Prefer one encrypted serialized record and a tested write-then-commit protocol; decide torn-write detection and fallback.
- Use `flutter_secure_storage` or vetted equivalent *only after* checking the owner's actual Flutter/Dart, Android minSdk/compileSdk and Gradle compatibility. As of 2026-11-14, package 11.2.0 is current and has Android/SDK migration changes; blind update from older versions is prohibited. [Package](https://pub.dev/packages/flutter_secure_storage), [changelog](https://pub.dev/packages/flutter_secure_storage/changelog).
- Configure Android backup/data-extraction exclusions for auth stores, including device-transfer and cloud-backup rules where supported. Uninstall/reinstall and different-device restoration must not restore a working session. Keystore deletion/key invalidation should lead to a recoverable sign-in state, not a crash.
- Biometric lock is an optional **local app unlock feature**, not a substitute for server reauthentication; no forced biometric prompt every app launch for P01-3 unless separately approved.
- Use platform secure storage/cryptographic APIs; do not implement ad hoc encryption with Dart string obfuscation or SharedPreferences. Non-exportable private signing key is a separate Android Keystore capability requiring a typed platform interface and physical Android verification.

## 4. Network behavior

One coordinator owns all outgoing authenticated calls. If access is expired or API returns validated `401`, perform at most **one** concurrent refresh for the family; all other calls await the same Future. Check a request's account-session generation before applying its response. Never replay non-idempotent requests automatically (OTP send, password reset/change, paid credits, chat send, account delete); on retry require idempotency key/explicit user confirmation. No unbounded exponential backoff and no network calls on every widget build.

`401`: prompt renewal/re-auth based on explicit auth error. `403`: account restriction vs missing permission shown separately. `429`: bounded backoff with retry-after. `503`/timeout/no network: **retain secure credential**, show Retry, preserve sign-in state as *pending verification* not active. Parse errors are not a reason to discard all credentials. Unknown/malformed reply fails closed to protected content.

## 5. Logout consistency

`LOGOUT_INTENT` increments local operation generation immediately, cancels/ignores all in-flight `restore/refresh/me` completions and clears memory tokens. Attempt server-family revocation; write a narrowly defined pending-revoke marker only if threat model supports it. Delete secure renewal material and reset navigation to `SIGNED_OUT`. If server outage prevents guaranteed remote revocation, UI must clearly distinguish **local sign-out complete** from **server revocation pending**. When reconnected, a secure remote all-devices action must be available after fresh sign-in. No late refresh resurrects the user.

A terminal app kill during `SIGNING_OUT` must never cause a successful auto-restore at next startup. Make local sign-out intent persistent **before** trying network, and test kill/reboot during logout.

## 6. Availability and offline UX

- If a refresh cannot reach localhost because ADB reverse is broken in local testing, show a connection message; don't wipe the only credential. Do not touch the five-email quota for this condition.
- Background maintenance should be minimal: no perpetual timer, no continuous polling, refresh on startup/foreground/authorized call when necessary. If nearing `reauthDueAt`, show a non-sensitive heads-up rather than an unexpected silent infinite renewal.
- P02 introduces actual profiles; P01-3 account home may remain minimal. Protected future profile/chat/wallet views must apply the same access gate.
- Screen reader/large font, offline Retry target, button disabled while pending and Android hardware Back are mandatory widget and phone test cases.

## 7. Migration and compatibility

P01-2 app stores no secure refresh credential and starts diagnostics. First P01-3 launch must display a normal sign-in and enroll only after successful interactive auth. Existing legacy server tokens expire under 24h policy; do not silently mint new 30-day renewals from them. Ensure legacy P00 diagnostics tests can still be invoked through a **dev-only** test path, while default launch exercises actual P01-3 auth gate. Existing P01-1/P01-2 verified UI requests and widget fakes must remain compatible with extended service interfaces; favor interfaces with optional adapters rather than breaking every fake at once.

## 8. Android behavior checklist

- Close app, launch from icon; force stop/relaunch; process killed by OS; background/resume.
- Actual phone reboot then launch; clear cached non-secret app state; change timezone and clock (server remains authoritative).
- Reinstall, data clear, backup/restore attempted; key invalidated or device security changed.
- Two phones signed in; one logout; revoke second; change password on first; second cannot refresh.
- App updated with secure-storage library migration; downgrade; truncated storage value; disk full.
- Switch network (Wi-Fi/cellular), ADB reverse broken and recovered, server restart, DB downtime.
- App open in different activities/deep links; logout/back; notification launched during restore.

**Never claim these tests PASS merely because Flutter widget tests pass.** Physical Android and real local Fastify/DynamoDB remain independent gates.
