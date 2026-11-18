# U_luv P03-1 / P03-2 — Current Technical Handbook

**Maintained:** 18 November 2026 · **Scope:** P03-1 private location and P03-2 private H3 discovery infrastructure, plus the P03 pre-discovery navigation shell. P01/P02 documents and behavior are unchanged.

## Read in this order

1. [01 — User journeys and navigation](01_USER_JOURNEYS.md): what a signed-in person sees, which tabs exist, the location flows, failure states.
2. [02 — GeoNames, GPS, storage and H3](02_GEO_DATA_STORAGE_AND_H3.md): actual data flow, integrity verification, privacy, cache, DynamoDB and future migration boundaries.
3. [03 — Implemented HTTP and internal API](03_API_REFERENCE.md): route ownership, request fields, error responses, P03-2 module contracts and explicit non-public endpoints.
4. [04 — Automated and manual acceptance](04_ACCEPTANCE_AND_RELEASE_GATES.md): commands, test capabilities, exact evidence vs remaining OS/device checks; what the extended Android tests really exercise.
5. [05 — History and safe documentation cleanup](05_LEGACY_MAP_AND_CLEANUP.md): prior P03 manuals, retained low-level source references and optional **P03-only** dry-run cleanup.
6. [06 — Next P03 stages](06_NEXT_STAGES_ROADMAP.md): proposed P03-3 publication, P03-4 API, P03-5 Flutter UI and P03 integration closeout; scope boundaries and acceptance gates.

## Status with evidence boundaries

- **P03-1:** **OWNER-ACCEPTED for local automated development (18 Nov 2026).** Private manual/GPS selection, GeoNames CDN verification and Fastify fallback, location save/read, two/five-tab UI and Settings are implemented. The owner's November 18 Windows log shows 11/11 combined P03 acceptance gates passing, including authenticated local API checks, DynamoDB Local and Flutter/Android integration.
- **P03-2:** **OWNER-ACCEPTED for local automated development (18 Nov 2026).** H3 R6 coverage, bounded `uluv_discovery` partition Query, exact distance bands and encrypted cursors are implemented and the owner's original full 11/11 local acceptance passed. **These are internal building blocks, not a public discovery feature.**
- **Expanded physical-Android journeys:** **7/7 owner-reported PASS on 18 November 2026** after the recovered production Flutter files; Flutter analyzer returned **No issues found**. They exercise actual Flutter screens with a private loopback HTTP fixture, manual pick/save, five/two-tab routing, widget remount and server re-read, 409/429 retry and 503 outage recovery. They are **not** an OS force-stop, native hardware GPS, live Fastify session or CloudFront test. The combined 11/11 verifier has **not yet been rerun on this final expanded-test/recovery state**.
- **Not signed off:** native permission dialogs and real hardware GPS, true Android OS force-stop/relaunch with the owner account, live CloudFront/OAC behavior, and production release. The P03-3 publication/eligibility and public people feed have **not started**.

**Source of truth:** runtime source and latest owner logs override stale historical status statements. `docs/implementation/phases/P03.md` remains the overarching forward-looking D1/D2/D3 specification, not proof that those later features are implemented.

### Detailed retained source references

- [`02 — Geo data, storage and H3`](02_GEO_DATA_STORAGE_AND_H3.md) and [`../architecture/P03_GEO_CDN_DATA_SEPARATION.md`](../architecture/P03_GEO_CDN_DATA_SEPARATION.md) — existing data pipeline, cache and cloud separation (previously linked detailed handbook is absent from this ZIP).
- [`../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md`](../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md) — existing production shell details.
- [`../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`](../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md) — detailed bounded-query, H3 and cursor internals.
- [`03 — Implemented API reference`](03_API_REFERENCE.md) and [`../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md`](../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md) — current API and internal interface contracts (previously linked geo/shell contract is absent from this ZIP).

**Never share** private `apps/api/.env`, account tokens, H3 centers for named people, true GPS fixes or the owner's records in test output. No test should contact production AWS. P01/P02 authentication and 30-day session documentation remain in their own existing locations; P03 reuses those established security gates.
