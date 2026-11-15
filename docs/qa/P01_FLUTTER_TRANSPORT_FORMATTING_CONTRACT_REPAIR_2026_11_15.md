# P01 Flutter Transport Source-Contract Repair — 2026-11-15

## Scope and observed failure

The owner reported `npm run test:flutter` passing with 37 widget tests and no analyzer issues. Next, `npm run verify:p01-3:portable` stopped in `scripts/verify/p01-source-contract.mjs` at the exact-string assertion for `request.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8')`. The failure occurred after the frontend readability/formatting update.

The verifier compared raw source snippets using `indexOf`, which is sensitive to Dart formatter line wrapping. A line-wrapped header call can remain correct Dart but be rejected by the source guard. The user's exact checked-out Dart bytes were not provided with the log, so the original formatting difference cannot be independently established beyond the observed assertion.

## Change delivered

Only `scripts/verify/p01-source-contract.mjs` was edited. It now matches Dart HTTP sender calls with whitespace-tolerant expressions, checks that all required header calls occur **before** `request.add(payload)`, and retains explicit verification of:

- UTF-8 `jsonEncode(body)` payload preparation before send
- `Content-Length` and disabled persistent connection before send
- `Accept: application/json`
- `Content-Type: application/json; charset=utf-8`
- Local developer outbox header on the development path
- Bearer authorization header for authenticated requests

No API or Flutter production code, token handling, database schema, rate limits, security settings, or dependency files were changed.

## Verification evidence

Reconstructed the latest relevant source from supplied project and incremental update archives, including the previously verified P01-3 code, API readability/verifier improvements and Flutter readability update. Restored the historical test fixture files matching the current P01-2 source contracts **only within the disposable reconstruction**, not in this deliverable.

- `node scripts/verify/p01-source-contract.mjs`: **PASS**.
- `npm run verify:p01-3:portable`: **PASS** in the reconstructed workspace, including 25 backend unit tests, all 17 P01-2 automation-contract tests and P01-3 structural/security source checks.
- Positive control: reformatting the content-type call across multiple lines: **PASS**.
- Negative control: moving the content-type header after the payload write: **rejected**.
- Negative control: changing `utf-8` to `utf-16`: **rejected**.
- Negative control: removing the bearer header: **rejected**.
- Negative control: moving the development header after body write: **rejected**.
- Negative control: removing `Content-Length`: **rejected**.

These checks were run on the source reconstruction, not the owner's full Windows checkout. Full Flutter and live Android testing cannot run in this container. The owner's Flutter analyzer and 37 widget tests were already reported passing before this verifier-only patch.

## Windows acceptance

From the repository root after overlaying this ZIP:

```powershell
npm run verify:p01-3:portable
npm run typecheck
npm run test:flutter
```

With Java DynamoDB Local, Fastify and physical Android connected, run the already established full regression gate if desired:

```powershell
npm run verify:p01-3
```

If another source-contract failure appears, repair the formatting-sensitive **assertion**, not the correctly formatted application source. Never remove a real security requirement merely to make a test pass.
