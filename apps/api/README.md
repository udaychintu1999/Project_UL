# U_luv API — local development and code map

This directory contains U_luv's **existing** Fastify/TypeScript API. The current implementation is deliberately **local/test only**, with Java DynamoDB Local. It must not silently enable real AWS, a production email provider, or payment operations.

## Where to start

- `src/app.ts` — Fastify composition, health endpoints, local DB diagnostics, feature registration, safe error handler.
- `src/config.ts` — fail-closed environment and host validation; `src/local-safety.ts` — loopback-only DynamoDB and local media rules; `src/db.ts` — document client.
- `src/features/auth/routes.ts` — email-code login/registration, account lookup, authorization and logout.
- `src/features/auth/password.ts` — password setup/login/change/recovery.
- `src/features/auth/device-sessions.ts` — P01-3 renewable, device-bound sessions and device management.
- `src/features/auth/*-policy.ts`, `src/features/auth/policy.ts`, `src/features/auth/email-budget.ts` — password/OTP/device rules and server-enforced shared email quota.
- `src/domain/rules.ts` — existing domain policy helpers used by future phases.
- `tests/unit/` — pure policy and local-safety regressions.

See [module and route map](docs/MODULE_AND_ROUTE_MAP.md), [coding guide](docs/READABILITY_AND_MAINTAINABILITY_GUIDE.md), and [change/verification report](docs/READABILITY_CHANGE_REPORT.md).

## Local developer commands

From the **repository root** (which contains the project's root `package.json`):

```powershell
npm run typecheck
npm run verify:p01-3:portable
```

For integration and device tests, first start Java DynamoDB Local **manually** and run the local API as already established:

```powershell
npm run dev:api
```

From a separate PowerShell/Command Prompt session, with the expected local services running:

```powershell
npm run verify:p01-3
```

The full verifier includes the previously accepted P01-2 regression suite and requires the attached physical Android environment. The historical P01-1 Android OTP automation exception remains separate.

Do not replace `apps/api/.env` or installed dependencies when applying readability-only updates. Never commit or share `.env` or private credentials. This package deliberately **does not include `.env`**.

## Scope of the readability pass

This update changes **whitespace, line wrapping and comments only** in `.ts` files. No route paths, export names, constants, API responses, authorization rules, DynamoDB expressions, session/token behavior or cryptographic settings were changed. There is no module or file split: moving functions across files would require broader regression review. Existing literal values are listed in the guide, not refactored.
