# P02-4 — Windows Gate 5 Flutter const-lint repair (2026-11-16)

**Owner evidence:** `npm run verify:p02-4` passed Gate 4 (`test:p02-2:store`), then stopped at Gate 5 (`test:flutter`) when the Flutter analyzer reported **one** `prefer_const_constructors` info at `apps/flutter_app/test/p02_2_photo_panel_test.dart:29:12`. The verifier correctly stopped: **Gates 6–12 were not executed**. The owner-provided excerpt did not include earlier gate logs beyond the Gate 4 success marker; do not reconstruct a broader test report.

**Root cause:** `FakeMedia.upload()` constructs a `const ProfileMedia` fixture `m`, then returned `ProfileResult.success(m)` without `const`. Its constructor is declared `const ProfileResult.success` in `profile_models.dart`. The project's `npm run test:flutter` treats analyzer info as a failed gate.

**Minimal patch:** Change the test fixture return to `return const ProfileResult<ProfileMedia>.success(m);`. No runtime Flutter UI, Fastify, DynamoDB Local, activation, photo persistence, or security code changed. Added a portable regression assertion to catch this exact missing-const fixture return.

**Authoring verification:** `npm run test:p02-4:contracts` **5/5 PASSED** and `npm run verify:p02-4:portable` **PASSED (exit 0)** in the authoring container after patch, including documentation, secret and cloud guards. **Flutter analyzer and full 12-gate Windows/USB verifier cannot be executed in authoring container without Flutter and local services.**

## Owner retest (PowerShell, project root)

1. Merge the update ZIP into the existing project. Do not replace `.env` or local user/media data.
2. `npm run test:flutter` — analyzer must say `No issues found!`, and Flutter widget tests must pass.
3. With Java DynamoDB Local and Fastify running and the isolated USB Android test device connected, run `npm run verify:p02-4`. Required result: `P02-4 AUTOMATED GATES PASSED for local development.`
4. Perform real native Android gallery-picker manual acceptance separately; controlled picker-channel Android automation cannot replace it.

Until #3 and #4 complete, P02 remains **PARTIALLY_VERIFIED / owner final closeout pending**. Do not activate P03 public discovery or describe this as production acceptance.
