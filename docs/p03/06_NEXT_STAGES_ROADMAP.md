# 06 — U_luv P03 remaining stages: design-to-acceptance roadmap

**Baseline date:** 18 November 2026. **Authority:** `docs/implementation/phases/P03.md` (D1/D2/D3/T1/T2/T3), `docs/architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`, actual repository source and owner-provided test logs.

**Accepted local-development milestones:** P03-1 (private location, Settings and two/five-tab shell); P03-2 (private, bounded H3 R6 reader and encrypted cursor). **Do not interpret acceptance as a public discovery/production release.** The original full 11/11 local verifier passed twice; seven device E2E cases passed separately after fixture expansion and recovery; a final combined 11/11 post-change rerun is still not evidenced. Hardware GPS permission/accuracy, a genuine normal-app OS force-stop/reopen and live CloudFront/OAC require separate manual acceptance.

## Why P03-3 is next

Today `uluv_discovery` contains **untrusted internal pointer contracts only**. Nothing publishes a user into discovery, and no HTTP route is available to fetch people. P02-3 fail-closed `discoveryEligible:false` must not be replaced with `true` merely to enable UI. Public visibility requires independent canonical account/profile/location/block/mode/media eligibility and revocable, versioned index maintenance.

## Proposed implementation sequence (stage numbers 4–6 are a planning split, not separate already-approved contracts)

| Stage | Scope and outputs | Hard stop / acceptance |
| --- | --- | --- |
| **P03-3 — Eligibility and pointer lifecycle (NEXT)** | Design and implement canonical eligibility and opt-in visibility rules; atomic/conditional create, revoke, move and invalidate `DISC#<MODE>#R6#<cell>` pointers on account/profile activation/pause, mode/media readiness, consent, moderation, blocks, location/revision changes and deletion. Verify no stale/unauthorized discoverability even with races, failures or partial transactions. | **Keep public discovery route OFF.** No pointer is trustworthy as the sole proof of permission. Owner-run real DynamoDB Local security/concurrency tests, comprehensive negative cases and existing P03 baseline regression required. Do not invent approved user consent if product contract does not define it; record decisions before coding. |
| **P03-4 — Authenticated discovery reads, canonical hydration and safe response projection (proposed)** | Reuse P03-2 bounded H3 cover/query/cursor; authorize viewer from session/own selected locality, independently re-read canonical account/profile/visibility/block/media/mode state for candidates, exact approved-center distance and revisions, enforce mutually applicable preferences, and return strictly allowlisted privacy-safe previews. Define errors, empty/continue semantics, quota/budget and sorted-page claim truthfully. | No UID/raw H3/precise location/pointers/private fields in client payload. Prove no cross-account, blocked, paused, changed locality, underage, stale, duplicate, over-radius, pagination or replay leakage. A limited authenticated read route only after security tests pass. |
| **P03-5 — Flutter Dating and Friendship discovery UX (proposed)** | Connect the existing five-tab UI to real approved read routes. Explicit band selector (0–10, 10–35, 35–50, All 0–50 km), approved sort modes only, card/list previews, load-more, filters as supported by policy, loading/empty/error/retry, accessibility, tab retention. Preserve Local Feed + Activities as a navigation section; do not silently implement local posts/activities backend. | Real API integration and physical Android taps; no demo-only results, no popularity/paid ranking or automatic radius widening. Near-band-first within bounded pages is **not** a claim of globally closest across unread partitions. |
| **P03 integration and phase closeout (label P03-6 only if owner adopts it)** | Integrate D1 backend, D2 Flutter and D3 workflow/error recovery with T1 unit/static, T2 real DynamoDB Local/API, T3 physical device tests; include boundary 0/10/35/50 km, cross-cell coverage, block/pause/edit/delete/retention/concurrent cursor cases and failure-injection. | Full fail-closed Windows verifier and separate OS/hardware/manual checks; no production/cloud authorization inferred. Only mark the full P03 phase complete after connected user journeys are demonstrably working and owner accepts evidence. |

## Invariants for every stage

- User-selected approximate locality, not continuous GPS; no exact personal coordinates or live movement in public cards, logs or cursors.
- Existing Dating/Friendship activation intentions are separate; P02 profiles, session/device security, media privacy, guided onboarding and five-tab navigation are frozen unless an actual defect is proven.
- Never infer eligibility from H3 pointer presence alone; account/status/age, active/mode/photo readiness, both-direction blocks, privacy and revisions must be checked from canonical records.
- `uluv_settings` viewer location is server authoritative. Never accept client-chosen center, index partition, unapproved radius or H3 resolution; only R6 and explicit agreed distance bands.
- Query budget in accepted P03-2: **6** PK Queries, **72** raw rows, **12** per partition and **24** internal pointers max per page, up to **1,600** cover cells. Keep bounded `Query`, never `Scan`; AES-GCM cursor bound to owner/preferences/revisions, TTL 10 minutes.
- No new DynamoDB table without verified documented justification, explicit owner decision and migrations; keep 18-table contract. DynamoDB Local remains manual Java on loopback through P16; unapproved AWS writes, S3/CloudFront changes, production payments or cloud deployment are forbidden.
- No implementation may bypass a failing test, lower security or alter accepted old stages simply to make P03-3 appear functional.

## P03-only documentation maintenance contract

**Primary living index:** `docs/p03/README.md` and this roadmap. Maintain user journey, storage/H3, API, evidence/manual gates and history/cleanup map as small canonical documents; fix broken links before deleting anything.

- Audit all `P03*` manuals, API/architecture notes, QA reports, phase/progress/next-step status **and links** against actual code and latest owner logs. Consolidate duplicated living instructions; retain unique normative privacy/spec contracts and actual prior FAIL/repair evidence as dated history.
- If genuinely obsolete unreferenced P03 docs are removed, include a **deletion manifest** and safe explicit project-relative removal steps (`git rm` where appropriate); **ZIP extraction cannot delete old files**. Never delete P01/P02 docs or general security/product source-of-truth documents.
- P03-only portions of shared `docs/NEXT_STEP.md`, `docs/implementation/PROGRESS.md`, `docs/qa/EVIDENCE_LOG.md`, and `docs/implementation/phases/P03.md` may be corrected. Do not rewrite unrelated P00–P02 records. Historical stale text should be labelled history, not silently made to look like the latest state.
- Record verified command, machine, result, and source of evidence; keep status separate for prior full 11/11, newer 7/7 physical device fixture tests, future post-patch full run, native GPS/CloudFront/manual and production readiness.

**Immediate next action:** Review the P03-3 design, security and transaction invariants against actual source; implement **P03-3 only** after identifying any decisions that require owner approval. Do not begin a public `GET /v1/discovery/...` route or UI until canonical eligibility and pointer lifecycle are proven.
