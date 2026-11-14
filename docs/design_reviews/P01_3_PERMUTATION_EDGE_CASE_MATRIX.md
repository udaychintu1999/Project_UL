> **V3 approved contract:** `P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` has priority over older design assumptions. All 84 cases are proposed tests, not actual runtime PASS.

# P01-3 — Exhaustive Practical State, Failure and Attack Permutation Matrix

**Meaning of outcomes:** `ACTIVE` = server-validated session and authorized account; `REAUTH` = interactive password or OTP required; `RETRY` = non-auth/network retry with credential retained and private content hidden; `REVOKED` = server invalidation; `SIGNED_OUT` = client locked and secrets cleared. Automated gate references correspond to **G2 real DB**, **G3 Flutter**, **G4 physical Android** in `P01_3_AUTOMATED_FIRST_VERIFICATION_MATRIX.md`. This is V3 simple-rotation policy: **no reuse of consumed refresh, no grace, no response receipts**.

| ID | Starting conditions / event | Required outcome | Automated gate |
|---|---|---|---|
| S01 | First new signup, OTP+DOB+consent+password valid | Exactly one UID and family; secure save then ACTIVE | G2, G4 |
| S02 | Existing password login | Same UID, new family, ACTIVE | G2 |
| S03 | Existing OTP-only account logs in | Same UID, family issued without password requirement | G2 |
| S04 | Invalid password or OTP | No family; regular P01-2 throttles/lockout unchanged | G2 |
| S05 | Repeat successful login concurrently | Independent authorized families within cap, never duplicate UID | G2 |
| S06 | Existing session opens app without network | RETRY; no private content, no deletion | G3, G4 |
| S07 | Signed-out user cold-starts | SIGNED_OUT, no auth network refresh | G3 |
| S08 | Credentials present, refresh valid, app cold-start | RESTORING → ACTIVE, no login flash | G3, G4 |
| S09 | App background then resume | Single validation/renew if necessary; no extra OTP | G3 |
| S10 | Force stop then relaunch | Preserve device authorization and UID before deadline | G4 |
| S11 | OS process killed, app re-created | Same family, no repeated registration | G4 |
| S12 | Phone reboot then app launch | Restore securely; no P00 buttons | G4 |
| S13 | App update with same data | Token migration preserves or fails safely | G2, G4 |
| S14 | Reinstall or clear storage | No silent old-session restore | G4 |
| S15 | Android backup restored onto new device | No cloned active renewal | G2, G4 |
| S16 | Keystore key invalidated | Recoverable sign-in, no crash | G3, G4 |
| S17 | Secure storage write returns error | No false ACTIVE, cleanup/revoke family when possible | G3 |
| S18 | Secure storage value truncated/invalid JSON | Fail closed and sanitise; sign-in fallback | G3 |
| S19 | Device clock moves back by month | No extension beyond server reauth deadline | G2, G4 |
| S20 | Timezone changed/clock daylight saving | No change to UTC server entitlement | G2 |
| S21 | At 29d 23h 59m 59s from auth | Restore permitted if other gates valid | G2 |
| S22 | At exactly 30d from interactive auth | REAUTH, regardless of recent refresh | G2 |
| S23 | Auth due later but renewal idle expiry reached | REAUTH; no infinite retries | G2 |
| S24 | Access token expires, valid renewal | Exactly one refresh, new 30m access | G2, G3 |
| S25 | Access token expires between request and API auth | 401 triggers one coalesced refresh for replay-safe request | G3 |
| S26 | 10 simultaneous Flutter calls after expiry | One refresh Future, no fan-out | G3 |
| S27 | Two server refresh requests same old token | One generation wins; no two successors | G2 |
| S28 | Refresh response lost after DB commit | Consumed old token **never replayed**; if committed response lost, interactive REAUTH after definitive rejection | G2, G4 |
| S29 | Previous token replayed by different request ID | Detect/revoke under declared reuse policy; no extra token | G2 |
| S30 | Previous token replayed by different device proof | Reject; family risk policy, no token leakage | G2 |
| S31 | No retry receipt exists in V1 | Never silently accept old credential even on same request ID | G2 |
| S32 | Legitimate retry while server DB unavailable | RETRY, not token deletion; bounded backoff | G2, G4 |
| S33 | Server returns 401 revoked | Clear credential and REAUTH | G3 |
| S34 | Server returns 403 account restricted | Lock UI, show restriction, no renewal | G2, G3 |
| S35 | Server returns 429 refresh throttled | Honor retry-after, no OTP quota used | G2 |
| S36 | Server returns 503 from DynamoDB | RETRY; no false incorrect-password message | G2 |
| S37 | HTTP timeout / captive portal / partial response | RETRY; do not mint duplicate token without proof | G3 |
| S38 | Invalid JSON / schema mismatch | No private UI; recover or explain compatibility | G2, G3 |
| S39 | TLS/certificate failure in eventual prod | Do not bypass HTTPS; fail closed | G2 |
| S40 | ADB reverse disconnects in local Android | Connection retry message; preserve credential | G4 |
| S41 | Power off during refresh before server commit | Preserve credential and RETRY only if refresh was definitely not committed; otherwise authoritative rejection requires REAUTH | G2 |
| S42 | Power off after server commit before secure write | REAUTH when updated secret cannot be recovered; **no** grace, cache, or exact retry | G2, G4 |
| S43 | Crash during encrypted credential write | Recover valid version or REAUTH, not empty ACTIVE | G3 |
| S44 | Login completes server-side but storage save fails | Don't claim persistent sign-in; no orphan privileged family | G2, G3 |
| S45 | User taps Logout while refresh pending | Local intent wins; late refresh never restores | G3 |
| S46 | Logout online | Family revoked, future access and refresh denied | G2, G4 |
| S47 | Logout offline | Immediately local lock; remote revocation unconfirmed/queued or all-devices fallback | G3, G4 |
| S48 | OS kill mid-logout | Next launch does not silently log back in | G4 |
| S49 | User switches from account A to account B | A caches removed/partitioned; B UID used, no mix | G3 |
| S50 | User logs in on phone A and B | Two separate families, same UID; no collision | G2, G4 |
| S51 | Phone A revokes phone B | B's next access fails immediately via family check | G2, G4 |
| S52 | One phone logs out | Other family still valid unless logout-all | G2 |
| S53 | User invokes logout-all | sessionEpoch increments, all access/renewals fail | G2 |
| S54 | Password change on phone A | All prior access/refresh revoked incl A/B; reauth | G2, G4 |
| S55 | Password recovery reset from another device | All old families invalid, no old-token comeback | G2 |
| S56 | Restriction enacted during refresh race | No newly valid token after restriction committed | G2 |
| S57 | User deleted/restricted/reactivated later | Old families not revived merely by status flip | G2 |
| S58 | Old 24h P01-2 access token present at rollout | No silent 30d enrollment; legacy expiry maintained | G2 |
| S59 | Old Flutter client accesses new backend | No unexpected crash; bounded old-token behavior | G2 |
| S60 | New client receives old API login response | Graceful compatibility/fresh login; no phantom 30d | G2 |
| S61 | User has max device families | Clear cap message, list/revoke choice, no silent eviction | G2, G3 |
| S62 | Device list cursor tampered | Reject; only user's families returned | G2 |
| S63 | Attacker guesses family locator | No access without independent secret and device proof | G2 |
| S64 | Attacker copies encrypted refresh store | No successful other-device refresh | G2 |
| S65 | Attacker obtains old token / logs | No plaintext logs; replay detection/revocation | G2 |
| S66 | Attack submits 100 concurrent refresh calls | Rate-limit and one winner, bounded cost | G2 |
| S67 | Access token sent in URL or telemetry | Guard fails and build blocked | G2 |
| S68 | Password change attempted with month-old remembered session | Step-up required, no unsafe action | G2 |
| S69 | Payments/account deletion initiated from expired access | Do not auto-replay mutation | G3 |
| S70 | User closes app for exactly 30d | Reauth per overall deadline; clear messaging | G2, G4 |
| S71 | Device sleep/standby for weeks | No background storms, refresh on foreground | G3 |
| S72 | Refresh while server HMAC key rotates | Verify old key within bounded migration but only issue current-key token | G2 |
| S73 | Server HMAC verification key is retired | Only bounded key-version validation; REAUTH when no valid migration | G2 |
| S74 | Device key renamed/migrated in plugin upgrade | Security preserves or resets with explicit UX, no silent plaintext conversion | G2 |
| S75 | Android Back during restoring | Does not leak diagnostics or account screen | G3 |
| S76 | Notification/deep link during restoring | Queue safe destination; validate after restore or discard | G3 |
| S77 | Two isolates try refresh simultaneously | One coordinator or safe native lock; no two successors | G2, G3 |
| S78 | User rapidly taps Sign in twice | Prevent duplicate credentials/families where idempotency required | G2, G3 |
| S79 | Network returns delayed success after logout | Stale response ignored with generation fencing | G3 |
| S80 | Reauth exactly at boundary concurrent refresh | Reauth ceiling wins, no deadline extension | G2 |
| S81 | Security status changes during access check | Strong server checks; deny whenever restriction authoritative | G2 |
| S82 | User manually signs in again before expiry | New qualifying authentication resets deadline, old family policy defined | G2 |
| S83 | Sensitive account view in offline cached shell | Hidden until server validation; no P02 data exposed | G2, G3 |
| S84 | Recovery email quota maxed while device session still valid | Renewal still works; no extra emails | G2 |

## Non-Cartesian combinatorial test strategy

Testing *every* mathematical combination of device state × account state × network × token state × concurrent operations is impractical. Use **pairwise matrix coverage** plus targeted three-way cases that are actually dangerous:

1. **Refresh commit + lost response + simultaneous second request** (CAS single winner, used token rejected, client REAUTH if recovery impossible).
2. **Password reset on device A + device B offline + device B resumes** (epoch + transport + user account state).
3. **Logout during refresh + app process kill + cold restore** (stale response + durable intent).
4. **Account restriction + concurrent enrollment + full DynamoDB transaction** (eligibility race).
5. **App update + backup restore + Keystore incompatibility** (ciphertext clone + broken key state).
6. **29d/30d reauth edge + network timeout + local clock tampering** (server temporal authority).
7. **Two families + revoke-one + stale access-token request** (immediate per-device revocation).
8. **DB transient 503 + token about to expire + repeated app restarts** (not mistaken for logout).
9. **Old 24h token + new client + changed server response schema** (migration and backward compatibility).
10. **Large-text keyboard/Back + slow restore + pending deep link** (auth gate + accessibility + routing).

Each critical triple requires at least one deterministic test and an evidence note. “Flutter unit green” is not proof of the real-device outcome.
