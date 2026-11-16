# P02-2 guided onboarding — Windows / Android retest

Apply the changed-files ZIP over the existing project root. Preserve `apps/api/.env`, `.local/`, all private device credentials, and existing DynamoDB Local data. No new AWS services, tables, or npm packages are added by this UI-only update.

## Automated verification

Run from the project root:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
```

Start Java DynamoDB Local manually as usual, then start Fastify with `npm run dev:api` in a separate terminal. On Windows with an Android device connected and USB debugging enabled, run:

```powershell
npm run test:p02-1:integration
npm run test:p02-2:integration
npm run test:flutter:p02-2:e2e
npm run test:flutter:p02-2:ui:e2e
```

The last command must run a real, UI-driven 13-checkpoint onboarding journey. The test app is isolated as `com.example.uluv.p02isolated`; do not uninstall/clear `com.example.uluv`. The physical test's system photo-picker return value is deterministic; manually test the real native Files/Photos chooser on a separate run.

## Manual acceptance

Run `npm run dev:flutter`. Confirm Common → enabled Dating details/photos → enabled Friendship details/photos → Review, with inactive modes skipped. Try left and right swipes, Next/Back, disabled future chips, unsaved edits, app cold restart, photo removal and reuse, and final private Continue. Check warnings are red/bold and no redundant Saved account details block appears. Verify the real OS gallery chooser and Settings security actions. Report test failures with the failing checkpoint; never count skipped checks as passed.
