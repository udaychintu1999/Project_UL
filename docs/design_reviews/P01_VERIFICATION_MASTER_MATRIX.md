# P01-2 and P01-3 — Mandatory automated-first verification master matrix

**Status:** DESIGN CONTRACT / planning; does **not** claim tests were executed. **Owner rule:** all *feasible* automated checks before manual verification; a P00 device test does not cover P01 forms. P01-1 Android OTP E2E retains its narrow, explicitly failed local-development exception only.

## 1. Mandatory evidence conventions

For every test case record `ID | requirement | test file/command | data fixture | platform | observed result | timestamp | owner evidence | remaining risk`. Valid statuses: `PASS`, `FAIL`, `UNVERIFIED`, `BLOCKED`, `OWNER_MANUAL_PASS_WITH_AUTOMATION_EXCEPTION`. Never silently map one status to another. A source-contract or fixture test is not equivalent to a live API or a real device.

Execution order per vertical slice: **(0) audit actual test coverage → (1) pure unit/static and source contract → (2) TypeScript typecheck + Flutter analyzer/widget → (3) real Fastify + Java DynamoDB Local integration/concurrency → (4) phase-specific Android UI E2E → (5) owner manual acceptance only for remaining gaps**. Retest P00 and P01-1 backend regressions. Never skip feasible negative cases merely because the happy path passes.

## 2. P01-2 test inventory and blockers

| ID | Test/expected assertion | Best test layer | Priority |
|---|---|---|---|
| A01 | 15-code-point non-symbol passphrase accepted; 14 rejected; 8+symbol rejected for **new** credential | Unit + Fastify | BLOCKER (new approved policy) |
| A02 | Spaces, Unicode, NFC-equivalent input, 64+ length, paste/autofill; no trim/truncate | Unit + Flutter widget + Android | BLOCKER |
| A03 | Blocklist rejects expected/compromised whole passwords; per-account rate limiting works | Unit + Fastify security | BLOCKER before production |
| A04 | New signup: email -> code -> DOB/consent -> password confirmation -> authenticated account, immutable UID | Fastify/DynamoDB + Android | BLOCKER |
| A05 | Returning **Email code / Log in**: email -> code -> account; **no DOB/consent, no new UID** | Fastify + widget + Android | BLOCKER; currently defective |
| A06 | Unknown email from login-code path returns safe response and **cannot create** account | Fastify/DynamoDB | BLOCKER; currently defective |
| A07 | Purpose isolation: signup code not valid for login/recovery and vice versa; replay/expiry/cooldown | Fastify/DynamoDB | BLOCKER |
| A08 | Existing OTP-only user can add password to same UID; no second account | Fastify/DynamoDB + Android | BLOCKER |
| A09 | Password login (correct/wrong/unknown), no OTP email cost, account-status gate | Fastify/DynamoDB + Android | BLOCKER |
| A10 | No create/change-password forms after regular login; exclusive form state on mode switch | Flutter widget + Android | BLOCKER; owner observed mixed UI history |
| A11 | Change current->new; old rejected; session epoch increment and old-session revocation | Fastify/DynamoDB + Android | BLOCKER |
| A12 | Recovery request generic; code issue/consume; reset new password; existing sessions revoked | Fastify/DynamoDB + Android | BLOCKER |
| A13 | Recovery Reset button truly visible, keyboard dismissed, `ensureVisible`, hit test; request actually fires | Flutter narrow-screen widget + Android | BLOCKER; prior E2E never tapped |
| A14 | Signup already-linked email, concurrent signup/password-set, response-loss retry, transaction cancellation | Fastify/DynamoDB stress | BLOCKER |
| A15 | Underage/birthdate-boundary/consent missing/restricted/deactivated account, no privileged session | Unit + Fastify + widget | BLOCKER |
| A16 | Network timeout/offline/503/partial response; retry without accidental new account, duplicate mail or stale UI | Flutter service + widget + real device | BLOCKER |
| A17 | Long copy, accessibility scaling, narrow screen, Android back key, keyboard/focus and test hit region | Flutter widget + Android | BLOCKER |
| A18 | Fast switching modes during pending request: stale response cannot navigate or repopulate secrets | Widget async + device | BLOCKER |
| A19 | No raw password/OTP/token/email or signing key in logs, analytics, exception text, backups | Security source + runtime logs | BLOCKER |
| A20 | P00 baseline tests, P01-1 backend tests, real DynamoDB 18-table/no scans, schema unchanged | Existing npm verifiers | REGRESSION |
| A21 | Real Google/provider and email delivery not claimed as complete from local outbox | Source + release checklist | RELEASE |

### Actual commands in current repository

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:flutter
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:flutter:e2e
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

`npm run test:flutter:e2e` is **P00 diagnostics only**, not P01 acceptance. Current `verify:p01-2` includes the P01-2 device command, but that device test has **FAILED** at the recovery Reset stage. Do not suppress `tap()` warnings or mark this check PASS. `npm run test:flutter:p01:e2e` remains the separately recorded P01-1 failure. After future auth-intent and NIST changes, redesign tests to cover the new route/state machine rather than merely matching old button keys.

## 3. P01-3 test inventory — not implemented

| ID | Test/expected assertion | Best test layer | Priority |
|---|---|---|---|
| S01 | Newly authenticated device receives access credential and distinct renewal credential | API/DB + Flutter | BLOCKER |
| S02 | Access expires; one refresh renews without email OTP if allowed by reauth deadline | Injected clock + API + Android | BLOCKER |
| S03 | App killed/restarted, device rebooted -> restore secure state; no raw access token in plaintext preferences | Android lifecycle + security | BLOCKER |
| S04 | Refresh generation rotates once; same old token cannot issue second successor | DynamoDB concurrency | BLOCKER |
| S05 | Response lost after successful server rotation -> defined bounded safe recovery, no permanent lockout or reuse vulnerability | Network fault injection + DB + Android | BLOCKER |
| S06 | Two simultaneous protected requests -> single-flight refresh | Flutter concurrency/widget | BLOCKER |
| S07 | Logout online and offline -> app immediately blocks access; server revocation and pending-revoke handling honest | API/DB + Android offline | BLOCKER |
| S08 | Expired, revoked, reused renewal token fails closed and follows documented detection policy | API/security | BLOCKER |
| S09 | Account restriction, deletion, password change/reset invalidate access and renewal across devices | API/DB + Android | BLOCKER |
| S10 | Authenticated session **reauthentication deadline** enforced; refresh alone does not reset it | Injected-clock DB/API | BLOCKER; NIST risk |
| S11 | Device time skew, timezone change, daylight saving and future server timestamps | Unit/Android | BLOCKER |
| S12 | Secure-store key unavailable, reinstall, restore/backup clone, app data clear, device lock changed | Android/platform | BLOCKER |
| S13 | A signs out, B signs in; no A notifications, profile cache, tokens or outgoing request leakage | Android cross-account | BLOCKER |
| S14 | Deep link/notification cold-start gates on restored authorization before showing private data | Android integration | BLOCKER |
| S15 | Server 503/offline is not treated as revoked; revoked 401/403 is not treated as transient offline | Flutter widget + API | BLOCKER |
| S16 | Old P01-2 clients and legacy 24h tokens handled safely in migration | API/DB/client-version compatibility | BLOCKER |
| S17 | Multiple registered devices and session listing/revoke-one/revoke-all function with bounded queries | DB/API + Android | BLOCKER if in approved scope |
| S18 | Keystore-backed secret storage, backup exclusions, zero logs, non-persistent access token | Android security test + code review | BLOCKER |
| S19 | NIST reauth/assurance policy decision, clear 30-day user promise and timeout UX | Product + security sign-off | POLICY GATE |
| S20 | Latency/battery/refresh-storm limits under scale and outage; bounded retries | Perf/fault tests | SCALE GATE |

P01-3 automated commands **do not exist yet**; names such as `verify:p01-3` are proposals and must not be presented as executable until added and tested. Must create phase-specific device E2E tests before owner manual acceptance.

## 4. Combinatorial testing model

Full Cartesian coverage of all state dimensions would be impractical. Use **pairwise coverage** for ordinary UI combinations and explicitly enumerate **all security-critical crossings**. The axes are:

- Intent: `signup`, `password_login`, `otp_login`, `recovery`, `change_password`, `restore_session`.
- Account: `absent`, `incomplete`, `active`, `restricted`, `deleted`.
- Credential: `none`, `legacy_otp`, `password`, `future_google`, `access`, `renewal`.
- Challenge: `none`, `valid`, `wrong`, `expired`, `consumed`, `superseded`.
- Network: `ok`, `timeout`, `partial_response`, `API_down`, `DB_down`, `offline`.
- UI/Device: `foreground`, `background`, `restart`, `reinstall`, `keyboard_obscured`, `tiny_screen`.
- Concurrency: `single`, `double_tap`, `two_devices`, `two_refreshers`, `lost_response`.

**Mandatory all-security-critical examples:** unknown-email + OTP login; stale verified proof + registration; underage + correct OTP; restricted + valid renewal; simultaneous password reset + change; replayed refresh + lost response; logout + in-flight refresh; A-to-B switch + retained cache; recovery code used in login; concurrency with immutable UID.

## 5. Manual escalation without automation bypass

Only after attempting all feasible automation: ask owner to run a *small, precisely targeted* Android checklist for residual gaps, retain the exact failed automated command and evidence, report `manual PASS` separately. A P01-1 local-development exception does not automatically exempt P01-2/P01-3. Provider/TLS/security/production gates are **not** waiveable by a manual UI pass. See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.
