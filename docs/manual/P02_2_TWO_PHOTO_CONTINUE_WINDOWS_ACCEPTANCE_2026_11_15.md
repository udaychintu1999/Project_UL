# P02-2 — Two-photo Continue gate: Windows and Android acceptance

This patch adds **no new dependency or table**. Merge its project-relative files into your existing local project (do not delete `.env`, DynamoDB, normal app data or `.local/media/`). In a Windows Command Prompt or PowerShell, run the commands **in order** and keep the full failure context if anything is red:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
```

Start the Java DynamoDB Local manually, as you already do. Start the existing backend in one terminal:

```powershell
npm run dev:api
```

Then run the live backend and isolated Android checks in another terminal:

```powershell
npm run test:p02-1:integration
npm run test:p02-2:integration
flutter test --help | findstr /I uninstall
npm run test:flutter:p02-1:e2e
npm run test:flutter:p02-2:e2e
```

**Android safety:** check `--no-uninstall` is available. The P02 runner uses `com.example.uluv.p02isolated`; never uninstall/clear `com.example.uluv`. Never copy refresh/access tokens, OTP codes or private data into logs.

## Manual workflow — must complement the automated tests

1. Sign in with your synthetic test account. On Home, save `@handle`, display name, broad city, an explicit gender selection (including `Prefer not to say` if desired), and **enable Dating only**. Check the **Saved account details** preview matches.
2. Save Dating bio, intention and an interest. Confirm **Continue is still disabled** and shows `Assign at least two valid, saved photos to Dating`.
3. Choose a real JPEG/PNG/WebP photo via Android picker, upload/assign it to Dating, verify `1/6 assigned`; Continue stays disabled. Upload/assign a second distinct photo, verify `2/6 assigned`; after the server refresh, Continue becomes enabled. Two photos merely in the library **must not** count.
4. Tap Continue and confirm the **private setup-complete placeholder** appears; no public discovery is activated. Return to edit.
5. Remove one assigned Dating photo; immediately verify Continue locks, even before the status-refresh finishes. Add it back and confirm the gate unlocks after server confirmation.
6. Enable Friendship and save this choice; Continue locks until **Friendship** bio/intention/interest and two photos are assigned. Reuse the same two library photos in Friendship without duplicating files, and confirm Continue unlocks only after both selected modes are complete.
7. Remove a Friendship photo while Dating still has two: Continue locks. Disable Friendship and save: Dating-only completion can unlock Continue, without deleting Friendship draft or library images.
8. Close/reopen the app and confirm saved city, gender, mode toggles, photo assignments and Continue status match server state. Cancel chooser and simulate offline API/status reload: failure must **not** unlock Continue. Confirm Settings/logout and persistent session are unaffected.

Maximum 6 mode photo assignments; one uploaded media object may be reused in both modes. The user's identity, romantic gender-preference policy and algorithm-free future discovery are unchanged. Real AWS and the public-activation workflow are out of scope.

**Acceptance:** Record `AUTOMATED_VERIFIED` only after the live Windows gate is green, `MANUAL_VERIFIED` after the eight real phone checks, and `OWNER_ACCEPTED` only when the owner reports acceptance. Until then P02-2 remains pending.
