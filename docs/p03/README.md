# U_luv P03-1 / P03-2 — Current Technical Handbook

**Maintained:** 18 November 2026 · **Scope:** P03-1 private location and P03-2 private H3 discovery infrastructure, plus the P03 pre-discovery navigation shell. P01/P02 documents and behavior are unchanged.

## Read in this order

1. [01 — User journeys and navigation](01_USER_JOURNEYS.md): what a signed-in person sees, which tabs exist, the location flows, failure states.
2. [02 — GeoNames, GPS, storage and H3](02_GEO_DATA_STORAGE_AND_H3.md): actual data flow, integrity verification, privacy, cache, DynamoDB and future migration boundaries.
3. [03 — Implemented HTTP and internal API](03_API_REFERENCE.md): route ownership, request fields, error responses, P03-2 module contracts and explicit non-public endpoints.
4. [04 — Automated and manual acceptance](04_ACCEPTANCE_AND_RELEASE_GATES.md): commands, test capabilities, exact evidence vs remaining OS/device checks; what the extended Android tests really exercise.
5. [05 — History and safe documentation cleanup](05_LEGACY_MAP_AND_CLEANUP.md): prior P03 manuals, retained low-level source references and optional **P03-only** dry-run cleanup.

## Status with evidence boundaries

- **P03-1:** private manual/GPS selection, GeoNames CDN verification and Fastify fallback, location save/read, two/five-tab UI and Settings are implemented. The owner's November 18 Windows log shows 11/11 combined P03 acceptance gates passing, including authenticated local API checks, DynamoDB Local and Flutter/Android integration.
- **P03-2:** H3 R6 coverage, bounded `uluv_discovery` partition Query, exact distance bands and encrypted cursors are implemented and the same owner's full local acceptance passes. **These are internal building blocks, not a public discovery feature.**
- **Extended Android journey tests:** added after the earlier full pass. They now test production picker widgets, locally authenticated HTTP, place selection/save, cross-tab state, widget remount/re-read, 409/429 and outage retry. They are **not yet owner-executed/accepted** as of this update. A fresh pass is required.
- **Not signed off:** native permission dialogs and real hardware GPS, true Android OS force-stop/relaunch with the owner account, live CloudFront/OAC behavior, and production release. The P03-3 publication/eligibility and public people feed have **not started**.

**Source of truth:** runtime source and latest owner logs override stale historical status statements. `docs/implementation/phases/P03.md` remains the overarching forward-looking D1/D2/D3 specification, not proof that those later features are implemented.

### Detailed retained source references

- [`../architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md`](../architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md) — existing detailed data pipeline, GeoNames license, cache/security internals.
- [`../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md`](../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md) — existing production shell details.
- [`../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`](../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md) — detailed bounded-query, H3 and cursor internals.
- [`../api/P03_GEO_AND_SHELL_API_CONTRACTS.md`](../api/P03_GEO_AND_SHELL_API_CONTRACTS.md) and [`../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md`](../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md) — detailed authoritative API and interface contracts.

**Never share** private `apps/api/.env`, account tokens, H3 centers for named people, true GPS fixes or the owner's records in test output. No test should contact production AWS. P01/P02 authentication and 30-day session documentation remain in their own existing locations; P03 reuses those established security gates.
