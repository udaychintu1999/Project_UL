> **FINAL security + media correction:** 2 DEV private S3 buckets + 1 DEV signed CloudFront distribution, OWNER MANUAL early setup. No agent AWS activity unless narrowly authorized. Java DynamoDB Local through P16; production AWS DynamoDB/media P17. Secrets handling under `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.

# Step 03 Architecture Decisions (ADR)

| ADR | Decision | Reason | Constraint / verification |
|---|---|---|---|
| 001 | **18 feature-aligned DynamoDB tables** | Clear ownership across growing modes | Extra tables do not guarantee speed; measure RCUs, WCUs, bytes, ops |
| 002 | Split former `uluv_accounts` → `uluv_users`, `uluv_auth_links`, `uluv_profiles`, `uluv_settings` | Separate public, sensitive identity, and preferences | Account creation touches user + provider link atomically |
| 003 | Split former `uluv_relationships` → `uluv_dating_likes`, `uluv_dating_matches`, `uluv_friendship_requests`, `uluv_connections`, `uluv_blocks` | Different read/write/retention and finance rules | Cross-table invariants transact atomically |
| 004 | Split former `uluv_local` → `uluv_local_posts`, `uluv_activities`, `uluv_local_comments`, `uluv_local_reactions` | High-growth social content and separate moderation/write pressure | Activity has one canonical post, not duplicated posts |
| 005 | Keep `uluv_discovery`, `uluv_wallet`, `uluv_chat`, `uluv_safety`, `uluv_operations` as separate tables | Already coherent operational boundaries | Split later only if measured hot path requires it |
| 006 | H3 Resolution 6, one home-cell pointer per profile and per Local post | Lower index write amplification, transparent locality model | Measure 50-km fan-out and city hot cells |
| 007 | User-adjustable 0–10, 10–35, 35–50 and all 0–50 km; nearest bands first | User's algorithm-free distance preference | Distance computed from *selected locality centers*; per-band strict sorting only of fetched candidates |
| 008 | Zero starting GSIs, reverse/mirrored materialized pointers where necessary | Explicit Query patterns, minimal index costs | Add GSI after proof—not as doctrinal ban |
| 009 | Immutable opaque user `uniqueId`; public handle changeable | Project U_Day identity pattern | No user contact details in feed indexes |
| 010 | Wallet + ledger + idempotency + domain action must commit together | Money correctness and retries | Same-account/Region TransactWrite; <=100 items/4 MB |
| 011 | Canonical `uluv_connections` pair entitlement persists across mode changes | Avoid duplicate paid unlock | Block/unmatch state governs active permission |
| 012 | TTL is cleanup only; visibility checks enforce exact expiry | Seven-day user-facing promise | Background cleanup includes S3 media, indexes, comments, reactions |
| 013 | No automatic irreversible ban solely on report count | Prevent coordinated report abuse | Admin can hide, investigate, restore, audit |
| 014 | No deployed code or live database benchmark included in this handoff; P00 source scaffold exists | Accurate validation status | Step 04 runs actual integration tests |

**Cost clarification:** AWS bills primarily for requests, storage and enabled features, not a flat fee per standard on-demand table. However, cross-table writes, duplicated projections, backups, alarms and operational work can raise costs. Split by access patterns, not by the idea that tables are free in every respect.


**FINAL v2.0:** Java DynamoDB Local throughout P00–P16. Owner manually sets up two DEV S3 buckets and one DEV CloudFront distribution early; no AI-driven AWS activity without separate scoped explicit approval. Local media adapter remains default; production AWS DynamoDB/media/ECS at P17, payment sandbox P16. See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.

## 2026-11-13 — P01-2 password and P01-3 persistent session split
Password credentials live in existing `uluv_auth_links` (user UID key, `SK=CREDENTIAL#PASSWORD`), Argon2id with per-password salt. Existing email verified link remains canonical. Atomic user `sessionEpoch` increment after change/reset revokes all previously issued session tokens on their next access check without a table scan. No extra tables or GSIs. Avoid JWT migration. Server token lifetime stays at 24h until P01-3 adds secure Android storage and 30-day rotating renewals. API remains local-only in P01.
