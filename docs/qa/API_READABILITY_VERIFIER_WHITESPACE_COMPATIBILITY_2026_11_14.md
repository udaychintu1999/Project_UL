# U_luv — API readability verifier compatibility fix (2026-11-14)

## Scope and observed failure

After the owner applied the API readability-only ZIP, `npm run verify:p01-3:portable` failed in `scripts/verify/source-contract.mjs` because the regular expression `/config\.env==='local'/` required tightly packed source syntax, while the formatted app has `config.env === 'local'`. The exact local-only condition was not changed. This was a false failure in a source-shape assertion.

Other portable contracts also depended on compressed spacing for known expressions, and the cloud guard expected a credential literal without whitespace between properties. Such tests must check *security-relevant expressions*, not a formatter's spaces.

## Changes in this checkpoint

- `source-contract.mjs`: accept spaces around strict-equality in the local-only diagnostic route condition.
- `cloud-operation-guard.mjs`: accept whitespace around property colons and commas while still requiring both local placeholder credentials.
- `p01-source-contract.mjs`: require consistent reads and the local-only OTP outbox registration with spacing-tolerant assertions.
- `p01-password-contract.mjs`: retain consistent-read, password minimum, local-only recovery outbox, and login/signup verification assertions while allowing formatting.
- `p01-3-source-contract.mjs`: retain exact 30-minute and 30-day constants and device-access digest wiring while allowing whitespace.
- `p01-2-automation.test.mjs`: retain login/signup isolation, typed DynamoDB transactions and existing-email rejection checks without assuming minified expressions.

**No changes** to Fastify source, Flutter/Dart, database schema, transactions, secrets, configuration, auth rules, or runtime code. No test or security assertion was removed to make this pass; formatting-sensitive assertions were adapted to still enforce the same contract.

## Tests actually executed in reconstructed repository

- `npm run verify:p01-3:portable` — **PASS** after the verifier changes: 25 backend unit tests, P00/P01-2 regressions, 17 P01-2 automation checks, P01-3 structural checks, documentation and cloud/secret guards.
- Negative-control mutations (temporarily applied and then fully restored) — all **REJECTED**: (1) change local environment gate to production, (2) change the DynamoDB local placeholder access key, (3) lower the minimum password length from 15 to 8, (4) change the 30-minute access-token lifetime to 2 hours.
- ZIP contents and integrity are verified separately.

**Limitation:** The reconstructed repo was assembled from project baseline and successive change archives, and one stale P01-1 Android test overlay was corrected using its existing E2E-harness archive solely for local verification. No Flutter file is included in this patch. The authoritative final check is on the owner's current Windows working tree.

## Owner's Windows verification

1. Extract this patch at project root, preserving the paths below, without overwriting `.env`, dependencies, or data.
2. Run `npm run verify:p01-3:portable` first. It should reach the final P01-3 source-contract PASS.
3. Then run `npm run typecheck` and, if desired, the comprehensive `npm run verify:p01-3` with Fastify, DynamoDB Local, and physical Android available.
4. The pre-existing owner-accepted P01-1 Android OTP automation exception remains explicitly recorded and is **not** silently reclassified as PASS.

## Forward development practice

Prefer formatter-independent semantic checks. Where a source-presence contract is appropriate, use explicit `\s*` around syntax whose whitespace is insignificant. Verify fail-closed behavior with targeted negative cases; never weaken cloud-locality, session expiry, cryptography, rate-limit or registration guards solely to accommodate formatting.
