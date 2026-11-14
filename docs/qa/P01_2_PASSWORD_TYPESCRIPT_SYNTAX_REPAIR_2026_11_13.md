# P01-2 — Password transaction TypeScript syntax repair (2026-11-13)

## Owner Windows evidence (before repair)

- `npm install`: **PASS**, 2 packages added, npm audit reported 0 vulnerabilities. Owner-generated `package-lock.json` remains local and is not included in this update-only ZIP.
- `npm run verify:p01-2:portable`: **PASS**, including P00/P01-1/P01-2 source, safety, documentation checks.
- `npm run test:flutter`: **PASS**, analyzer 0 issues and 21 Flutter tests passed.
- `npm run typecheck`: **FAIL**, 33 TypeScript parser errors in `apps/api/src/features/auth/password.ts`; first error at line 66, repeated near 119, 142, and 183. These are compilation errors; no live P01-2 password test has been demonstrated.

## Confirmed source cause and change

Four `TransactWriteCommand({TransactItems:[...]})` calls used the invalid closing sequence `]}}));` (one extra closing brace), causing cascading parser errors. Corrected each to `]}));`. This is a syntax-only change: DynamoDB transaction items and conditions, API routes, credential policy, schema, authentication decisions, and Flutter behavior remain unchanged.

The earlier P01-2 source-contract test checked strings but did not parse TypeScript. It could therefore incorrectly pass malformed syntax. Strengthened `scripts/verify/p01-password-contract.mjs` by executing `stripTypeScriptTypes` from Node 22 `node:module` (actual SWC parse) as a dependency-free syntax gate before static source assertions.

## Verification performed in authoring container

- `node:module.stripTypeScriptTypes` on corrected password file: **PASS**. Note: `node --check` on a `.ts` file may report success even for malformed TypeScript, so it is NOT used as the protective guard.
- TypeScript parser `createSourceFile(...).parseDiagnostics` on all 10 backend TypeScript modules: **0 diagnostics**.
- Isolated synthetic external-declaration semantic check for the modified password module: **PASS**; this is NOT the same as full app typecheck with the real npm dependencies.
- `npm run verify:p01-2:portable`: **PASS**, including the new syntax gate.
- Negative mutation test: reintroduced one malformed transaction delimiter in temporary working-source fixture; revised P01-2 contract **FAIL** as intended. Restored corrected source; contract **PASS**.
- `node --check scripts/verify/p01-password-contract.mjs`: **PASS**.
- Full `npm run typecheck`: **UNVERIFIED** here (backend npm dependencies and `@types/node` unavailable; owner's installed dependencies are not mounted in this environment).
- Real Fastify + Java DynamoDB Local password integration: **UNVERIFIED**, requires the owner's running services.
- Flutter/physical-device runs **after** this patch: **UNVERIFIED**; the owner's pre-repair Flutter analyzer/21 widget tests passed.

## Windows acceptance instructions

Apply the update-only ZIP at the project root (preserving `.env`, node_modules, data, and the owner's npm-generated `package-lock.json`), then run:

```cmd
npm run typecheck
npm run verify:p01-2:portable
npm run test:p01:password:integration
npm run test:flutter
```

Keep the existing Java DynamoDB Local process on port 8000 and Fastify on port 3000 for live integration. If the full typecheck reports additional errors, do not claim the phase is verified; capture only the sanitized errors and repair them before further gates. After the live tests, perform the manual password registration/login/change/recovery checklist in `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md`, including manual fallback under the established policy. Do not silently waive the previously failed P01-1 Android OTP automated E2E test.

## Status

**P01-2: PARTIALLY_VERIFIED**, pending full Windows TypeScript, real password integration, and manual acceptance. P01-3 (30-day persistent sessions) and P02 **not started**.
