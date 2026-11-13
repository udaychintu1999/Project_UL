# Archived previous-version portable test output (not v2.0 execution evidence)

```text
U_luv v1.1 portable tests / environment checks, 2026-11-10
Executed in ZIP-authoring container; no Java DynamoDB Local JAR or Windows PowerShell/Flutter/Android SDK was present.
These results do NOT prove working Java DB, Fastify API runtime, real cloud, store providers or device tests.

$ npm run test:portable (exit=0)

> uluv@0.0.1 test:portable
> npm run test:unit && npm run test:contracts && npm run test:docs && npm run test:environment


> uluv@0.0.1 test:unit
> node --experimental-strip-types --test apps/api/tests/unit/*.test.ts

TAP version 13
# (node:1756) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: canonical pair remains direction independent
ok 1 - canonical pair remains direction independent
  ---
  duration_ms: 1.192535
  type: 'test'
  ...
# Subtest: women monthly 4, other users monthly 2
ok 2 - women monthly 4, other users monthly 2
  ---
  duration_ms: 0.11998
  type: 'test'
  ...
# Subtest: two distinct paid Dating actions and unpaid ordinary like
ok 3 - two distinct paid Dating actions and unpaid ordinary like
  ---
  duration_ms: 0.092519
  type: 'test'
  ...
# Subtest: distance band boundary inclusivity
ok 4 - distance band boundary inclusivity
  ---
  duration_ms: 0.191228
  type: 'test'
  ...
# Subtest: limits and 7-day expiry
ok 5 - limits and 7-day expiry
  ---
  duration_ms: 0.612372
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
# duration_ms 128.196449

> uluv@0.0.1 test:contracts
> node scripts/verify/source-contract.mjs

PASSED: P00 API route declarations, explicit DynamoDB calls, guarded local route, Flutter source contract

> uluv@0.0.1 test:docs
> node scripts/verify/docs-check.mjs

PASSED: 32 required paths, 18 phase guides, all six sections, 18 unique tables

> uluv@0.0.1 test:environment
> node scripts/verify/local-environment-contract.mjs

PASSED: Java-only startup, loopback-only local DB provisioning, P16 payment sandbox, P17 real AWS integration gates


$ npm run verify:p00 (exit=0)

> uluv@0.0.1 verify:p00
> node scripts/verify/p00-verifier.mjs


=== Domain unit tests ===

> uluv@0.0.1 test:unit
> node --experimental-strip-types --test apps/api/tests/unit/*.test.ts

TAP version 13
# (node:1877) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: canonical pair remains direction independent
ok 1 - canonical pair remains direction independent
  ---
  duration_ms: 2.123115
  type: 'test'
  ...
# Subtest: women monthly 4, other users monthly 2
ok 2 - women monthly 4, other users monthly 2
  ---
  duration_ms: 0.216556
  type: 'test'
  ...
# Subtest: two distinct paid Dating actions and unpaid ordinary like
ok 3 - two distinct paid Dating actions and unpaid ordinary like
  ---
  duration_ms: 0.100241
  type: 'test'
  ...
# Subtest: distance band boundary inclusivity
ok 4 - distance band boundary inclusivity
  ---
  duration_ms: 0.306822
  type: 'test'
  ...
# Subtest: limits and 7-day expiry
ok 5 - limits and 7-day expiry
  ---
  duration_ms: 4.087022
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
# duration_ms 174.970202

=== Source contract ===

> uluv@0.0.1 test:contracts
> node scripts/verify/source-contract.mjs

PASSED: P00 API route declarations, explicit DynamoDB calls, guarded local route, Flutter source contract

=== Handoff docs ===

> uluv@0.0.1 test:docs
> node scripts/verify/docs-check.mjs

PASSED: 32 required paths, 18 phase guides, all six sections, 18 unique tables

=== Java-only environment gates ===

> uluv@0.0.1 test:environment
> node scripts/verify/local-environment-contract.mjs

PASSED: Java-only startup, loopback-only local DB provisioning, P16 payment sandbox, P17 real AWS integration gates
Portable checks PASSED. IMPORTANT: DynamoDB Local/API/Flutter are not included in this claim.


$ node --check scripts/db/provision.mjs (exit=0) 
$ node --check scripts/verify/p00-db-direct.mjs (exit=0) 
$ node --check scripts/verify/local-environment-contract.mjs (exit=0) 
$ node --check scripts/verify/docs-check.mjs (exit=0) 

```
