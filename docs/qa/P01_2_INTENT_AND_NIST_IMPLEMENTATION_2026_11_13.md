# P01-2 — Contract reconciliation implementation and Windows acceptance (2026-11-13)

**Status:** `PARTIALLY_VERIFIED`. This is a source-and-test update authorized after the owner asked to proceed from the P01-2/P01-3 design audit. **P01-3 is NOT implemented** and P02 has not started. The new changes have not yet passed owner Windows TypeScript, Flutter, real DynamoDB Local or physical Android verification. P00 history and P01-1 Android automation exception remain intact.

## Implemented source changes (not a claim of live acceptance)

1. **Intent-separated email proof:** `/v1/auth/email/request` accepts `purpose='signup'|'login'` (defaults to login for legacy request clients). Challenge item stores purpose, and the final endpoint must match it. Request cooldown/rate rules remain shared and enforced across purposes.
2. **Existing-account OTP login only:** `POST /v1/auth/email/verify` requires an existing active eligible account. It no longer requires DOB or registration consent and cannot create a UID. Unknown emails receive a safe non-account-creating response. **No real email sent**; development-only private outbox unchanged.
3. **Atomic new registration:** `POST /v1/auth/signup/register` consumes a signup-purpose OTP and commits the new immutable UID, verified email link, reverse provider link, user settings, **Argon2id password verifier**, and first opaque 24-hour session in one conditional DynamoDB transaction. DOB/18+ and consent checked only here. Concurrent registration uses the existing OTP transaction replay guard.
4. **NIST target password policy:** new set/register/change/reset requires 15 or more Unicode code points after NFC canonicalization; no mandatory symbols, case or digits; 64+ accepted (up to 256 code points and 1024 UTF-8 bytes). Legacy password hash verification retains an exact-raw fallback for legacy non-NFC hashes. Existing 8–14-character passwords can still sign in but cannot be chosen for new writes. No forced periodic rotation. A **small offline blocklist** exists, but full vetted commonly compromised password coverage remains a PRODUCTION BLOCKER.
5. **Flutter state isolation:** Sign up displays DOB/consent and create/confirm password, then routes to account home on atomic success. Email-code login displays only email/code, no DOB/consent; password login returns account home; changing password requires explicit Password settings. Recovery includes a confirm field; Android test dismisses keyboard before scrolling/tapping Reset.
6. Existing OTP-only accounts remain eligible to sign in using OTP and to add a password to the **same** UID. Password change/reset still revoke existing sessions via `sessionEpoch`. The opaque 24-hour token remains memory-only until P01-3.

## Implemented decisions / unresolved production dependencies

- The recommendation defaults Q01–Q10 in the design audit were adopted for P01-2 implementation where local-only execution permits. In particular, **password is required on every NEW registration**; legacy OTP-only accounts remain supported. There is no incomplete persistent account from an abandoned signup.
- Real production-grade breached-password corpus, real email delivery, Google identity, HTTPS, provider email/link policy, and end-to-end external verification are **NOT implemented or approved**. These are release blockers, not passing tests. Local OTP outbox is for development only.
- P01-3 questions Q11–Q20 (30-day reauthentication/deadline, fixed versus sliding renewal, replay/lost-response, Android secure storage and device session policy) remain open. **Do not implement P01-3 or P02 from this update.**

## Automated-first evidence (authoring environment)

| Gate | Result |
|---|---|
| `npm run verify:p01-2:portable` after source/docs changes | **PASS** — P00 regression, P01-1/P01-2 source contracts, 16 Node units, 10 P01-2 automation guards, docs/security/cloud checks |
| `node` TypeScript syntax parsing in P01-2 contract | **PASS** for routes and password module |
| Full semantic `npm run typecheck` | **BLOCKED** — attempted, failed TS2688 because `@types/node`/project dependencies are absent in authoring environment; not a verified code typecheck |
| Flutter analyze/widget tests | **UNVERIFIED** — Flutter SDK unavailable here |
| Real Fastify + Java DynamoDB Local integration | **UNVERIFIED** — local database/process unavailable here |
| Physical Android P01-2 E2E | **UNVERIFIED** — owner device required; previous historical run FAILED before this update |
| P01-1 Android OTP E2E | **Known FAILED historical exception**; not a P01-2 PASS |

## Owner Windows run order

Start Java DynamoDB Local manually on port 8000 and Fastify (`npm run dev:api`) on port 3000, in separate terminals. Then execute **all feasible automated checks before manual checks**:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:db
npm run test:integration
npm run test:p01:integration
npm run test:p01:password:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

If a device test repeatedly fails, preserve the failed log and use `docs/qa/MANUAL_VERIFICATION_ESCALATION.md` to request focused manual evidence; never claim the full automated gate passed. For manual UI smoke *after* automated checks, run `npm run dev:flutter` and verify:

1. Sign up with a fresh email using local test outbox; DOB/consent and create/confirm are required; no current-password form; account home appears after commit.
2. Log out, log in by password (no code), account home only.
3. Log out, choose Email code; enter only email+OTP; **no birthdate/consent**, and return to same `uniqueId`.
4. Unknown email with Email code must never create a user; guide to Sign up.
5. Forgot password shows new+confirm fields; Reset is visibly tappable with keyboard closed; old password rejected and new password works.
6. Change password in Settings, then reauthenticate; previous sessions revoked. Old 8–14 character **existing** password signs in if present but cannot be set/reset as new.

Do not share OTP, email test fixture, local dev key, password, or bearer tokens in chat. Record the outcome of each manual action separately from automation.
