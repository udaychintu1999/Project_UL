# Technical documentation index â€” P03 integration references

> This index exists to keep **P03 integration** readable while preserving the owner's existing P01/P02 documentation. It makes no changes to those documents. Start at `docs/P03_READ_ME_FIRST.md` for the complete current P03 map.

## P03 current docs

- `docs/P03_READ_ME_FIRST.md` â€” canonical P03 entry and retirement list.
- `docs/architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md` â€” Dating first, five final tabs (Local Feed + Activities third), profile in Settings.
- `docs/p03/02_GEO_DATA_STORAGE_AND_H3.md` â€” GeoNames, CloudFront, local India GPS boundary, Flutter pack cache, DynamoDB/H3.
- `docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md` â€” authenticated API routes and error/privacy contracts.
- `docs/manual/P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md` â€” real acceptance gates.
- `docs/implementation/phases/P03.md` â€” still-planned H3/discovery phases.

## P01 and P02 dependencies (read-only pointers)

- **P01-3 30-day persistent sign-in:** `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` and `docs/design_reviews/P01_3_REFRESH_SIMPLE_PROTOCOL_AND_SECURITY_V3.md`; source `apps/api/src/features/auth/device-session-policy.ts` defines `P13_REAUTH_SECONDS = 30 * 24 * 60 * 60`. Refresh must not move the absolute reauthentication deadline. Never replace P01-3 Keystore device proof / rotating refresh with a P03 local session flag.
- **P02 profiles and onboarding:** use whichever verified P02 docs remain in this owner's current `docs/design_reviews/` and the current `apps/api/src/features/profiles/` + Flutter profile workspace. Do not restore removed P02 filenames or reauthor P02 contracts during a P03 docs cleanup.
- P03 location readiness is independent of `onboarding.ready`; account status and location status both come from authenticated Fastify reads.

This file is a P03 integration reference only, not a replacement for P01/P02 phase documentation.

**Navigation precedence:** P03 owner decision dated 2026-11-17 specifies five completed-profile tabs; older shared product/design text describing four is historical for this one topic. P01/P02 source documents remain unchanged.
