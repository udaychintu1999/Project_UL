# P03 — Five-tab navigation and clean Settings (owner update, 2026-11-17)

**Status (18 Nov 2026):** Five-tab correction was covered by the owner’s 11/11 full local automated acceptance (twice), including the original 3 Android UI tests. Expanded 7-scenario Android journey suite is newly authored and still needs execution; native GPS and true OS restart remain separate. See [../p03/README.md](../p03/README.md). This decision supersedes the earlier four-tab P03 shell and the historical four-tab product-navigation wording only. It does not alter P01-3 sessions or P02 profile/photo logic.

## Canonical product navigation

**Owner-approved navigation (2026-11-17):** Five main tabs, in exact order:
**Dating → Friendship → Local Feed → Connects → Settings**. The third **Local Feed** tab contains two sections, **Local Feed** and **Activities**. Friendship is a separate tab for People/Friendship only; it does not contain either local section. The last destination remains Settings and owns the saved profile summary/editor. **There is no Home tab.**

The earlier shared `docs/ui/DESIGN_SYSTEM.md` and `docs/product/PRODUCT_CONTRACT.md` mention four tabs with Local Feed/Activities nested in Friendship. This P03 owner decision **supersedes only that navigation detail**. Do not rewrite those shared/P01/P02 documents within a P03-only ZIP. Future consolidation should make their navigation language consistent without altering other product rules.

| Account status | Bottom navigation order | Visible content |
| --- | --- | --- |
| Authenticated, profile status loading | Hidden until server dashboard replies | Saved-profile checking/retry, no onboarding flash |
| Server-confirmed incomplete `onboarding.ready=false` | **Dating, Settings** | Dating shows the existing guided P02 Save & Next onboarding; Settings has location, password, devices and logout |
| Server-confirmed complete `onboarding.ready=true` | **Dating, Friendship, Local Feed, Connects, Settings** | Dating and Friendship await later discovery features; Local Feed includes Local Feed/Activities sections; Settings owns saved profile/edit and account controls |
| Profile changes from complete to incomplete after verified server update | **Dating, Settings** | Settings index **4 → 1**; other tabs → Dating index **0** |
| Profile changes from incomplete to complete | Five destinations restored | If Settings was selected, index **1 → 4**; otherwise remain on Dating |

Navigation indexes are zero-based: **Dating 0, Friendship 1, Local Feed 2, Connects 3, Settings 4** (completed); **Dating 0, Settings 1** (incomplete). Do not use the old completed Settings index 3. `IndexedStack` preserves tab state; no new discovery endpoint is enabled by this correction.

### Source ownership and state transitions

- `apps/flutter_app/lib/features/auth/persistent_gate.dart` is the immutable P01-3 identity/session parent. It creates the authenticated account subtree only after cryptographically verified restoration; logout/revocation disposes the subtree. No P03 auth change.
- `apps/flutter_app/lib/features/auth/auth_screen.dart` owns `selectedAccountTab`, `profileStatusKnown`, `profileComplete`, `locationRefreshEpoch`; only a backend-verified `ProfileDashboard.onboarding.ready` changes the 2/5-tab state. Never infer completed onboarding from local form text or mere presence of location.
- `apps/flutter_app/lib/features/auth/account_navigation.dart` implements the active five-tab design and temporary two-tab onboarding variant. `IndexedStack` retains active editors between tab switches. No visible Home destination. Bottom tab `Settings` is the owner-facing Profile destination in the original specification.
- `apps/flutter_app/lib/features/profiles/profile_workspace.dart` provides the wizard during incomplete setup, and the compact owner summary/edit/activation interface inside Settings when complete. All profile writes/readiness checks remain authenticated server operations; edits can invalidate completeness.
- `apps/flutter_app/lib/features/geo/friendship_sections.dart` displays Friendship/People only and reuses the private saved-location gate.
- `apps/flutter_app/lib/features/geo/local_feed_activities_sections.dart` owns the **third main tab** and its Local Feed/Activities toggle. Only the active section checks saved location, with no public feed/activity API calls.
- `apps/flutter_app/lib/features/geo/discovery_location_gate.dart` checks `/v1/me/geo/location` upon entering an eligible discovery surface; if the backend positively confirms `location:null`, show single-tap GPS and a manual sheet. An API error shows Retry, **not** a false "location missing" prompt. A confirmed save updates the active gate and other views via `locationRefreshEpoch`.
- `apps/flutter_app/lib/features/geo/geo_settings_panel.dart` presents a single `Location & discovery` expansion item in Settings, with a concise saved-area subtitle, private location editor and nested distance preferences. `IndiaLocationPanel(compact:true)` hides duplicate explanations/maintenance actions; errors and retry remain visible. No automatic permission prompt or background GPS.

### Settings behavior

**Before profile completion:** Essential account controls only: password settings, signed-in device management, **Location & discovery** expansion, logout. Do not show new profile/public visibility or unsupported settings actions.

**After profile completion:** Top owner summary (name/handle, Edit) plus expandable Profiles & visibility preserving P02-3 activation/preview actions, one Location & discovery expandable item, password controls, signed-in devices and logout. No large banners, two redundant Settings headings, advertising copy or rows of speculative future settings. The full existing profile editor appears only after explicit Edit.

### Privacy and no-discovery gate

An existing GeoNames place selection and GPS selection are private owner location in `uluv_settings`. The signed-in API derives the approximate H3 R6 cell; no raw GPS coordinates are retained. The original one-bucket CloudFront GeoNames catalogue is **public geographical source data only**, never owner records, and its manifest/shards are SHA-verified. Bundled India country polygon is loaded by Fastify locally, not on every request. PIN search remains on hold.

**Phase boundary (current):** This earlier UI cleanup introduced no public publication to `uluv_discovery`. P03-2 now adds private, bounded backend H3 query utilities only (see `P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`); it still does **not** publish profiles, return people/post feeds or activate Connects. `discoveryEnabled` remains false until future independently tested eligibility/publication gates.

### P03 document ownership and reading order

- `docs/architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md` — data import, S3, checksums, caching, H3, GPS, DynamoDB and operational diagnostics.
- `docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md` — implemented HTTP methods, auth/revision/privacy/error contracts and API route ownership.
- `docs/P03_READ_ME_FIRST.md` — current P03 index, retired-document cleanup and links to unchanged P01/P02 references.
- `docs/manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md` — exact Flutter, API and device tests.

### Verification state

Authoring workspace: portable Node source/contract checks executed. Flutter analyser, widget tests, real DynamoDB Local, CloudFront, and moto g04s remain **owner verification required**. The new `npm run verify:p03:navigation-docs` runs portable assertions; `npm run verify:p03:navigation-docs:full` additionally invokes typecheck and the Flutter suite. A source-contract pass never proves Dart compiles.
