# Capacity, costing and growth strategy for 18 tables

## Pricing facts and caveats

DynamoDB's standard on-demand charges are primarily read/write request units, storage and optional features. There is no generic per-table monthly fee solely for having a standard on-demand table, but each added table entails setup/alarms/backups/quotas and frequently mirrored writes. Transactional reads/writes consume more capacity than comparable standard operations.

## Why splitting is reasonable for U_luv

- Auth access and public profile discovery have different confidentiality and update frequencies.
- Incoming Dating Likes and matching have different query shapes from paid Friendship invitations and blocked edges.
- Local post reads, Activity-specific filtering, comment volume and reaction volume can grow independently.
- Independent table provision/capacity modes, alarms, PITR and lifecycle management become easier to reason about.

## Why splitting alone will NOT guarantee performance

- Many DynamoDB table partitions can still have hot keys (dense Mumbai/Hyderabad cells; very popular posts; highly active users).
- Cross-table transaction writes cost capacity; Local Activity creation writes both canonical post and activity extension, plus two geographic pointers.
- A feed with H3 R6 at 50 km may need substantial cell `Query` fan-out. Pagination caps per-cell records only; it cannot eliminate the number of intersecting partitions.
- Unnecessary duplicated pointers consume write/storage capacity; evaluate with actual workload before adding more.

## Metrics required in Step 04

| Workflow | Measure |
|---|---|
| Dating near feed per band | cell queries, read capacity, p50/p95 response time, filtered candidates |
| Local posts near feed | home-cell fanout, post hydration, S3 refs, bytes read |
| Activity feed | activity-only pointer efficiency, canonical lookups |
| Paid Like Back | per-action transact item count, charged WCUs, retry handling |
| Paid Connect | concurrent unique pair race, exactly-one debit |
| Friendship request | successful send charge, retry/refund correctness |
| Posts/comments/reactions | write amplification, quota contention, hot-post limits |
| Expiry and cleanup | max lag of physical cleanup, stale pointers, orphan images |

No unmeasured performance or cost savings should be described as verified.


**FINAL v2.0:** Java DynamoDB Local throughout P00–P16. Owner manually sets up two DEV S3 buckets and one DEV CloudFront distribution early; no AI-driven AWS activity without separate scoped explicit approval. Local media adapter remains default; production AWS DynamoDB/media/ECS at P17, payment sandbox P16. See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.
