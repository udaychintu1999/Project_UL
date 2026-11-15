# P01-2 formatted Dart: remaining two contract assertions

**Date:** 2026-11-15  
**Scope:** Verification script and documentation only; no API, Flutter, Kotlin, dependencies, database or protocol changes.

## Owner-reported failure

After applying the earlier P01-2 formatting-contract patch, `npm run verify:p01-3:portable` passed 16 of 18 P01-2 automation checks. The two remaining failures were strict single-line assertions in `scripts/verify/p01-2-automation.test.mjs`:

1. `newAccount: decoded['newAccount'] is bool` — the formatter moves `decoded[...]` to a new line.
2. `onChanged: (_) => touchedField('auth-recovery-code')` — the Dart callback may use additional whitespace or line breaks.

The owner-provided diagnostic output shows the intended field mapping and inline-validation callback remain present and semantically unchanged. Earlier checks, including 25 backend unit tests, had already passed; the portable runner stopped on these two supplemental structural checks.

## Minimal remedy

Replaced these two formatting-dependent text assertions with narrowly scoped patterns that allow whitespace and line wrapping. The first now requires the complete `bool` type check, `decoded['newAccount'] as bool` true branch, and `null` false branch. The second still requires `onChanged`, an ignored callback parameter, and the exact `touchedField('auth-recovery-code')` action. No blanket whitespace stripping or removal of assertions was used.

Added a permanent test covering two formatting layouts and six negative controls (wrong type, wrong response branches, wrong callback keys, wrong callback event).

## Local validation performed

- Reconstructed project from the current verified workspace, incorporating the frontend readability ZIP's formatted `auth_screen.dart` and `auth_service.dart`.
- `node --test scripts/verify/p01-2-automation.test.mjs`: **PASS 19/19**.
- `npm run verify:p01-3:portable`: **PASS**, including P01/P01-2/P01-3 source guards, unit tests, docs and safety checks.
- No app source files are shipped; new assertion patterns are behavior-sensitive, and their negative controls passed.

**Not run in this environment:** Windows project typecheck, Flutter analyzer/widget tests, real DynamoDB Local integration, or physical Android E2E. The owner should run these gates from the canonical working tree.

## Windows verification from the project root

```powershell
node --test scripts/verify/p01-2-automation.test.mjs
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
```

With local DynamoDB Local, Fastify, and a connected Android device, optionally run the full `npm run verify:p01-3` suite. Do not relabel the documented P01-1 Android OTP E2E owner-accepted local-only failure as PASS.
