# Physical DynamoDB schema v0.2 — eight proposed tables

**Status:** Concrete design proposal; keys untested in DynamoDB Local. Name prefix is illustrative (`uluv_`). All eight have string PK/SK; item type encoded in key prefixes. No initial GSIs/LSIs. Table names, sizes and exact attributes need review with the prototype.

## Global key conventions

- `uid` = immutable opaque Project U_Day-style `uniqueId`; handles change independently.
- `pairId = canonicalEncode(min(uidA,uidB),max(uidA,uidB))`; length-delimited or encoded to avoid separator collisions; no raw user IDs embedded in untrusted external URLs.
- `h3` = H3 res-6 index of **selected locality center**. Never use private home/GPS point for public lookup.
- Timestamp keys use fixed-width UTC ISO-8601 or sortable epoch; add unique ID tie breaker. `ScanIndexForward=false` returns newest first when key prefix is identical.
- `GetItem` strongly consistent for finance/authoritative state, conditional writes for one-time transitions, `Query` for user-owned lists, no app-level Scan.
- Reference/projection records contain no private profile details and are always validated against canonical visibility/expiry before display.
- Idempotency `operationId` is unique per logical action and persists long enough for replay/refund investigation; it is NOT solely a 10-minute DynamoDB request token.

## Table inventory

| # | Physical table | PK | SK | Purpose | Initial GSIs |
|---|---|---|---|---|---:|
| 1 | `uluv_accounts` | `PK` | `SK` | Account, auth links, separate profiles and settings | 0 |
| 2 | `uluv_discovery` | `PK` | `SK` | H3 res-6 Dating and Friendship directory pointers | 0 |
| 3 | `uluv_relationships` | `PK` | `SK` | Pair, Likes, matches, Friend requests, blocks and reverse pointers | 0 |
| 4 | `uluv_wallet` | `PK` | `SK` | Balance, ledger, purchase receipts, durable paid-action IDs | 0 |
| 5 | `uluv_local` | `PK` | `SK` | Posts, home-cell feed/activities refs, comments, reactions and author list | 0 |
| 6 | `uluv_chat` | `PK` | `SK` | Conversation metadata, message generations, user inbox/state | 0 |
| 7 | `uluv_safety` | `PK` | `SK` | Reports, moderation queue, appeals, administrator audit | 0 |
| 8 | `uluv_operations` | `PK` | `SK` | Daily quotas, notifications, expiry work and cleanup status | 0 |

**Why eight?** Each table has distinct ownership, retention and hot-path characteristics. Keeping wallet, expiring message media and geographically indexed UGC separate limits accidental coupling. Single-table purism would make controls harder to reason about. Table count alone is not a meaningful cost metric; cost should be measured in actual RCUs/WCUs and bytes.

## 1 — `uluv_accounts`

| Item | PK | SK | Key attributes | Read/write |
|---|---|---|---|---|
| Account | `USER#<uid>` | `META` | status, ageEligibility, createdAt, currentLocalityId, revision | Get, conditional update |
| Dating profile | `USER#<uid>` | `PROFILE#DATING` | safe public projection, photos, active, prefs, currentDiscoveryPK/SK | Get, update + discovery mirror |
| Friendship profile | `USER#<uid>` | `PROFILE#FRIENDSHIP` | distinct bio/interests/photos/visibility | Get, update + mirror |
| Settings | `USER#<uid>` | `SETTINGS` | distances, selectedBand/all, notification/privacy prefs | Get, update |
| Google auth | `AUTH#GOOGLE#<providerSubjectHash>` | `META` | uid, provider, createdAt | Get, conditional put |
| Email auth | `AUTH#EMAIL#<normalizedEmailHash>` | `META` | uid, verified, createdAt | Get, conditional put |
| Public handle | `HANDLE#<normalizedHandle>` | `META` | uid | Get, conditional put |
| Owner media pointer | `USER#<uid>` | `MEDIA#<mediaId>` | media key, owner, status | Query for deletion |

No public read returns the account's email, full DOB or raw auth-link value. Email lookup must normalize and protect personal data; do not link Google/email accounts merely because unverified addresses appear to match.

## 2 — `uluv_discovery`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Dating candidate | `DISC#DATING#R6#<h3>` | `JOIN#<ISO>#<uid>` | uid, coarse locality center, mode, eligibility pointer version |
| Friendship candidate | `DISC#FRIENDSHIP#R6#<h3>` | `JOIN#<ISO>#<uid>` | uid, coarse locality center, mode, pointer version |

- The profile item holds its own exact current discovery pointer so location/visibility/photo changes can delete the old pointer and put the new one conditionally.
- One home-cell directory entry per discoverable mode; no per-neighbor duplicates at launch.
- This table never stores wallet balance, full DOB, contact information, or private photos.
- `JOIN#` is **not** behavioral ranking. Candidates are merged by chosen distance band and checked against mutual eligibility; order within a page uses known approximate-distance plus stable tie-breakers.
- A high-volume metropolitan cell may later need deterministic `#SHARD#n` partitioning; start without it, measure actual hot-key impact.

## 3 — `uluv_relationships`

| Record | PK | SK | Attributes | Query path |
|---|---|---|---|---|
| Canonical pair | `PAIR#<pairId>` | `STATE` | each Like flag, match, friendship state, `connectUnlocked`, `connectPaidBy`, revision | Strong Get |
| Incoming Like | `LIKEDYOU#<recipientUid>` | `T#<ISO>#<likerUid>` | pairId, liker uid | Query newest |
| Outgoing Like | `LIKESSENT#<likerUid>` | `T#<ISO>#<recipientUid>` | pairId | Query newest |
| Mutual match pointer | `MATCHES#<uid>` | `T#<ISO>#<pairId>` | pairId | Query newest |
| Friendship request | `REQ#<requestId>` | `STATE` | sender, target, status, sentAt, expiresAt, sourcePostId, feeTxnId | Direct Get |
| Incoming request | `REQIN#<uid>` | `T#<ISO>#<requestId>` | requestId | Query newest |
| Outgoing request | `REQOUT#<uid>` | `T#<ISO>#<requestId>` | requestId | Query newest |
| Block outbound | `BLOCKS#<blockerUid>` | `TARGET#<blockedUid>` | createdAt | Query/check |
| Block inbound | `BLOCKEDBY#<blockedUid>` | `TARGET#<blockerUid>` | createdAt | Query/check |

Both Likes/matches and Friendship are separate **relationship contexts** on one canonical pair record; the paid Connect entitlement is shared where the product permits reuse. Incoming/outgoing projection records may be stale after a race; profile and canonical pair must be checked before rendering or charging.

## 4 — `uluv_wallet`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Wallet balance | `USER#<uid>` | `BALANCE` | `freeCredits`, `purchasedCredits`, `periodId`, `nextRenewalAt`, revision |
| Ledger entry | `USER#<uid>` | `TX#<ISO>#<txnId>` | reason, debit/credit, free/purchased split, refId, operationId |
| Durable operation | `OP#<uid>#<operationId>` | `META` | action, immutable parameters hash, result, transactionId |
| Monthly grant claim | `GRANT#<uid>#<periodId>` | `META` | grantedAmount, eligibleGroup, claimedAt |
| Store receipt | `RECEIPT#<provider>#<storeTransactionId>` | `META` | uid, pack, verifiedAt, issuanceTxnId |

Update balance with condition `available >= fee` and consume free first. The balance, corresponding ledger entry, durable operation, and **underlying successful business action** must commit together in one cross-table DynamoDB transaction, not in two separate awaited API calls. Do not make wallet subitems so large they exceed DynamoDB limits.

### Monthly expiry nuance

If the free period has elapsed, any spend or balance view must first settle renewal/expiry correctly through an idempotent grant/rollover transaction (or read a derived available balance from period boundaries). Purchased credits do not vanish during the renewal. **A stale cached balance must never be a source of authorization**.

## 5 — `uluv_local`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Canonical post | `POST#<postId>` | `META` | authorUid, type, localityCenter, H3R6, photos[] (<=5), reachMaxKm=50, createdAt, expiresAt, status |
| Home feed pointer | `FEED#R6#<h3>` | `POST#<ISO>#<postId>` | postId, type, expiry hint |
| Activity-only pointer | `ACTIVITY#R6#<h3>` | `POST#<ISO>#<postId>` | postId | 
| Author post pointer | `AUTHORPOST#<uid>` | `POST#<ISO>#<postId>` | postId, status hint |
| Comment | `POST#<postId>` | `COMMENT#<ISO>#<commentId>` | uid, screened text, expiresAt |
| Reaction | `POST#<postId>` | `REACTION#<uid>` | reaction, createdAt, expiresAt |

- Activity-only pointer is created **only** for Activity posts so Activities discovery doesn't have to read all local post types; no GSI required. Nearby People and Local use the common feed pointer for the same canonical post.
- A post is associated with its author's selected locality center and **one** home cell. Never index into every circle-overlapping cell at initial launch.
- Canonical `status` and `expiresAt` are checked before any comment/reaction/read/write. Author deletes and admin hides become invisible even if a pointer is stale.
- Reaction-count totals may be kept on the canonical post as hints; the unique `POST#id / REACTION#uid` item prevents multiple active reactions. Counters are not a popularity ranking.
- Image objects live in private S3; only references, dimensions, type and lifecycle metadata live in DynamoDB.

## 6 — `uluv_chat`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Thread metadata | `THREAD#<pairId>` | `META` | generation, clearAt, lastMessageAt, participants, revision |
| Chat message | `THREAD#<pairId>` | `GEN#<zeroPaddedGeneration>#MSG#<ISO>#<msgId>` | fromUid, text or imageRef, createdAt, expiresAt |
| User thread state | `USERCHAT#<uid>` | `PAIR#<pairId>` | archive/mute, read marker, currentInboxPointer |
| Chat list pointer | `CHATINBOX#<uid>` | `T#<ISO>#<pairId>` | pairId, last activity hint |

- Read messages using `begins_with(SK, 'GEN#<currentGeneration>#MSG#')` plus creation/expiry validation. Use a composable key condition based on the fixed generation/time prefix; no Scan.
- **Delete history for both** increments thread generation and clears previews for both, without deleting existing paid entitlement.
- There must be a policy for messages racing against a clear: conditional generation checks on send ensure old-generation writes fail/retry.
- Private photo URLs are short-lived and authorization-sensitive. A public permanent media URL would contradict delete-for-both semantics.
- `CHATINBOX` items are mutable references and may be stale; always check thread/pair/status on read. Reindex when last-activity timestamp changes.

## 7 — `uluv_safety`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Report | `REPORT#<reportId>` | `META` | actor, targetType, targetId, reason, status, createdAt |
| Report by target | `TARGET#<targetType>#<targetId>` | `T#<ISO>#<reportId>` | reportId |
| Open moderation queue | `QUEUE#OPEN#<yyyy-mm-dd>` | `T#<ISO>#<reportId>` | reportId, priority |
| Account appeal | `APPEAL#<uid>` | `T#<ISO>#<appealId>` | moderationActionId, status |
| Admin audit | `ADMINAUDIT#<adminId>` | `T#<ISO>#<actionId>` | action, target, reason |

Moderators look up by exact user/post ID. Report frequency can trigger review but not irreversible automatic bans. Staff roles enforced outside DynamoDB key structure.

## 8 — `uluv_operations`

| Record | PK | SK | Attributes |
|---|---|---|---|
| Daily quota | `USAGE#<uid>#<yyyy-mm-dd>` | `COUNTER#<feature>` | count, limit, revision |
| Pending expiry job | `EXP#<YYYYMMDDHH>#<shard>` | `DUE#<epoch>#<type>#<id>` | expiresAt, owner, state |
| Notification | `NOTIFY#<uid>` | `T#<ISO>#<eventId>` | type, privacy-safe payload, expiry |
| Cleanup continuation | `CLEANUP#<type>#<id>` | `STATE` | progress cursor, retryCount |

Expiry jobs must be scheduled by a bounded hourly partition+shard (not one infinite partition). The cleanup job runner enumerates due buckets by known keys rather than scanning all items. A time-window service process in ECS can drive it; **no Lambda is required**.

## Primary access patterns by screen

| Screen / operation | Table and key read | Notes |
|---|---|---|
| Dating feed | `uluv_discovery` / `DISC#DATING#R6#cell` | search distance bands progressively; final pair/profile/block checks |
| Friendship People | `uluv_discovery` / `DISC#FRIENDSHIP#R6#cell` | same geo logic |
| Incoming Liked You | `uluv_relationships` / `LIKEDYOU#uid` | all genuine Likes paginated, no reveal charge |
| Mutual matches | `uluv_relationships` / `MATCHES#uid` | pair truth authoritative |
| Paid Like Back | `uluv_relationships` + `uluv_wallet` + `uluv_operations` | atomic transaction |
| Paid Connect | `uluv_relationships` + `uluv_wallet` | single pair entitlement |
| Friendship request | `uluv_relationships` + `uluv_wallet` | paid at successful send, nonrefundable ordinary rejection |
| Local newest/nearby | `uluv_local` / `FEED#R6#cell` | 0–10 → 10–35 → 35–50; exact distance check |
| Activities | `uluv_local` / `ACTIVITY#R6#cell` | identical locality checks |
| Post details/comments | `uluv_local` / `POST#postId` | no scans |
| Chat / clear for both | `uluv_chat` / `THREAD#pairId` | pair entitlement checked separately |
| Admin post by ID | `uluv_local` / `POST#postId` | audited direct lookup |
| Admin report queue | `uluv_safety` / `QUEUE#OPEN#date` | bounded time partitions |

## Security/consistency caveats

1. DynamoDB `BatchGetItem` may return unprocessed keys; retry with backoff, validate the canonical entity before presenting.
2. A DynamoDB transaction can contain at most 100 distinct item actions / 4 MB and cannot target the same item twice. Design and tests must check the actual transaction shape; never use separate ConditionCheck and Update on the same wallet record within one transaction.
3. Authentication is user-scoped; never let clients supply arbitrary PK/SK values, pair membership, wallet balances or locality coordinates as authorities.
4. For a precise distance priority across all 0–50 km results, this sparse home-cell/index shape is insufficient without broader candidate enumeration; see the documented pagination limitations.
5. Initial GSI count **zero** is a proposal, not a badge of engineering merit. Add an index only when measured access patterns require it.
