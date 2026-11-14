# API readability update — change and verification report

**Owner-supplied baseline:** `api.zip` (the exact uploaded API snapshot; not a guessed Git revision).  
**Scope:** P00/P01-1/P01-2/P01-3 local API TypeScript source and six unit-test files.  
**Nature of change:** whitespace, indentation, line wrapping, and comments only; no intentional logic or behavior change.  
**Target project paths:** `apps/api/...`.  
**Secrets:** `.env` was present in the supplied archive but was **excluded** from extraction into the update and from delivery. `.env.example`, `package.json`, and `tsconfig.json` are unchanged.

## Results

| Check | Result | Evidence |
|---|---|---|
| TypeScript parse and executable-AST equivalence | **PASS — 20 of 20 files** | Compared every original and updated TypeScript source/test AST, retaining node kinds, order, identifiers, string/regex/numeric/template literal contents and operator nodes; ignored comments/positions |
| Original unit suite | **PASS — 25/25** | `node --experimental-strip-types --test tests/unit/*.test.ts` in original extracted API |
| Updated unit suite | **PASS — 25/25** | Same command against updated API |
| Project `tsc --noEmit` | **UNVERIFIED here** | The isolated upload omitted `node_modules`/`@types/node`; compiler fails with `TS2688: Cannot find type definition file for 'node'` before semantic checking |
| Real DynamoDB, Fastify, full root project and physical Android | **UNVERIFIED in this package** | Only `api.zip` was supplied. Owner should rerun existing root verification with project dependencies, Java DynamoDB Local, Fastify and phone |
| Runtime dependencies and environment secrets | **UNCHANGED** | No package, lockfile, `.env`, `.env.example`, endpoint, DB schema or credential changes |

The executable AST comparison is stronger than merely checking whether code parses; it catches modified expressions, statement order, public route strings, guard conditions, transaction text, and literal values. It does not replace a full TypeScript compilation or integration test in the owner's complete repository.

## Human-reviewable source changes

| TypeScript file | Before lines | After lines | AST match |
|---|---:|---:|---|
| `src/app.ts` | 59 | 102 | Pass |
| `src/config.ts` | 24 | 39 | Pass |
| `src/db.ts` | 15 | 15 | Pass |
| `src/domain/rules.ts` | 39 | 52 | Pass |
| `src/features/auth/device-session-policy.ts` | 31 | 37 | Pass |
| `src/features/auth/device-sessions.ts` | 136 | 324 | Pass |
| `src/features/auth/email-budget-policy.ts` | 42 | 46 | Pass |
| `src/features/auth/email-budget.ts` | 62 | 76 | Pass |
| `src/features/auth/password-policy.ts` | 39 | 42 | Pass |
| `src/features/auth/password.ts` | 200 | 400 | Pass |
| `src/features/auth/policy.ts` | 52 | 54 | Pass |
| `src/features/auth/routes.ts` | 231 | 432 | Pass |
| `src/local-safety.ts` | 19 | 28 | Pass |
| `src/server.ts` | 10 | 10 | Pass |
| `tests/unit/authPolicy.test.ts` | 46 | 46 | Pass |
| `tests/unit/email-budget.test.ts` | 56 | 58 | Pass |
| `tests/unit/localSafety.test.ts` | 21 | 32 | Pass |
| `tests/unit/p01-3-device-session-policy.test.ts` | 32 | 33 | Pass |
| `tests/unit/passwordPolicy.test.ts` | 23 | 30 | Pass |
| `tests/unit/rules.test.ts` | 37 | 37 | Pass |

The large authentication modules were deliberately **not** split across new files. No exported symbol, function name, route, query expression, schema key, hard-coded value or return path was refactored. A future module split should be tracked as a separate task with full integration coverage.

## Documentation and tooling changes

- New `apps/api/README.md` — module introduction and existing Windows commands.
- New `apps/api/docs/MODULE_AND_ROUTE_MAP.md` — current route ownership and security boundaries.
- New `apps/api/docs/READABILITY_AND_MAINTAINABILITY_GUIDE.md` — coding/comment conventions, deliberate constants inventory and review checklist.
- This report — exact comparison scope, method and limitations.
- New `apps/api/.editorconfig` — editor-only whitespace preferences.
- Updated `apps/api/src/features/README.md` — reflects implemented P01-1, P01-2 and P01-3 rather than only the earlier OTP module.

## Commands to run after applying in the full Windows repository

Run from the root containing `apps/api` and the project's root scripts:

```powershell
npm run typecheck
npm run verify:p01-3:portable
```

With manually started Java DynamoDB Local, the local Fastify API and a connected Android device:

```powershell
npm run verify:p01-3
```

Confirm no changes in API responses or P01-3 persistent login behavior. Historical P01-1 Android OTP automated failure remains the previously owner-accepted local-development exception, **not a PASS**.

## Release decision

This is a **readability-only proposal verified for AST identity and the standalone 25-unit suite**. It is not a new functional feature or proof of completed Windows/Android integration. Keep this as a separate commit from behavior-changing P02 work.
