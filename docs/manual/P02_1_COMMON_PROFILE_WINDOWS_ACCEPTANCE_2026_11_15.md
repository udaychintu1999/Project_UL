# P02-1 Common Profile & Setup Gate — Windows Acceptance

**Status at authoring:** SOURCE_IMPLEMENTED / PORTABLE_VERIFIED; real Windows semantic typecheck, Flutter SDK, local Fastify/Java DynamoDB and physical Android rechecks **UNVERIFIED**. Historical owner-provided P02-1 integration and Android E2E passed *before* this continuation. Owner manually accepted the preceding two-tab Home/Settings UI.

Merge the update-only ZIP **at the existing project root** with correct relative paths. Keep `.env`, the manually started Java DynamoDB Local, personal test data and Keystore material unchanged. No new database tables or npm dependencies are needed. Do not run `npm audit fix --force` as part of this UI update.

## Automated verification first

Open Windows PowerShell/CMD in `C:\Dump\Projects\Project-ULuv-Space`:

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
```

Start Java DynamoDB Local **manually**, as usual. In another terminal:

```powershell
npm run dev:api
```

After Fastify and the local database are ready:

```powershell
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

The integration test now asserts real common-settings storage, one-mode readiness, zero-mode re-lock, incomplete second-mode behavior, concurrent revision conflicts, privacy, account restrictions, inherited common names and persistence. The Android E2E adds real shared-settings save/restore and server-ready evidence while still proving the private/non-activated photo state.

## Manual Android journey

Run `npm run dev:flutter` with the usual USB debugging and ADB reverse workflow. Use a local test account; no external provider or AWS access.

1. Log in: **Home** should show the setup form, **Settings** should retain the existing password, signed-in devices and logout functions.
2. On fresh setup, **Continue** is disabled. Enter and save a unique `@handle`.
3. Under **Common profile**, enter a name, a broad city such as `Hyderabad`, and optionally gender. Age is read-only and derived from previously supplied signup DOB (not independent DOB verification).
4. Try neither Dating nor Friendship selected: save common details; **Continue** stays disabled with the reason to select a mode.
5. Enable Dating, leave Friendship disabled and save common/mode choices. Enter Dating bio, intention, `Reading, Music` interests; leave Dating-specific nickname blank to inherit common name. Save Dating details. The server should unlock **Continue**. Press it: see the **setup-ready placeholder**, not a discovery feed.
6. Select **Edit my profile details**. Enable Friendship **as well**, save. Continue must lock until Friendship has a saved bio, intention and interest. Save Friendship and confirm re-enabled Continue.
7. Switch between Dating and Friendship; make sure their own drafts are separate. Disable one mode and save. The disabled mode's old draft should remain saved; enabling again restores its data.
8. Edit a common name while it remains unsaved; Continue must disable until saved. Switch Settings/Home and check unfinished common/profile text stays (unless you explicitly discard). Password and session actions must remain operational.
9. Fully restart the app and restore the Keystore-backed session. The server should restore common name, broad locality, enabled modes, both drafts and readiness. No photo or discovery functionality should appear yet.
10. Enter `123 Main Street`, precise coordinates or a contact link as locality; backend must refuse the save. Invalid handle/contact bio and stale editing revisions must show useful messages without losing unsaved input.
11. In restricted/signed-out state, private profile/settings responses must not be accessible. No new account-authentication flow, P01 token change, external network or cloud storage is introduced.

## Reporting

Provide command exit status and only sanitized error details (no tokens, DOB, email, Keystore or .env). Separate **AUTOMATED_VERIFIED** from **MANUAL_VERIFIED**. If `typecheck` or Flutter analyzer/widget fails, repair and rerun before moving to P02-2.

**Known exception:** P01-1 standalone Android OTP automated case is historically FAILED with local-development owner acceptance; do not relabel it PASS. The P02-1 new Android test does not waive it.
