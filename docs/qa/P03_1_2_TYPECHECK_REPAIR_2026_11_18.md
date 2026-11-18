# U_luv P03-1 + P03-2 — Acceptance Test Typecheck Repair (2026-11-18)

## Scope and baseline

- Based on the owner-uploaded `Project_UL-master(3).zip`, the P03-2 infrastructure update and the subsequent P03-1/P03-2 acceptance-suite update.
- **Production Flutter/API code is not modified.** No database migrations, cloud changes, or P01/P02 documentation changes.
- Fixes the **first failed full Windows verification gate** reported by the owner, not a runtime production defect.

## Root causes of reported TypeScript errors

1. The `call(...)` test helper passed `payload?: unknown` directly to `app.inject(...)`. Fastify's supported `InjectPayload` type does not admit an arbitrary `unknown` or `null` value. Because the call did not match the injection overload, TypeScript could not infer a completed response and reported follow-on `statusCode`, `body`, `json` and `rawPayload` failures.
2. The fixture cleanup loop attempted array destructuring (`[TableName, Key]`) on objects shaped like `{TableName, Key}`. It now uses object destructuring.

The helper now JSON-serializes each provided payload, adds `Content-Type: application/json`, and awaits `app.inject(...)` before returning the response. Calls with no payload omit it entirely. The test still exercises actual Fastify routes, DynamoDB Local and the same response assertions.

## Fail-fast improvement

The full P03 acceptance runner now puts the **strict TypeScript test-compilation gate first** (previously gate 4 after all portable tests). The existing 11 full gates remain present and in the runner. A dedicated orchestrator regression test verifies that a compilation failure aborts before the other gates run.

## Authoring-environment verification

- PASS: TypeScript transpile/syntax diagnostics for the patched local DB test.
- PASS: Isolated strict TypeScript validation of the corrected injection-helper typing against the compatible request/response shape (not the installed Fastify declaration package).
- PASS: 48 P03 source-contract tests when excluding the live-API test, which intentionally requires a running local service and `.env`.
- PASS: Project documentation check (`42 required paths, 18 phase documentation contracts, 18 unique tables`).
- PASS: Verification plan now lists the strict test typecheck as full gate 1/11.
- **Not run here:** `tsc --noEmit -p apps/api/tsconfig.p03-acceptance.json` with real `node_modules`, live Fastify/DynamoDB Local, Flutter analyzer/widgets, Android E2E. This environment could not install npm dependencies (`EAI_AGAIN` from npm registry). Do not mark the full acceptance complete based on the above checks.

## Windows verification — from the project root

Run the **fast failing gate first**, using existing `node_modules` from your successful `npm ci`:

```powershell
npm run test:p03:acceptance:types
```

Then with Java DynamoDB Local started manually, 18 tables provisioned, your local Fastify server running in another terminal, and the moto g04s attached:

```powershell
npm run verify:p03:acceptance
```

If a new gate fails, send its full error output. Do not skip failing gates, modify production authentication to suit a synthetic fixture, or change verified release assets to satisfy a test.

## Separate observation

The `npm ci` output reported 11 dependency vulnerabilities. These are **not** the TypeScript errors fixed here. Review with `npm audit` before production deployment; avoid blanket `npm audit fix --force` upgrades that could disrupt the locked P01/P02 implementation.
