# P02-1 Update-Only Delivery and Merge Notes — 2026-11-15

**Status:** source implemented and portable-tested; live environment/device owner verification pending.

## How to apply

- This ZIP is **not a full repository**. It contains modified/new project files and a complete `docs/` tree (for historical documentation continuity).
- Extract at the existing repository **root** with normal overwrite, preserving paths. Keep existing `node_modules`, `apps/api/.env`, Java DynamoDB Local data, Android signing settings and `.local/` data untouched.
- Do not replace accepted P01 source with a different branch. This patch was based on the uploaded `Project_UL-master.zip` with `U_luv_P02_0_Design_Freeze_2026-11-15.zip` applied first. Compare current Git baseline before merging if you have subsequent local edits.
- No dependencies added: `package-lock.json` remains unchanged; `package.json` adds the P02-1 test scripts only.

## Implemented paths

- API: `apps/api/src/features/profiles/validation.ts`, `apps/api/src/features/profiles/routes.ts`, `apps/api/src/features/auth/routes.ts`, `apps/api/src/app.ts`.
- Flutter: `apps/flutter_app/lib/features/profiles/{profile_models,profile_service,profile_workspace}.dart` and `apps/flutter_app/lib/features/auth/persistent_gate.dart`.
- Tests: `apps/api/tests/unit/p02-1-profiles-validation.test.ts`, `apps/flutter_app/test/p02_1_profile_workspace_test.dart`, `apps/flutter_app/integration_test/p02_1_profile_integration_test.dart`.
- Verification: `scripts/verify/{p02-1-profile-integration,p02-1-source-contract,p02-1-android-e2e}.mjs`, `scripts/dev/flutter.mjs`, root `package.json`.
- Relevant developer notes: API/Flutter READMEs, API route map, root `README.md` and `AGENTS.md`, complete `docs/` history.

## Next required owner actions

Follow `docs/manual/P02_1_WINDOWS_IMPLEMENTATION_AND_ACCEPTANCE_PLAN.md`. First run portable/typecheck/Flutter widgets, then live Java DynamoDB Local and Android (including manual account editor). All failing gates require a real source fix and rerun. Do not mark the whole P02 phase complete; this is the **first coding milestone only**.
