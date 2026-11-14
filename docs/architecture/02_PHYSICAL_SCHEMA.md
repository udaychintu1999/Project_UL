# Step 03 — Physical DynamoDB Schema v0.3 (18 feature-aligned tables)

**Status:** Design ready for prototype; no DynamoDB Local execution has yet verified these keys.  
All 18 tables use string `PK` and `SK` (unless a prototype motivates a justified adjustment); no initial GSIs are proposed.

## Key rules

- `uid`: immutable internal Project U_Day `uniqueId`; never use display name or mutable handle for foreign keys.
- `pairId`: canonical, unambiguous encoding of the lexicographically sorted two user IDs (length-delimited/hashed as appropriate).
- UTC timestamp-sortable fixed format plus unique suffix; sort descending for most recent.
- `cell`: H3 **R6** based on user-selected locality, not continuous/live private GPS.
- `POST#id`, `PAIR#id`, `USER#uid` canonical records are authoritative; feed/list projections are pointers subject to current canonical visibility, blocking, expiry and ownership checks.
- No request-facing Scan; direct Get, BatchGet (retry UnprocessedKeys), Query and bounded multi-cell merges.

## Inventory

| # | Table | Typical canonical PK / SK | Query/index examples | Purpose |
|---|---|---|---|---|
| 1 | `uluv_users` | `USER#uid / META` | `HANDLE#normalized / META` | Account identity; eligibility; public handle mapping |
| 2 | `uluv_auth_links` | `AUTH#provider#subjectHash / META` | `USER#uid / PROVIDER#provider#subjectHash` | Google/Email verified provider mappings |
| 3 | `uluv_profiles` | `USER#uid / MODE#DATING|FRIENDSHIP` | `USER#uid / MEDIA#mediaId` | Separate Dating/Friendship profiles; photos |
| 4 | `uluv_settings` | `USER#uid / SETTINGS` | `USER#uid / MODE#DATING|FRIENDSHIP` | Privacy, notification, selected locality, distance bands |
| 5 | `uluv_discovery` | `DISC#mode#R6#cell / JOIN#ISO#uid` | `—` | H3 R6 mode-specific candidate pointers |
| 6 | `uluv_dating_likes` | `PAIR#pairId / META` | `LIKEDYOU#uid / T#ISO#liker; LIKESSENT#uid / T#ISO#recipient` | Canonical one-sided Likes and incoming/outgoing inboxes |
| 7 | `uluv_dating_matches` | `PAIR#pairId / META` | `MATCHES#uid / T#ISO#pairId` | Canonical mutual match state and match indexes |
| 8 | `uluv_friendship_requests` | `REQ#requestId / META` | `REQIN#uid / T#ISO#id; REQOUT#uid / T#ISO#id; PAIR#pairId / DEDUP` | Paid invitations, lifecycle, incoming/outgoing indexes |
| 9 | `uluv_connections` | `PAIR#pairId / META` | `USER#uid / PAIR#pairId (optional owner list)` | Canonical pair entitlement across Dating/Friendship |
| 10 | `uluv_blocks` | `BLOCKS#actor / TARGET#target` | `BLOCKEDBY#target / ACTOR#actor` | Block edge and reverse lookup |
| 11 | `uluv_wallet` | `USER#uid / BALANCE` | `USER#uid / TX#ISO#txnId; OP#uid#opId / META; RECEIPT#store#id / META` | Balances, credit ledger, grants, receipts, idempotency |
| 12 | `uluv_local_posts` | `POST#postId / META` | `FEED#R6#cell / POST#ISO#id; AUTHORPOST#uid / POST#ISO#id` | Canonical social posts; local home-cell feed pointers; author posts |
| 13 | `uluv_activities` | `POST#postId / META` | `ACTIVITY#R6#cell / POST#ISO#postId` | Activity extension, expiry, activity-only geographic index |
| 14 | `uluv_local_comments` | `POST#postId / T#ISO#commentId` | `COMMENT#commentId / LOOKUP (optional direct admin lookup)` | Public comments on all Local post types |
| 15 | `uluv_local_reactions` | `POST#postId / USER#uid` | `—` | One active reaction per user per post |
| 16 | `uluv_chat` | `THREAD#pairId / META` | `THREAD#pairId / GEN#gen#MSG#ISO#id; USERCHAT#uid / PAIR#pairId` | Pair conversation, per-user inbox, ephemeral messages |
| 17 | `uluv_safety` | `REPORT#reportId / META` | `TARGET#type#id / T#ISO#reportId; QUEUE#OPEN#day / T#ISO#id` | Reports, moderation status, appeals, admin audit |
| 18 | `uluv_operations` | `USAGE#uid#day / COUNTER#feature` | `NOTIFY#uid / T#ISO#id; EXP#hour#shard / DUE#epoch#type#id` | Usage counters, notifications, due-expiry buckets |

## Ownership and record layout

### `uluv_users`

- Canonical: `PK=USER#uid, SK=META`: status, createdAt, ageEligibility, moderationRestrictionVersion, canonical identity revision.
- Public handle mapping: `PK=HANDLE#normalized, SK=META`: uid, createdAt. Conditional put prevents takeover; rename invalidates old mapping.
- Do not store public Dating/Friendship biographical content here. Full DOB never exposed in public projections.

### `uluv_auth_links`

- Provider lookup: `PK=AUTH#GOOGLE#subjectHash, SK=META` or `PK=AUTH#EMAIL#emailHash, SK=META` → immutable uid; only verified provider subjects/email OTP accepted.
- Reverse index for account unlink/delete: `PK=USER#uid, SK=PROVIDER#provider#subjectHash`.
- User creation conditionally writes the new user and auth link together. Never link two accounts based solely on an unverified matching email.

### `uluv_profiles`

- `PK=USER#uid, SK=MODE#DATING` and `MODE#FRIENDSHIP`: separate public-safe profile projection, photos (minimum 2, max 6), interests, intention, mode activation, version, current home-cell pointer.
- `PK=USER#uid, SK=MEDIA#mediaId`: user-owned image refs and deletion progress, if owner-media listing is necessary.
- Authoritative profile is read when fetching limited public previews, alongside block/mode rules. Do not store private email/age evidence here.

### `uluv_settings`

- `PK=USER#uid, SK=SETTINGS`: selected locality id/center, revision, notifications/quiet hours, privacy defaults and account-level band preferences.
- `PK=USER#uid, SK=MODE#DATING` / `MODE#FRIENDSHIP` / `MODE#LOCAL`: mode-specific distance band (0–10, 10–35, 35–50, All 0–50) and filters.
- **One source of truth for selected locality.** Updates close previous Local posts and move active profile discovery pointer(s); versioned signed cursors invalidate on changes.

### `uluv_discovery`

- `PK=DISC#DATING#R6#cell, SK=JOIN#ISO#uid` and `PK=DISC#FRIENDSHIP#R6#cell, SK=JOIN#ISO#uid`.
- Home-cell, one projection per active profile/mode; no private profile information or balances in projection.
- Last-resort density sharding or added GSIs only if tested hot cells justify them.

### `uluv_dating_likes`

- `PK=PAIR#pairId, SK=META`: two directional Like flags, timestamps, withdrawn flags and revision.
- `PK=LIKEDYOU#recipientUid, SK=T#ISO#likerUid`: incoming-Likes projection, paginated newest first.
- `PK=LIKESSENT#likerUid, SK=T#ISO#recipientUid`: Likes Sent projection.
- **Free ordinary Like** may create match; explicit **Liked You Like Back costs 1 credit**. Never infer fee from presence of a reciprocal Like while doing an ordinary swipe.
- Conditional create/flag transition and idempotency protect against retry/double-charge.

### `uluv_dating_matches`

- `PK=PAIR#pairId, SK=META`: mutual match generation/status, matchedAt, unmatchedAt, version.
- `PK=MATCHES#uid, SK=T#matchedAt#pairId`: user-facing match list projections for both participants.
- Unmatch stops romantic access; future rematch needs new consent; **do not erase eligible prior paid connection entitlement**.
- Transition from two Likes to match must be transactionally consistent with valid Like state; retry conflicts with conditional versioning.

### `uluv_friendship_requests`

- `PK=REQ#requestId, SK=META`: sender, recipient, status, sourcePostId, sentAt, expiresAt, fee operation, version.
- `PK=REQIN#recipient, SK=T#sentAt#requestId`; `PK=REQOUT#sender, SK=T#sentAt#requestId`: inbox/outbox projections.
- `PK=PAIR#pairId, SK=DEDUP`: current outstanding pair request pointer/cooldown.
- Sending spends **1 credit immediately when committed**; rejection/expiry normally does not refund. Acceptance produces valid shared Connect permission without additional charge.

### `uluv_connections`

- `PK=PAIR#pairId, SK=META`: `entitled`, `openedAt`, `paidBy`, `unlockOperationId`, `source` (Dating or accepted Friendship), status/version.
- Optional `PK=USER#uid, SK=PAIR#pairId` projection only if required by a measured user-list query.
- Source of truth for whether a paid connection has ever been unlocked; block/match/request state still determines current ability to chat.
- Concurrent unlocks must be serialized by conditional Put/Update in one cross-table transaction with wallet debit and immutable ledger.

### `uluv_blocks`

- `PK=BLOCKS#blockerUid, SK=TARGET#blockedUid` and `PK=BLOCKEDBY#blockedUid, SK=ACTOR#blockerUid`.
- Both directions checked on profile reveal, Like, request, chat send and local post/comment interactions.
- Any cached or geo directory pointer never overrides canonical block checks.

### `uluv_wallet`

- `PK=USER#uid, SK=BALANCE`: free vs purchased balance, period, nextRenewal, version.
- `PK=USER#uid, SK=TX#ISO#txnId`: immutable ledger.
- `PK=OP#uid#operationId, SK=META`: durable idempotency record.
- `PK=GRANT#uid#period, SK=META`: once-per-period grant.
- `PK=RECEIPT#provider#storeTxnId, SK=META`: verified purchase receipt once.
- Credit action must atomically update wallet, add ledger/idempotency and change relationship record(s), across their respective tables.

### `uluv_local_posts`

- Canonical `PK=POST#postId, SK=META`: type (ACTIVITY/QUESTION/RECOMMENDATION/DISCUSSION), owner, selected locality center, H3R6, up to 5 storage-agnostic media refs (local first; real S3 in P17), createdAt, expiresAt, status.
- Common geo feed pointer `PK=FEED#R6#cell, SK=POST#ISO#postId`: postId, type, expiry hint; **one home-cell pointer**.
- Author list `PK=AUTHORPOST#uid, SK=POST#ISO#postId`: post ID to close on locality change and cleanup.
- All social post types exist exactly once here; `uluv_activities` is an extension, not a second post.

### `uluv_activities`

- Activity details `PK=POST#postId, SK=META`: start/end time, activity category, approximate public meeting area, additional activity state.
- Activity-specific index `PK=ACTIVITY#R6#cell, SK=POST#ISO#postId`: activity post ID; query Activity-only feed without scanning common posts.
- Activity create/edit/delete is coordinated with canonical post and both pointers through transaction or controlled state transitions. If activity ends sooner, canonical post expires no later than its activity end.

### `uluv_local_comments`

- `PK=POST#postId, SK=T#ISO#commentId`: user, screened text, createdAt, expiresAt, status.
- Report/Admin lookup includes post ID and comment ID; optional direct reverse `PK=COMMENT#commentId, SK=LOOKUP` only if needed.
- Public comments only, bounded `Query` by post ID, max 10 created per day per user in `uluv_operations`.
- Remove when parent post expires; never expose a comment if canonical post is hidden/expired.

### `uluv_local_reactions`

- `PK=POST#postId, SK=USER#uid`: reaction kind, createdAt, postExpiry, version.
- `GetItem` checks current user's reaction; `Query` supports post reactions if required. One active reaction per person per post.
- Per-day reaction limit in `uluv_operations`; canonical post reaction totals may be updated transactionally as display hints (not ranking signals).
- Reaction and its ownership/expiry checks must not permit interaction after parent post removal.

### `uluv_chat`

- `PK=THREAD#pairId, SK=META`: history generation, participants, last-message state.
- `PK=THREAD#pairId, SK=GEN#gen#MSG#ISO#messageId`: text or image reference, 7-day expiry.
- `PK=USERCHAT#uid, SK=PAIR#pairId`: archive/read/mute preferences.
- `PK=CHATINBOX#uid, SK=T#ISO#pairId`: optional inbox pointer as before.
- Both-user clear increments generation, hiding old messages; content and media objects cleaned asynchronously (local media in early phases, S3 in P17); permanent paid entitlement remains in `uluv_connections`.

### `uluv_safety`

- `PK=REPORT#reportId, SK=META`: owner, targetType, targetId, reason, status.
- `PK=TARGET#type#targetId, SK=T#ISO#reportId`: target reports.
- `PK=QUEUE#OPEN#day, SK=T#ISO#reportId`: bounded admin moderation queue.
- `PK=ADMINAUDIT#adminId, SK=T#ISO#actionId`: immutable action trail; appeals as `PK=APPEAL#uid`.
- Moderation restrictions are authoritative (user/post status), not solely indexed by report count.

### `uluv_operations`

- `PK=USAGE#uid#YYYY-MM-DD, SK=COUNTER#feature`: quotas (Likes, posts, comments, reactions).
- `PK=NOTIFY#uid, SK=T#ISO#eventId`: genuine user notification.
- `PK=EXP#YYYYMMDDHH#shard, SK=DUE#epoch#type#id`: bucketed expiry work.
- `PK=CLEANUP#type#id, SK=STATE`: cleanup checkpoints and retry progress.
- No scan for due-expiry or account actions; due time buckets are deterministic and paginated.

## Known limitations and validation gates

1. Splitting data into separate tables **does not improve performance by itself**; all important queries require measured RCU/WCU and bounded fan-out tests.
2. DynamoDB cross-table transactions must be same AWS account/Region, <=100 actions, <=4 MB, no two actions on one item in the same transaction.
3. Concurrent two-direction Likes and matched-state creation require robust conditional transactions and retry logic.
4. Local Feed queries use only H3 cell pointers and canonical post checks; pagination per cell does not skip querying additional eligible cells. Globally perfect nearest-first is **not yet guaranteed**.
5. No GSIs is a starting design objective, not a permanent prohibition. Urban hot-cell sharding, direct moderation lookup or alternative indexes can be added when measured.
6. DynamoDB TTL is not exact; API checks expiry and cleanup reconciles media objects, comments/reactions and post indexes.

**FINAL v2.0:** Media IDs reference a local-first adapter. Owner manually sets up two private DEV S3 buckets plus one DEV signed CloudFront distribution early; AI/dev scripts cannot make AWS requests without separately scoped owner approval. Production S3/DynamoDB/ECS integration remains P17. Local Java DynamoDB tables persist through P16 and are never migrated by accident.

### P01-2 password records (same 18 tables)
- `uluv_auth_links`: `PK=USER#uid, SK=CREDENTIAL#PASSWORD` → Argon2id PHC string, version UUID, timestamps. No plaintext/reversible passwords.
- `uluv_auth_links`: `PK=PASSWORD#LOGIN#emailHash, SK=RATE` → optimistic CAS per-identity rate window; `PK=PASSWORD#RESET#emailHash, SK=RATE|CHALLENGE` → local recovery issuance and digest.
- `uluv_users`: optional numeric `sessionEpoch` (default 0 for P01-1 accounts) increments after password change/reset. Session records capture epoch; every protected request compares it before authorizing, so old tokens are revoked without scans. No new tables/indexes.
