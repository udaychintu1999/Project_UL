# P01 — Windows T1/T3 verification failure repair (2026-11-13)

## Scope and evidence provenance

Owner provided Windows logs after applying the first P01 email-OTP implementation. The real Fastify + Java DynamoDB Local API integration **PASSED** and exercised validation, OTP issuance/rate limiting, self-declared age/consent, concurrent registration and immutable UID, account restriction, sign-out/re-entry, and revoked sessions. Flutter `analyze` **PASSED** with no issues; **8 widget tests passed**. `verify:p01:portable` **PASSED** with 14 Node unit tests, 2 local guards, 9 CLI stubs, 3 environment-init tests, plus contracts, docs and security checks.

Two actual failures were observed:

1. `npm run typecheck`: TypeScript TS2345, `apps/api/src/features/auth/routes.ts` line 131, `sessionDigest(secret, token)` received a value typed as `string | undefined`. The private development secret is guarded at runtime, but its inferred optional type was not preserved as a concrete string inside a nested handler. This patch changes the local initialization to a `string`-typed value (`config.devToken ?? ''`) **without weakening the existing 24-character minimum and local/test mode rejection**. It does not generate a new secret or change the environment.
2. `npm run test:flutter:p01:e2e`: USB/ADB reverse, Android build/install and test launch succeeded, but the integration test then found **zero widgets keyed `auth-local-code`** after requesting the local development outbox. The original Flutter auth screen used `ListView(children:...)`: Flutter may not build an out-of-viewport descendant in a lazily constructed list, especially with the software keyboard visible. This is a plausible UI/test interaction cause, **not proven to be the sole cause** because the earlier test did not assert the outbox API response. The patch uses a scrollable eagerly built `Column`, dismisses keyboard before actions, adds a 320×480 narrow-viewport widget regression, and asserts that the local outbox API reports success **before** attempting to read the code. If outbox access is actually denied, missing, or offline, the new test surfaces that failure rather than an opaque widget-not-found error.

`npm run verify:p01` also failed because it stopped at the broken typecheck before proceeding to its remaining gates. The Gradle Java native-access warnings shown during the Android build were warnings, not the reason for test failure.

## Changed application and test files

- `apps/api/src/features/auth/routes.ts` — explicit non-optional local secret type, preserving existing runtime validation and session authorization.
- `apps/flutter_app/lib/features/auth/auth_screen.dart` — reliable short-form construction and keyboard dismissal without removing scrolling.
- `apps/flutter_app/integration_test/auth_integration_test.dart` — outbox success assertion to distinguish backend failures from hidden widget failures.
- `apps/flutter_app/test/auth_widget_test.dart` — narrow-viewport code visibility regression fixture, no external provider.

No new DynamoDB table/index/scan, AWS integration, Google verification, payment operation, source credential, generated APK or production identity shortcut was added.

## Verification after repair

**Executed in authoring Linux container:** `npm run verify:p01:portable` **PASS**: 14/14 unit tests, 2/2 endpoint guards, 9/9 synthetic CLI tests, 3/3 config-init tests and existing P00 + P01 source, documentation, environment, secrets and cloud guards. This is **offline-only**, not a TypeScript semantic compile or Android test.

**Not executable in authoring environment:** `npm run typecheck` with full dependencies, `npm run test:p01:integration` with live owner Java DB/API, Flutter analyzer/widget tests, USB Android integration, complete `verify:p01`. **All post-patch checks remain UNVERIFIED pending owner Windows rerun.** The prior owner successful P01 API integration is historical evidence for the *pre-patch* source, not proof the patched ZIP passes live integration.

## Windows acceptance commands

From the repository root, extract the corrective ZIP over the installed project without deleting `.env`, `.git`, DynamoDB data or Android folders. Run:

```powershell
npm run typecheck
npm run test:flutter
npm run verify:p01:portable
```

Keep manually started Java DynamoDB Local on port 8000 and Fastify (`npm run dev:api`) on port 3000. For manual interactive checks, connect the USB phone and run `npm run dev:flutter`; test the sign-in screen end to end. **Stop that interactive Flutter run before the automated device command** (both use Flutter on the same phone). The automated command already configures ADB reverse and launches its own test app:

```powershell
npm run test:p01:integration
npm run test:flutter:p01:e2e
npm run verify:p01
```

Finally optionally run `npm run verify:p00` to repeat the complete P00 regression suite. The combined `verify:p01` already runs P00 portable tests and P00 device/API checks, but does not substitute for the original manual P00 outage/recovery observation. No P02 work should begin. Do not report P01 `CORE_FLOW_VERIFIED` before actual post-patch T1/T2/T3 logs are available; full phase requirements also remain incomplete.
