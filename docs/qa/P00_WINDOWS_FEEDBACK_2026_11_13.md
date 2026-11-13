# P00 — Windows feedback, targeted fix and next verification (2026-11-13)

## Scope and reported behavior

Owner-reported Windows logs show Java DynamoDB Local provisioning successfully created the canonical 18 `uluv_` tables and P00 sentinel, Fastify started at local port 3000, and the portable stage of full verification passed. Full `verify:p00` stopped at `TS18046` in `apps/api/src/app.ts` line 50. Flutter Android scaffolding and dependencies were created but no Android emulator/phone was connected. Existing private `.env` triggered the old first-time initializer's non-overwrite error. **No changes to table names/schema, product invariants, media, AWS or payments.**

## Diagnosis and code repair

- **TS18046**: catch/error-handler values need type narrowing. `error instanceof Error ? error.name : 'UnknownError'` avoids touching fields of unknown throwables, and logs only the error category to keep request data/private values out of logs. Re-run `npm run typecheck` on Windows with dependencies installed to confirm the actual TypeScript compiler result.
- **Idempotent env:init**: `scripts/dev/generate-token.mjs` only reads `.env.example` on **initial creation**. If `apps/api/.env` already exists it returns success without opening, overwriting, or printing anything from the owner's private config. On initial creation, `flag:'wx'` prevents races overwriting any newly created file; template must have exactly one placeholder. If an existing `.env` was created incompletely, the owner privately repairs it using `.env.example`. Never include `.env` in a ZIP or chat.
- **Flutter device selection**: Windows, Chrome, Edge are not approved P00 Android run targets. First create/start an Android Studio emulator or connect/authorize a USB Android phone; then run the existing standard npm launcher. Do not generate Windows/web platforms as a workaround.

## User's next commands (run from project root)

With owner's manual Java DynamoDB Local and the already-running Fastify process in separate terminals:

```powershell
npm run typecheck
npm run test:db
npm run test:integration
npm run test:flutter
```

Launch an Android emulator via Android Studio Device Manager, or:

```powershell
flutter doctor -v
flutter emulators
flutter emulators --launch <emulator-id>    # replace with ID from the prior command
flutter devices
npm run dev:flutter
npm run test:flutter:e2e
npm run verify:p00
```

USB Android alternative: enable USB debugging, authorize the workstation, confirm `adb devices`, execute `adb reverse tcp:3000 tcp:3000`, then `npm run dev:flutter -- --api-base-url http://127.0.0.1:3000`; use `ULUV_API_BASE_URL=http://127.0.0.1:3000` privately on the owner's machine for the E2E test launcher (do not expose the token), or use emulator for standardized default.

Manual outage/recovery acceptance is required in addition to the automated gate. On stopping Java, readiness should return 503 while liveness stays 200; after Java restarts using the same data directory the Flutter database check should recover. Test repeated taps and unauthorized requests. Capture results **without screenshots or output containing `.env` or debug tokens**.

## Evidence and honesty

- Owner-reported Windows terminal outputs are recorded in `docs/qa/EVIDENCE_LOG.md`; this patch was not executed on that Windows computer.
- Portable tests run in Linux authoring environment: 19 Node unit/CLI/local/env tests PASS, plus source/docs/environment/secret/cloud guards. Env tests use temporary synthetic fixtures only; no real `.env` accessed.
- Full backend `npm run typecheck` BLOCKED in this environment without npm deps. Real DynamoDB/API integration and Flutter SDK/Android runtime UNVERIFIED here. Full `CORE_FLOW_VERIFIED` is **not claimed**.
