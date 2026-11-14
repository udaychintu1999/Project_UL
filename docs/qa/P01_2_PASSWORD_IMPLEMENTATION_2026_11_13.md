# P01-2 password implementation — QA evidence (2026-11-13)

## Scope
Implemented local-only password attachment to already OTP-verified immutable account, password login, password change, separate recovery OTP challenge/outbox and reset, epoch-based session revocation, Flutter password/OTP/recovery UI and negative/concurrent integration fixtures. 18-table schema preserved. P01-3 persistence deliberately excluded.

## Actual authoring-container checks
- `node --experimental-strip-types --test apps/api/tests/unit/passwordPolicy.test.ts`: **PASS**, password boundary and denylist policy.
- `npm run verify:p01-2:portable`: **PASS** after source and doc updates (P00 portable + P01-1 source contracts + P01-2 source contracts).
- `node --check scripts/verify/p01-password-integration.mjs` and Node TypeScript strip syntax check: **PASS**.
- Safe offline ZIP packager and ZIP integrity check: record result upon packaging.

## Explicitly unverified
- Real `@node-rs/argon2` installation/package lock resolution; npm registry unreachable in this environment; `npm install` timed out and offline lock-only install reported ENOTCACHED. Owner must run `npm install` and commit regenerated lockfile.
- Semantic `npm run typecheck` after dependency installation, real Argon2 hashing, Fastify/DynamoDB P01-2 integration, Flutter analyzer/widget and USB device behavior: **UNVERIFIED** here. No Node dependencies/Flutter SDK/Java local DB/device available in this container.
- P01-1 Android OTP E2E remains earlier owner-reported **FAIL**, with owner manual account access/log out PASS; do not relabel. The new P01-2 manual acceptance is unverified until reported.
- Real email/SMS, Google provider, TLS production transport, persisted 30-day renewals, broad breached-password corpus and final identity-provider verification: **NOT IMPLEMENTED / OUT OF THIS SLICE**.

## Exit criteria
Mark P01-2 complete only after owner reports clean local typecheck, real Fastify+DynamoDB integration, Flutter tests and manual end-to-end verification or accepted narrow unresolved automation exception. Escalate to owner manual test after recurring device automation failure rather than iterative speculative patches. Overall P01 remains PARTIALLY_VERIFIED; P02 untouched.

## Windows feedback / follow-up correction (2026-11-13)

Owner successfully installed Argon2 dependencies; `verify:p01-2:portable` and Flutter analyze/21 tests PASS. Full TypeScript compile uncovered four extra closing braces in password transaction calls, reported as 33 parser errors. Corrected in a narrow subsequent ZIP and added a Node TypeScript syntax gate. Post-repair authoring portable checks PASS; full Windows compile and real password API integration still need owner verification. See `docs/qa/P01_2_PASSWORD_TYPESCRIPT_SYNTAX_REPAIR_2026_11_13.md`.
