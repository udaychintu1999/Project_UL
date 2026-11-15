# P02-1 Home / Settings continuation — update-only delivery manifest

Merge this ZIP at the U_luv project root **after** the previously delivered P02-1 identity/draft editor update. The archive is incremental: it is not a standalone project checkout. Preserve existing `.env`, Keystore session state and Java DynamoDB Local database. The `docs/` tree is included in full for safe historical documentation merging.

## Modified source/config/test paths

- `apps/api/src/app.ts` — TS18046 fix: safely narrow unknown Fastify error code.
- `apps/api/src/features/auth/device-sessions.ts` — drop unused `randomUUID` import, no behavioral change.
- `apps/api/src/features/auth/password.ts` — drop unused `randomInt`, `bearerToken` imports, no behavioral change.
- `apps/flutter_app/lib/features/auth/account_navigation.dart` — new two-tab, scrollable Material 3 signed-in navigation shell.
- `apps/flutter_app/lib/features/auth/auth_screen.dart` — reuse P01 settings/password actions within two-tab shell; keep legacy test layout.
- `apps/flutter_app/lib/features/auth/persistent_gate.dart` — connect Home profile editor and Settings device manager to the real persistent session.
- `apps/flutter_app/lib/features/profiles/profile_workspace.dart` — open and load profile fields automatically on Home.
- `apps/flutter_app/lib/main.dart` — production app title becomes U_luv, diagnostics title preserved for P00 mode.
- `apps/flutter_app/test/p02_1_account_navigation_test.dart` — new widget checks for navigation, settings and Back behavior.
- `apps/flutter_app/test/p02_1_profile_workspace_test.dart` — new auto-open widget check.
- `scripts/verify/p02-1-account-navigation.test.mjs` — source-based/negative structural checks.
- `package.json` — portable verification now includes navigation contracts; standalone `test:p02-1:navigation:contracts` command.
- `apps/flutter_app/README.md` — two-tab usage and QA links.

Full `docs/` tree includes new evidence, current phase checkpoint, Windows manual runbook and this manifest. `node_modules`, Flutter build, caches, real `.env`, binary artifacts and private credentials are excluded.

**Current status:** P02-1 pre-continuation API/database/Android test PASSED on owner Windows; post-continuation authoring portable checks PASS; post-continuation Windows semantic compile, Flutter tests, Android interactive navigation and owner acceptance PENDING. P02-2 not started.
