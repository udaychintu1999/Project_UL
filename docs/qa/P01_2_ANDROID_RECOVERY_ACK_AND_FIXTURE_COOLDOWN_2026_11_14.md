# P01-2 — Android recovery acknowledgement and shared-cooldown fixture repair (2026-11-14)

## Owner-observed result (source: Windows/USB Android log)

`npm run test:flutter:p01-2:e2e` **FAILED** at the recovery request in `apps/flutter_app/integration_test/password_integration_test.dart:213` (the old `tapAuth` check reported from line 73). The UI displayed:

> If eligible, a recovery code is available in the local development outbox. Up to 5 codes per 24 hours.

The Android test, however, still required the obsolete prefix `If eligible, a recovery code was issued`. The Java/Gradle native-access warning was nonfatal. The synthetic local test account was cleaned up. **This failure does not establish that recovery issuance or reset failed.** The anonymous 202 response intentionally does not disclose whether a code was issued, whether the address is registered, or whether issuance was rate-limited. A verified local-outbox read (test-only private key) establishes whether an actual code exists.

## Findings

1. **Confirmed mismatch:** `auth_service.dart` defines the updated privacy-neutral recovery message; `password_integration_test.dart` still expected its superseded wording. The test rejected the expected `AuthResult` and did not reach the outbox read/reset.
2. **Timing-dependent fixture risk:** Test setup registers a fresh synthetic account through a real signup OTP, consuming **one** shared rolling-24-hour issuance and setting the real 60-second cooldown. Physical-device test runtimes vary with Gradle/device startup. A fast run may request recovery within that cooldown; Fastify returns the same neutral 202 even when it skips issuance, as designed.
3. **No backend defect demonstrated:** The supplied failure has no unsuccessful HTTP status; no recovery outbox or reset check ran after the stale message assertion. Do not claim backend recovery PASS or FAIL from that log alone.

## Narrow repair

- Device E2E now expects `If eligible, a recovery code is available`, preserving the privacy-safe copy.
- Device E2E still executes the REAL local outbox request and asserts an actual six-digit code before completing recovery, reset, prior-password rejection, new-password login, account identity and logout.
- LOCAL-ONLY, generated-per-run host fixture checks that its shared quota record contains exactly the one signup issuance. It advances only `nextAllowedAt` on that disposable fixture via a version-conditioned DynamoDB update; it does **not** delete the issuance, change five-per-day limits, touch a user account's quota, or change production application code. The fixture fails rather than silently bypassing unexpected shared-budget state.
- New portable automation contract guards the current message, outbox check and fixture-only shared-cooldown logic.

## Verification evidence and classification

| Gate | Result | Detail |
|---|---|---|
| Owner Android E2E before patch | **FAIL** | Obsolete recovery message expectation; test stopped before outbox/reset |
| Authoring P01-2 automation contracts | **PASS** | Added regression guard; 16 checks |
| Authoring full P01-2 portable suite | **See latest execution log** | Portable tests, guards and docs; no Android runtime here |
| Backend TypeScript semantics | **UNVERIFIED after this patch** | No production TypeScript edited; Windows remains authoritative |
| Real Java DynamoDB Local fixture update | **UNVERIFIED after patch** | Requires local Fastify, database and Windows runner |
| Flutter analyzer/widget + Android recovery E2E | **UNVERIFIED after patch** | Requires Windows Flutter and authorized physical Android |

## Owner's exact next steps (automated-first)

Apply the update-only ZIP into `C:\Dump\Projects\Project-ULuv-Space` (overwrite matching paths; preserve `.env`, local DB, lockfile, dependencies). Keep Java DynamoDB Local and Fastify running. No npm install is required for this repair.

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:p01:email-budget:integration
npm run test:p01:password:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
```

If every check passes, run `npm run verify:p01-2` to repeat the full fail-closed gate. **P01-2 remains PARTIALLY_VERIFIED until the actual owner Windows results.** The separate P01-1 OTP Android E2E exception remains historically failed and owner-accepted for local development only; it is not counted as a PASS. P01-3 30-day session persistence and P02 remain out of scope.

If the Android run now fails at `recoveryOutbox`, record the **sanitized** error; do not expose OTP, password, token, private headers or test-account email. A 404 means no code was available, and further diagnosis is required rather than assuming the neutral recovery acknowledgement guarantees an issuance.
