# Step 02 → Step 03: Table splits, boundaries and migration strategy

## Old-to-new table map

| Step 02 table | Step 03 table(s) |
|---|---|
| `uluv_accounts` (retired) | `uluv_users`, `uluv_auth_links`, `uluv_profiles`, `uluv_settings` |
| `uluv_relationships` (retired) | `uluv_dating_likes`, `uluv_dating_matches`, `uluv_friendship_requests`, `uluv_connections`, `uluv_blocks` |
| `uluv_local` (retired) | `uluv_local_posts`, `uluv_activities`, `uluv_local_comments`, `uluv_local_reactions` |
| `uluv_discovery` | Unchanged |
| `uluv_wallet` | Unchanged |
| `uluv_chat` | Unchanged |
| `uluv_safety` | Unchanged |
| `uluv_operations` | Unchanged |

**Count:** 8 - 3 retired + (4+5+4) new = **18 physical tables**.

## Preventing duplicate ownership

- User account owns identity; profile owns mode content; settings owns selected locality; auth-link owns provider mapping.
- `uluv_dating_likes` owns directional Like facts; `uluv_dating_matches` owns mutual match generation; `uluv_connections` owns paid entitlement. Never treat match as proof of a paid chat entitlement.
- `uluv_friendship_requests` owns the request attempt and charge outcome; on acceptance create/confirm the pair's shared entitlement.
- Every Local post (including an activity) has **one canonical record** in `uluv_local_posts`. Activity-only fields/index live in `uluv_activities` and reference its postId.
- Public comments/reactions have independent tables; do not duplicate them under canonical post records. Hints like count totals must be clearly nonauthoritative.

## Migration note

**There is no deployed Step 02 database to migrate.** These are schema DESIGN revisions. Do not write a data migration tool or claim that any live records have been moved. Update references and documentation now; implement the chosen 18-table model directly in the first real DynamoDB Local prototype.

## Future split candidates (not approved today)

If justified by metrics, chat inbox may be separated from expiring messages, and wallet ledger may be separated from balance. Avoid splitting preemptively: the current 18-table structure is already feature clear and maintainable.
