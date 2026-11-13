# Atomic business flows across 18 tables

DynamoDB `TransactWriteItems` permits atomic modifications across tables within one AWS account and Region; <=100 distinct item actions and total <=4MB, with only one action per item. Add durable operation IDs because SDK client-token retries alone have limited time windows.

## Paid Like Back — distinct from free ordinary Like

1. Validate existing incoming Like in `uluv_dating_likes`, user eligibility, block state (`uluv_blocks`), and sufficient `uluv_wallet` funds.
2. In one transaction: conditionally update canonical Like direction and necessary inbox/outbox pointers (`uluv_dating_likes`); create/update mutual match (`uluv_dating_matches`) if appropriate; debit wallet; add immutable ledger and durable idempotency marker (`uluv_wallet`); update applicable quota if policy requires (`uluv_operations`).
3. A repeated operation with the same operation ID must not debit again. In concurrent races, conditional version conflict triggers re-read and re-evaluation, not an unconditional retry debit.
4. **Cost:** one credit ONLY when user deliberately taps paid Like Back from Liked You. Normal Dating swipe never invokes this paid operation, even if it creates a match.

## Free ordinary Like

Read canonical pair-Like state; conditional transactional update in `uluv_dating_likes`, reciprocal Match in `uluv_dating_matches` if both flags true, and daily Like count in `uluv_operations`. No wallet debit. Model pair-state versions to handle two simultaneous first Likes.

## Connect — one paid chat entitlement per pair

1. Confirm current valid mutual Dating match or applicable Friendship acceptance, both eligible and not blocked.
2. In one transaction, conditional create/enable `uluv_connections PAIR#id/META` only if no existing active entitlement; debit payer's `uluv_wallet`; append ledger + durable op.
3. If another caller already unlocked this pair, return existing entitlement and charge no one. A second user must not pay for an already unlocked pair.
4. Retain paid entitlement after a consensual unmatch; active permission is still governed by valid current relationship and block state.

## Paid Friendship request

One transaction conditionally creates `uluv_friendship_requests REQ#id` plus sender/recipient projections, pair dedup, decrements `uluv_wallet`, writes ledger and durable op, and checks pending-request quota in `uluv_operations`. Ordinary decline/cancel/expiry updates request status but does not return credit. If request fails to enter valid SENT state, entire charge must fail or be corrected.

On ACCEPT, atomically set accepted status and ensure `uluv_connections` entitlement exists without charging the recipient. For previously entitled pairs, respect no duplicate fee rules and avoid repeat paid request action where no new entitlement is needed.

## Account creation and profile visibility

- Signup conditionally writes `uluv_users` canonical user and verified `uluv_auth_links` provider mapping in one transaction; user settings/profiles can be created in the same bounded transaction.
- Publishing a mode updates `uluv_profiles` mode status and `uluv_discovery` pointer together. Updating locality updates `uluv_settings` and relevant old/new discovery pointers with revision checks.

## Local Activity post creation

When creating an activity, create one `uluv_local_posts` canonical post + feed/author pointers, one `uluv_activities` extension + activity index, and update `uluv_operations` publishing quota atomically for the metadata. Image-upload lifecycle is staged and recoverable; no S3 object write can be included in DynamoDB's transaction.

## Required failure/race tests

Two paid Like Back requests; both users click Connect simultaneously; simultaneous first Likes; two requests to same recipient; insufficient wallet balance; transaction retry after response loss; duplicate purchase receipt; monthly grant rerun; photo-upload failure after metadata staging; activity end while request is pending; block between precheck and commit.
