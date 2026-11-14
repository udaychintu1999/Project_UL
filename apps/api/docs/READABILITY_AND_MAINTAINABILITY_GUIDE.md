# API readability and maintainability guide

Status: **developer convention for the existing U_luv local API**, recorded after P01-3 owner acceptance. Applies to subsequent maintenance unless an explicit phase contract overrides a convention. This guide does **not** authorize behavior or schema changes.

## Principles

1. **Preserve behavioral contracts.** API methods/paths, status codes, response/error strings, validation conditions, field names, DynamoDB keys, transaction conditions, token lifetimes and security checks are contracts. A formatting request cannot change them.
2. **Prefer readable flow over clever density.** Two-space TypeScript indentation, blank lines between conceptual steps, multiline nested objects/transactions, one statement per line, and short guard clauses where they remain clear. Preserve the order of operations and short-circuit evaluation.
3. **Comment the *why*, not every operation.** Comments should explain transaction invariants, replay protection, account-enumeration trade-offs, migration behavior, local-only boundaries, and failure recovery. Avoid narrating obvious assignments or documenting an intended behavior that the source does not implement.
4. **Name business concepts carefully.** Existing names and public exports were deliberately kept unchanged in this pass. Future renames require cross-file symbol searches, tests, and explicit review if serialized schema or public API exposure is possible.
5. **Keep boundaries visible.** `app.ts` composes modules; `routes.ts` owns email auth and session middleware; `password.ts` owns credential lifecycle; `device-sessions.ts` owns P01-3 family transitions; `*-policy.ts` files contain deterministic/pure rules; `email-budget.ts` wraps the atomic budget+challenge write. Do not introduce empty repositories, services or abstractions solely for architecture aesthetics.
6. **Protect secrets and privacy.** No token, password, OTP, private key, raw email subject hash, or recovery credential in logging, examples, test output or error messages. Public signup's existing-account `409` is a deliberate current product trade-off, not a general authorization to reveal account membership elsewhere.
7. **Test the behavioral invariant, not formatting.** A structural/token/AST check is useful as a first gate, but run unit/typecheck and integrated Windows/Android gates before accepting any later logic-adjacent cleanup.

## Authoring conventions

- Use clear line breaks for nested Fastify handlers and `TransactWriteCommand` items; align conditional checks, expressions and values so reviewers can audit them together.
- Keep `try/catch`/`finally` blocks expanded. Distinguish expected conditional transaction failure from actual storage unavailability.
- Use JSDoc at exported or security-sensitive boundaries; add short comments above important transaction and revocation steps. Do not add vague filler comments.
- Prefer explicit TypeScript types when inference produces incompatible conditional DynamoDB transaction unions, as previously encountered in P01-2. Never weaken type safety to quiet a formatter.
- Keep pure policy functions deterministic and timezone-independent where already intended; do not change UTC semantics.
- Keep rate limiting **on the server**, not Flutter. The Flutter client may validate form fields for UX, but it is not the enforcement boundary.
- Keep all local-only endpoint guards. Never infer AWS production capability from environment variables or available credentials.
- Treat the 18-table model and phase boundaries as canonical; no new table or GSI during formatting.

The directory's `.editorconfig` records whitespace conventions. There is intentionally no new formatting dependency or `package.json` script in this pass. Automated format-on-save should always be reviewed for incidental semantic edits.

## Existing values intentionally NOT changed

The request explicitly prohibited changing logic. These examples are intentionally documented rather than centralized or parameterized in this pass:

| Location | Existing rule/literal | Why it stays as-is |
|---|---|---|
| `src/config.ts` | Region `ap-south-1`, loopback host and local/test gate | Existing local SDK/environment contract; not an AWS toggle |
| `src/app.ts` | `uluv_operations`, 16 KiB Fastify body limit, 300-second diagnostic TTL | P00 diagnostics and request limits |
| `src/features/auth/routes.ts` | `uluv_auth_links`, `uluv_users`, `uluv_settings`; public route strings | Existing keys, table mapping and externally visible URLs |
| `src/features/auth/policy.ts` | OTP validation, 10-minute challenge, legacy 24-hour session | Existing OTP/legacy session rules |
| `src/features/auth/email-budget-policy.ts` | 5 eligible code issuances per rolling 24 hours and 60-second cooldown | Shared backend anti-abuse budget, not a UI quota |
| `src/features/auth/password-policy.ts` | 15-character minimum and existing maximum, attempts/cooldown rules | Accepted password rules |
| `src/features/auth/password.ts` | Argon2id settings, password route strings and DynamoDB conditions | Security-sensitive credential storage and revocation behavior |
| `src/features/auth/device-session-policy.ts` | 30-minute access, 30-day reauthentication, 5 devices, `p13-v1` key ID | Accepted P01-3 session protocol |
| `src/features/auth/device-sessions.ts` | Device slot keys, P-256 proofs, generation CAS, family revocation | Token replay defense; changing them requires a new protocol review |
| `src/domain/rules.ts` | Distance bands, entitlement counts, posting limits, seven-day expiry | Current product-domain decisions; not part of an auth refactor |

A later **separate, owner-approved functional refactor** may consolidate genuine duplicate constants/helpers, split route modules, or introduce explicit configuration, with tests for migrations and legacy clients. Do not mix such work into readability-only maintenance.

## Review checklist

- [ ] Compare changed files to the exact owner-supplied version, not a remembered or guessed baseline.
- [ ] Verify method/path names, exported interfaces, constants, error codes, conditions and literal strings are unchanged.
- [ ] Verify `try/catch/finally` order, side-effect order and `await` boundaries are unchanged.
- [ ] Confirm added comments do not mention secrets, invent safeguards or contradict current behavior.
- [ ] Run syntax/AST equivalence and the same unit suite on **both** before/after trees when possible.
- [ ] Run `npm run typecheck`, `npm run verify:p01-3:portable`, then real DB and Android checks on the owner's machine where the toolchain is available.
- [ ] Do not declare the prior P01-1 OTP Android automation exception to be a PASS.
- [ ] Deliver only changed files with project-relative paths; exclude `.env`, binaries, caches and dependencies.
