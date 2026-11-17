# P03 pre-discovery navigation and Settings — implementation & verification

**Scope:** Owner's 2026-11-17 cleanup request, before P03-2. Restores the owner-approved **2/5-tab** shell after the intervening four-tab attempt. No discovery publication or new API endpoint.

## Changed behavior

1. Current five-tab design: Dating, Friendship, Local Feed (with Local Feed and Activities sections), Connects, Settings. Incomplete accounts: Dating/setup + Settings; no Home.
2. Profile summary and Edit now inside Settings, not a separate Home. `onboarding.ready` from authenticated Fastify remains the only state selector. Existing P02 Save & Next, mode-specific photos, activation request and safe owner preview remain available.
3. Settings now contains compact profile summary/Edit, expandable visibility, one `Location & discovery` expansion with saved name, nested distance preferences, password action, device management and logout. Redundant explanatory paragraphs/technical cache buttons hidden from compact picker; errors and retry remain functional.
4. Added a P03-only API reference and handoff index pointing to existing, untouched P01/P02 docs. P01-3 30-day session controls remain unchanged.

## Source-level regression protection

- `scripts/verify/p03-four-tabs-and-documentation.test.mjs` validates five-tab owner decision, server-controlled 2/5 switch, profile ownership, compact location and documentation linkage.
- Updated `scripts/verify/p03-pre-discovery-shell.test.mjs`, `scripts/verify/p02-1-account-navigation.test.mjs` and `scripts/verify/p02-5-visual-contracts.test.mjs` to recognize owner-authorized P03 five-tab screen while continuing to validate P02 security and onboarding architecture.
- Updated `apps/flutter_app/test/p03_pre_discovery_shell_test.dart` for the 2/5 transition, Settings profile and no Home. Added `test/p03_four_tab_friendship_settings_test.dart` to exercise the new third Local Feed/Activities tab. The existing `test/p03_geo_settings_visibility_test.dart` remains unchanged. Updated widget tests are authored but NOT RUN here (Flutter SDK unavailable).

## Evidence and remaining verification

**Historical evidence (previous four-tab update, not evidence for this five-tab correction):** `npm run verify:p03:navigation-docs` returned **exit 0** on 2026-11-17. The script ran **53 passing Node test assertions, 0 failures** across the updated P02/P03 contract suites and passed the offline secret/cloud-operation guards. It includes real bundled India boundary checks. No AWS API call was made. **Source-level Node tests do not compile Dart.** Authoring runner does not have Flutter SDK or the real owner's DynamoDB Local / moto g04s, so those gates are **NOT RUN**. Do not claim owner acceptance for this correction without the full gate + device checklist. See `docs/manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md`.

**Final checklist:** `npm run verify:p03:navigation-docs`, `npm run verify:p03:navigation-docs:full`, `npm run dev:api`, `npm run dev:flutter`; verify completed and incomplete accounts, profile editing and persistence, Local Feed as its own third tab with Activities section, saved location one-tap GPS/manual, Settings controls, logout/session restore and cross-account isolation.

## Documentation baseline and update boundaries (2026-11-17)

The owner supplied `docs(1).zip` as the documentation baseline for the preceding P03 reconciliation. This correction changes P03 navigation implementation, relevant navigation tests (including historical P02 navigation expectations) and **P03-scoped documentation only**. It does not reauthor cleaned P01/P02 documents, project-wide change history, root README/AGENTS, product/design files or the general API map. The P03 architecture explicitly records that this new owner decision supersedes the earlier four-tab wording in shared product/design contracts.

## Five-tab correction and stale P02 test dependency (2026-11-17)

- Owner corrected finished-account bottom navigation to **Dating, Friendship, Local Feed, Connects, Settings**; the third destination switches **Local Feed / Activities**. Incomplete accounts retain Dating + Settings.
- `scripts/verify/p03-four-tabs-and-documentation.test.mjs` no longer asserts that the deleted `docs/design_reviews/P02_1_COMMON_PROFILE_AND_ONBOARDING_GATE_2026_11_15.md` exists. The assertion was stale and is replaced by the current P02 profiles route and P03 references. No P02 document is manufactured or rewritten.
- Backend auth, location API, H3, CloudFront and DynamoDB schemas remain unchanged. No discovery functionality is enabled.
- This section records implementation intent only; full Flutter analyzer/widget tests and physical moto g04s runs must be recorded by the owner before acceptance.

## Actual reconstructed-source verification for this correction

- `npm run verify:p03:navigation-docs`: **RUN/PASS**, with P03 navigation/documentation tests, P02-1/P02-5 source regressions, previous GeoNames/S3/CDN/GPS/data-security checks.
- `npm run typecheck`: **RUN/BLOCKED** because the isolated execution environment lacks repository Node dependencies (`TS2688 Cannot find type definition file for node`). No TypeScript implementation files were changed in this update.
- Flutter `flutter analyze`, Flutter widget suite and physical moto g04s: **NOT RUN** (SDK/device unavailable here). Owner must run `npm run verify:p03:navigation-docs:full` before device acceptance.
- No live DynamoDB/API, AWS or CloudFront operations were performed.
