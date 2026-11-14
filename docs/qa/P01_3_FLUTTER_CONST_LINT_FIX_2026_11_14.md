# P01-3 — Flutter `prefer_const_constructors` lint correction (2026-11-14)

## Owner evidence

`npm run test:flutter` stopped during `flutter analyze` with one informational issue: `prefer_const_constructors` at `apps/flutter_app/integration_test/persistent_session_integration_test.dart:18:19`. Widget tests did not execute in the reported run.

## Minimal correction

Change the P01-3 integration-test API adapter construction from `DeviceSessionApi(base)` to `const DeviceSessionApi(base)`. The `DeviceSessionApi` constructor is declared `const`; the `base` value is compile-time constant (`String.fromEnvironment`). No production behavior or security protocol changes.

## Verification status

- Static source check: PASS — exactly one `const DeviceSessionApi(base)` at the affected line; SDK constructor confirmed const in source.
- Flutter analyzer and widget test runner: UNVERIFIED in authoring environment (Flutter SDK not available).
- Full P01-3 Fastify/DynamoDB and physical Android integration: NOT RETESTED by this one-line repair.
- P01-3 remains implemented in source, not owner-accepted. P01-2 remains owner-accepted.

## Windows acceptance

```cmd
npm run test:flutter
```

If this passes, continue the previously defined P01-3 gates with Java DynamoDB Local and Fastify running:

```cmd
npm run verify:p01-3:portable
npm run typecheck
npm run test:p01-3:integration
npm run test:flutter:p01-3:e2e
npm run verify:p01-3
```

Do not run or report these commands as PASSED without Windows output.
