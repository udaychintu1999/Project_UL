# U_luv — P01-2 Flutter Source-Contract Formatting Repair

**Date:** 2026-11-15  
**Scope:** Verification scripts and documentation only; no Dart, Kotlin, TypeScript API, database, configuration, or dependency changes.  
**Status:** Portable verification passed in a reconstructed local workspace; Windows owner rerun and device gate pending.

## Observed Windows failure

After the frontend readability pass, the owner reported that `npm run test:flutter` passed `flutter analyze` and 37 Flutter widget tests, but `npm run verify:p01-3:portable` stopped at four assertions in `scripts/verify/p01-2-automation.test.mjs` (13/17 passed). These source-pattern checks assumed exact compressed text, for example:

- `if (accountPanel == 'setup' || accountPanel == 'create')` all on one line;
- `validate(['auth-email','auth-recovery-code','auth-recovery-password','auth-recovery-confirm'])` without formatting spaces or line breaks;
- the widget-test title and `tester.enterText` calls without Dart formatter wrapping;
- `find.byKey(const Key('auth-me')),findsOneWidget` and compact `expect(service.verifies,1)` assertions.

The actual app/test behavior was **not shown to be failing** by these errors. Do not label the full verification as passed on the owner's workstation until rerun.

## Repair

Changed only `scripts/verify/p01-2-automation.test.mjs`:

1. Accept whitespace/newline wrapping for the *same* account setup/change expressions and authenticated account widget checks.
2. Match the *exact* recovery validation field sequence with optional Dart trailing comma; no omitted or reordered fields accepted.
3. Find the named recovery widget test regardless of `testWidgets` line wrapping; verify that each required `tester.enterText` call is followed by `await tester.pump()` before reading rendered inline errors.
4. Accept whitespace/newline wrapping around existing OTP widget counters and account assertions.
5. Add an explicit positive/negative formatter-compatibility test.

## Local verification evidence

- `node --check scripts/verify/p01-2-automation.test.mjs` — **PASS**.
- `node --test scripts/verify/p01-2-automation.test.mjs` — **18/18 PASS** against the compact frontend snapshot.
- Same test suite against a temporary simulated multiline Dart layout — **18/18 PASS**; original files restored afterward.
- `npm run verify:p01-3:portable` — **PASS** (including 25 backend unit tests, P01/P01-2 contracts, security checks and P01-3 structural gate).
- Temporary deliberate mutations were each rejected: account `||` changed to `&&`, recovery confirmation removed, recovery widget pump removed, authenticated account assertion changed. Original files restored after every mutation.

**Not verified here:** Flutter SDK execution, full TypeScript semantic compilation, live DynamoDB/Fastify, or real Android E2E. Those are owner Windows gates. The existing P01-1 Android OTP exception is not reclassified.

## Owner Windows commands

From the repository root after applying this two-document + one-script update:

```powershell
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
```

Only once those pass, run `npm run verify:p01-3` with Fastify, Java DynamoDB Local, and the physical Android device running. Preserve the previously accepted P01-3 behavior and continue P02 only after the checkpoint is verified.
