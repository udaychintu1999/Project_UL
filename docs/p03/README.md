# U_luv — P03 technical handbook

**Maintained 19 November 2026.** This is the single entry point for P03. P01/P02 contracts and security policies remain authoritative in their own documentation. Runtime source and owner-run logs outrank historical prose. No public people-search endpoint, public preview, or P03-4 feature is enabled.

| Read | Purpose |
| --- | --- |
| [01 — User journeys](01_USER_JOURNEYS.md) | Two/five-tab navigation, Settings, consentful manual/GPS save, UI failure states |
| [02 — Geography and H3](02_GEO_DATA_STORAGE_AND_H3.md) | GeoNames release, S3/CloudFront setup and rollback, pinned integrity, DynamoDB, H3/cursor limits |
| [03 — API contracts](03_API_REFERENCE.md) | Real authenticated endpoints, internal modules, status/error rules, **nonexistent** public APIs |
| [04 — Verification](04_ACCEPTANCE_AND_RELEASE_GATES.md) | Actual owner evidence, Windows commands, regression gates, physical-device/manual gaps |
| [05 — Pointer lifecycle and safety](05_POINTER_LIFECYCLE_AND_SAFETY.md) | P03-3 transaction map, new trusted restriction primitive, incident recovery, block/delete boundaries |
| [06 — Next stages](06_NEXT_STAGES_ROADMAP.md) | P03-4 hydrated public reads, P03-5 Flutter, deferred PIN work and cross-phase decisions |

## Current evidence checkpoint

**Owner Windows run, 19 November 2026:** `npm run verify:p03-3` finished **15/15 portable and 11/11 full P03 gates PASS**; 81/81 Flutter widget tests and 7/7 isolated physical Android UI/loopback HTTP journeys PASS; both P03-3 real DynamoDB Local publication and restricted-account repair integrations PASS. This is the **accepted automated core checkpoint**, not full P03 end-to-end discovery, native GPS approval, live CDN verification, production authorization or acceptance of any new edits made after that run.

The P03-3 follow-up adds an **unexposed trusted restriction transaction** with audit and automatic revocation. It is a candidate requiring a new real-DynamoDB/full-owner run; no authorized moderator endpoint, block workflow, data-erasure workflow or global index cleanup has been implemented by this private helper. Consult 05 before interpreting private pointers as eligibility.

**P01-3 30-day persistent sign-in remains unchanged:** source `apps/api/src/features/auth/device-session-policy.ts` defines `P13_REAUTH_SECONDS = 30 * 24 * 60 * 60`; see `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`. Preserve device-bound Keystore proof, refresh rotation and absolute reauthentication deadline. **P02** remains the source of profile `onboarding.ready`, READY photo ownership and requested-mode intent.

**Navigation precedence:** P03 owner decision is five main tabs for completed profiles — **Dating, Friendship, Local Feed (Activities inside), Connects, Settings** — and only Dating/setup + Settings for incomplete profiles. Historical four-tab wording elsewhere is superseded for this topic only.

All P03-only superseded documents were consolidated into this handbook and are recoverable through Git history. Refer to the delivery's deletion manifest before any `git rm`. Avoid restoring obsolete instructions solely to satisfy old path-based tests; the maintained tests must validate actual current contracts.
