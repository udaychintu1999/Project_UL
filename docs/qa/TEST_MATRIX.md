# CURRENT PROJECT CHECKPOINT — 2026-11-14 (P01-3 V3)

**P00:** historical owner `CORE_FLOW_VERIFIED`. **P01-1:** manual core accepted, Android OTP automated FAIL accepted only for local development (not a PASS). **P01-2:** owner explicitly reported all latest automated and manual checks PASS, accepted. **P01-3:** design and security decisions APPROVED, **NO CODE YET**; owner requested complete docs before authorizing coding. **P02:** not started.

**Current P01-3 authority:** `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` and companion simple-refresh/device/UX/QA docs. V2 proposals and archived `PENDING` markers are historical, not present directions. No AWS, live email, Google, or payment authorization.

---

# DynamoDB Local + H3 acceptance test plan — Step 03

**Planned, not executed.** Every test below must run against real DynamoDB Local and actual H3 calculations before claims of correctness.

| ID | Target tables | Test / expected result |
|---|---|---|
| T01 | users + auth_links | Two simultaneous signups with same verified identity → one `uid`, no duplicate links |
| T02 | profiles + settings + discovery | Activate with <2 photos → blocked; activate with 2 → correct R6 pointer |
| T03 | settings + discovery + local_posts | Change selected locality → old profile pointers invalid; old Local posts closed |
| T04 | dating_likes + dating_matches | Free ordinary Like that creates mutual match → zero credits spent |
| T05 | dating_likes + dating_matches + wallet | Paid Liked You Like Back creates match, exactly one debit; replay no debit |
| T06 | dating_matches + connections + wallet | Both people Connect concurrently → one pair entitlement and one debit |
| T07 | friendship_requests + wallet | Successful request → one debit, reject or expiry → no refund |
| T08 | friendship_requests + wallet | Invalid delivery/transaction error → no debit or corrected reversal |
| T09 | friendship_requests + connections | Accept valid request → shared entitlement, no recipient debit |
| T10 | blocks + all feature views | Blocked pair excluded from Dating, Friendship, Local and Chat |
| T11 | local_posts + activities | Activity create produces exactly one canonical post + one extension, both feeds same postId |
| T12 | local_posts + local_comments | Parent hidden/expired → comments inaccessible even before physical TTL deletion |
| T13 | local_posts + local_reactions | One active reaction per user/post, daily quota enforced; parent expiry removes accessibility |
| T14 | activities + local_posts | Activity end earlier than 7 days → no stale visible activity/posts |
| T15 | H3 R6 + discovery/local_posts | 0, 10, 35, 50km boundaries; cell boundaries covered; no out-of-radius leaks |
| T16 | geo cell pagination | Multi-cell cursor returns each eligible ID once, never skips, near band prioritized |
| T17 | wallet + operations | Monthly grants exactly once under concurrency, 4 women/2 other, no rollover |
| T18 | chat + connections | 7-day message hidden; clear-for-both changes generation while entitlement remains |
| T19 | safety + users/local_posts | Admin hides post/user → all indexed views immediately suppress; audit recorded |
| T20 | operations + Local tables | Expiry worker removes post, activity detail, comments, reactions and media refs without Scan |
| T21 | 18-table catalog | Create all 18 tables in DynamoDB Local, verify PK/SK and required operations |
| T22 | cost / hot cells | Dense-city R6 50-km pagination benchmarks: query counts, latency, RCUs/WCUs (where available) |

**P0:** Money and permissions T01/T04–T10/T17–T19. **P1:** Geo correctness T02/T03/T11–T16/T20–T22. Failure must block release of affected feature.

**v1.1 environment note:** Run P00–P15 real DB tests using Java 17+ DynamoDB Local (no Docker); use local media adapters; P16 payment-provider sandbox and P17 real AWS production cloud/media integration. Do not mark unexecuted checks PASS.
