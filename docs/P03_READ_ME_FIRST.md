# P03 — READ ME FIRST (current implementation, decisions, docs)

**Document baseline:** the owner's uploaded `docs(1).zip` (17 November 2026). **Scope:** P03 only. This update does **not** rewrite P01/P02 documents, shared product contracts, broad progress/changelogs or unrelated architecture. The P03-2 change adds private H3 query infrastructure, P03-only docs and regression tests; existing five-tab navigation/P03-1 behavior and P01/P02 documentation are unchanged.

## Read these in order

| Need | One current document |
| --- | --- |
| P03-2 internal H3 R6 design and limits | [`architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`](architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md) |
| P03-2 private interface/API non-public contract | [`api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md`](api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md) |
| P03-2 Windows/DynamoDB Local checks | [`manual/P03_2_WINDOWS_ACCEPTANCE.md`](manual/P03_2_WINDOWS_ACCEPTANCE.md) |
| P03-2 verification status | [`qa/P03_2_IMPLEMENTATION_REPORT.md`](qa/P03_2_IMPLEMENTATION_REPORT.md) |
| Current behavior and phase boundary | [`implementation/phases/P03.md`](implementation/phases/P03.md) |
| Main navigation (no Home) and clean Settings | [`architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md`](architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md) |
| GeoNames processing, one-bucket S3/CloudFront, offline packs, one-time GPS and DynamoDB H3 R6 | [`architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md`](architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md) |
| Exact implemented authenticated P03 HTTP routes, request/response and failures | [`api/P03_GEO_AND_SHELL_API_CONTRACTS.md`](api/P03_GEO_AND_SHELL_API_CONTRACTS.md) |
| Windows/Android verification and privacy edge cases | [`manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md`](manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md) |
| Implementation verification record (with honest unverified gates) | [`qa/P03_FOUR_TAB_SETTINGS_CLEANUP_QA.md`](qa/P03_FOUR_TAB_SETTINGS_CLEANUP_QA.md) |

**Specific supporting decision notes:** [`architecture/P03_GEO_CDN_DATA_SEPARATION.md`](architecture/P03_GEO_CDN_DATA_SEPARATION.md) is a historical one-bucket rationale; [`architecture/P03_1C_PINCODE_SEARCH.md`](architecture/P03_1C_PINCODE_SEARCH.md) is explicitly **on hold**. They are not alternative current runbooks. `manual/P03_GEO_CLOUDFRONT_OWNER_SETUP.md` is retained for AWS-console-only upload/troubleshooting, not runtime behavior.

## Current behavior at a glance

- No Home destination. Incomplete profile: **Dating/setup, Settings**. Complete profile: **Dating, Friendship, Local Feed, Connects, Settings**. The third tab contains Local Feed and Activities sections; Friendship has neither. Saved profile summary/edit are in Settings.
- `onboarding.ready` is **server-confirmed**, not a Flutter assumption. GPS or manual place selection is a separate saved-location state; Dating/Friendship/Local Feed/Activities prompt for location only if the authenticated owner location is genuinely absent.
- Existing `geo/india/v1/` JSON reference files stay in the one S3 bucket, served via CloudFront; Fastify independently pins canonical manifest SHA. Flutter caches chosen district packs. User location is kept privately in DynamoDB, H3 R6 only; India GPS boundary is bundled locally with the API, not S3.
- Only private location and placeholder shell behavior are active. **P03-2 private H3 discovery infrastructure has been prepared (acceptance pending); public discovery remains disabled**. PIN lookup is on hold.

## P03-only obsolete manuals (safe to retire after backing up)

These old files in `docs(1).zip` duplicate, or conflict with, the **current** consolidated owner acceptance guide. This ZIP does **not** silently delete them from your repository. Once you are satisfied that their content is covered by the current guide, delete the following **P03-only** paths manually; leave all P01/P02 files alone:

- `docs/manual/P03_API_TERMINAL_LOGGING_AND_DART_COMPILE_REPAIR_2026_11_17.md`
- `docs/manual/P03_AUTO_DISTRICT_LOAD_WINDOWS_ANDROID_ACCEPTANCE.md`
- `docs/manual/P03_GEO_SAVED_LOCATION_WINDOWS_ACCEPTANCE.md`
- `docs/manual/P03_GPS_BOUNDARY_AND_SETTINGS_CRASH_WINDOWS_ACCEPTANCE.md`
- `docs/manual/P03_LOCATION_RECOVERY_AND_ONE_TAP_GPS_WINDOWS_ACCEPTANCE.md`
- `docs/manual/P03_PRE_DISCOVERY_NAVIGATION_WINDOWS_ACCEPTANCE.md`

Keep the old `docs/qa/P03_*` incident reports as **historical evidence**, not current instructions. Do not use the old pre-cleanup `P03_PRE_DISCOVERY_NAVIGATION_WINDOWS_ACCEPTANCE.md` after consolidation. The active P03 shell document **replaces** previous four/five-tab drafts at the same path, so no additional rename is needed.

## External contracts that P03 MUST NOT reimplement

- P01-3 30-day, device-bound, rotating persistent sessions: see existing `docs/design_reviews/P01_3_*`; unchanged by this ZIP.
- P02 authenticated profile dashboard, completeness, photos, owner activation/preview: see existing `docs/design_reviews/P02_*` and runtime source; unchanged by this ZIP.
- The stale P03 Node assertion referencing `docs/design_reviews/P02_1_COMMON_PROFILE_AND_ONBOARDING_GATE_2026_11_15.md` has been removed: that file was intentionally absent from the owner's cleaned P02 docs. The test now validates the actual existing P02 backend route and P03 documentation, without manufacturing historical P02 files.

## Maintenance rule for new P03 work

Update the relevant P03 architecture, P03 API, P03 owner acceptance and P03 QA record **in the same change**. Do not append new P03 details to the general P01/P02 chapters. P03-2 infrastructure must preserve the existing P03-1 location, five-tab shell, P01-3 session semantics and P02 profile/photo logic. Never describe a source-contract or doc-only check as Flutter/Android/live DynamoDB verification.

**Legacy filenames:** `P03_FOUR_TAB_SETTINGS_*` filenames are retained to update the existing doc/test paths in place; their **content now describes five tabs**. Do not follow historical four-tab advice.
