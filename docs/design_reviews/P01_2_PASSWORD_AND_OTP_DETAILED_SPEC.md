> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# P01-2 — Complete password/OTP authentication product and technical design review

**Status:** REVIEW DRAFT — no code authorized.  
**Evidence base:** existing Fastify/Flutter source and owner physical Android logs, 2026-11-13.  
**Owner-approved rules:** email+password primary login; OTP optional login/verification/recovery; no compulsory OTP on password sign-in; **new NIST SP 800-63B-4 target:** >=15 Unicode code points for single-factor passwords; no mandatory special/uppercase/lowercase/digit; Argon2id; immutable account ID; no new DynamoDB table; P01-3 handles persistent 30-day sessions.  
**Not yet resolved:** registration commit point, existence-disclosure UX, how to enforce age/consent only on registration, provider/email-change linking, recovery step-up and production email integration. See decision register.

## 1. Golden user experiences and literal screen contract

**Screens must be mutually exclusive in the main application, not all fields on a single page.** The existing diagnostics launcher is a development shell; never treat P00 diagnostics as the final onboarding container.

| UI state | Headline | Visible inputs | Primary action | Explicitly ABSENT |
|---|---|---|---|---|
| Welcome / method choice | Welcome to U_luv | None | Log in / Sign up | DOB, consent, password change |
| Password login | Log in | Email + Password | Log in | DOB, consent, signup password confirmation, current/new change, OTP widgets |
| Sign up: email | Create account | Email | Continue / send verification code | Existing-password login, DOB before required, unrelated recovery |
| Sign up: verify | Verify your email | Six-digit code, masked email, resend cooldown | Verify and continue | Password-change fields, false 'signed in' copy |
| Sign up: eligibility | Confirm eligibility | DOB date picker + registration consent | Continue | Returning login fields, duplicate OTP issuance |
| Sign up: create password | Secure your account | New password + Confirm password | Create account / finish setup | Current password, password-change fields, DOB from earlier step |
| OTP returning login | Log in with email code | Email -> code after request | Sign in | **DOB and registration consent**, create/change password, account creation |
| Signed-in account | Account | Account summary, Password settings, Log out | Continue | Password creation/change forms until explicitly opened |
| Add password (legacy OTP-only) | Add password | New + Confirm, freshly verified session | Save password | Current password if no password exists |
| Change password | Change password | Current + New (confirm optional by final UX decision) | Update password | Registration DOB/consent or unrelated recovery fields |
| Forgot password | Reset password | Email, then code, then New + Confirm | Reset password | Authenticated account controls, DOB |
| Restricted/underage/verification failure | Access unavailable / eligibility notice | No privileged action | Retry/appeal/support as allowed | Authenticated adult features |
| Busy/network-error | Contextual state | Only relevant form | Retry appropriate action | Repeated mutable submissions, unbounded spinner |

**Heading/CTA coherence is an acceptance test:** A selected Email code tab must say **Log in with email code**, not invite the user to *register* or ask for age. No mixed 'sign up' and 'sign in' copy. A password login success must never show Create password or Change password fields by default.

**Field state isolation:** Switching modes must clear passwords, OTPs, recovery codes, statuses and pending operations (while email may be retained only by documented policy). Disable repeated submits during a pending request. Password/OTP must not remain in text controllers after success, logout, timeout or switching to an unrelated mode; never log/autofill raw OTP into generic fields. Support show/hide password, paste/autofill, small screens, keyboard and scroll. Use form-level validation and accessible labels; errors live-region announced; avoid accidental back navigation to authenticated state after logout.

## 2. Identity and route-intent separation — major known defect

**CURRENT DEFECT:** `auth_screen.dart` shares `if (mode == 'signup' || mode == 'otp')` and shows DOB+consent for both. `routes.ts` `/v1/auth/email/verify` always requires DOB+consent and silently creates new account when no email mapping exists. An Email-code login may therefore create an account without an explicit Sign up decision and can demand DOB again from an existing adult.

**PROPOSED REQUIRED CONCEPT:** Explicit, server-validated `intent` and purpose-specific OTP challenges:

- `signup`: email verification proof is bound to registering a **new** account; verify DOB and consent once; create immutable UID atomically at finalization; display setup/eligibility as registration, not login.
- `login_otp`: challenge is bound to a pre-existing verified email identity; validate account status, age-eligibility record and any moderation restriction on server; **no DOB or consent UI**. If no account exists, do not silently create one and do not reveal existence in an easily enumerated response.
- `password_recovery`: challenge proof is bound to reset; cannot be used to log in, attach email or register.
- `verify_new_email` (future): separate challenge scope, not implicitly permitted by a login code.

**Route design recommendation (names PROPOSED, not implemented):** `POST /v1/auth/registration/email/request`, `/registration/complete`, `/v1/auth/email/login/request`, `/v1/auth/email/login/verify`; preserve P01-1 routes temporarily with explicit compatibility/retirement contract. The backend, not a Flutter tab string, must decide if a challenge can create an account. Do not use response `newAccount` as the *only* proof of a user's registration intent.

### 2.1 New-account commit options — DECISION REQUIRED

**Option A (recommended if password is mandatory at signup):** Complete OTP, DOB, consent, and password into one server-side conditional registration transaction. Compute Argon2id hash ahead of transaction; create `uluv_users`, email link, password-credential item, settings, consume signup proof and issue one session in a single atomic transaction (subject to DynamoDB item/action limits and no duplicate keys). Never leave a fully active, passwordless account due to an interrupted password screen. Handle email already registered with a safe 'log in / recover' flow and no duplicate UID.

**Option B (compatibility-first):** Current OTP verify creates an existing account and session; `passwordSetupRequired`/`onboardingState` remains server-controlled until password is added. Protected adult features are denied to an incomplete registration; returning onboarding can resume after a verified sign-in. An explicit supported OTP-only account type may be permitted ONLY if the owner chooses optional passwords. Adds migration/state consistency cases.

Do not implement either option without owner sign-off. Existing P01-1 OTP-only users must be migrated/accessed without a new `uniqueId`. Do not silently deactivate legacy accounts.

## 3. Core API contract proposals (all require schema/auth checks)

| Operation | Authentication | Valid input | On success | Negative/security behavior |
|---|---|---|---|---|
| Register OTP request | Public, throttled, purpose-scoped | Normalized email + `signup` | Generic accepted, bounded code outbox | Enumeration protection, cooldown, expired challenge, no duplicate email identity |
| Complete registration | Valid unused signup proof | Email/code, adult DOB, consent/version, password | Atomic UID + credential + eligible account + session | Underage, duplicate email, stale consent, simultaneous signup, replay fail closed |
| Password login | Public, throttled | Email, password | New opaque access session, same UID | Generic invalid credentials, bounded Argon2 work, status check, no OTP bill |
| OTP returning request | Public, throttled | Email + `login_otp` | Generic accepted, send only if eligible account | No account creation, no existence leak, no DOB prompt |
| OTP returning verify | Valid unused login-OTP proof | Email/code | Session with same UID | Expired/used/wrong code, account restriction, replay and race |
| Attach password to OTP-only account | Authenticated + recent trusted proof | Password + confirmation on client | Single credential bound to same UID | Password already set, stale session, concurrent writes, only active eligible user |
| Change password | Authenticated + current password/recent reauth | Current/new | New Argon2id hash, revoke sessions per policy | Wrong current, same/reused password, concurrency, locked user, revocation |
| Request password recovery | Public throttled | Email | Constant/generic accepted | Unknown account no enumeration; no account status disclosure; provider unavailability |
| Complete recovery | Valid unused bound recovery proof | Email/code/new password | Credential rotated atomically, all previous sessions revoked | Wrong/expired/used proof; no partial hash update; duplicate concurrently |
| `/me` / account access | Valid access token | None | UID, restricted safe profile | Expired/revoked/restricted never returns private data |
| Logout | Valid auth | Session | Revoke session immediately | Idempotent local UX after network error; no false server logout claim |

**Versioning:** Define JSON schema and explicit response codes; never depend on localized user-visible text for control flow. Use machine-readable error codes and bounded retry-after metadata. Avoid exposing whether an email exists through content, status, timing or delivery behavior when feasible. Define behavior for a challenged email that becomes linked/unlinked between issuance and consumption.

## 4. Account and credential invariants

- `uniqueId` never changes under password creation/change/reset, OTP login, provider linking, or reinstallation.
- Normalize email per canonical function. **New Unicode password policy should consistently apply NFC on both creation and verification, subject to legacy-hash migration; do not trim, case-fold or truncate.** Store only Argon2id salted verifiers (PHC string) in `uluv_auth_links` credential item.
- A single verified email identity maps to at most one UID. All external provider links require authenticated linking protocol; email-string equality alone must not auto-link Google and password identities.
- New registration may have `pending_verification`, `pending_eligibility`, `pending_password`, `active`, `restricted`, `deactivated` (conceptual, not current persisted statuses). Distinguish authentication state from onboarding completion and age eligibility. Account status must be validated on every protected API route.
- `uluv_users.sessionEpoch` increments on password change/reset; verify protected access *and future P01-3 renewals* use this revision, not DynamoDB TTL alone.
- Conditional expressions/transact writes handle first-user uniqueness, credential attachment and version races; no `Scan`, ad hoc GSI or new table unless approved. DynamoDB TTL cleanup is eventually consistent, so API checks expiry now.
- P00 diagnostics remain valid; P01 UI must not depend on the P00 diagnostic buttons for authentication completion.

## 5. Password policy and known variance

**NEW OWNER-APPROVED TARGET POLICY:** NIST SP 800-63B-4 §3.1.1.2 — **15+ Unicode code points** for email+password as a single factor; **no composition rules**, so symbols/uppercase/digits are NOT mandatory. Support at least 64 characters, printing ASCII, spaces and Unicode; allow paste/autofill/password managers. Apply consistent NFC treatment on new password creation and verification with a reviewed legacy hash path. Block commonly used/compromised entire passwords. Do not impose arbitrary periodic password changes. See `P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`.

**CURRENT SOURCE HAS NOT BEEN MIGRATED:** `password-policy.ts` still enforces >=8 + ASCII punctuation, caps at 256 code points/1024 UTF-8 bytes, and has a tiny local blocklist. `password.ts` uses Argon2id `memoryCost=19456 KiB, timeCost=2, parallelism=1`, with a 10-attempt/15-minute per-email window and 10-minute recent-auth requirement. These facts describe the existing local code **not** approved new behavior, not broad brute-force protection and not proven NIST conformity. Future implementation must migrate backend/Flutter/tests coherently, preserve legacy account access safely, and select a production-grade whole-password blocklist. Do not update source during this analysis-only phase.

## 6. Edge cases to handle in P01-2 implementation

### Identity / registration

- Email casing, whitespace, Unicode domain/IDN handling, max length, malformed addresses, plus aliases, accidental duplicate addresses, two signup requests at the same instant, new code invalidates old code, request cooldown across process restart, reset after DB restart.
- Existing password account selects Sign up; existing OTP-only account selects password login; unregistered email selects Email code login; Google account with same email (future) attempts signup; deactivated/restricted identity tries password/OTP/recovery.
- DOB yesterday/today 18th birthday, Feb-29 birthday in non-leap year, invalid date, future DOB, user lies about DOB, changing DOB later, screen timezone vs server UTC. Consent version, re-consent if policy changes, parental/underage denial; no display of DOB after registration unless product explicitly allows.
- New account created by OTP but password setup abandoned due to app kill, back button, offline, DB outage, auth expiration or partial transaction; returning legacy OTP-only accounts must not be forced into duplicate registration.

### Login / authentication

- Wrong email vs wrong password vs missing credential: generic user-safe errors; timing leakage; simultaneous correct/wrong login requests; rate-limit atomicity and different IP/device throttles; attack on many email targets; loading timeout; login after restriction between credential check and session issuance; disabled account may not receive a session.
- Password manager/autofill, paste, physical/IME keyboard, field focus and scroll; rapid mode switches; multiple requests, back navigation, response arriving after screen disposed, stale response overwriting new mode, text field reusable vs cleared; accessibility and large fonts.
- OTP purpose confusion, replay, exhaust attempts, expiry between presentation and submission; code not delivered, email provider outage (future); resend invalidates previous; no DOB/consent on existing OTP login.

### Change / recovery

- Correct current password but invalid new; wrong current password; two simultaneous changes; change vs password reset race; change vs new login race; reset vs account restriction; consumed code replay; recovery rate limit across API process restart; recovery code brute force, old recovery code after resend, delayed email, account unknown.
- Re-authentication age, use session `createdAt` vs actual last strong authentication, password changed from another device; current implementation bumps epoch and forces re-login. Define UX specifically: error, clear secrets, no stale signed-in state; revocation across all devices is a documented choice.
- Short/invalid new password (14 vs 15 code points), no-symbol valid passphrase, Unicode/emoji/NFC, spaces, 64/256-codepoint and 1024-byte boundaries, password reuse, null bytes and control characters, Argon2 OOM/cost under burst and bounded request sizes.
- Recovery button offscreen, keyboard overlay, scroll view and modal barriers; test should assert it is **hit-testable** before tapping; no `warnIfMissed:false` to pretend success. A failed tap is not evidence the reset API failed.

### Outages and errors

- DynamoDB outage between `Get`, hash and transaction, backend restart during OTP outbox life, expired session, malformed 2xx JSON, 4xx/5xx, partial HTTP response/ADB reverse failure, duplicate response, explicit cancellation, transient network failure after write but before response. Avoid unsafe automatic replay of codes/credential changes. Show clear retry/reauth guidance and preserve user input safely only within same protected screen.

## 7. UX acceptance test cases (mandatory before declaring P01-2 done)

1. Sign up → email verify → age/consent → create/confirm password → Account screen; never show current-password/change fields during this journey. Same UID after future logins.
2. Email code login for **existing** account → code → Account directly; **no age picker or registration consent**, and does not create account.
3. Email code login for **unknown** email → generic safe response, explicit Sign up entry only, never silent UID creation.
4. Password login → Account directly; account screen no password editing inputs. Password manager and keyboard work on physical phone.
5. Existing OTP-only account → Sign in with OTP → choose Add password → attach to same UID; duplicate set denied; password login works afterward.
6. Wrong password, rate limit, restricted account → no protected access and generic errors; no account existence leak.
7. Change password via settings → old password rejected, new password accepted, sessions invalidated per policy; UI returns to appropriate sign-in state.
8. Forgot password → request proof → enter code → new+confirm → Reset; button remains visible and **tappable** after keyboard use; old password rejected/new accepted.
9. Rapid tap, back navigation, tab switching, app background, offline/server restart and low/small-screen viewport → deterministic state, no duplicate operations, no mixed copy/fields, no crash/hang.
10. No real delivery claimed: developer outbox visible only in local mode; negative path when outbox unavailable is clearly explained.

## 8. Implementation gate

This document is a **design contract proposal**, not authorization to modify app or database. Resolve `P01_DECISIONS_RISKS_AND_RELEASE_GATE.md` first; then implement as small end-to-end slices. `P01_VERIFICATION_MASTER_MATRIX.md` is the acceptance ledger. Do not require manual verification before attempting all feasible automated tests, and never use manual PASS to erase an automated FAIL.

### Sources

- Repo code: `apps/flutter_app/lib/features/auth/auth_screen.dart`, `auth_service.dart`; `apps/api/src/features/auth/routes.ts`, `password.ts`, `password-policy.ts`.
- Owner observations (2026-11-13): Email code tab showing DOB/consent in login context; Android device E2E warnings indicating unhit-testable Reset button and no reset request.
- External standards: https://pages.nist.gov/800-63-4/sp800-63b.html ; https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
