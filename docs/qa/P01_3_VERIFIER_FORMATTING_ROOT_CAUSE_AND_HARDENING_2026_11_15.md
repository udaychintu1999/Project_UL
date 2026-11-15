# P01-3 — Formatting-Verifier Root Cause and Permanent Regression Guard

**Date:** 2026-11-15  
**Scope:** Verification script and documentation only. No API/Flutter/Kotlin logic, schemas, auth settings, or installed dependencies changed.

## Owner-reported failure

After the Flutter code-quality pass, the owner repeatedly ran `npm run verify:p01-3:portable`. Earlier source-pattern failures were fixed sequentially. The latest run passed all 25 backend unit tests and all 19 P01-2 automation-contract tests, then failed at `scripts/verify/p01-3-source-contract.mjs` because it expected `/signedOut:true/` but the Flutter source contained `signedOut: true` after formatting.

This failure was **a verifier defect**, not evidence of an application runtime regression. `npm run test:flutter` had independently passed analysis and 37 widget tests in the earlier owner logs.

## Why the earlier patches kept repeating

The old repair workflow fixed the first failing string assertion without validating the **entire** portable verification chain against the **same formatted source version** used by the owner. Reconstructed workspaces could contain the compact, older Dart layout and falsely indicate the issue was finished. The final P01-3 verifier was never fully protected against formatter output.

## Corrective changes

The P01-3 structural verifier now:

- Matches the actual sign-out intent `before.copyWith(signedOut: true)` across compact, spaced, and multiline Dart formatting, including an optional trailing comma.
- Requires persistence of the signed-out intent through `vault.write(jsonEncode(signedOut.toJson()))`, rather than treating the bare word `signedOut` as sufficient evidence.
- Checks the production `persistentMode: true` setting independently of whitespace.
- Preserves P-256, Android Keystore, AES-GCM, DynamoDB CAS, account `sessionEpoch`, 30-minute access, 30-day reauthentication, and no-scan/no-refresh-grace assertions.
- Executes positive and negative formatter self-tests as part of the **existing** mandatory P01-3 portable command.
- Uses concise failure messages rather than echoing the entire source file into the terminal.

## Verification evidence (local reconstructed project)

| Gate | Result |
| --- | --- |
| `node scripts/verify/p01-3-source-contract.mjs` | PASS |
| `npm run verify:p01-3:portable` with latest P01-2 contract repair merged | PASS |
| Full portable chain against a formatting-only copy with `signedOut: true` and multiline `persistentMode` | PASS |
| P01-2 automated source checks within both full runs | 19/19 PASS |
| Backend unit tests within full runs | 25/25 PASS |
| Five synthetic contract mutations (signed-out flag, sealed sign-out write, persistent mode, CAS, hard reauthentication window) | All correctly FAIL the P01-3 verifier |
| P01-3 intrinsic formatting/semantic self-tests | PASS |
| Flutter analyzer and Android E2E *after this verifier-only patch* | NOT RUN in this environment |

The formatting-only copy and negative-control mutation were disposable test inputs, **not** delivered application changes.

## Owner Windows verification

Apply the ZIP at project root, preserving relative paths. Run:

```powershell
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
```

The full device integration gate `npm run verify:p01-3` remains available when the owner wants a complete rerun, using the usual local Fastify, Java DynamoDB Local and USB Android setup. The previously documented P01-1 Android OTP automation exception remains in effect; no result was renamed to PASS.

## Release discipline

Do not ship follow-up patches based only on the first reported assertion. First merge the owner's most recent formatter output and prior patches, audit remaining source assertions, run the *whole* portable suite, repeat with a formatting variant, and test negative controls. A passing older source snapshot is not valid evidence for a new formatted source tree.
