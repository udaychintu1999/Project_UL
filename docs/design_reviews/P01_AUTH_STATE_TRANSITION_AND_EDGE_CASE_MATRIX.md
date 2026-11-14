# P01-2 / P01-3 — Authentication state, permutations and edge-case inventory

**Design-only; no application changes.** This matrix is normative only where explicitly tagged **OWNER APPROVED**. All other rows are recommended contracts awaiting review. A single "login" Boolean cannot represent these states safely.

## A. Separate dimensions — never merge them

| Dimension | Legal values / examples | Rule |
|---|---|---|
| User account | absent, registered-incomplete, active, restricted, deactivated, deleted | Do not infer account state solely from a non-null token |
| Email identity | unknown, pending-verification, verified-linked, changed, revoked | Code purpose and email ownership must be checked server-side |
| Eligibility | unknown, underage, 18+ self-declared, eligibility-restricted | DOB/consent required for **registration**, not returning login |
| Credential | none, OTP-only legacy, password-enabled, Google-only future, multiple linked | Same UID after adding/removing method; never auto-create duplicates |
| UI intent | signup, password-login, OTP-login, recovery, signed-in-home, password-settings | Each has distinct copy, fields and back navigation |
| Challenge | not requested, issued, expired, exhausted, consumed, superseded | Must bind to purpose and identity, one-time use; cooldown separate |
| Access session | absent, active, expired, revoked, restricted | Server authorizes every protected call |
| Renewal P01-3 | absent, active, rotating, revoked, expired, reused, storage unavailable | Separate from access and interactive reauth deadline |
| Network | online, offline, API down, DynamoDB down, partial response | Distinguish transient 503 from 401; no unsafe retry |
| Device state | foreground, background, killed, rebooted, reinstalled, cloned backup | Only P01-3 persists credential securely |

## B. Registration / email verification (P01-2)

| Case | Starting state | Expected final state and UI | Critical invariant |
|---|---|---|---|
| R01 | New email + consent + age 18+ + policy-compliant password | Verified linked account, same immutable UID throughout, account home | Atomic final commit / reviewed incomplete-account design |
| R02 | New email, under 18 | Ineligible state; no adult access | Verify DOB server-side at date boundary |
| R03 | DOB exactly 18th birthday (UTC/local) | Eligible per canonical birth-date policy | Timezone consistency; leap-day behavior tested |
| R04 | Future/invalid/empty DOB | Validation error; no account | Do not create UID first |
| R05 | Consent unchecked/stale version | Explicit consent requirement; no active account | Store consent version/time |
| R06 | Email exists with password | Generic safe response; path to login/recover | Never issue second UID |
| R07 | Email exists OTP-only | Intentional sign-in/add-password flow | Preserve original UID |
| R08 | Double-tap / parallel complete | At most one account and credential | DynamoDB conditional transaction |
| R09 | OTP wrong/expired/exhausted/replayed | Stay verification state, bounded retry/reissue | No credential or session issued |
| R10 | Signup code used in login/recovery | Reject purpose mismatch | Challenge purpose is server-enforced |
| R11 | Email changed mid-registration | Invalidate old proof; restart intentional step | No cross-email account binding |
| R12 | App kill after verification before password | Explicit resumable onboarding or atomic signup | No unrestricted active account with mandatory password unset |
| R13 | DB outage after successful proof, before commit | Recoverable state; no partial account | Transaction/response-loss idempotency |
| R14 | User backs out / switches tab mid-request | Ignore stale UI response; no unintended signup | Cancellation/nonce; server may have committed, reconcile |
| R15 | Email casing/normalization aliases | Canonical mapping per current policy | Never invent equivalence for plus aliases |
| R16 | Google email matches existing local email (future) | Verified link flow with reauth; no silent merge | Email equality is not proof of account ownership |

## C. Returning sign-in and screen copy (P01-2)

| Case | Selected action | Exactly what appears | Server rule |
|---|---|---|---|
| L01 | Log in | Email + password; Log in CTA; Forgot password link | Validate existing credential and eligibility |
| L02 | Email code | Email → OTP input; **Log in with email code**; no DOB or consent | OTP **login only**, no account creation |
| L03 | Sign up | Email verification → DOB/consent → create/confirm password | Signup purpose distinct |
| L04 | Password login success | Account home; zero password editing fields | Same UID as originally registered |
| L05 | Existing OTP login success | Account home; optional "Add password" via settings | No unsolicited create-password UI |
| L06 | Password wrong / unknown email | Same generic error, no account disclosure | Rate limits, no session |
| L07 | Restricted/deactivated/deleted account | No protected account access; safe message | Status checked during session issue and `/me` |
| L08 | Request code for unknown login email | Generic response; no account creation | Privacy-preserving response, no silent signup |
| L09 | Password copied/pasted/autofilled | Supported, visibly correct semantics | No hidden trim/truncation; Unicode NFC policy consistent |
| L10 | Flip login → signup → OTP → login rapidly | Only selected form, no stale code/password/error | Pending response cannot switch user's intent |
| L11 | Rapid button taps | One logical operation; disabled busy state | Idempotency and bounded requests |
| L12 | Large fonts, keyboard opened, small phone | Primary button scrolls into tappable viewport | Automated `ensureVisible` and hit test, not fake tap |
| L13 | Backend/network down | Actionable retry without dumping secrets | No false authentication success |
| L14 | API returns malformed/partial response | Finite retry/error state | Do not parse into valid account from partial JSON |
| L15 | Password reset on another device | Old session revoked and new sign-in required | Epoch and future renewal invalidation |

## D. Credential management and recovery (P01-2)

| Case | Expected behavior | Edge/race to verify |
|---|---|---|
| C01 Add password to OTP-only account | Requires recent authenticated proof; same UID | Double add, stale session, compromise risk |
| C02 Change password, correct current | New credential, old rejected, old sessions revoked | Concurrent change, revision check |
| C03 Change password, wrong current | Generic reject, old stays, no epoch bump | Rate limit attempts, no hash leakage |
| C04 New password below NIST min or blocked | Reject before writing, helpful feedback | Server/UI policy agreement (15 chars; no symbol requirement) |
| C05 Forgot password unknown email | Same public accepted response | Enumeration/timing prevention |
| C06 Recovery code generated twice | Latest challenge wins or explicit version policy | Late email, resend cooldown, replay |
| C07 Recovery code wrong/expired/used | Retry/reauth; no update | Attempts bound, atomic consume |
| C08 Reset with correct proof | New hash, epoch bump, all prior sessions revoked | Response lost; do not resend reset unsafely |
| C09 Reset request while password change occurs | One predictable winner, no partial state | Credential version condition |
| C10 Recovery Reset button offscreen | Ensure visible and dismiss keyboard before tapping | Recent owner E2E failed at **unhittable button**, not API |
| C11 Recovery code reused as login OTP | Reject | Purpose-bound digest and record |
| C12 Lost access to recovery email | Support policy/identity proof decision required | No password bypass/support impersonation |
| C13 Password set after account restricted | Reject; credential doesn't become active | Check status in same transaction |
| C14 Common password / long Unicode passphrase | Block common, accept valid lengthy Unicode | NFC normalization, UTF-8 size bounds, no trim |

## E. Persistent login and token lifecycle (P01-3)

| Case | Action / condition | Expected behavior | Test type |
|---|---|---|---|
| S01 First login | Authorized device | Access + rotating renewal issued | API+Android |
| S02 App closed/reopened | 1 hour later | Account restored without OTP when within policy | Android |
| S03 Phone reboot | Secure store intact | Account restored after server verification | Android |
| S04 Access expired | Renewal still valid | One refresh, new access, no login UI flash | Unit+DB+Android |
| S05 Renewal idle deadline reached | No activity | Reauthentication required | Injected-clock DB |
| S06 Reauth overall deadline reached | 30-day NIST-oriented ceiling | Interactive reauth even if token rotated | Injected-clock DB |
| S07 Multiple simultaneous requests | All discover expired access | Single refresh; no storm | Concurrency |
| S08 Two refresh requests with same generation | Race | One winner; bounded retry policy | DB transaction |
| S09 Lost response after server rotates | Crash/network fault | Deterministic secure reconciliation or reauth | Fault injection |
| S10 Stolen old renewal token replay | Detected old generation | Policy-driven family revocation/alert | Security test |
| S11 Password reset/change | Another device active | Old access and renewal invalid | DB+Android |
| S12 Logout offline | No server response | Local lock now; server revocation pending explicitly | Android+fault |
| S13 Account restricted | Existing refresh token | No new token | API integration |
| S14 Device reinstall/backup clone | Old secure token should not copy silently | Reauth per backup policy | Android |
| S15 Secure storage cannot read | Keystore missing/corrupt | Safe sign-in, no crash | Widget+Android |
| S16 Server 503 | Transient outage | Offline/retry state, no false forced logout | API+Flutter |
| S17 Server 401/403 | Revoked/restricted | Clear auth state and sensitive cache | API+Flutter |
| S18 Clock skew / timezone shift | Client time changed | Server-clock authority, no duration extension | Unit/API |
| S19 Cross-account switch | User B signs in | User A tokens/cache eliminated | Android |
| S20 Stale refresh completion after logout | In-flight network response | Ignore; remain signed out | Race test |
| S21 Sensitive account change | Long-lived renewed session | Require fresh interactive auth | API/security |
| S22 App background notification deep link | Old access expired | Restore safely before navigation | Flutter E2E |
| S23 All-device logout | Authorized user | All families invalidated | API+Android |
| S24 New/old app versions coexist | Rolling rollout | Explicit version/upgrade path | Migration test |

## F. Failure classification and priority

- **Blocking functional defects currently observed:** email-code login displays registration DOB/consent and can create an account; recovery Reset button was not hittable in Android automation. Both require disposition before P01-2 closure.
- **Known narrow exception:** P01-1 OTP Android E2E (response_headers_truncated) still fails; owner accepted limited local progress. It is neither a green test nor proof of a source defect.
- **Unimplemented:** P01-3 secure device persistence and refresh; do not claim 30-day experience.
- **Test harness vs app:** a missed Flutter `tap()` establishes *the tap did not land*, not that password reset backend failed. A manual pass cannot erase an automated fail; but all feasible automation must precede requesting manual fallback.

## G. Traceability and future expansion

Each row must receive a unique automated test ID, owner-approved requirement ID, implementation file/route, result (PASS/FAIL/UNVERIFIED), and evidence link before phase acceptance. Extend combinations by pairwise and security-critical all-pairs coverage across: UI intent × account state × credential type × challenge state × session state × network state × device lifecycle × concurrency. Full Cartesian product is impractical; justify pairwise coverage and manually enumerate all security-critical intersections (e.g., restricted+valid refresh, signup+existing email, reset+concurrent change).
