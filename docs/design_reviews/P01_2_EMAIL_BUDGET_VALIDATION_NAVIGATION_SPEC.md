> **2026-11-14 owner UX override:** Previously recommended neutral signup-account responses are superseded for existing signup email addresses only. Explicit 409 saves a wasted OTP but exposes registration status; older privacy rationale below remains valid. Login and recovery remain neutral. See `docs/qa/P01_2_EXISTING_EMAIL_SIGNUP_MESSAGE_2026_11_14.md`.

> **Implementation note:** Backend-authoritative rolling quota, no-send checks, Flutter inline validation and Back guard are now in source. Existing public 202 responses intentionally remain non-enumerating. Provider controls/IP abuse protections are NOT production-ready.

# U_luv — P01-2 Email Delivery Budget, Form Validation and Navigation Design Contract

**Date:** 2026-11-14  
**Status:** Implementation begun 2026-11-14; authoring portable checks PASS, Windows DB/Flutter/Android UNVERIFIED. See `docs/qa/P01_2_EMAIL_BUDGET_UX_IMPLEMENTATION_2026_11_14.md`. Historical design sections below are retained as requirements, not verified evidence.  
**Scope:** P01-2 hardening. P01-3 exclusively owns 30-day renewable session persistence. P02 is out of scope.

## 0. Audit of the actual currently delivered code

- `apps/api/src/features/auth/policy.ts`: `OTP_COOLDOWN_SECONDS=60`, `OTP_HOURLY_LIMIT=5`, OTP TTL 600s, five verification attempts. **No rolling 24-hour shared email budget exists.**
- `routes.ts` `/v1/auth/email/request`: per-email, per-email-purpose-independent OTP **hourly** issuance record (`OTP#EMAIL#…/RATE`) with a conditional write. It issues a challenge for unknown emails on login and issues signup challenges even for already-linked emails. Both are unnecessary email expenses when wired to a provider.
- `password.ts` recovery-request: independent `PASSWORD#RESET#…/RATE` record; it issues challenge even for absent accounts. These channels can therefore exceed a single shared daily cap.
- The local outboxes are process-memory developer fixtures. No real emails are currently sent and no external provider success can be claimed.
- `auth_screen.dart`: some fields are validated only on pressing a button. Password length check is on submission. Email formatting, empty fields, code digits, underage DOB, password confirmation and recovery inputs have incomplete *live* inline guidance. The Fastify backend must **continue** to validate all requests.
- `main.dart`: P00 diagnostics is the root route; its button **pushes** `AuthScreen`. Android Back can pop the authentication screen and expose P00 buttons, while the session token is only held in `AuthScreen` memory. This is a navigation defect and **not** proof of P01-3 persistent authentication.
- Owner-verified `npm run verify:p01-2` on 2026-11-13 passed actual Android password E2E and 27 Flutter widget tests, but the current manual signup/code/back behavior reported on 2026-11-14 is not covered by that particular passing journey.

## 1. Binding product decisions / recommended defaults

| ID | Rule | Reason |
|---|---|---|
| B01 | **Maximum five newly issued email codes per normalized email per rolling 24 hours**, shared across signup, existing-user email OTP login, and password recovery | Clear cost ceiling and no cross-flow bypass |
| B02 | Keep at least **60 seconds between issuances** for a recipient; preserve five attempts/code and ten-minute expiry | Avoid bursts and guessing |
| B03 | Count **successful durable code-issuance commitments**, not invalid form submissions, stale retries, or 'not eligible' operations | Do not charge for no-code responses |
| B04 | A new code issued for the same recipient/purpose invalidates the previous one; consuming a code **never** erases the daily budget | Prevent resend bypass |
| B05 | Public **signup for an existing email** must **not** issue an email; public OTP login for an unknown email must **not** issue an email; public recovery for an unknown/ineligible account must **not** issue an email | Stop unnecessary email expense |
| B06 | Public request response must be **indistinguishable for existing/nonexistent/ineligible identities**, including account-specific limits; never announce 'this address is registered' before proof of control | Account enumeration protection (OWASP) |
| B07 | A **currently authenticated** user may see 'You are already signed in' and can go directly to Account, because the session has proven identity | Clear feedback without enumeration |
| B08 | No automatic re-issuing OTP after uncertain network outcome. Use client-generated idempotency key on each intended request and server-side deduplication | Avoid double charges/consumption |
| B09 | No new DynamoDB tables or GSIs. Use transactional conditional writes inside `uluv_auth_links`; no scans | Preserve canonical schema |
| B10 | Client-side validation is immediate and accessible, but server-side validation is always authoritative | Safety and correctness |

**Cost model:** This is a ceiling on authorized code issuance attempts; it is **not yet a real-email delivery counter**, because the local runtime has no email provider. When real delivery is added, the provider call must use a durable delivery job, provider idempotency/reconciliation and explicit failed-send policy. Do **not** send external mail inside a DynamoDB transaction or claim exactly-once delivery based on a transaction alone.

## 2. Rolling 24-hour logic (not midnight resets)

Use UTC epoch seconds. For every recipient, store a bounded list of issuance timestamps in a single versioned DynamoDB item; do not depend on DynamoDB TTL for expiry enforcement.

Recommended item in existing `uluv_auth_links`:

```text
PK = OTP#EMAIL#<HMAC-SHA256 normalized email>
SK = DELIVERY_BUDGET
version = <random UUID>
issuedAtSeconds = [last at most five successful issuance times]
nextAllowedAt = <epoch second>
expiresAt = <last issuance + 25 hours; for eventual cleanup only>
```

Algorithm when an **eligible** request reaches issuance:

1. Strongly consistent Get of the shared budget and current purpose-specific rate/challenge state.
2. Filter stored timestamps `t` where `t > now - 86400` (a timestamp exactly 24h old is expired).
3. If `now < nextAllowedAt`, block issuance for the remaining cooldown; **do not** write a challenge or spend a slot.
4. If five timestamps remain, block issuance until `oldest + 86400`. Do not mutate records.
5. Otherwise form the next record with `timestamps + now`, `nextAllowedAt=now+60`, a new random `version`, and TTL marker.
6. **Atomically** transact: (a) version-checked Put budget, (b) purpose-specific challenge Put/replace, (c) compatible existing hourly/rate record where needed, and (d) bounded idempotency receipt. If the CAS fails, re-read and retry a fixed small number of times. Do not silently issue on CAS failure.
7. Place the local-only outbox code after commit. In future production, enqueue a durable email delivery operation with an idempotency key, not a best-effort untracked send.
8. Return a safe response, never the code or recipient existence status.

**Boundary example:** Issuances at Monday 09:00, 09:02, 09:04, 09:06, 09:08 exhaust the cap. The next issuance can happen Tuesday 09:00 **or later**, provided cooldown and any independent anti-abuse controls also allow it. A sixth request Monday evening cannot reset the window. Five concurrent requests cannot each read `count=4` and all commit: the shared conditional-write `version` allows only one winner.

**Do not use** a counter reset at midnight, a per-process `Map`, a standalone Get-then-Put, one counter per OTP purpose, or DynamoDB TTL as the actual quota clock. Tests must force CAS conflicts, exact time boundaries and app/server restarts.

## 3. Critical identity privacy vs clarity decision

OWASP recommends consistent answers for existing and nonexistent emails in account recovery. Returning `'email already registered'`, different HTTP codes, or exact account-specific remaining allowance to an **unauthenticated** signup visitor is an account-enumeration oracle.

**Required response behavior:**

| Situation | Send email? | Public UI result |
|---|---|---|
| Signup, valid new email, budget available | Yes (future provider); local challenge/outbox for now | 'If this email can be registered, a verification code will be available. Already registered? Log in.' |
| Signup, already registered email | **No** | **The same generic response**, same HTTP status and structurally identical body |
| OTP login, existing eligible email | Yes | 'If this email is eligible, check for a code. You can also use your password.' |
| OTP login, unknown email | **No** | Same generic response as existing email |
| Password recovery, known eligible account with password | Yes | 'If this account can be recovered, recovery instructions will be available.' |
| Recovery, unknown/restricted/no-password | **No** | Same generic response |
| Logged-in user taps Sign up | **No** | 'You are already signed in. Go to Account or Log out.' |
| Address is already at daily limit | **No** | Generic public response; don't expose existence by returning recipient-specific 429 only for real accounts |

**Important UX trade-off:** A precise `You have 0 of 5 emails remaining` on a public unverified address is not safe if no corresponding message appears for unknown accounts. Rate-limit totals and `Retry-After` can be shown after verified identity, or for **global/client/IP** restrictions applied independently of account existence. On public anonymous flows, give neutral help: 'A maximum of five codes per address can be issued in a rolling 24-hour period. If no code arrives, use password sign-in or try later.'

Local private `/v1/dev/*/outbox` can show whether there is a code to an authorized developer. Do not copy this behavior to public or production endpoints. For production, also normalize timing and prevent delivery side-channel abuse as far as feasible; status/body equality alone is not sufficient.

## 4. Prevent budget and provider bypasses

- **Same email across intents**: one global budget, even if challenged via signup, OTP login and recovery; changing mode, case or whitespace must not provide extra slots.
- **Idempotency**: same client `requestId` after a timeout does not spend another slot; new explicit Resend is a new intention and must obey cooldown/quota. Receipt TTL > request retry window. Do not store plaintext OTP in idempotency receipts.
- **Atomicity**: challenge must not exist without budget reservation; budget reservation must not commit on transaction failure; cross-endpoint CAS protects burst races.
- **IP/device abuse**: per-address caps alone do not stop a bot sending one email to thousands of addresses. Add a separately bounded source/IP velocity control (with correct trusted-proxy configuration), WAF/bot controls, and provider-wide spending cap **before production email delivery**. Set thresholds based on load and avoid punishing entire households/carrier NATs. Do not trust arbitrary `X-Forwarded-For` headers.
- **Repeated bad codes**: verify-attempt lockout is separate from issuance rate. Password login’s 10 attempts per 15 minutes is separate. Never share counters with failed password guesses.
- **Provider outage**: accept only if delivery job safely queued; define whether provider hard failure refunds the quota. Require provider idempotency and reconciliation; otherwise mark unknown sends as spent to avoid duplicate billing.
- **Restricted/deactivated accounts**: no new code issuance; neutral response to unauthenticated callers. Existing authenticated sessions must enforce restrictions.
- **Clock drift**: server time only; fake clock injected in tests. Don't trust phone time or timezone/DST.
- **Data privacy**: HMAC email in keys, no plaintext addresses/codes in logs, metrics, errors or test output; bound data retention and capacity; clean test records.

## 5. Form UX — exact validation and feedback contract

On-device validation avoids unnecessary API calls and gives instant guidance. Never skip server checks.

| Field/action | Validate in Flutter as user types/edits | UI feedback | Backend still validates? |
|---|---|---|---|
| Email | Trim outer spaces for validation, check simple reasonable syntax and length <=254; don't silently alias dots/plus | 'Enter a valid email address.' below field, once touched; clear automatically when corrected | Yes |
| Password login | Nonempty, never trim or change case | 'Enter your password.' Do **not** demand 15+ for existing legacy passwords at login | Yes + Argon2id verify |
| New password (signup/change/reset) | 15+ Unicode code points, accept spaces/Unicode; no mandatory symbol; capped input | Live count such as '12/15 characters — add 3 more'; show inline weak/common-password rejection from server | Yes + blocklist |
| Confirm password | Match exact new password | 'Passwords don't match.' clear live | Yes at UX boundary; server receives single password |
| Six-digit email/recovery code | Exactly six ASCII digits | 'Enter all six digits.' No call until valid | Yes, attempt counter/replay |
| Date of birth | Valid calendar date, age >=18; UTC server is authority at boundary | 'You must be at least 18.' | Yes |
| Consent | Explicit true during signup only | 'Please confirm before creating your account.' | Yes |
| Request code | Valid email and correct current mode; disable duplicate taps; show visible cooldown/help | 'You can request up to five codes in 24 hours.' For accepted requests say *eligible*, not *email sent* | Yes, atomic quota and identity intent |
| Server unavailable | Preserve safely resumable nonsecret inputs; no credentials in logs | 'Unable to connect. Check connection and try again.' | Yes |

**Validation mechanics:** Use per-field touched/dirty state and reactive listeners or `Form`/`TextFormField` validators. Revalidate on change and on submission; disable the specific action while pending; clear stale status when mode changes. Inline `errorText` with screen-reader semantics; no snackbars as the sole error channel. Explicitly test keyboard overlay, small screens, landscape, text scaling, paste, autofill, focus loss and tap targets. Do not disable a button with no explanation about what must be fixed.

**Back navigation:** Since P00 diagnostics currently pushes the auth route, Android Back can expose its buttons even when signed in. During P01-2 prevent an authenticated account from popping back into the diagnostic shell; offer explicit development-only diagnostics navigation if necessary. Unauthenticated Back may exit the auth form. Never claim 30-day persistence: restarting the app still loses the in-memory token until P01-3.

## 6. Mandatory state/race matrix

| Scenario | Expected outcome |
|---|---|
| 5 codes inside 24h then sixth | At most 5 committed issuances; no sixth code, no reset from OTP consumption |
| Oldest code reaches exactly +86400s | Oldest drops out, one new issuance permitted if cooldown passes |
| 2 requests against one remaining slot | Exactly one transaction succeeds; other is neutral-denied or rate-limited internally |
| Signup and recovery race for same email | **Shared** budget CAS; combined issuances cannot exceed 5 |
| Same client request retried after lost response | One issuance and one outbox/provider job, idempotent response |
| Invalid email, missing password, underage signup | No issuance; inline error, backend enforces anyway |
| Signup for known email | No code, no email cost, no explicit account-exists public response |
| OTP login for unknown email | No user creation, no code, neutral public response |
| Recovery for unknown email | No code, neutral public response |
| Resend while cooldown remains | No new code, original remains usable, no allowance consumed |
| New code after cooldown | Prior code invalidated; latest valid only, daily total increases by 1 |
| Client changes email while request pending | Stale response does not populate code screen for different email |
| Backend/DB restarts between requests | Budget unchanged and enforced from DynamoDB, not process memory |
| Request succeeds but HTTP response lost | No silent auto-retry or duplicate email spend |
| Provider sends twice despite idempotency | Detect/report provider breach of cost contract; provider cap alarms |
| Public error across existing vs unknown address | Same externally observable response structure/status and similar latency |
| Logged-in user presses Back | Remains in authenticated account context, not P00 diagnostic buttons |
| App restart | **Not persistent in P01-2**; P01-3 implements secure 30-day session restoration |
| Keyboard covers action button | Dismiss/focus/scroll; button is hit-testable, not merely present in tree |

## 7. Test strategy — all feasible automation first

1. Pure deterministic tests for 24h timestamp eviction, cooldown, 5th/6th issuance, normalization, leap/clock boundaries, idempotency and recovery classification.
2. **Real Fastify + Java DynamoDB Local tests** for >5 concurrent requests, shared signup/login/recovery budget, CAS retry, restart persistence, unknown/existing no-send, no identity leakage, receipt idempotency, challenge replay and quota state after failure.
3. Flutter widget tests: inline email/new-password/confirmation/code/DOB/consent errors while editing; no backend call for invalid local input; accessible error announcements; back state; narrow-screen keyboard; pending request duplicate-tap.
4. Physical Android E2E: real three-purpose request routing, no unnecessary code, controlled cap boundaries, correct back navigation, password and OTP login, network failures. Keep P01-1 known Android automation exception explicit and test any independently feasible paths.
5. Run existing P00, P01-1, P01-2 regression gates; no fake PASS for unavailable Flutter/DB. If persistent environment-only failure remains after all feasible tests, ask owner for a **specific** manual acceptance check and retain that failure as an exception.

**Release gates:** Static validation never substitutes for the real DB race gate; widget tests never substitute for actual Android UI; local email outbox tests never validate a future real SMTP/SES provider. No new 30-day session behavior in this scope.

## 8. Staging / migration plan for implementation

- **Slice A**: freeze response semantics and exact quota math; add deterministic model tests and a shared daily-budget module; no behavior change yet.
- **Slice B**: integrate shared transaction into both `routes.ts` and `password.ts`; test with real DynamoDB under concurrency and process restart; update cleanup fixtures; preserve 18-table schema.
- **Slice C**: suppress ineligible signup/login/recovery deliveries while keeping public response neutral; identity-timing and denial-of-service review.
- **Slice D**: add live Flutter validation, helpful safe messages, accessible state and authenticated Back behavior, with widget/Android coverage.
- **Slice E**: full P00/P01 regression, security review, owner manual QA only afterward; document every exception and production email-provider prerequisites.

**Do not ship an anonymous public account-existence check or count-unaware per-purpose rate counters as a shortcut.**

## Sources

- Inspected repo: `apps/api/src/features/auth/{routes.ts,password.ts,policy.ts}`, `apps/flutter_app/lib/{main.dart,features/auth/auth_screen.dart,features/auth/auth_service.dart}`, and existing P01 integration/unit tests.
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- NIST SP 800-63B-4 (rate limiting / OTP): https://pages.nist.gov/800-63-4/sp800-63b.html
- AWS DynamoDB transactions: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
