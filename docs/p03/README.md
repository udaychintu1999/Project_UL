# U_luv P03 — Current Technical Handbook

**Maintained:** 19 November 2026 · **Scope:** owner-accepted P03-1/P03-2, plus owner-verified P03-3 private pointer core and targeted restricted-account repair, with combined closeout retest pending. No public discovery/API/Flutter people results, no P03-4. P01/P02 documents remain unchanged.

## Read in this order

1. [01 — User journeys and navigation](01_USER_JOURNEYS.md): what a signed-in person sees, which tabs exist, the location flows, failure states.
2. [02 — GeoNames, GPS, storage and H3](02_GEO_DATA_STORAGE_AND_H3.md): actual data flow, integrity verification, privacy, cache, DynamoDB and future migration boundaries.
3. [03 — Implemented HTTP and internal API](03_API_REFERENCE.md): route ownership, request fields, error responses, P03-2 module contracts and explicit non-public endpoints.
4. [04 — Automated and manual acceptance](04_ACCEPTANCE_AND_RELEASE_GATES.md): commands, test capabilities, exact evidence vs remaining OS/device checks; what the extended Android tests really exercise.
5. [05 — History and safe documentation cleanup](05_LEGACY_MAP_AND_CLEANUP.md): prior P03 manuals, retained low-level source references and optional **P03-only** dry-run cleanup.
6. [06 — Next P03 stages](06_NEXT_STAGES_ROADMAP.md): proposed P03-3 publication, P03-4 API, P03-5 Flutter UI and P03 integration closeout; scope boundaries and acceptance gates.
7. [07 — P03-3 security closeout and decisions](07_P03_3_SECURITY_CLOSEOUT.md): actual post-recovery Windows evidence, restricted-account repair, moderation/block/delete decisions and exact next verification.

## P03-3 private core — verified, final scope still blocked

Owner's **18 Nov 2026** `npm run verify:p03-3` output **PASSED** all 15/15 portable and 11/11 full P03 gates, including new private DynamoDB pointer publication/revocation, TypeScript/lint, Flutter 81/81 and isolated real Android 7/7. The earlier missing test paths and GPS fixture failure were repaired in the owner's local tree. A later **19 Nov** owner run separately confirmed the new `reconcileRestrictedPointers` helper against real DynamoDB Local (**1/1 PASS**) and source contract (**1/1 PASS**). The first post-repair combined rerun stopped at portable gate 15/15 due to a stale `NOT YET RUN` documentation assertion. This patch repairs that assertion and adds the previously omitted real repair test to the fail-closed full verifier; a fresh owner rerun is mandatory. The helper is private, bounded and only cleans known anchored pointers for an account **already restricted by a trusted process**; no moderation or deletion route is introduced. See [07 — Closeout](07_P03_3_SECURITY_CLOSEOUT.md).

Open decisions/integration: trusted staff moderation and durable account-deletion path, block policy, unanchored orphan repair and post-fix full combined regression acceptance. Do not begin public discovery or describe P03-3 as fully accepted. Historic stage reports below remain dated evidence rather than new run instructions.

## Status with evidence boundaries

- **P03-1:** **OWNER-ACCEPTED for local automated development (18 Nov 2026).** Private manual/GPS selection, GeoNames CDN verification and Fastify fallback, location save/read, two/five-tab UI and Settings are implemented. The owner's November 18 Windows log shows 11/11 combined P03 acceptance gates passing, including authenticated local API checks, DynamoDB Local and Flutter/Android integration.
- **P03-2:** **OWNER-ACCEPTED for local automated development (18 Nov 2026).** H3 R6 coverage, bounded `uluv_discovery` partition Query, exact distance bands and encrypted cursors are implemented and the owner's original full 11/11 local acceptance passed. **These are internal building blocks, not a public discovery feature.**
- **Expanded physical-Android journeys:** **7/7 owner-reported PASS on 18 November 2026** after the recovered production Flutter files; Flutter analyzer returned **No issues found**. They exercise actual Flutter screens with a private loopback HTTP fixture, manual pick/save, five/two-tab routing, widget remount and server re-read, 409/429 retry and 503 outage recovery. They are **not** an OS force-stop, native hardware GPS, live Fastify session or CloudFront test. The owner subsequently reran the **full combined `verify:p03-3`** on 18 Nov: **15/15 portable and 11/11 full P03 PASS**, with Flutter **81/81** and Android **7/7**.
- **Not signed off:** native permission dialogs and real hardware GPS, true Android OS force-stop/relaunch with the owner account, live CloudFront/OAC behavior, and production release. A P03-3 **private** publication implementation candidate now exists; real transaction proof now passed; safety lifecycle closeout and corrected full combined regression remain outstanding, and the public people feed has **not started**.

**Source of truth:** runtime source and latest owner logs override stale historical status statements. `docs/implementation/phases/P03.md` remains the overarching forward-looking D1/D2/D3 specification, not proof that those later features are implemented.

### Detailed retained source references

- [`02 — Geo data, storage and H3`](02_GEO_DATA_STORAGE_AND_H3.md) and [`../architecture/P03_GEO_CDN_DATA_SEPARATION.md`](../architecture/P03_GEO_CDN_DATA_SEPARATION.md) — existing data pipeline, cache and cloud separation (previously linked detailed handbook is absent from this ZIP).
- [`../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md`](../architecture/P03_PRE_DISCOVERY_SHELL_AND_SETTINGS.md) — existing production shell details.
- [`../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`](../architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md) — detailed bounded-query, H3 and cursor internals.
- [`03 — Implemented API reference`](03_API_REFERENCE.md) and [`../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md`](../api/P03_2_INTERNAL_DISCOVERY_CONTRACTS.md) — current API and internal interface contracts (previously linked geo/shell contract is absent from this ZIP).

**Never share** private `apps/api/.env`, account tokens, H3 centers for named people, true GPS fixes or the owner's records in test output. No test should contact production AWS. P01/P02 authentication and 30-day session documentation remain in their own existing locations; P03 reuses those established security gates.
