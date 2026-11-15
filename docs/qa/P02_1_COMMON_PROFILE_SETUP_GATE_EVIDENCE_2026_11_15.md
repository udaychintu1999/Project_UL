# P02-1 — Common Profile, Mode Selection & Setup Gate Evidence (2026-11-15)

## Scope and current verification

- **SOURCE_IMPLEMENTED:** Local Fastify `PUT /v1/profiles/me/setup` conditional write with account restrictions; GET dashboard private shared data, computed age and server-owned setup readiness; Flutter common form / enable switches / separate details / gated Continue / ready placeholder; real integration and Android test scenarios extended.
- **AUTOMATED_VERIFIED in authoring:** `npm run verify:p02-1:portable` **PASS**, including 33 Node API unit tests (3 new onboarding cases) and P00/P01 regressions, existing P02 contract and navigation tests, documentation, secrets and cloud guards. TypeScript global transpile syntax on changed backend files **PASS**; syntax parsing is not semantic typechecking.
- **UNVERIFIED in authoring:** TypeScript semantic `npm run typecheck` (project dependencies not installed), ESLint, `npm run test:flutter` (Flutter SDK unavailable), real Fastify/Java DynamoDB Local integration (owner service/.env unavailable), updated physical Android E2E, updated manual phone flow. These must not be reported as passing.
- **Owner history received:** Prior `npm run test:p02-1:integration` **PASS**, prior `npm run test:flutter:p02-1:e2e` **PASS**, prior 40 Flutter widgets **PASS**, earlier P02 Home/Settings **MANUAL_VERIFIED** per owner. Owner reported a TS18046 error before prior navigation repair; subsequent current semantic check evidence not received. These earlier passes do not certify this new setup code.
- **No table/schema replacement, no new dependency, no actual media upload, no AWS/payment/production action.**

## Evidence boundaries and open risks

- Self-declared broad-city text is permitted to finish **onboarding**, but is *not* trusted geospatial data for P02-3/P03. Profile activation remains blocked pending photo and locality eligibility.
- `selectedModes` are setup intent only, never discovery visibility and never account membership flags.
- A shared/display name is distinct from a mode nickname; existing draft names are preserved. The first no-shared-name UI load may suggest a legacy mode name but requires explicit save.
- Gender is optional, stored in private Settings, and is not published or used for eligibility.
- No automated test performed a full real Flutter UI/DB/device journey in this authoring environment. Owner Windows verification is the gating task.

## Exact next checks

See `docs/manual/P02_1_COMMON_PROFILE_WINDOWS_ACCEPTANCE_2026_11_15.md`:

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

`dev:api` and the manually started Java DynamoDB Local must be running for the last two gates. Continue with P02-2 only after owner feedback/acceptance.
