# Developer tooling V1 — change and verification record (2026-11-14)

**Scope:** root package manifest (four development-only packages), root ESLint/Prettier configurations, npm developer commands, a dependency-free contract test, and developer documentation. **No runtime TypeScript/Dart code, database schema, environment file, or test logic changed.**

Decisions: retain `tsx watch`, existing `dotenv`, and Fastify/Pino; add developer-only `eslint`, `typescript-eslint`, `prettier`, `pino-pretty`; omit `nodemon`, `morgan`, and `cross-env`. Prettier is opt-in: its check is not part of the existing phase acceptance gate.

**Verification:** complete the result table below from actual tool logs. Offline contract and pre-existing portable tests can be executed in the authoring environment. `npm run lint`, `npm run check:dev` and `npm run format:api:check` require npm installation on Windows. Do not call any missing dependency check PASS. Update `package-lock.json` only by normal owner-run `npm install`, then review and commit its diff.

Owner Windows checklist: `npm install`; `npm run test:dev-workflow`; `npm run check:dev`; `npm run verify:p01-3:portable`; and, when local DB/API/Android available, `npm run verify:p01-3`.

### Authoring verification evidence

- `npm run test:dev-workflow`: **PASS**, three offline tests.
- `npm run verify:p01-3:portable`: **PASS**, including 25 Node API unit tests, 17 P01-2 automation-contract checks, P01-3 structural contract, and existing documentation, secret and cloud guards.
- `node --check eslint.config.mjs`: **PASS** (syntax, not tool/runtime loading).
- ESLint, Prettier, and pino-pretty execution: **UNVERIFIED**, registry unavailable in authoring environment; must be installed on Windows.
- `npm run verify:p01-3` (live API/DB + physical Android): **UNVERIFIED after this tooling-overlay change**; prior owner-accepted implementation evidence remains unchanged.
- All TypeScript, Dart, and security verifier implementation files: **unchanged** in the output package.
