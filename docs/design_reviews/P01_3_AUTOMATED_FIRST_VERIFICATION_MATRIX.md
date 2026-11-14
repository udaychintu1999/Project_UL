# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# P01-3 — V3 Automated-First Acceptance Matrix (Approved Simple Refresh)

**Status:** DESIGN ONLY; every new P01-3 test below is `NOT IMPLEMENTED / NOT RUN`. These command names are proposals; creating runnable scripts is part of the future coding stage. Existing P01-2 owner PASS does not prove any P01-3 restore/refresh feature. **No P01-3 pass claims from documentation-only validation.**

## Gate sequence (hard order)

`G0` build/test harness and schema/source guards -> `G1` TypeScript/security/unit -> `G2` **real Fastify + Java DynamoDB Local**, race/expiry/family/crypto/epoch -> `G3` Flutter analyzer/widgets and secure-store fakes -> `G4` **real physical Android** with Keystore/private key across kill/reboot/restore and real API -> `G5` owner manual (after all feasible automation) -> `G6` evidence, docs, ZIP, owner signoff.

### Server unit / real-DynamoDB API

| ID | Case | Evidence required |
|---|---|---|
| S01 | Password login enrolls family | Same immutable UID; access + refresh + device public key bound; no extra OTP |
| S02 | Existing OTP login enrolls | Same UID; no repeated DOB/consent; quota counted only for actual OTP issuance |
| S03 | Atomic new signup + session | No half-created user or family when transaction fails |
| S04 | Legacy token migration | Old access cannot mint 30-day refresh; fresh interactive login required |
| S05 | Access expires at exactly 30 minutes | Explicit expiry, refresh once, no unsanctioned use |
| S06 | Day 29, day 30−1 second, day 30 | Server clock; `now >= reauthDueAt` denies, never reset by refresh |
| S07 | Idle 30-day cap with earlier reauth | Earlier clock always wins, no indefinite session |
| S08 | Refresh generation CAS | 2/20/100 concurrent requests: **exactly one** valid successor |
| S09 | Old token reused within 1 millisecond | Rejected even same request ID and valid device signer |
| S10 | Old token reused after 120 seconds | Rejected, no grace window |
| S11 | Same signed proof replayed | Rejected by generation/token checks; no new successor |
| S12 | Copied refresh token but wrong device signer | 401, no refresh; no owner/account leakage |
| S13 | Tampered signature / malformed SPKI | Reject without DB mutation or exception dump |
| S14 | Refresh while user restricted/deleted | No renewal; no protected access |
| S15 | Password reset/change elsewhere | Epoch invalidates old access and refresh across all devices |
| S16 | Device logout vs other devices | One family revoked, other legitimate device unaffected |
| S17 | Logout-all | All old families/access invalidated by epoch or per-family check |
| S18 | Late access token after family revoke | Protected handler refuses even if original access TTL valid |
| S19 | Five-device enrollment concurrently | Atomic max 5; no sixth session and no stealth eviction |
| S20 | Device limit after revoked/expired slots | Owner can safely reuse slot without Scan or counter leak |
| S21 | Wrong account requests device listing/revoke | No IDOR, no cross-user metadata |
| S22 | Rate limit refresh storm | 429 bounded backoff, zero email-quota debit |
| S23 | DB down before refresh | 503; family not falsely revoked; no fallback to AWS |
| S24 | Failure after transaction condition evaluation | No half-rotated family/access token |
| S25 | Server committed, response deliberately dropped | Next old credential rejected; new login required; never same-token grace |
| S26 | Client timeout before confirmed commit | Classified as ambiguous network state, not immediate bad-password |
| S27 | Device key lost/re-enrollment | Require fresh interactive auth; no simple key replacement via refresh |
| S28 | Secret key version rollover | Verify current/old only during bounded policy, write new, reject retired versions |
| S29 | Missing required secret | Startup fails closed; no default shared secret, no log leak |
| S30 | Malformed/oversized refresh request | 400 before expensive DB/crypto; no information disclosure |
| S31 | New user registration during cap race | No duplicate user or family, transaction within Dynamo limits |
| S32 | 24h P01-2 access/session compatible until expiry | Regression protected, no retroactive 30-day privilege |
| S33 | Password login failure | No session/family/item created |
| S34 | Refresh does not touch OTP request budget | All 5/rolling-24-hour tests remain PASS |
| S35 | Cross-device clone of encrypted blob | Proof mismatched; cannot restore account |
| S36 | Account epoch default 0 (older users) | Valid eligible users can enroll, still revoked correctly after change |
| S37 | TransactWrite same-item guard | No two actions on same item, no scan/new GSI/table |
| S38 | Logout while refresh transaction in progress | Revoke wins effective access, late response fenced on phone |
| S39 | Pseudonymous security audit | No raw tokens, passwords, private keys, OTP or full email in logs |
| S40 | System clock/timezone tampering | No server deadline bypass |

### Flutter unit / widget / platform tests

| ID | Case | Evidence required |
|---|---|---|
| F01 | Boot with no credential | Auth screen, not P00 buttons |
| F02 | Boot with stored credential | Neutral restoring screen, no account-data flash |
| F03 | Restore success | Verified account home, no login flicker |
| F04 | Restore 503/network failure | Retry state + sealed credential retained |
| F05 | Explicit revoked/consumed 401 | Reauth state and helpful message, never retry old token forever |
| F06 | Two protected calls expire together | Exactly one refresh Future; safe request coalescing |
| F07 | Rotated token storage failure | No false ACTIVE state or plaintext fallback; sign-in recovery |
| F08 | Logout during refresh | In-flight completion ignored by operationGeneration |
| F09 | A logs out then B logs in | No cached A account/protected state appears for B |
| F10 | Android hardware Back | No return to P00 diagnostics or authenticated route after logout |
| F11 | Deep link before restored login | Deferred until verification; no bypass |
| F12 | At 30-day boundary | Reauth UI without silent extension |
| F13 | Account restriction mid-session | Locked/restricted state, no account data |
| F14 | Reinstall/Keystore corruption | Fresh login without crash |
| F15 | Storage record torn/truncated | Safe parse failure, no unencrypted fallback |
| F16 | Access expiry safe retry vs mutation | GET may retry after refresh; non-idempotent mutation never blindly replayed |
| F17 | Refresh API 429 Retry-After | Bounded backoff, no endless loading |
| F18 | Long text/accessibility/offline UI | Readable screen reader status, Retry usable, buttons disabled only while pending |
| F19 | Sensitive operation recent-auth clock | Refresh does not satisfy 10-minute step-up |
| F20 | Password/OTP P01-2 login and recovery | All current widgets still pass; no new OTP cost |

### Physical Android gates (cannot be replaced by mocks)

| ID | Mandatory device scenario | Actual acceptance |
|---|---|---|
| A01 | Real password login + Keystore key | Device-bound family created, account shown, private key never exportable |
| A02 | Swipe app away and relaunch | Restores without password/OTP and no login flicker |
| A03 | Reboot phone and relaunch | Restores through real API/DB without password/OTP |
| A04 | Kill app process during restore | No crash/stale UI, next launch safe |
| A05 | Access expiry + background/foreground | One rotation, old refresh rejected, account usable |
| A06 | Disable network/ADB reverse | Retry state, credential not erased; restore after reconnect |
| A07 | Lost refresh reply after server commit | User prompted to sign in again; no blank screen/stuck spinner |
| A08 | Logout then force-stop/reopen | No auto-restore/Back route to diagnostics |
| A09 | Password change/reset on another device | Revoked device cannot restore/refresh; fresh login needed |
| A10 | App data clear/reinstall/restore attempt | No cloned signed-in state; recovery via normal login |
| A11 | Two devices and targeted revoke | One revoked, other remains until all-revoke |
| A12 | KeyStore/secure-store failure injection | Clear error/recovery; no plaintext secret or crash |
| A13 | Session limit 5 + new device | Helpful device-selection flow; no silent eviction |
| A14 | Device clock/timezone change | No deadline extension; server truth |

### Mandatory regressions / status

- P00 complete diagnostics/API/DB unchanged; `test:db`, `test:integration`, `test:flutter:e2e` still valid and distinct.
- P01-1 existing functionality remains; the owner-accepted **P01-1 Android OTP automated FAIL** remains visible and **does not waive A01–A14**.
- P01-2 `verify:p01-2`, typecheck, shared email budget real local DB integration, 30 widget tests from owner-reported baseline (count may grow) and P01-2 Android password E2E must still pass. Do not infer current post-P01-3 results from historical logs.
- Future P01-3 scripts must fail closed on required Android gates and not quietly skip them; when truly unavailable, report `UNVERIFIED` and seek specific manual fallback per existing manual escalation policy.
- No server key/credential material in QA, no production AWS or payment calls, no extra DynamoDB table. `docs/qa/EVIDENCE_LOG.md` records individual command/time/actual result.

**Proposed commands to implement later:** `npm run test:p01-3:unit`, `npm run test:p01-3:contracts`, `npm run test:p01-3:integration`, `npm run test:flutter:p01-3:e2e`, `npm run verify:p01-3`.
