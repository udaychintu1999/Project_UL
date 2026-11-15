# P02-1 Home + Settings — Windows / Android Acceptance Runbook

## Installation

Merge the **update-only ZIP** into the existing U_luv project root (`C:\Dump\Projects\Project-ULuv-Space`), preserving every project-relative path. Keep `apps/api/.env`, persistent Java DynamoDB Local data and your Android Keystore session configuration. Do not delete any existing project files or regenerate credentials. No dependency or database-schema change is included; **you do not need to rerun `npm ci` or `db:provision`** if your existing local environment is healthy.

## Automated checks (project root; PowerShell or cmd)

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
```

`typecheck` must now PASS (formerly TS18046 at `apps/api/src/app.ts:98`). `lint` should complete without the three previously reported unused-import warnings. The new `test:flutter` count will exceed the prior 40 after the navigation widget tests run. If any gate fails, preserve its exact console output and stop before moving to P02-2.

As usual, **start Java DynamoDB Local yourself**, keep the existing 18 local tables, and start Fastify in another terminal:

```powershell
npm run dev:api
```

Then rerun the real local profile integration in a separate terminal:

```powershell
npm run test:p02-1:integration
```

For the existing automated physical Android profile integration (uses real Keystore/DB and cleans up its synthetic fixture), with the USB phone authorized and no competing interactive Flutter run:

```powershell
npm run test:flutter:p02-1:e2e
```

The existing E2E test covers session, profile API and persistence. The **new two-tab UI** is currently exercised through Flutter widget tests and the following owner manual phone check; do not claim the real phone UI was automated by the old profile E2E.

## Manual two-tab phone checklist

Launch:

```powershell
npm run dev:flutter
```

1. Sign in using the existing method. Confirm you land on a **Home** tab with visible bottom **Home / Settings** navigation (no diagnostics, no third tab).
2. Home automatically displays the public handle editor, Dating/Friendship selectors and draft fields; no `Set up profiles` tap needed. Change display name or bio, save, switch modes, save a different draft, and verify each mode retains its own data.
3. Type **unsaved** text in Home, switch to Settings and back. Verify text is still present without being submitted. Then save or deliberately discard it using the existing draft behavior.
4. On Settings, use **Check account access** and **Password settings**; open Change password and return using Back without submitting a new password. Confirm no password field appears on Home.
5. Tap **Manage signed-in devices**, verify it loads and can be closed. Do not revoke your current device unless intentionally testing sign-out.
6. Verify physical Android system Back in Settings returns to Home (and Back inside a password subpanel returns to the Settings list). Authenticated Back must never open P00 diagnostics.
7. Rotate to a small display or test a smaller device if available: the bottom bar stays visible, text fields can be reached by scrolling, and the Save button remains tappable above the keyboard.
8. Quit and reopen the app. Confirm Keystore persistent session restoration and saved Dating/Friendship fields remain, while any previously unsaved text is not falsely reported as saved.
9. In Settings, tap **Log out**. Confirm the account UI disappears and the sign-in flow replaces it. Verify the back stack does not show private profile content.
10. If you deliberately test Change password, use the established P01 runbook: it revokes the session, requires sign-in again, and the old password must fail. Do not perform this during unsaved draft checks.

## Reporting

Share only sanitized PASS/FAIL logs (no passwords, access tokens, OTPs, account identifiers or private profile text). Mark P02-1 navigation accepted only after the above user-visible flow and typecheck pass. Full P02 remains open until later media/activation milestones.
