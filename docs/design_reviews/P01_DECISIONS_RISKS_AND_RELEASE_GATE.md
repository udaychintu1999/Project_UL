
> **2026-11-14 current-status addendum:** P01-2 accepted by owner after automated and manual checks (old P01-2 defects/status rows below are historical). P01-3 review now specified by D13-01…D13-16 in `P01_3_DECISION_AND_THREAT_REGISTER.md`; 30-day persistence NOT IMPLEMENTED. P01-1 Android OTP E2E known failure stays explicit.

> **2026-11-14 P01-2 email-cost/UX review — analysis only:** Owner requested five-or-seven emails per day and proactive client validation after noticing Back returns to P00 buttons. The recommendation is **five per rolling 24 hours per email across all code purposes**, with atomic conditional writes, no-send for ineligible requests and neutral public responses. See `P01_2_EMAIL_BUDGET_VALIDATION_NAVIGATION_SPEC.md`. This proposal is **not implemented**; don't confuse historical PASS of password E2E with new quota/UX acceptance. P01-3 persistence remains separate.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# P01-2 / P01-3 — Decision register, threat/risk register and no-code release gate

**As of:** 2026-11-13. **DOCUMENTATION ONLY.** Nothing below authorizes application, API, Flutter, DB migration or infrastructure edits. The owner requested comprehensive analysis before any further development. `APPROVED` means product direction approved, not implemented or verified. Proposed code contracts require explicit implementation authorization.

## 1. Owner decisions / binding scope

| Decision ID | Decision | Status | Implementation reality |
|---|---|---|---|
| D01 | **P01-2** = password and authentication UX/recovery hardening, **P01-3** = 30-day persistent login; **P02 separate** | APPROVED | Existing code: P01-3 not started |
| D02 | Email + password primary returning-user login; OTP alternative/recovery; future Google login distinct | APPROVED | Password and local OTP routes exist; Google not implemented |
| D03 | Registration uses email OTP and adult DOB/consent, immutable `uniqueId`; no routine OTP for password sign-in | APPROVED | OTP login currently shares signup DOB/consent: defect |
| D04 | **New NIST-aligned 15-character minimum**, no mandatory special/uppercase/digit | APPROVED, NOT IMPLEMENTED | Existing `password-policy.ts` still enforces 8+punctuation |
| D05 | Argon2id salted password hashing, throttle, secure recovery, account revocation | APPROVED | Some local implementation exists; review against new contract |
| D06 | 18 canonical DynamoDB tables, no new table/GSI without approved change, no Scans | APPROVED | Existing tables preserved |
| D07 | Real Android user journey automated first; manual only after all feasible automation; P01-1 known narrow exception | APPROVED | P01-2 recovery E2E currently FAIL |
| D08 | User should remain signed in for **at least 30 days** without daily OTP, across app/phone restart | APPROVED GOAL | Needs P01-3 secure renewal design and reauth boundary decision |
| D09 | Do not start P01-3 implementation while P01-2 is not contractually stabilized; no P02 feature development | APPROVED REVIEW HOLD | Documentation-only phase in effect |

## 2. Decisions that must be resolved before P01-2 implementation

| ID | Unresolved issue | Recommended default for sign-off | Consequence if ignored |
|---|---|---|---|
| Q01 | When is a signup account created? | Atomic final transaction after email proof + DOB/consent + strong password, with resumable expiring signup proof | Premature account creation, orphan incomplete accounts |
| Q02 | Is OTP-only a permanent supported account type? | Retain **legacy** OTP-only access and allow add-password; make password mandatory for **new** signups | Contradictory required fields, inconsistent home screen |
| Q03 | Email-code sign-in for unknown email? | Safe generic response; **never create** account; guide explicitly to Sign up | User intent confusion, accidental UID provisioning |
| Q04 | What counts as valid adult eligibility evidence? | Existing self-declared 18+ contract; single registration collection, stored consent version; future legal review | Returning users repeatedly asked DOB, possible age bypass |
| Q05 | Recovery UI/action ordering, code purpose and account state after reset? | Separate recovery state; require code and new password; revoke all sessions, return to login | Cross-purpose code use or stale sessions |
| Q06 | Password change session treatment? | Revoke all access/renewals via epoch; require explicit re-login | Unexpected state in UI and Android test |
| Q07 | Existing 8–14-character passwords post-NIST change? | Preserve existing login, prompt upgrade, enforce policy on new set/change/reset, record release review | Sudden lockout or contradictory validation |
| Q08 | Google account same email? | Never auto-merge on email equality; require verified and authorized account linking later | Account takeover |
| Q09 | Error copy on unknown email vs existing identity? | Generic public response, user-helpful on-screen route guidance; stable error codes, no enumeration | Leaks private account existence |
| Q10 | Production email provider and recovery delivery? | Separate provider gate, keep local outbox explicitly dev-only | False real-delivery claims |

## 3. Decisions that must be resolved before P01-3 implementation

| ID | Unresolved issue | Recommended default for sign-off | Risk if unresolved |
|---|---|---|---|
| Q11 | How do **30-day stay-signed-in** and interactive reauthentication fit together? | 30-day device authorization window; server-enforced interactive reauthentication no later than 30 days for NIST-oriented AAL1, or explicitly document different consumer risk posture | Indefinite silent renewals falsely described as NIST-conformant |
| Q12 | Does inactivity expire renewal? | Define clearly: product goal of 30-day remembered device vs 30-day rolling inactivity; choose fixed or sliding window and communicated rules | Surprising early logout/infinite credentials |
| Q13 | Access lifetime | Shorter than 24h, propose 15–60 minutes; access token memory-first | 24-hour stolen access risk |
| Q14 | Refresh replay/response-loss recovery | Server-side token-family generation CAS plus bounded idempotent retry proof and safe replay handling | False revocations or refresh-token replay takeover |
| Q15 | Keystore unavailable, Android backup/restore behavior | Do not copy renewal secret across restore; fail to login, not crash | Cloned sessions, unrecoverable state |
| Q16 | Offline logout | Immediate local lock/secret erase, queue/reconcile server revocation without claiming completion | Server token remains usable remotely |
| Q17 | Device session cap/list and revoke-one | Bounded per-user session list + current/all revocation, no Scan; exact limit TBD | Unbounded session growth or impossible revocation |
| Q18 | Migration from 24h in-memory token | Require explicit reauth/new enrollment; no automatic elevation to 30-day credential | Silent privilege extension |
| Q19 | Security-sensitive actions on remembered device | Recent interactive proof for password/email change and other sensitive actions | Session theft performs irreversible changes |
| Q20 | Reauth path if email delivery unavailable | Password sign-in supported; clear fallback and expiry messaging, no OTP loop | User lockout |

## 4. Observed defects and known exceptions

| Risk ID | Severity | Confirmed evidence | Disposition |
|---|---|---|---|
| R01 | HIGH functional/security | Email-code login form shows DOB/consent; current `/email/verify` can create new UID on nonexistent link | P01-2 blocker; intent separation at UI **and API** |
| R02 | HIGH UX/test | P01-2 Android recovery Reset `tap()` missed an existing but obscured/offstage target; password reset request never issued | P01-2 blocker; fix visibility/focus/hit-target, then device retest |
| R03 | HIGH policy drift | Current backend and tests enforce superseded 8-character/special-character rule | P01-2 blocker before policy acceptance |
| R04 | HIGH security | A tiny offline common-password set is not a production-grade breached-password defense | Production blocker; select vetted corpus/private check |
| R05 | HIGH security | Local outbox and loopback cleartext dev transport not real verified delivery/TLS | Production gate; no cloud action authorized |
| R06 | MEDIUM unresolved | App creates active OTP account before password setup during signup; interrupted onboarding may remain active | Decide Q01/Q02 |
| R07 | MEDIUM automation | P01-1 Android OTP E2E known FAIL with owner-approved **local-only** exception | Keep failed evidence, rerun for release/readiness planning |
| R08 | HIGH future | P01-3 refresh theft/replay and server response-loss race | Decide Q14 prior to code |
| R09 | HIGH future | 30+ days product expectation vs NIST 30-day interactive reauth recommendation | Decide Q11 before representing standards alignment |
| R10 | MEDIUM testing | Source-contract tests green while device/form fails; P00-only buttons previously mistaken for P01 coverage | Enforce journey-specific coverage matrix |
| R11 | HIGH future | Token persistence across Android backup/device changes risks cloning | Decide Q15 and test Android restore cases |

## 5. Phase release gates

### P01-2 completion requires all of the following

- [ ] Owner signs off Q01–Q10 and exact UI state diagrams; no contradictory signup/login copy.
- [ ] New NIST password creation/validation applied consistently in API, Flutter and tests; legacy migration handled.
- [ ] Backend intent split prevents login-OTP account creation and avoids DOB/consent on returning sign-in.
- [ ] Real Fastify + Java DynamoDB Local concurrency/replay/restriction tests for **new** contracts pass.
- [ ] Flutter widget tests pass across signup/login/code/recovery/settings, narrow screens and keyboard.
- [ ] Phase-specific physical Android E2E tests execute real requests and pass, OR a separately approved development-only exception lists precise failure, all other automation done, and owner manual evidence recorded. **Release cannot silently waive security gates.**
- [ ] P00/P01-1 regressions run; original P01-1 Android exception remains explicit.
- [ ] Documentation/QA evidence updated; no accidental cloud/payment/API changes.

### P01-3 completion additionally requires

- [ ] Q11–Q20 resolved (especially reauthentication deadline and refresh-response-loss safety).
- [ ] Keystore and backup threat model approved; versioned rolling migration designed.
- [ ] Atomic refresh family + replay/idempotency + account restriction tests pass on real DynamoDB.
- [ ] Cold start/reboot/timeout/offline/logout/security/dual-device Android E2E pass or exact evidence-backed exceptions.
- [ ] Device UI does not briefly reveal private cached data before server restoration.
- [ ] Session timeout, TTL cleanup, log redaction and bounded DynamoDB access patterns inspected.
- [ ] User-facing 30-day promise accurately matches implemented server timeouts; no unsupported NIST compliance claim.

### P02 gate

P02 work is **outside** these documents. No P02 work is authorized by this review. Finishing P01-2 and P01-3 still does not imply all of P01 (e.g. Google) or production/provider verification is complete.

## 6. Sign-off and implementation authorization template

```text
Phase: P01-2 / P01-3
Scope/version approved:
Decision IDs approved:
Unresolved decisions and explicit risk owner:
Verification gates accepted:
External provider or AWS actions authorized (default: NONE):
Owner acceptance date:
Permission to implement this scoped slice: YES / NO
```

**Current answer to authorization:** NO — owner requested analysis/documentation only.
