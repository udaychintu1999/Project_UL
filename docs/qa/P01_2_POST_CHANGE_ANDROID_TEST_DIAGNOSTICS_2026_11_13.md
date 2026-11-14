# P01-2 Android post-password-change E2E — targeted diagnostics (2026-11-13)

## Owner Windows evidence, before this update

- `npm run verify:p01-2:portable`: **PASS**, including P00/P01-1 regression, P01-2 source/automation contracts and all seven existing automation guards.
- `npm run typecheck`: **PASS**.
- `npm run test:flutter`: Flutter analyzer **PASS**, **25 widget tests PASS**.
- `npm run test:p01:password:integration`: **PASS** with real Fastify + Java DynamoDB Local (password create/change/recovery, Argon2id, account restrictions, session-epoch revocation and immutable ID).
- `npm run test:flutter:p01-2:e2e`: **FAIL** on physical Android at `password_integration_test.dart:115`, expecting successful password login but receiving `Incorrect email or password.`

**Important diagnosis:** Line 115 is the **second login after password change**, not the first login of the test. The Android test had already successfully signed in with the original password, checked account access, changed the password and confirmed that the original password was rejected. The updated password then failed. The previous fixture preflight only checked the **original password before Android started**; it could not validate the password change.

## Targeted change (test-only; production app/backend unchanged)

1. After Android submits `Change password` and receives success, the test now calls the real password-login endpoint **from Android via the same `HttpAuthService`**, using the updated synthetic password. It immediately logs out this temporary probe session. If it fails, the failure is classified as **post-change credential/backend/API behavior** rather than a Flutter text-entry issue.
2. The test observer verifies that the Flutter UI actually supplied the exact synthetic email/current password/new password to the service callback for login and change. Equality only is reported; no passwords, OTPs, tokens, developer keys, request bodies or hashes are logged.
3. The widget suite adds the precise regression sequence: login → password change → reject old password → accept new password. This tests a screen-state transition the earlier widget tests missed.
4. The P01-2 automation contract enforces the presence of both device-side probe and widget regression, so the evidence cannot quietly regress to P00-only buttons or fixture-only preflight.

No production API, database schema, Argon2id parameters, Android app source, Flutter auth service or 24-hour token logic changed. No P01-3 implementation or cloud integration.

## Result interpretation

- **Post-change API probe fails:** Updated password is not accepted by the Android API client; review Fastify/password-change transaction or exact input at change (the observer checks it) and any server-side logs. Do not assert a UI typing bug without more evidence.
- **Post-change API probe passes but subsequent UI-login input assertion fails:** Flutter focus/controller/autofill or test input submission differs from the synthetic fixture; isolate the input transition without modifying backend credentials.
- **API probe passes and submitted UI values match but UI login returns 401:** Investigate session/rate/transport/server state or non-determinism between successive requests; do not invent a proven root cause.
- **Device test passes:** Run full `npm run verify:p01-2` and then perform the approved manual P01-2 UI acceptance checklist.

## Execution and evidence limits

Run in Windows CMD from the project root, with Java DynamoDB Local started manually and Fastify kept running in another terminal:

```cmd
npm run verify:p01-2:portable
npm run typecheck
npm run test:flutter
npm run test:p01:password:integration
npm run test:flutter:p01-2:e2e
```

If Android passes, run `npm run verify:p01-2` and only afterward owner manual acceptance (`npm run dev:flutter`). If Android fails repeatedly after this targeted split, **request a focused manual post-change test** using the existing login/password-settings UI, preserving automated FAIL status under `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.

**New physical Android result:** UNVERIFIED until the owner reruns. No owner credentials should be shared. P01-2 remains PARTIALLY_VERIFIED. P01-1 has a separate known automation exception; P01-3 and P02 not started.
