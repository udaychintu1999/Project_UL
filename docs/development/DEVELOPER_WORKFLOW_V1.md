# U_luv — Developer workflow V1 (local, source-preserving)

**Status:** developer tooling prepared for Windows installation; runtime behavior unchanged. P01-3 is owner-accepted for local development, and P02 has not started. This document does **not** authorize production cloud services, database changes, or Flutter changes.

## Which packages are actually useful?

| Package | Decision | Reason |
|---|---|---|
| `tsx` | **Already installed; retain** | `npm run dev:api` uses `tsx watch`, so a second process watcher (`nodemon`) is redundant. |
| `dotenv` | **Already installed; retain** | API `config.ts` already imports `dotenv/config`; Node's `--env-file` also loads variables for verification scripts. Do not load or print a private `.env` in tooling. |
| `pino-pretty` | **Add as dev-only CLI** | Fastify already logs with Pino and redacts sensitive fields. Optional CLI formatting makes local JSON logs readable without changing the logger or production behavior. |
| `eslint` + `typescript-eslint` | **Add as root dev tools** | Detect obviously unsafe/unreachable code and warn about unused declarations in TypeScript. Keep `npm run typecheck` as the semantic type gate. |
| `prettier` | **Add as root dev tool** | Stable manual formatting/check commands. **No blanket format-on-save, no mass reformat, and no new formatting requirement in existing P01 verification gates.** |
| `nodemon` | **Do not add** | Duplicates `tsx watch`. |
| `morgan` | **Do not add** | Duplicates built-in Fastify/Pino HTTP request logging. |
| `cross-env` | **Do not add** | Current scripts avoid shell-specific inline environment assignments; portable Node scripts handle environment settings. |

## One-time setup on Windows (from project root)

1. Overlay the update-only ZIP; **keep existing `.env`, dependencies, and local database files**.
2. Run `npm install` with npm registry access. This resolves the four **new development-only** dependencies and **regenerates `package-lock.json`**. The provided archive deliberately omits the lockfile: the authoring container could not reach the npm registry, and publishing a guessed lockfile would be unsafe.
3. **Review and commit the npm-generated `package-lock.json` together with `package.json`.** Do not use `npm ci` until they are synchronized. Subsequent clean installs use `npm ci` once lockfile is committed.
4. Run `npm run test:dev-workflow`, `npm run check:dev`, and `npm run verify:p01-3:portable`. The *full* local DB/Android regression remains `npm run verify:p01-3` when those services/devices are available.

> `npm install` updates dependency resolution and the lockfile. Inspect the diff; reject unexpected production-dependency upgrades. This update adds no production dependencies. Do not install any dependency globally or with `npx` network fallback.

## Daily commands

| Command | Purpose |
|---|---|
| `npm run dev:api` | **Existing** automatic server restart on TypeScript edits (`tsx watch`) |
| `npm run typecheck` | **Existing** API semantic TypeScript check |
| `npm run lint:api` | ESLint for API source and policy tests |
| `npm run lint:scripts` | ESLint for `.mjs` automation scripts |
| `npm run lint` | Both lint scopes |
| `npm run check:dev` | TypeScript check then lint, no code modification |
| `npm run format:api:check` | **Opt-in** Prettier report; may show existing unformatted baseline code |
| `npm run format:api:write` | **Manual only** formatting of API TypeScript; run full regressions and review diff afterward |
| `npm run format:scripts:check` | **Opt-in** check on automation scripts; existing scripts are not mass-formatted |
| `npm run test:dev-workflow` | Offline, dependency-free tooling configuration contracts |
| `npm run verify:p01-3:portable` | Existing project regression and safety guards |
| `npm run verify:p01-3` | Existing real DB/Android acceptance verifier |

### Optional readable logs (PowerShell)

Start Java DynamoDB Local manually first, as usual. In a separate PowerShell terminal:

```powershell
npm run dev:api | npm run logs:pretty
```

This **only formats console output**. Fastify continues to emit its original JSON logs; no application logger configuration, redaction, request shape, or privacy behavior changes. Use plain `npm run dev:api` if the pipeline behaves differently in your terminal, and do not copy logs containing identifiers/secrets into issues. `pino-pretty` is for local development only.

## Formatting and lint policy — staged adoption

- **Never** automatically run `prettier --write .`; the accepted P00–P01 code, Flutter sources, canonical docs, and verifier fixtures must not be rewritten as collateral changes.
- ESLint intentionally begins with high-signal rules (`no-debugger`, unreachable code, unsafe `finally`, constant binary expressions) and unused TypeScript **warnings**. Tightening to type-aware rules requires a separate audited change and regression pass.
- `format:api:check` is **not part of `check:dev`** or `verify:p01-3`. Existing files from the earlier mechanical readability pass may fail its style check until intentionally formatted with full follow-up tests.
- Do not change route strings, transaction conditions, token protocol, quotas, `uniqueId`, secret redaction, or local/remote guards while formatting. The previous regex-contract failure is why every formatting change must run `npm run verify:p01-3:portable` and then the actual Windows integration gates.
- No pre-commit hook is installed, so checks are explicit and cannot unexpectedly block urgent local developer work.
- Use `.editorconfig` for whitespace conventions and `.prettierrc.json` for optional TypeScript formatting. Flutter continues to use `dart format`/`flutter analyze`, not Prettier.

## Expected verification and limitations

- The authoring environment verified the **unchanged** existing P01-3 portable chain and new dependency-free tooling contracts.
- The registry is unreachable here: **ESLint, Prettier and pino-pretty were not installed or executed**. Their invocations and exact lockfile resolution require the owner's Windows run.
- This is a developer-experience change, **not** production readiness or a P02 feature. The documented P01-1 Android OTP automation exception remains `FAILED` (owner-accepted local-only exception).

## Primary references

- Node.js CLI environment-file/watch flags: https://nodejs.org/api/cli.html
- Fastify's built-in Pino logging and redaction: https://fastify.dev/docs/latest/Reference/Logging/
- ESLint + TypeScript tooling: https://typescript-eslint.com/getting-started/
- Prettier CLI `--check` and `--write`: https://prettier.io/docs/cli
