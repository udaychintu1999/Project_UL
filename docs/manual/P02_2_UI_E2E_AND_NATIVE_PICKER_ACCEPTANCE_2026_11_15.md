# P02-2 — Windows physical Android UI E2E + native picker acceptance

## Preparation

- Unzip the update package **into the existing project root** and keep `apps/api/.env`, existing local media, and normal app data unchanged.
- Start **Java DynamoDB Local manually**, provision tables if needed, and leave `npm run dev:api` running in a separate terminal.
- Connect and authorize your USB Android phone, then from project root run `adb devices`. The runner automatically configures `adb reverse`.
- Do **not** clear data, uninstall or reset `com.example.uluv`, and do **not** paste sensitive test logs containing credentials. The test runner resets only `com.example.uluv.p02isolated`.

## Exact verification

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

The last command is **NEW**. Watch the phone: it should now visibly open the U_luv login and profile screens and interact with controls. The console should print 13 **P02-2 UI PASS** messages after assertions succeed. The prior `test:flutter:p02-2:e2e` is still essential, but it runs direct API operations behind Flutter's generic test runner without onscreen interaction.

**Expected automated states:** Saved handle/name/city/gender/mode; Continue locked with 0 and 1 Dating photos; unlocked at 2 Dating photos; locked when Friendship is enabled; unlocked when Friendship reuses two owner photos; locked after removal; unlocked after reassign; persisted after reload and app widget recreation; final private completion screen appears. Failure at any stage must give a nonzero result.

## Real Android system image picker — separate manual check

The automated UI suite provides two deterministic PNGs through the picker channel. It does **not** cover OS gallery/Documents UI. Verify that separately using **your normal debug app** or a separate disposable account you control:

1. Run `npm run dev:flutter` and sign into a **test account**. Never use real users' media.
2. On Home, save common details, enable Dating and save a Dating draft so the Photos panel appears.
3. Tap **Select photo from device**. Confirm Android's native Files/Photos chooser opens (ACTION_OPEN_DOCUMENT), without prompting for broad storage permissions.
4. Select a local JPEG/PNG/WebP sample under 8 MB. Check the in-app preview; tap **Cancel selection**, confirm no new library photo or mode assignment.
5. Repeat selection, tap **Upload and add photo**. Check actual thumbnail, count and stored library presence. Repeat with a second distinct image; Continue should now unlock when the other required details are complete.
6. Force close and reopen the application. Confirm the images, city, gender, enabled mode and ready state are still there. Disable network briefly to confirm a failed upload does not display false success; restore and retry.
7. If both modes are enabled, reuse photos via **Use in this mode**, confirm no duplicate upload. Remove one from a mode and confirm Continue re-locks.
8. Verify no profile becomes discoverable automatically; P02-3 activation is separate. Check Settings and normal app persistent login are still intact.

**Report back:** whether all 13 UI checkpoints PASS, whether native picker manual checks PASS, and the exact first failed checkpoint/error if not. No passwords/tokens/OTP/Keystore values in logs.

## Safety and scope

- Java DynamoDB Local and `.local/media/` are for development only; no AWS calls.
- Test fixture cleanup targets synthetic owner records and the **exact isolated Android package** only.
- `--no-uninstall` prevents Flutter's base-app uninstall; it does not promise Flutter will never force-stop the base app.
- Do not run `npm audit fix --force`, wipe app data, delete DynamoDB tables or modify permanent account/profile records to fix a test.
- Do not advance P02-3 or mark P02-2 fully accepted until this genuine UI and native-picker verification is complete.
