# U_luv — P02-1 Windows Verification, Android Test and Owner Acceptance

**Status:** P02-1 source and test files supplied; authoring environment portable checks completed; owner real local DB, semantic TS compile, Flutter analyzer/widgets and physical Android checks **UNVERIFIED** until executed. The P02-0 design-only instructions are superseded by this implementation runbook.

## Prerequisites

- Windows 10 / PowerShell, Node 22+, existing Flutter/Android SDK/ADB, real USB-debugging-enabled Android device.
- A clean current project root; merge the ZIP **with project-relative paths** and do not copy its contents into a nested folder.
- Do not modify/disclose existing private `apps/api/.env`; the command `node --env-file` loads it. Java DynamoDB Local is started **manually**, as in `docs/Developer_Command_Center.md`.
- No Docker, S3, CloudFront, payment API or production AWS call is required. Test accounts and access are strictly local development.
- Ensure accepted P01 install/dev environment still works. Backup/commit source before merge.

## 1. Portable and static checks (PowerShell from repository root)

```powershell
npm ci
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
```

`verify:p02-1:portable` includes all earlier P01-3 portable checks, the new profile validation Node unit tests, and formatting-tolerant security source contracts with mutation negatives. `test:flutter` includes Flutter analysis and the new P02-1 widget tests. **A command failing is a failed gate, not permission to skip it.** Report sanitized failure output so code can be repaired and rerun.

## 2. Live local backend/database integration

1. Manually start Java DynamoDB Local (existing local configuration, typically loopback port 8000).
2. Ensure your private `apps/api/.env` exists and the initial 18 local tables have already been provisioned. If not, use the existing `npm run db:provision` only against the loopback Java DB.
3. In a separate PowerShell window from repository root, run:

```powershell
npm run dev:api
```

4. In a **second** root PowerShell window run:

```powershell
npm run test:p02-1:integration
```

This test uses the **actual P01 signup/outbox**, creates two random disposable accounts, tests authentication and handle collisions/rename, independent draft saves, forbidden fields, concurrent update CAS, privacy-safe DTOs, real DynamoDB persistence, restricted-account rejection and fixture cleanup. Existing production data must not be involved. If cleanup reports a warning, inspect only isolated local fixture records.

## 3. Physical Android integration

Keep Fastify and Java DynamoDB Local running. Connect one USB Android device, confirm `adb devices` shows `device`, and close any existing interactive `flutter run` session. Run:

```powershell
npm run test:flutter:p02-1:e2e
```

Uses existing synthetic local fixture creation, device Keystore-backed enrollment, authenticated Android HTTP handle + two draft writes and a second controller restore followed by persisted read. The wrapper sets ADB reverse and cleans up the disposable identity, handle, mode records and device records. It requires fresh **test-app** secure-storage state, never a real user's session. It does not substitute for the owner verifying the actual UI taps.

If using a specific device, the existing wrapper supports `-- --device <adb-device-id>`; device ID may be checked with `adb devices`.

## 4. Manual Android UI acceptance (real signed-in test account)

```powershell
npm run dev:flutter
```

Within the authenticated account view:

1. Open **Set up Dating / Friendship profiles**. Confirm it loads the account dashboard and the saved drafts.
2. Claim a valid unused handle (for example, start with a letter and use 3–24 supported characters). Confirm the normalized handle is shown on refresh; duplicate handles on a second account must fail with helpful feedback.
3. Select Dating, enter a distinct display name, bio, intention and optional comma-separated interests; **Save draft**. It should show a success message and increment the mode version.
4. Switch to Friendship, enter a different display name and intention, save. Switch back; Dating values should be unchanged. Edit a saved mode and save again; version increases.
5. Force close/reopen app with saved P01-3 login. Open the editor; confirm handle and both profiles are retrieved from the server, not just an in-memory widget.
6. Edit but **do not save**, then switch modes or Reload. Confirm discard dialog protects local unsaved edits.
7. Enter an email, phone number, URL or forbidden social link in public bio and try Save. Expect a safe field-related failure, no public exposure and no false saved confirmation.
8. Stop Fastify or Java DynamoDB and try loading/saving. The UI must show an error; restart service, Reload, and verify whether prior write committed before retrying. Confirm buttons do not freeze or falsely report success.
9. Sign out or revoke device, and confirm the authenticated account editor is no longer shown. Authentication and the existing P01 persistent session flows must still work.
10. Photo uploads, locality selection, discovery preview and mode activation must **not** be available or silently claimed working in P02-1.

Record **actual** outputs from `verify:p02-1:portable`, `typecheck`, `lint`, `test:flutter`, `test:p02-1:integration`, `test:flutter:p02-1:e2e` and your manual observations. If all these checks pass, `npm run verify:p02-1` is the combined automated gate. Owner acceptance still requires the actual manual UI workflow.

## 5. Security/implementation notes

- Do not paste `.env`, bearer tokens, OTP values, personal account data, local media paths or device credentials into chat or test logs.
- The sample bounded fields are provisional; no fixed global locality catalog or P03 discovery was invented.
- Do not start P02-2 photo uploads until this milestone is verified or failures are documented and repaired.
- A P01-1 OTP Android automation failure remains historically accepted only for local development; it must not be reclassified as passing.
