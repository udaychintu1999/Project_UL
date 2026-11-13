# U_luv — 18-Phase Implementation Master Plan v1.1

**Date:** 2026-11-10  
**Status (2026-11-13):** P00 owner-verified `CORE_FLOW_VERIFIED`; P01 first local email-OTP slice implemented, `PARTIALLY_VERIFIED` pending live Windows tests; P02–P17 not started. See `PROGRESS.md` for current evidence.  
**Baseline:** Product and Business contract v1.1 as updated by the latest U_luv decisions; 18-table Step 03 design, H3 resolution 6, user-selected distance bands; original Project U_Day phase-by-phase handoff principles.  
**Delivery target:** Both autonomous coding agents AND ordinary AI chats.

## Environment gates (binding): Java/local first; AWS and payment providers last

See [`ENVIRONMENT_AND_INTEGRATION_POLICY.md`](ENVIRONMENT_AND_INTEGRATION_POLICY.md). P00–P16 require Java 17+ DynamoDB Local (no Docker). Owner sets up two DEV S3 buckets/one DEV CloudFront early, but no AI AWS calls without scoped approval; tests remain local by default. P16 payment sandbox/production planning; P17 owner-approved real AWS DynamoDB and separate production media/ECS.

## Mandated phase structure: 3 development + 3 testing sections

Every phase guide contains **D1 Backend + DynamoDB**, **D2 Flutter/User experience**, **D3 Full workflow and recovery**, **T1 static/unit**, **T2 real integration**, **T3 UI/end-to-end/manual fallback**. The phase owner must implement code in D1–D3 and produce runnable tests plus evidence from T1–T3. Test code generation is not test execution. In Chat mode, lack of Java DynamoDB Local/Flutter/Android/dependencies is a limitation to document, not a reason to omit tests or claim PASS.

## Phase map

| Phase | Feature/workstream | Predecessors | Deliverable |
|---|---|---|---|
| [P00](phases/P00.md) | Repository foundation and genuine local QA harness | None | A bootable monorepo with connected Flutter, Fastify/TypeScript and DynamoDB Local; real local scripts; a simple health screen; no mock-only green check. |
| [P01](phases/P01.md) | Identity, authentication and account eligibility | P00 | Google Sign-In and email OTP without mandatory phone; immutable uid; adult-only account gate. |
| [P02](phases/P02.md) | Dating/Friendship profiles and photo storage | P01 | Independent public/contact-safe profiles, at least two photos per enabled mode, up to six, and reusable media selections. |
| [P03](phases/P03.md) | Settings, H3 R6 and algorithm-free geographic discovery | P02 | User-selected approximate location; H3 resolution 6; user-set 0–10, 10–35, 35–50 and All 0–50 km; nearest-band-first without popularity ranking. |
| [P04](phases/P04.md) | Shared Connect wallet, free grants and ledger | P01 | 4 free monthly credits for self-identified women, 2 for other eligible users; free first; no rollover; durable paid ledger; concurrency-safe debits. |
| [P05](phases/P05.md) | Connection entitlement and gated chat foundation | P01, P04 | Single canonical pair entitlement plus basic text/photo chat gated by real server permission; message seven-day lifespan. |
| [P06](phases/P06.md) | Ordinary Dating Likes, Liked You and Likes Sent | P02, P03, P04 | Ordinary 100/day Likes and unlimited Passes, incoming Likes visible free, outgoing Likes list. |
| [P07](phases/P07.md) | Mutual Dating matches and paid Liked You Like Back | P04, P06 | Free mutual match through ordinary swipes; explicit 1-credit Like Back in Liked You, matching state and no fake expiry. |
| [P08](phases/P08.md) | Paid Dating Connect and lifetime conversation access | P05, P07 | Explicit 1-credit Connect on mutual match, exactly one successful pair unlock, free ongoing chat and rematch logic. |
| [P09](phases/P09.md) | Paid Friendship invitations and acceptance | P03, P04, P05, P08 | 1 credit consumed at successful send; accept opens previously built real chat; decline/expiry/cancel no routine refund. |
| [P10](phases/P10.md) | Hyperlocal social posts with up to five photographs | P02, P03 | Text/photos (0–5) local Question/Recommendation/Discussion/Activity shell; 3 daily posts, 5 active; geo-cell feed; seven-day maximum expiry. |
| [P11](phases/P11.md) | Local public comments, reactions and limits | P10 | Free comments/reactions, 10 comments/day, 30 reactions/day and one active reaction/post; parent visibility always enforced. |
| [P12](phases/P12.md) | Activity posts and real-world companion flow | P09, P10, P11 | One Activity extension to one canonical Local post; event end ≤7 days; private one-to-one request uses Friendship paid flow. |
| [P13](phases/P13.md) | Blocking, reporting, basic safety guardrails | P05, P06, P09, P10, P11 | User/post/conversation reporting, cross-mode blocking, risk-based minor restriction hooks and low-budget text/image safety rules. |
| [P14](phases/P14.md) | Admin moderation website and action audit | P13 | Separate minimal admin website: search Post/User IDs, hide/delete/restrict, review reports and maintain action audit. |
| [P15](phases/P15.md) | Notifications, expiry and account data lifecycle | P05, P09, P10, P11, P12, P13 | Genuine-event notifications; reliable seven-day visibility plus cleanup; deactivation, deletion, local move and minimal retention. |
| [P16](phases/P16.md) | Late payment-provider sandbox + cloud release preparation | P04, P08, P09 | Real Google Play sandbox/provider verification, eligible Indian alternative billing assessment; production AWS DynamoDB/S3/CloudFront infrastructure plan and stage readiness; Apple StoreKit later-iOS contract. |
| [P17](phases/P17.md) | Production AWS integration, end-to-end validation, release gate | P00–P16 | Owner-approved real AWS DynamoDB production table provisioning, S3/CloudFront/ECS staging, payment sandbox-to-release verification, founder-critical workflows and Pan-India release gate. |

## Milestones (do not skip critical gates)

- **M0: P00** Java DynamoDB Local (no Docker) environment and test harness truly operational.
- **M1: P01–P03** Account/profile/location discovery end-to-end.
- **M2: P04–P09** Credits, Dating and Friendship unlocks with real messaging and concurrency tests.
- **M3: P10–P12** Hyperlocal photos, comments, reactions and activities with real geo access control.
- **M4: P13–P16** Safety/admin, deletion/notifications, late payment-provider sandbox and cloud preparation.
- **M5: P17** Live AWS DynamoDB production tables/S3/CloudFront/ECS integration and full system release gating.

## Daily/turn workflow

1. Load `docs/START_HERE.md`, `docs/implementation/PHASE_MASTER.md`, and the current single `phases/Pxx.md`; read only the relevant domain/QA docs.
2. Choose one **small complete vertical slice** from current D1–D3; implement backend + Flutter UI + real persistence as applicable.
3. Generate tests/scripts at the same time as implementation; run every possible test in the environment. If an unavailable tool blocks execution, preserve a runnable script and mark that check `UNVERIFIED`.
4. Fix verified regressions, rerun the affected test suite; do not claim a feature is working based on code inspection.
   - For unavailable device/interactive tests or repeated failures without a proven app defect, **proactively request owner manual testing**, with exact commands, visible steps and expected results. Preserve the automated failure and record manual observations separately; follow `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.
5. Update `docs/implementation/PROGRESS.md` once at the end of the slice/phase, plus `docs/qa/EVIDENCE_LOG.md`, changed docs, and `docs/NEXT_STEP.md`.
6. Deliver **project-relative changed code**, relevant QA scripts and updated `docs/` in the step ZIP; never deliver only a report when code was requested.
7. Phase gate: `CORE_FLOW_VERIFIED`, `PARTIALLY_VERIFIED`, or `RELEASE_BLOCKED`. An ordinary AI chat should usually report `PARTIALLY_VERIFIED` when Flutter/DynamoDB Local cannot be executed; this is honest and expected.

## Architectural constraints preserved

- Flutter app, Fastify/TypeScript AWS ECS monolith, DynamoDB, S3/CloudFront, SES; no Lambda/microservices; 18 feature-aligned tables; persistent opaque uid. P00–P16 **Java DynamoDB Local**, no Docker; local media adapter by default. Owner manually sets up DEV 2 private S3 buckets + one signed CloudFront distribution in early phases; no AWS requests by AI unless separately owner-approved, otherwise UNVERIFIED. P16 payment sandbox & production infrastructure planning; P17 owner-approved real AWS DynamoDB plus separate production S3/CloudFront/ECS.
- Query/GetItem/BatchGet/atomic transactions, no request-facing DynamoDB Scan; no extra GSIs without evidence. H3 R6 initial choice subject to measured hot-cell fan-out.
- Dating ordinary free Like and paid Like Back are distinct; one Connect credit unlocks chat; Friendship send consumes one credit; monthly women 4/others 2; transactions exactly once.
- Discovery selected bands [0,10], (10,35], (35,50] km, plus All 0–50; near-band priority, not guaranteed globally exact nearest neighbor without adequate candidate coverage.
- Local text + up to five photos; 3 posts/day, 5 active, 10 comments/day, 30 reactions/day; posts and individual messages expire seven days max subject to necessary safety/legal retention; lifetime connection at launch.

## Hand-off principle

This implementation plan is **not** proof of implementation. Do not begin coding P01 if P00 cannot be made runnable or its blocker cannot be documented. `docs/qa/RELEASE_GATE.md` governs truthfulness of status.
