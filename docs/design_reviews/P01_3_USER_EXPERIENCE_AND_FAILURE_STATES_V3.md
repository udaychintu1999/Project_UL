# P01-3 — Approved V3 UX / Flutter / Android Lifecycle

**Binding design, not implemented.** The product priority is **ordinary app opening should feel automatic**, without weakening server authorization. No OTP emails or password challenges during routine refresh.

## 1. Root app model

Replace current `main.dart` initial P00 diagnostics route with a **single AuthGate**. Keep diagnostics reachable only through a clearly separated local developer/testing route (preserve P00 regression tests). Do not retain the sign-in screen as a normal Back destination after successful sign-in. Auth state belongs to one `SessionCoordinator`/`SessionRepository`, not ephemeral `AuthScreen` widget state.

**States**: `BOOTSTRAPPING`, `SIGNED_OUT`, `AUTHENTICATING`, `RESTORING`, `ACTIVE`, `REFRESHING`, `OFFLINE_RETRYABLE`, `REAUTH_REQUIRED`, `ACCOUNT_RESTRICTED`, `SECURITY_REVOKED`, `SIGNING_OUT`, `STORAGE_UNAVAILABLE`. Avoid a single Boolean `signedIn`.

## 2. Screen and message contract

| Trigger | UI message / action | Secure behavior |
|---|---|---|
| First install/no credential | Normal Log in / Sign up and Email code options | No server auth assumed |
| Credential present at launch | Compact **Restoring your session…** with bounded loading | No previous profile/account details until verified |
| Restored successfully | Account home (later P02 profile home) | Current server-verified UID, no previous-screen flicker |
| Server offline/DB unavailable | **Can't connect right now. Retry.** | Keep protected credential and avoid exposing private content |
| Temporary ambiguous timeout | **Connection interrupted. Retry, or sign in again if needed.** | No blind grace or automatic old-token acceptance |
| Server explicitly says old refresh consumed | **For security, please sign in again.** | Invalid credential removed and local UI locked |
| Overall 30-day deadline | **Your session expired. Sign in to continue.** | No silent new 30-day session |
| Account restricted | **Account access unavailable.** | No hidden retry that restores a restricted account |
| Keystore/secure-store lost | **Sign in again to keep this device connected.** | No plaintext storage fallback |
| Device cap reached | **You're signed in on five devices. Choose one to sign out before adding this device.** | No automatic eviction; step-up/safe enrollment controls |
| User logs out | Return directly to Log in | No Back into authenticated content or diagnostics |
| Server unavailable during logout | **Signed out on this phone. Remote revocation is pending.** | Persist local logout intent and reconcile safely when possible |

Accessibility: clear actionable Retry and Sign in buttons, focus order, screen-reader announcements, dynamic type, visible validation, no endless spinner; no repeated biometric prompts on every refresh.

## 3. State machine and concurrency

- Flutter boot checks secure metadata **once**, coalesces concurrent restore requests and always consults server before entering `ACTIVE` after a cold start.
- Keep access token in memory. When current access is about to expire or server returns a typed refreshable 401, call a **single-flight** refresh Future shared by all protected service calls.
- On network 503/timeout: go to `OFFLINE_RETRYABLE` and keep renewal credential; do not translate into incorrect-password or local-logout.
- On authoritative 401 revoked/used/expired: transition to `REAUTH_REQUIRED`. No replay of previously consumed token or cached response. Do not auto-submit login emails.
- Keep a monotonic local `operationGeneration` (fence). Every logout, account switch and local lock increments it. An old in-flight token/session response must be ignored after generation changes.
- Save rotated token securely as one record **before** treating refresh as committed locally. No multi-value secure storage transaction assumption. Crash between server CAS and local write may cause required login; document this as the approved V1 fallback.
- Never automatically retry unsafe non-idempotent operations (password reset/change, chats, credits, account deletion). Safe GET may be retried once after verified refresh; mutations require their own idempotency and explicit user interaction.

## 4. Detailed life events

| Phone/app event | Required acceptance |
|---|---|
| Background -> foreground | No duplicate refresh; if still active, return without login |
| Swipe app away / OS process kill | Launch -> neutral restore -> account home if valid |
| Phone reboot | Launch -> successful server check -> home |
| Timezone change/device clock adjusted | No extension of server deadlines |
| KeyStore alias lost/app reinstalled | Normal sign-in, no crash/cloned session |
| Logout while refreshing | Local home locked instantly; late response ignored and server revoke enforced |
| User A logout then B login | No A account/profile information, stale action or access token used under B |
| Deep link/notification while restoring | Destination held pending verification; no protected content before server checks |
| Android Back after sign-in | Never reopen P00 diagnostics or a sign-in view with active session |
| Two API requests expire at once | One refresh, no old-token replay by client |
| Server response lost after committed refresh | If invalidated old token cannot be recovered, explain sign-in again; no infinite loader |
| 30-day boundary while app open | Lock protected actions, display session expired and reauth |

## 5. Offline logout safety tradeoff

Locally clearing the only refresh secret is not equivalent to server-side family revocation. A logout action must set a **durable no-auto-restore flag before network work**, revoke the server family where possible, clear protected local credentials, and, when unreachable, retain only a **non-secret revocation reference/intent** sufficient for an explicitly designed safe reconciliation path. Never persist raw revoked refresh token just for cleanup. If remote revocation cannot safely be retried without secret or fresh authorization, mark it pending, expire it server-side and permit a later authenticated `logout all` or device management. Do not claim remote revoke succeeded if it did not.

## 6. Manual after automated evidence

On one actual USB Android phone: login -> home -> swipe close -> relaunch -> restore; phone reboot -> restore; break network -> Retry -> restore; logout -> relaunch -> login; password reset -> old device denied; 30-day boundary via test-only server clock. If multiple devices unavailable, mark multi-device manual tests UNVERIFIED but retain mandatory backend real-DynamoDB coverage. The P01-1 Android OTP E2E local exception does **not** waive P01-3 device-binding/restore tests.
