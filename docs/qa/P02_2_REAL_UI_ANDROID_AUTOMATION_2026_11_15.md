# P02-2 — Real UI-driven Android automation and evidence

**Date:** 2026-11-15  
**Scope:** P02-2 QA repair only. No P02-3, discovery, AWS, new tables or changes to existing production authentication/media operations.  
**Implementation status:** SOURCE_IMPLEMENTED  
**Owner physical-Android verification:** UNVERIFIED for this new UI test.

## Root cause of misleading previous automation

The existing `integration_test/p02_2_media_integration_test.dart` is a legitimate physical-device/API test. It creates a real device session and uses `HttpProfileRepository` to send real image bytes, operate on DynamoDB-backed profile assignments, test API authorization and deletion. It **never mounts `UluvApp` or taps the photo editor**. Consequently the phone displayed Flutter's generic "Test Started"/"Test Finished" harness without showing the user journey. A PASS there means the media API path worked, not that the app's picker, forms, buttons or Continue gate are usable.

## New device test — what it does

`apps/flutter_app/integration_test/p02_2_ui_integration_test.dart`:

1. Verify the running APK is **exactly** `com.example.uluv.p02isolated` and the test Keystore has no existing session. Run only with synthetic local fixture; never inspect/clear a normal session.
2. Mount the **real persistent `UluvApp`**, type into the actual login UI and submit the actual Login button. Wait for the authenticated two-tab Home, not just an HTTP login response.
3. Edit/Save the public handle through the real form and verify the account's saved handle projection.
4. Edit/Save common display name, broad city, original permitted gender option and enable Dating, then verify the backend-returned saved summary in Flutter.
5. Type/save Dating bio, interests, intention; assert Continue disabled with zero assigned photos.
6. Tap **Select photo from device → Preview → Upload and add photo** twice. Assert Continue disabled with one and enabled with two assigned, READY photos.
7. Enable Friendship; assert Continue disabled until Friendship's draft and two photos are complete.
8. Save Friendship details, use actual **Use in this mode** library buttons to reuse the two stored images (no reupload), assert Continue enabled.
9. Remove one Friendship photo in UI; assert Continue disabled. Reuse the stored photo and verify Continue re-enables.
10. Reload, navigate Settings/Home, re-mount the app to check Android Keystore session restore and persisted profile state, then press Continue to reach the **private** completion UI.

The test prints `P02-2 UI PASS 01..13` only **after corresponding UI assertions**. A failed action or timed-out state fails `flutter test` and the npm process. Credentials, tokens, full exception payloads and private media are not logged.

### Deterministic picker vs real native picker (important)

The UI test uses `TestDefaultBinaryMessengerBinding` to intercept ONLY `uluv/p02_2_photo_picker` and return two small valid PNGs. It deliberately exercises the user's **Flutter photo selection button**, preview and confirm button, followed by the unmodified real uploader/Fastify/DynamoDB pipeline. It does **not** automatically interact with Android's system `ACTION_OPEN_DOCUMENT` UI. No profile repository, auth service, database or HTTP response is mocked. The separate native-picker manual test remains necessary.

## Commands and evidence separation

From project root, with manually running Java DynamoDB Local, provisioned 18 tables, Fastify API and authorized USB phone:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
npm run test:p02-2:integration
npm run test:flutter:p02-2:e2e
npm run test:flutter:p02-2:ui:e2e
```

The full `npm run verify:p02-2` now includes both Android suites, in that order. The UI suite has a separate fixture and isolated APK lifecycle, so failures in the real UI cannot be hidden by the API suite's PASS.

**Authoring environment:** Node portable tests executed and passed (recorded by exact command in release summary), JavaScript syntax checked. No Flutter SDK, Java DynamoDB Local service or connected physical Android device exists in this environment. Consequently *do not claim UI/Android analyzer/E2E PASS here*.

### Failure handling

- If `Test Started/Finished` appears with **no** `P02-2 UI PASS 01..13` lines, the new UI journey did **not** complete; inspect test runner selection and preceding failure logs.
- `npm run test:flutter:p02-2:e2e` remains the backend/media-API device suite and will not visibly tap form controls. Use the **`:ui:e2e`** command for the screen-driven journey.
- On failure, capture sanitized console test name, first failing checkpoint and Flutter exception (never passwords, OTPs, tokens or sealed credential records). Do not delete/reset normal U_luv application or its data.
- `--no-uninstall` blocks Flutter's known potentially unsafe base-package uninstall; host cleanup targets only exact `com.example.uluv.p02isolated`. Flutter could still force-stop the normal app, so avoid running this when using that app interactively.
- A false-positive test PASS is a release blocker. A manual working app does not convert a failing automated UI test into a pass.

**Pending:** owner physical Android UI E2E PASS, real native picker manual PASS, owner acceptance. P02-3 held.
