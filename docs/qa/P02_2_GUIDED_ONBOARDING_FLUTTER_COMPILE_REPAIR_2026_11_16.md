# P02-2 guided onboarding — Flutter compile repair (2026-11-16)

## Owner Windows failure and root cause

The guided-onboarding ZIP passed portable source/Node gates, TypeScript semantic typechecking, ESLint and real Fastify/DynamoDB Local integration on the owner machine. Flutter analyzer and physical Android UI build then **FAILED** because `profile_workspace.dart` invoked `photoBytes(mediaId)` on `ProfileRepository`, while that method belongs to the distinct `ProfileMediaRepository` interface (`profile_media.dart`). The concrete `HttpProfileRepository` already implements **both** interfaces. No media route, account ownership, schema, or API change is necessary.

Additional Flutter analyzer diagnostics:
- `integration_test/p02_2_ui_integration_test.dart`: redundant `dart:typed_data` import.
- `test/p02_2_photo_panel_test.dart`: `ProfileMedia` fixture can use `const`.

## Fix delivered

- After checking the optional media capability, cast the repository into an **explicitly typed `ProfileMediaRepository` local** and fetch final-review images through that capability. Profile-only fake repositories still return an empty preview without throwing.
- Remove the redundant Dart import, and make the media test fixture constant.
- Strengthen the Flutter friendship-only journey's final-review test: use a complete PNG fixture, ensure real `photoBytes` calls take place, and ensure both assigned photo previews render.
- Add an executable negative source regression guard that rejects reintroducing `repository.photoBytes(mediaId)` against the wrong interface.

## Verification evidence

**Executed here on the reconstructed source (not on the owner's Windows device):**
- `npm run verify:p02-2:portable` — **PASS**, including 36 backend unit tests, P00/P01/P02-1 safeguards and updated P02-2 contract checks (7 guided-contract tests).
- Node guided and UI source-guard tests — **PASS**.
- Validated that the exact patch paths and ZIP contents contain no credentials, local media, compiled APKs, or generated caches.

**Not executed in this environment:** Flutter SDK analysis/widgets, real Android Gradle build and Android UI E2E; Flutter SDK and physical Android device are absent. The owner must rerun the explicit gates below. Do **not** report these as passed until executed.

## Windows verification

Apply the changed-files ZIP over the **current guided-onboarding repository**, preserving project-relative paths. No `npm ci`, database migration, new table, or storage reset is required.

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:flutter
```

After manually starting Java DynamoDB Local and Fastify, with a USB-debugging-enabled Android device connected, run:

```powershell
npm run test:p02-2:integration
npm run test:flutter:p02-2:ui:e2e
```

Expected: Flutter analyzer has zero diagnostics; widget tests including final-review preview tests pass; Android build succeeds and the 13 real UI checkpoints complete. Continue must still require two owner-READY photos per enabled mode and still lead to a **private** review-completion screen, not public activation.

## Scope and status

- Scope: only the reported compile issue, two minor analyzer diagnostics and preventative tests/docs.
- Unchanged: P01 auth, session storage, gender/preference contract, guided Next/Back gating, real media ownership, local `.local/media/` storage, DynamoDB tables and AWS/payment configuration.
- Status: **SOURCE_REPAIRED / PORTABLE_VERIFIED / FLUTTER_UNVERIFIED / ANDROID_UNVERIFIED / OWNER_ACCEPTANCE_PENDING**.
