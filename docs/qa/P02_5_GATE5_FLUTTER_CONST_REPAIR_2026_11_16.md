# P02-5 — Windows Flutter analyzer Gate 5 repair (2026-11-16)

**Status: focused source repair made; Windows Flutter/runtime acceptance pending.** This addendum supersedes no previous P02-4 owner acceptance. P02-5 remains NOT fully verified until the complete verifier passes and manual visual acceptance is performed.

## Owner evidence

- `npm run verify:p02-5:portable` — PASS (including 40 backend unit tests and seven existing P02-5 source/verifier contracts).
- `npm run typecheck`, `npm run lint`, `npm run test:p02-2:store` — PASS in owner logs.
- `npm run test:flutter` — analyzer reported **five `prefer_const_constructors` info-level issues** at `apps/flutter_app/test/p02_5_visual_reference_test.dart` lines 59–61; no widget tests executed by the fail-closed wrapper.
- `npm run verify:p02-5` — P02-5 gate 1 PASS; nested P02-4 gates 1–4 PASS; **P02-4 gate 5 FAIL**, and later DB/Android gates NOT RUN. The owner retried with the same results.

## Root cause and remediation

All five Flutter analyzer findings arise from one 320dp visual test fixture: `Scaffold`, `SafeArea`, `SingleChildScrollView`, `Padding`, and `Column` were constructed without `const` despite having const-compatible arguments. The test's `Column` children were already a const list. Change only that fixture's `home: Scaffold(...)` to `home: const Scaffold(...)`; the nested widgets thereby inherit const context. No application production code is changed.

A new offline regression assertion was added to `scripts/verify/p02-5-visual-contracts.test.mjs`, requiring the fixture's transitive const root. This adds one guard but **is not a substitute** for a real Flutter analyzer and widget execution on Windows.

## Windows acceptance

Merge update-only ZIP at repository root, preserving existing configs and local media; dependencies are unchanged.

```powershell
npm run test:flutter
npm run verify:p02-5
```

Start Java DynamoDB Local, Fastify and a USB Android test device before the second command. The complete verifier reruns all P02-4 local integrations and three distinct isolated Android suites. **Do not mark P02-5 PASS until `P02-5 ... PASSED` appears after all gates.** Review screenshots manually against the reference pack; native SAF gallery selection is a separate manual acceptance check. If any additional Flutter runtime failure appears, preserve the first failing test/error and do not infer later gates passed.

## Safety

No production source, backend route, database table, authentication, model, local media, cloud or payment change. No `.env`, private data or reference PNGs in this patch.
