# Short-lived content and cleanup boundaries

## Product lifespan

| Data | Owner table | Visibility deadline | Physical deletion |
|---|---|---|---|
| Local post + up to 5 photos | `uluv_local_posts` (+ S3) | min(created+7d, activityEnd) for activities | Cleanup canonical, FEED/author pointers + S3 refs |
| Activity metadata + activity index | `uluv_activities` | same canonical post expiry | Remove extension and `ACTIVITY#R6#cell` pointer |
| Comment | `uluv_local_comments` | never after parent post hidden/expired | Delete comments by `POST#id` Query |
| Reaction | `uluv_local_reactions` | never after parent post hidden/expired | Delete reactions by `POST#id` Query |
| Chat message / image | `uluv_chat` (+ S3) | seven days after send | Cleanup per thread/generation + S3 media |
| Connection entitlement | `uluv_connections` | while pair is eligible to chat | Remains per lifetime/unmatch policy; account deletion changes requirements |
| Wallet purchase/ledger | `uluv_wallet` | authorized user/admin access only | Retention per financial/operational requirements |
| Reports/incident evidence | `uluv_safety` | access restricted | Separate narrow safety/legal retention policy |

## Immediate visibility

DynamoDB TTL does NOT guarantee deletion at the exact expiry moment. Always enforce `status`, `expiresAt`, block/eligibility and parent-post status at reads/writes. On delete-for-both-chat, advance `generation` and hide all prior generations immediately, then cleanup old messages/media.

## Cleanup flow (no Scan)

Use deterministic hourly due buckets in `uluv_operations` (`EXP#hour#shard / DUE#epoch#type#id`) and bounded `Query`, with retries and checkpoints. For each expired post, query comment and reaction partitions, remove extensions/pointers, release S3 images. For chat, query current/old message generations and revoke relevant media access. TTL only acts as a supplementary backstop.

## Correctness edge cases

- One activity is one canonical post. Removing/hiding `POST#id` must suppress it in Local Feed, Activity-only and Nearby People feeds immediately.
- Post/report/admin delete by ID must not be defeated by stale cell pointers.
- If locality changes, close old posts and remove their visibility without shifting them into the new neighborhood.
- Clear chat for both should not remove `uluv_connections` paid entitlement.
- 7-day messaging expiry applies to individual messages. Exact media deletion/backup commitments require separately verified service behavior and disclosed policy.
- Safety/required retention exceptions must be narrowly controlled; do not represent messages as globally impossible to recover if such exceptions remain.


**FINAL v2.0:** Java DynamoDB Local throughout P00–P16. Owner manually sets up two DEV S3 buckets and one DEV CloudFront distribution early; no AI-driven AWS activity without separate scoped explicit approval. Local media adapter remains default; production AWS DynamoDB/media/ECS at P17, payment sandbox P16. See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.
