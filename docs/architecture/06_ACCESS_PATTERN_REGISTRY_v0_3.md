# U_luv — Access Pattern Registry v0.3 — 18-table mapping

**90 inherited access patterns** from Step 02, preserving user-facing action names, keys/locators and invariants. The `Mapped table(s)` column is updated to the new canonical 18-table ownership. **No implementation or DynamoDB Local proof yet.** Use `02_PHYSICAL_SCHEMA.md` for precise new record PK/SK keys. If a registry locator is a logical name, the actual physical access is its canonical key from the schema document.

The old generic `accounts`, `relationships`, `local` labels are retired. Some inherited patterns are multi-table workflows and require cross-table conditional transactions rather than assuming a single-table mutation.

| ID | Feature | Action | Access key / locator (logical, inherited) | Operation | Mapped table(s) — revised | Invariant |
|---|---|---|---|---|---|---|
| AP-001 | Account | Look up Google sign-in | AuthLink(provider, externalSubject) → uniqueId | GetItem | `uluv_auth_links`, `uluv_users` | Provider-specific subject; no email-as-immutable-ID |
| AP-002 | Account | Look up email-OTP account | AuthLink(normalizedEmail) → uniqueId | GetItem | `uluv_auth_links`, `uluv_users` | Normalized email uniqueness |
| AP-003 | Account | Create new user and auth link | Users(uniqueId) + AuthLink → write | TransactWrite | `uluv_users`, `uluv_auth_links`, `uluv_settings` | Conditional uniqueness / idempotent signup |
| AP-004 | Account | Read own account/settings | Users(uniqueId) | GetItem | `uluv_users`, `uluv_settings` | Authorization, no public private fields |
| AP-005 | Account | Update profile identity and settings | Users(uniqueId) | UpdateItem conditional | `uluv_users`, `uluv_settings`, `uluv_profiles` | Version checks; privacy |
| AP-006 | Account | Look up public handle | UserDirectory(handle) → uniqueId | GetItem | `uluv_users` | Unique handle, changeable |
| AP-007 | Account | Save age-eligibility decision | Eligibility(uniqueId) | UpdateItem conditional | `uluv_users` | Risk/appeal; do not treat face detection as proof |
| AP-008 | Account | Read user eligibility/restriction | Users(uniqueId) / Eligibility(uniqueId) | GetItem | `uluv_users` | Required on write actions |
| AP-009 | Account | List own privacy and security events | UserAudit(uniqueId, timestamp#id) | Query | `uluv_safety` | Retention limited by policy |
| AP-010 | Profiles | Get own Dating profile | Profiles(uniqueId, DATING) | GetItem | `uluv_profiles`, `uluv_discovery`, `uluv_users` | Private fields never sent to public |
| AP-011 | Profiles | Get own Friendship profile | Profiles(uniqueId, FRIENDSHIP) | GetItem | `uluv_profiles`, `uluv_discovery`, `uluv_users` | Separate mode |
| AP-012 | Profiles | Save incomplete mode profile | Profiles(uniqueId, mode) | Put/Update conditional | `uluv_profiles`, `uluv_discovery`, `uluv_users` | Draft is not discoverable |
| AP-013 | Profiles | Publish/hide active mode | Profiles + discovery pointer | Transactional/conditional write | `uluv_profiles`, `uluv_discovery`, `uluv_users` | 2-photo minimum, eligibility, consent |
| AP-014 | Profiles | Fetch limited public profile by IDs | Profiles(public projection) IDs | BatchGetItem/GetItem | `uluv_profiles`, `uluv_discovery`, `uluv_users` | Contact-safe projection, blocks |
| AP-015 | Profiles | Update photos/intentions/visibility | Profiles + discovery pointer | Conditional write | `uluv_profiles`, `uluv_discovery`, `uluv_users` | Hide mode if photo count <2 |
| AP-016 | Profiles | Read mode-specific discovery preferences | Preferences(uniqueId,mode) | GetItem | `uluv_settings`, `uluv_profiles` | No hidden recommendation ranking |
| AP-017 | Profiles | Update selected locality and invalidate old discovery pointers | Locality(uniqueId) → coarse center + cell | UpdateItem conditional | `uluv_settings`, `uluv_profiles`, `uluv_discovery`, `uluv_local_posts` | Close old local posts; no migration; user-selected center, not live GPS |
| AP-018 | Discovery | Nearby eligible Dating candidates | Discovery(mode#H3_R6_homeCell,time#uniqueId) | Parallel Query + merge | `uluv_settings`, `uluv_discovery`, `uluv_profiles`, `uluv_users`, `uluv_blocks`, `uluv_dating_likes` | Geographic radius + two-sided prefs, block/privacy; near-first 0–10 / 10–35 / 35–50 or selected band |
| AP-019 | Discovery | Nearby eligible Friendship people | Discovery(mode#H3_R6_homeCell,time#uniqueId) | Parallel Query + merge | `uluv_settings`, `uluv_discovery`, `uluv_profiles`, `uluv_users`, `uluv_blocks`, `uluv_dating_likes` | Mode active; no romantic preferences; near-first 0–10 / 10–35 / 35–50 or selected band |
| AP-020 | Discovery | Direct candidate profile preview | Profiles(public view, uniqueId,mode) | Get/BatchGet | `uluv_settings`, `uluv_discovery`, `uluv_profiles`, `uluv_users`, `uluv_blocks`, `uluv_dating_likes` | Final authoritative active/blocked check |
| AP-021 | Discovery | Exclude blocked pairs | Blocks(blockerId,targetId) and reverse | BatchGet/GetItem | `uluv_blocks` | Both directions |
| AP-022 | Discovery | Exclude prior Pass / Like if desired | DatingPair(pairId) or edges | Get/BatchGet | `uluv_settings`, `uluv_discovery`, `uluv_profiles`, `uluv_users`, `uluv_blocks`, `uluv_dating_likes` | No popularity ordering |
| AP-023 | Dating | Create ordinary right Like | Pair(pairId)+incoming/outgoing projections+quota | TransactWrite | `uluv_dating_likes`, `uluv_dating_matches`, `uluv_operations` | Free; conditional cap; race-safe mutual match |
| AP-024 | Dating | Show incoming Liked You page | LikeInbox(recipientId,createdAt#likerId) | Query descending | `uluv_dating_likes`, `uluv_profiles`, `uluv_blocks` | All genuine likes paginated, zero reveal fee |
| AP-025 | Dating | Show Likes Sent page | LikeOutbox(likerId,createdAt#recipientId) | Query descending | `uluv_dating_likes` | Remove withdrawn/invalid entries |
| AP-026 | Dating | Read pair Like/match status | Pair(sortedUserIds) | GetItem | `uluv_dating_likes`, `uluv_dating_matches` | Canonical pair |
| AP-027 | Dating | Paid Like Back from Liked You | Pair+inbox/outbox+Wallet+Ledger+operation | TransactWrite | `uluv_dating_likes`, `uluv_dating_matches`, `uluv_wallet` | 1 credit; require active incoming Like; retry-safe |
| AP-028 | Dating | Mutual match list | MatchInbox(userId,matchedAt#pairId) | Query descending | `uluv_dating_matches` | Actual two-sided Likes only |
| AP-029 | Dating | Withdraw Like/Pass | Pair + relevant projections | Conditional write | `uluv_dating_likes`, `uluv_dating_matches` | No incorrect refunds or visibility |
| AP-030 | Dating | Unlock matched chat (Connect) | Pair entitlement+Wallet+Ledger+operation | TransactWrite | `uluv_dating_matches`, `uluv_connections`, `uluv_wallet`, `uluv_blocks` | 1 credit once per pair; concurrent race-safe |
| AP-031 | Dating | Read unlocked chat entitlement | Pair(pairId) | GetItem strongly consistent | `uluv_connections`, `uluv_blocks`, `uluv_dating_matches` | No duplicate unlock; block must override |
| AP-032 | Dating | Track free daily Like allowance | Usage(userId,day#datingLikes) | Update conditional / transaction | `uluv_operations` | 100 initially; config changes supported |
| AP-033 | Friendship | View received requests | RequestInbox(recipientId,createdAt#requestId) | Query descending | `uluv_friendship_requests` | Unexpired/current statuses |
| AP-034 | Friendship | View sent requests | RequestOutbox(senderId,createdAt#requestId) | Query descending | `uluv_friendship_requests` | Pending max 5 |
| AP-035 | Friendship | Send request and pay | Request+in/out projections+Wallet+Ledger+operation | TransactWrite | `uluv_friendship_requests`, `uluv_wallet`, `uluv_operations`, `uluv_blocks` | 1 credit at successful send; NOT reserved |
| AP-036 | Friendship | Accept received request | Request+Pair entitlement+projections | TransactWrite | `uluv_friendship_requests`, `uluv_connections` | No credit on acceptance; no duplicates |
| AP-037 | Friendship | Decline/cancel request | Request state+projections | Conditional update | `uluv_friendship_requests` | Credit stays spent on valid send |
| AP-038 | Friendship | Read request by ID | Requests(requestId) | GetItem | `uluv_friendship_requests` | Owner/recipient/moderator access |
| AP-039 | Friendship | Expire stale request | ExpiryQueue(expireBucket,expiresAt#requestId) | Query + conditional update | `uluv_operations`, `uluv_friendship_requests` | At seven days or activity ending; no refund |
| AP-040 | Friendship | Prevent repeated request to same person | Pair / RequestDedup(pairId,mode) | GetItem + conditional write | `uluv_friendship_requests`, `uluv_blocks` | Blocks and cooldowns |
| AP-041 | Wallet | Read credit balances | Wallet(uniqueId) | GetItem strongly consistent | `uluv_wallet` | Free vs purchased balances |
| AP-042 | Wallet | List credits and charge history | Ledger(userId,occurredAt#txnId) | Query descending | `uluv_wallet` | Immutable audit |
| AP-043 | Wallet | Apply monthly free allocation | Wallet+monthlyGrantKey+Ledger | TransactWrite | `uluv_wallet` | Women 4; other users 2; one grant/period |
| AP-044 | Wallet | Expire unused monthly free credits | Wallet+period marker+Ledger | Conditional/transactional update | `uluv_wallet` | Anniversary cutoff; no rollover |
| AP-045 | Wallet | Purchase credit pack | PaymentReceipt(storeTxnId)+Wallet+Ledger | TransactWrite | `uluv_wallet` | Store verification; credit once |
| AP-046 | Wallet | Restore failed/duplicate charge | Wallet+Ledger+reversal marker | TransactWrite | `uluv_wallet` | Refund exception only; idempotent |
| AP-047 | Wallet | Read purchase transaction | PaymentReceipt(storeTxnId) | GetItem | `uluv_wallet` | Support/refund/reconciliation |
| AP-048 | Local | Create post with up to five photos | Posts(postId)+owner list+geoCell index+usage | TransactWrite / staged media publish | `uluv_local_posts`, `uluv_activities`, `uluv_operations` | Up to 5 photos; selected locality; H3 res 6; post locality anchored, global reach 50 km max |
| AP-049 | Local | Get post by ID (including admin) | Posts(postId) | GetItem | `uluv_local_posts` | Check status, expiry, permissions |
| AP-050 | Local | Fetch Local feed within user-selected 0–10 / 10–35 / 35–50 / All 0–50 | LocalIndex(FEED#R6#homeCell, POST#time#postId) | Bounded multi-cell Query + canonical BatchGet + cursor | `uluv_local_posts` | Priority by near distance band; authoritative distance/expiry/block checks; no global exact-nearest claim |
| AP-051 | Local | Get Activity-only local feed | LocalIndex(ACTIVITY#R6#homeCell,POST#time#postId) | Bounded multi-cell Query | `uluv_local_posts`, `uluv_activities` | Type-specific pointer for Activity only; 50 km hard ceiling |
| AP-052 | Local | Show posts in nearby People feed | LocalIndex cells + author relation | Query + bounded in-memory join | `uluv_local_posts`, `uluv_operations` | Shared canonical postId in People/Local/Activities; no copy; band eligibility checked |
| AP-053 | Local | List own posts | PostByAuthor(userId,createdAt#postId) | Query descending | `uluv_local_posts`, `uluv_operations` | Owner edit/close/delete |
| AP-054 | Local | Edit/close/delete post | Posts(postId) + index pointer(s) | Conditional write + cleanup | `uluv_local_posts`, `uluv_operations` | Old locality closed; no duplicate index |
| AP-055 | Local | Read post comment page | PostComments(postId,createdAt#commentId) | Query paginated | `uluv_local_posts`, `uluv_local_comments`, `uluv_operations` | Chronological, live posts only |
| AP-056 | Local | Add a comment | PostComments + Usage + optional counts | Transaction / conditional update | `uluv_local_posts`, `uluv_local_comments`, `uluv_operations` | 10 comments/day; contact/text guards |
| AP-057 | Local | Remove comment | PostComments(commentId/postId) + counters | Conditional delete | `uluv_local_posts`, `uluv_local_comments`, `uluv_operations` | Owner/moderator permissions |
| AP-058 | Local | Add/remove a reaction | PostReactions(postId,userId)+Usage | Conditional transaction | `uluv_local_posts`, `uluv_local_reactions`, `uluv_operations` | 1 reaction/user/post; 30/day |
| AP-059 | Local | Read reaction count | PostStats(postId) | GetItem | `uluv_local_posts`, `uluv_local_reactions`, `uluv_operations` | Counter reconciliation; no sort by popularity |
| AP-060 | Local | Expire posts and children | ExpiryQueue(dateBucket,expiresAt#postId) | Query + state transition | `uluv_local_posts`, `uluv_operations` | 7-day max; activity earlier |
| AP-061 | Local | Clean expired post photos | PostMediaByPost(postId) / media manifest | Query + delete assets | `uluv_local_posts`, `uluv_activities` | Do not rely on TTL alone |
| AP-062 | Chat | List user's conversations | ConversationInbox(userId,lastActivity#pairId) | Query descending | `uluv_local_posts`, `uluv_activities`, `uluv_operations` | Never leak blocked/expired chat |
| AP-063 | Chat | Fetch last 7 days of messages | Messages(pairId,createdAt#messageId) | Query using time boundary | `uluv_local_posts`, `uluv_operations` | Check entitlement, block, clear-generation |
| AP-064 | Chat | Send a text or photo message | Messages+conversation updates | Conditional write / transaction | `uluv_local_posts`, `uluv_activities`, `uluv_operations` | Unlocked and not blocked; expiry metadata |
| AP-065 | Chat | Delete history for both | Conversations(pairId) historyGeneration | Conditional update | `uluv_chat`, `uluv_connections`, `uluv_blocks` | Immediate visibility cut-off for both |
| AP-066 | Chat | Remove expired message media | MessageMediaByConversation(pairId) | Query + delete media | `uluv_chat`, `uluv_connections`, `uluv_blocks` | Seven-day lifespan; legal exceptions |
| AP-067 | Chat | Mark read/unread | UserConversationState(userId,pairId) | UpdateItem conditional | `uluv_chat`, `uluv_connections`, `uluv_blocks` | Read receipts disabled by default |
| AP-068 | Chat | Mute/archive chat | UserConversationState(userId,pairId) | UpdateItem | `uluv_chat`, `uluv_connections`, `uluv_blocks` | User-private preference |
| AP-069 | Safety | Block target user | Blocks(blockerId,targetId) + reverse | Conditional write | `uluv_chat`, `uluv_connections`, `uluv_blocks` | Immediately stop new interactions in both modes |
| AP-070 | Safety | Unblock target user | Blocks(blockerId,targetId) + reverse | Conditional write | `uluv_chat`, `uluv_connections`, `uluv_blocks` | No automatic match restoration |
| AP-071 | Safety | Submit post/profile/conversation report | Reports(reportId)+ReportByTarget(targetId,at#id)+queue | TransactWrite | `uluv_chat`, `uluv_connections`, `uluv_blocks` | Report user/conversation, not granular message report |
| AP-072 | Safety | Get moderator report queue | ModerationQueue(status#bucket,createdAt#reportId) | Query | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | No scans; status transitions |
| AP-073 | Safety | Admin lookup post/user by ID | Posts(postId) or Users(uniqueId) | GetItem | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | Staff-only access, audited |
| AP-074 | Safety | Admin hide/restrict/restore post | Posts(postId) authoritative status | Conditional update | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | All feed read paths enforce status |
| AP-075 | Safety | Admin restrict profile privileges | Users(uniqueId)+mode restrictions | Conditional write | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | Clear privilege scope, appeals |
| AP-076 | Safety | Audit admin actions | AdminAudit(adminId,occurredAt#actionId) | PutItem+Query | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | Limited appropriate retention |
| AP-077 | Safety | Appeal moderator decision | Appeals(targetId,createdAt#appealId) | Query/conditional write | `uluv_safety`, `uluv_local_posts`, `uluv_local_comments`, `uluv_users` | Owner and staff access |
| AP-078 | Lifecycle | Store genuine user notification | Notifications(userId,createdAt#eventId) | PutItem | `uluv_operations`, `uluv_settings` | Privacy-safe previews |
| AP-079 | Lifecycle | Get notification page | Notifications(userId,createdAt#eventId) | Query descending | `uluv_operations`, `uluv_settings` | Category settings/quiet hours |
| AP-080 | Lifecycle | Deactivate profile/account | Users+Profiles+visibility state | Conditional write | `uluv_users`, `uluv_profiles`, `uluv_discovery`, `uluv_local_posts` | Hidden immediately despite stale projections |
| AP-081 | Lifecycle | Delete account and linked content | User-owned partition lists + expiry queue | Queries, bounded cleanup | `uluv_users`, `uluv_auth_links`, `uluv_profiles`, `uluv_settings`, `uluv_local_posts`, `uluv_chat`, `uluv_wallet`, `uluv_operations` | No scans; defined retention exceptions |
| AP-082 | Lifecycle | Re-match existing pair after unmatch | Pair(pairId) | Conditional write | `uluv_dating_likes`, `uluv_dating_matches`, `uluv_connections` | Fresh mutual consent; reusable Connect entitlement |
| AP-083 | Profiles | Read/update per-mode distance band choice | accounts(USER#uid, SETTINGS) | GetItem / UpdateItem | `uluv_settings` | 0–10, 10–35, 35–50, All 0–50; no hidden ranking |
| AP-084 | Discovery | Enumerate H3 resolution 6 cells intersecting selected band | h3 gridDisk + conservative boundary coverage | In-process H3 calculation | `uluv_discovery`, `uluv_local_posts`, `uluv_activities` | Cover all edge cells; home cell only; near-first staged |
| AP-085 | Local | Publish post with selected local reach band | local POST#id + FEED#R6#homeCell | TransactWriteItems | `uluv_local_posts`, `uluv_activities`, `uluv_operations` | Viewer band and 50 km ceiling checked |
| AP-086 | Local | Close previous locality posts on chosen-location change | AUTHORPOST#uid and POST#id | Query / bounded conditional write | `uluv_settings`, `uluv_local_posts`, `uluv_activities`, `uluv_discovery` | Do not silently migrate social posts to a new locality |
| AP-087 | Discovery | Read a paginated multi-cell near-first page | Cell query cursor + pending candidate IDs | Query / BatchGet | `uluv_discovery`, `uluv_local_posts`, `uluv_activities` | Bounded operations, secure cursor; pagination does not eliminate cell fanout |
| AP-088 | Discovery | Apply final exact approximate-center distance and band | Candidate center + selected center | Application validation | `uluv_settings`, `uluv_discovery`, `uluv_local_posts` | [0,10], (10,35], (35,50]; ordered only over fetched candidates |
| AP-089 | Discovery | Invalidate cursor after locality/filter change | Signed cursor with localityRevision | Application validation + GetItem | `uluv_settings` | Do not accept arbitrary client cells or stale location |
| AP-090 | Local | Retrieve activity-only distance-band page | ACTIVITY#R6#homeCell | Bounded Query / BatchGet | `uluv_activities`, `uluv_local_posts` | Activity end-time <= post seven-day expiry |

## Cross-cutting refinements

- `AP-001–017`: provider identity belongs to `uluv_auth_links`; account/age to `uluv_users`; profile to `uluv_profiles`; locality/privacy/filter settings to `uluv_settings`.
- `AP-023–032`: Likes and match truth now belong to separate tables, with credit operations in `uluv_wallet` and shared entitlement in `uluv_connections`.
- `AP-033–040`: Friendship invitation records in `uluv_friendship_requests`, acceptance can create an entitlement in `uluv_connections`.
- `AP-048–064`: Common post canonical records and feed pointers in `uluv_local_posts`; activity extension and specific pointers in `uluv_activities`; comments and reactions in their own tables.
- A handful of original locators in the registry are *logical*, not exact DynamoDB keys; implement from the canonical `02_PHYSICAL_SCHEMA.md` keys. Validate all 90 during Step 04 and later vertical slices; do not claim complete runtime mapping verification merely from this document.
- No request-level Scan; GSI count starts at zero subject to measured validation.
