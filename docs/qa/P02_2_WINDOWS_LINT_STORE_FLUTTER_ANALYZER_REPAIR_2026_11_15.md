# U_luv — P02-2 Windows lint, media-store and Flutter analyzer repair (2026-11-15)

## Scope and evidence

Owner submitted logs for the **initial P02-2 ZIP**. Observed results:

- `npm run verify:p02-2:portable`: **PASS** (36 backend unit tests and existing P00/P01/P02-1 contracts).
- `npm run typecheck`: **PASS**.
- `npm run lint`: **FAIL**: ESLint `no-unsafe-finally` at `scripts/verify/p02-2-android-e2e.mjs:116`.
- `npm run test:p02-2:store`: **1 PASS / 1 FAIL**, due to Windows `EPERM` when a test tried to create a directory symlink. The test failed before exercising the adapter's path-safety behavior.
- `npm run test:flutter`: **FAIL during analyzer**: one unnecessary `dart:typed_data` import and one missing `const` in a photo-panel widget test. Flutter widget tests had not yet run.
- `npm ci`: completed, but npm audit reported **8 vulnerabilities (7 moderate, 1 high)**. These were not assessed or silently upgraded here.
- Real P02-2 Fastify/DynamoDB integration and physical Android media test: **NOT YET REPORTED**.

## Repair changes (no backend media contract or app authentication changes)

1. The Android E2E fixture-cleanup `finally` no longer throws for an invalid synthetic owner ID. It marks cleanup failed, retains strict UUID validation, prevents unexpected owner-directory selection, and continues safe fixture-account cleanup; the exit code reports failure.
2. Media-store negative test now uses an NTFS **directory junction** on Windows (`symlink(..., 'junction')`) rather than a privileged directory symlink. On Linux/macOS it uses a normal directory symlink. The test asserts the **specific `unsafe_media_store` error**; an unrelated corrupt-image error cannot make the security test pass. If Windows policy also prevents creating junctions, the test records a diagnostic stating that the symlink-root assertion was **not verified**, while still validating rejection of malformed image content; other errors remain failures.
3. Removed the redundant `dart:typed_data` import from `profile_media.dart`; `Uint8List` remains provided through `flutter/services.dart`.
4. Made the immutable `ProfileMedia` fixture a Dart `const` to satisfy `prefer_const_constructors`.

No new infrastructure, database table/index, S3 call, auth protocol change, permission, or paid API was added. The local media adapter remains a **development-only** store in `.local/media/`; real-user photos and P01 Keystore state must not be cleared.

## Verification performed in the authoring environment

- Reconstructed the complete working repository from the supplied master and sequential update ZIPs, then overlaid these four source/test repairs. `npm run verify:p02-2:portable` **PASSED**, including all existing P00/P01/P02-1 and P02-2 unit/contract checks.
- `node --check scripts/verify/p02-2-android-e2e.mjs`: **PASSED**.
- Ran the two `p02-2-media-store.test.ts` cases against the real `LocalMediaStore` implementation and installed Sharp via an **offline TypeScript transpilation harness** (equivalent source/runtime, Linux host); both **PASSED**. This was **not** a Windows junction test and was **not** executed using the project `tsx` command.
- Full ESLint, Flutter analyzer/widget tests, real Java DynamoDB Local integration, and physical Android E2E: **UNVERIFIED in this environment**. Owner Windows retests are required.

## Verification after applying this patch (Windows)

From the project root, existing dependencies installed:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
```

Keep manually started Java DynamoDB Local + Fastify running for the following separate gates:

```powershell
npm run test:p02-1:integration
npm run test:p02-2:integration
flutter test --help | findstr /I uninstall
npm run test:flutter:p02-2:e2e
```

Do not claim automated P02-2 acceptance until the media-store test, Flutter analyzer **and widgets**, live media integration, and isolated physical Android media flow all pass. Any junction-creation diagnostic leaves the junction-specific safety test unverified. Manual Android photo selection, preview, upload, reuse, reorder, replace, delete, app restart and failure recovery remain mandatory before owner acceptance.

### Separate npm security follow-up

The installer reported 1 high and 7 moderate npm advisories. Preserve the dependency lockfile during this targeted repair. Run `npm audit --omit=dev` and `npm audit` from Windows to identify affected packages and evaluate non-breaking updates separately; **do not automatically run `npm audit fix --force`**.
