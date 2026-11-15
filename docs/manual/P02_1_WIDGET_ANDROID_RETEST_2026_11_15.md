# P02-1 Widget / Android E2E Repair — Windows Retest

From `C:\Dump\Projects\Project-ULuv-Space`, overlay the update-only ZIP and keep your private `.env` untouched. Java DynamoDB Local stays under your manual control; start Fastify separately with `npm run dev:api`.

Run the full sequence (do not stop verification at portable tests):

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

`npm run test:p02-1:android-package` is also available independently for the new offline package-safety tests.

The physical-device runner must launch a **separately installed** test application named `com.example.uluv.p02isolated`, not `com.example.uluv`. On first run, it is normal for this test app to be absent; the runner installs it through Flutter. The runner removes **only** the test package and synthetic test database fixture after the test. Neither your normal installed U_luv app nor its real Keystore-backed session should be altered.

If ADB fails, verify `adb devices` lists an authorized phone and the API is running locally. If the test-app package state needs inspection, a read-only command is:

```powershell
adb shell pm list packages com.example.uluv.p02isolated
```

Do **not** run `adb uninstall com.example.uluv` or `adb shell pm clear com.example.uluv`; doing so can erase your actual signed-in state. Do not share tokens, OTPs, credentials, or session JSON in bug logs.

After automation passes, manually test independent handle Save while an unsaved common name or mode bio is typed; the other text must remain. Then save the common profile, enable one mode, complete that mode's saved fields and verify Continue unlocks only after the backend reports readiness. Settings and logout still need to work.

Keep P02-1 marked pending until Flutter and Android passes are observed and the owner accepts the UI. P02-2 media remains a separate milestone.
