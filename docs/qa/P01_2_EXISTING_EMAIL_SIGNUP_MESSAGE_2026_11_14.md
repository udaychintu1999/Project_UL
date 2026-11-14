# U_luv — P01-2 existing-email signup notice and identity timing

**Date:** 2026-11-14. **Scope:** signup OTP request UX and tests only; P01-3 and P02 not implemented.

## Owner request and existing behavior

The backend already checked whether the normalized signup address had an email identity link before issuing an OTP. Existing accounts received a neutral acknowledgement, without a new code or a quota debit. The owner explicitly requested a visible **email already registered** message instead. This patch changes only the response and associated UI while retaining the no-send behavior.

## API / Flutter contract

- On `POST /v1/auth/email/request` with `purpose=signup`, an existing linked email returns HTTP **409** and `{"error":"email_already_registered"}` before touching the OTP challenge or the shared 5-code rolling-24-hour budget. The lookup uses strongly consistent DynamoDB GetItem; on a signup race/conditional rejection, the backend re-reads the identity link.
- For a new signup email, normal OTP issuance is unchanged, including cooldown, idempotency, limits, 10-minute expiry and local dev outbox.
- Unknown email OTP login and ineligible recovery retain neutral responses. No provider, user identity, account status, token, password or DOB is disclosed in the error.
- Flutter translates the error to **“This email is already registered. Log in or use Forgot password.”** It keeps OTP/registration forms hidden and renders **Go to Log in**, preserving the entered email.
- The immutable `uniqueId` is still allocated by the server upon successful signup; no new handle or name is created here.

## Security note: explicit account enumeration risk

This requirement makes it possible for an unauthenticated user to learn whether an email is registered. It intentionally **supersedes** the earlier privacy-neutral signup design and is **not recommended for a public release without further protection**. The 5-code quota cannot stop account-existence probing: an already-registered address does not consume a code or a quota entry. A separate public-release security decision must consider signup-probe throttling (per-IP/per-device, proxy-aware), bot prevention, abuse alerting, and whether a neutral response until email ownership is verified is preferable. Never suggest that this risk has been resolved by the existing email-issuance quota.

## User name / unique identifier phase boundary

- **P01:** email, DOB/18+ gate, consent, password, backend-generated immutable opaque `uniqueId`. It is never chosen by the user or used as a public profile display name.
- **P02:** define public display-name/profile-name collection and the optional `@handle`, including whether Dating and Friendship use independent names. The physical schema already contains a conditional `HANDLE#normalized` mapping in `uluv_users`; exact P02 field requirements and timing are not yet finalized.
- **P01-3:** persistent/re-authentication sessions, unrelated to profile names.

## Verification and evidence

Owner's prior full P01-2 local Windows/Android verification passed; P01-1 Android OTP E2E remains a separately documented manually accepted development-only automation exception. **Post-patch** authoring container: `npm run verify:p01-2:portable` PASS (includes 17 automation contract tests); TypeScript/JS syntax parsing checks PASS. Flutter SDK, project npm dependencies, real Java DynamoDB Local and physical Android device were not available in the authoring container. Consequently **TypeScript semantic compilation, live Fastify/DynamoDB, Flutter analyzer/widget, Android E2E remain UNVERIFIED after this patch.**

Windows automated-first run (Java DynamoDB Local and Fastify already running):

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:p01:email-budget:integration
npm run test:p01:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

Then manual: request signup code for existing email, verify message appears immediately with Go to Log in, confirm no new code/consumed slot; choose login and confirm email is preserved; request signup for a new synthetic email and complete signup; check OTP login and recovery still work. Preserve all previously verified password-change flows.
