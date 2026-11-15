# Source Contract Tests — Formatting-Invariant Development Policy

Applies to the U_luv backend, Flutter frontend, developer scripts, and test fixtures.

## Why

`dart format` and `prettier` legitimately add spaces, wrapping, and trailing commas. A source-contract check should fail for an actual behavior or security-rule regression, **not for formatting alone**.

## Required practices

1. **Use executable tests first.** Flutter analyzer/widget tests, TypeScript compilation, real DynamoDB integration, and physical Android E2E are authoritative for their respective behaviors. Text source checks are supplemental, not proof of runtime correctness.
2. **Prefer parsers/ASTs for complex invariants.** For simple local source checks, accept whitespace and formatting-only trailing commas but continue matching exact field names, operators, order, endpoints, and security requirements.
3. **Do not blanket-remove all whitespace.** That can alter string or regex literals and conceal mistakes. Keep patterns narrowly scoped to known expressions.
4. **Do not weaken a failing assertion just to get green.** Confirm the source expression still implements the approved contract. Add a negative-control test for an important invariant whenever practical.
5. **Check rendered-state sequencing.** In Flutter widget tests, ensure `await tester.pump()` follows a `tester.enterText` when asserting values updated by `setState`. Keep actual hit-test and interaction checks in the device/widget tests.
6. **Don't change application code to satisfy a text-format assertion.** Change the verifier if it rejects equivalent, formatter-produced source syntax.
7. **Avoid logging auth secrets.** Do not include tokens, passwords, OTPs or private `.env` contents in source-contract failure output or QA documentation.
8. **Do not classify structural passes as device passes.** Owner-run Windows/Android checks remain explicit release gates, with prior exceptions retained transparently.

## Verification sequence

```powershell
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
npm run verify:p01-3
```

The final command requires the existing local Java DynamoDB and Fastify services plus a connected Android device. It is not a background task.


## P01-2 Flutter checks to retain

- The `AuthResult.newAccount` mapping must retain the exact `decoded['newAccount'] is bool ? decoded['newAccount'] as bool : null` semantics. `dart format` may split this across multiple lines; do not require a one-line match.
- The recovery-code field must retain `onChanged: (_) => touchedField('auth-recovery-code')`. Accept line wrapping and formatter-only trailing commas without accepting an alternate field or callback event.
- Protect every relaxed source assertion with a contrasting negative-control test (e.g., `is String` instead of `is bool`, or `onSubmitted` instead of `onChanged`).
- A complete formatting-only frontend change should be verified once with both `npm run test:flutter` and `npm run verify:p01-3:portable` before being packaged.

## P01-3 hardening (2026-11-15): avoiding the repeated one-failure-at-a-time cycle

The complete `verify:p01-3:portable` chain must be run **after all earlier patches are merged into the same workspace** and before a corrective ZIP is delivered. A successful run against an older, compact copy of the Flutter sources does **not** verify the actual reformatted sources.

P01-3 structural checks must recognize equivalent Dart layouts such as `signedOut:true`, `signedOut: true`, and a multiline `copyWith(signedOut: true,)`. Match the *operation* (`before.copyWith(...)`) and its sealed persistence (`vault.write(jsonEncode(signedOut.toJson()))`), not only a field name that might appear in unrelated code. Likewise, the production entry-point check accepts spacing and line breaks around `persistentMode: true` but must reject `false`.

Each future source-contract refactor must include all of the following evidence:

1. Run the complete portable chain with the actual current frontend and backend tree, not only the failing test or a stale reconstruction.
2. Run the same chain against a temporary formatting-only variant, so `dart format` cannot silently break a later stage of verification.
3. Run negative controls that change a protected value or operation and confirm a nonzero exit code.
4. Keep assertion messages short and descriptive; do not dump entire authentication source files into CI logs.
5. Verify the update-only archive has no application source, environment files, generated build output, or accidental dependency changes.

Source-contract checks are supplementary. They are not a substitute for `flutter analyze`, widget tests, API tests, or physical Android E2E when those are relevant to an actual behavior change. For a verification-script-only patch, do not represent unexecuted Android tests as passed.
