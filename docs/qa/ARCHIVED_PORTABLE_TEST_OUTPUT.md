# Archived previous-version portable test output (not v2.0 execution evidence)

```text

> uluv@0.0.1 verify:p00
> node scripts/verify/p00-verifier.mjs


=== Domain unit tests ===

> uluv@0.0.1 test:unit
> node --experimental-strip-types --test apps/api/tests/unit/*.test.ts

TAP version 13
# (node:5437) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: canonical pair remains direction independent
ok 1 - canonical pair remains direction independent
  ---
  duration_ms: 0.8351
  type: 'test'
  ...
# Subtest: women monthly 4, other users monthly 2
ok 2 - women monthly 4, other users monthly 2
  ---
  duration_ms: 0.156424
  type: 'test'
  ...
# Subtest: two distinct paid Dating actions and unpaid ordinary like
ok 3 - two distinct paid Dating actions and unpaid ordinary like
  ---
  duration_ms: 0.096854
  type: 'test'
  ...
# Subtest: distance band boundary inclusivity
ok 4 - distance band boundary inclusivity
  ---
  duration_ms: 0.195502
  type: 'test'
  ...
# Subtest: limits and 7-day expiry
ok 5 - limits and 7-day expiry
  ---
  duration_ms: 0.597204
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 96.268116

=== Source contract ===

> uluv@0.0.1 test:contracts
> node scripts/verify/source-contract.mjs

PASSED: P00 API route declarations, explicit DynamoDB calls, guarded local route, Flutter source contract

=== Handoff docs ===

> uluv@0.0.1 test:docs
> node scripts/verify/docs-check.mjs

PASSED: 27 required paths, 18 phase guides, all six sections, 18 unique tables
Portable checks PASSED. IMPORTANT: DynamoDB Local/API/Flutter are not included in this claim.

```
