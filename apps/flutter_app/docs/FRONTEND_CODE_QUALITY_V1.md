# U_luv Flutter — Frontend Code Quality and Maintainability V1

**Scope:** `apps/flutter_app/`. This is the Flutter counterpart to the accepted API readability cleanup and backend Developer Workflow V1. It is a **readability/tooling-only** checkpoint, not P02 feature development.

## Purpose and constraints

1. Keep all accepted P01-1/P01-2/P01-3 behavior unchanged: requests, response contracts, navigation decisions, token generation, local endpoint restrictions, Keystore cryptography, refresh/revocation, validation, and test assertions.
2. Favor readable, small, logically grouped code, one responsibility per method, and comments that explain *why* security/transaction behavior exists—not comments repeating every line.
3. Use `dart format` (Dart), `flutter analyze` (lint/static analysis), and `flutter test` (widget/regression). Do not add ESLint, Prettier, Morgan, Nodemon, `dotenv` or `pino-pretty` to Flutter. Those are JavaScript/server tools or duplicates of Flutter capabilities.
4. Make formatting changes separately from behavior changes. **Never auto-format the full app as a side effect of launching or testing.**
5. Keep the existing root `npm run dev:flutter` / `npm run verify:p01-3` entry points, because they implement the USB reverse, local API guards and full real-device validation.

## What this checkpoint changes

- Expanded `lib/main.dart` and `lib/features/auth/persistent_gate.dart` from compact widget trees into clearer sections. The actual expression, arguments, and control flow remain the same.
- Normalized a portion of punctuation spacing in `auth_service.dart`, `auth_screen.dart`, `persistent_session.dart`, `persistent_gate.dart` and `diagnostics_service.dart`; did not rename fields or APIs.
- Added module/lifecycle comments explaining session restoration, protected storage, refresh-token consumption, local-only networking, password UI separation, OTP idempotency, and native channel error safety.
- Added `.editorconfig` for consistent indentation and line endings. Existing analyzer rules stay in place to avoid introducing unverified new warnings.
- Added `tool/flutter-workflow.mjs` with explicit `quick`, `analyze`, `test`, `format:check`, `format:write`, and `verify` actions; no new packages, no direct device runner.

## Daily commands — from project root

| Command | Effect | Mutates code? |
|---|---|---|
| `node apps/flutter_app/tool/flutter-workflow.mjs quick` | Flutter analysis + widget tests | No |
| `node apps/flutter_app/tool/flutter-workflow.mjs analyze` | Flutter analysis only | No |
| `node apps/flutter_app/tool/flutter-workflow.mjs test` | Widget tests only | No |
| `node apps/flutter_app/tool/flutter-workflow.mjs format:check` | Reports Dart formatter differences | No |
| `node apps/flutter_app/tool/flutter-workflow.mjs format:write` | Runs official Dart formatter on `lib/`, `test/`, `integration_test/` | **Yes — explicit only** |
| `node apps/flutter_app/tool/flutter-workflow.mjs verify` | Opt-in formatting check + analyze + widget tests | No |
| `node --test apps/flutter_app/tool/tests/*.test.mjs` | Tests the developer-command wrapper | No |
| `npm run dev:flutter` | Existing safe device launcher with ADB reverse | Build/generated artifacts only |
| `npm run test:flutter` | Existing project Flutter analysis + widget tests | Build/generated artifacts only |
| `npm run verify:p01-3` | Full project/API/Android regression gate | Test fixtures only |

`quick` is the recommended automatic gate while the source tree is not yet fully Dart-formatted. The **full formatting check is opt-in**, because Dart formatting on the inherited tree will probably produce differences and may expose formatting-sensitive source assertions. Run `format:write` only in a dedicated reviewed commit, and run the entire root P01-3 verifier afterward.

## Working practices

- Do not convert immutable internal `uniqueId`, API keys, route names, storage format version, UI keys, field keys, Keystore aliases, session timeouts, slot count, or OTP quotas to new config variables just because they look hard-coded. Most are **shared protocol/business contracts**. Changing them is a feature/security change, not readability cleanup.
- Prefer file-by-feature organization: auth UI, HTTP clients, persistent session coordinator, Android vault bridge, diagnostics. Only create more files when a tested and reviewed separation is useful.
- Keep device signing and encryption exclusively in `android/app/src/main/kotlin/.../MainActivity.kt`, not in Dart or debugging utilities.
- Never log bearer/refresh tokens, passwords, OTPs, signatures, request bodies or arbitrary server response messages.
- Prefer `mounted` checks after async Flutter operations, and preserve single-flight session refresh and logout-precedence rules.
- Separate local form validation (UX) from authoritative server checks (eligibility, quotas, state transitions).
- Keep comments accurate after future refactoring; outdated security comments are more harmful than omitted ones.
- New dependencies require an explicit reason, lockfile review and a full verification cycle. This checkpoint introduces **none**.

## Hard-coded values and ownership (not modified)

| Value or path | Owner | Why not changed |
|---|---|---|
| `ULUV_API_BASE_URL`, loopback/emulator addresses, local-only HTTP | Flutter launcher and HTTP clients | Prevent unintended remote access and secret disclosure |
| Device channel `uluv/p01_3_secure` and method names | Flutter + Kotlin | Native wire protocol; both sides must change together |
| Keystore aliases / AES-GCM / P-256 proof content | Android + backend | Crypto identity and encrypted storage format |
| Sealed record `v: 1`, `slot`, `generation` | Flutter + backend | Versioned session schema |
| Five session slots; 30-day reauthentication / short access-token window | Backend contract | Product/security decisions; cannot be altered by formatting |
| OTP code length, NIST password length, field keys, UI test keys | P01 forms/backend/tests | API, validation and automation contract |
| P00 route strings and debug token expectations | Fastify + diagnostics | Local test-only protocol |

## Required acceptance for further work

1. Run `node --test apps/flutter_app/tool/tests/*.test.mjs` and `node apps/flutter_app/tool/flutter-workflow.mjs quick` on Windows.
2. Run `npm run verify:p01-3:portable` and `npm run typecheck`; correct any **formatter-sensitive test** rather than reverting valid spacing or changing product logic.
3. With Fastify, Java DynamoDB Local and Android available, run `npm run verify:p01-3`.
4. Do a brief manual restore/logout/offline-retry smoke test if any UI source file changed. No P02 coding in this checkpoint.

## Limitations of this handoff

The current workspace has **no Dart/Flutter SDK**, so it cannot run `dart format`, `flutter analyze`, Flutter widget tests or native Android tests. Source parity is checked through a conservative executable-token comparison with comments and whitespace excluded. This is useful regression evidence but does **not** replace Flutter compilation or real-device checks. Do not mark this checkpoint Windows-verified without the owner's logs.
