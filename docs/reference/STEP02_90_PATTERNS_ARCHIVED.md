# U_luv — DynamoDB Access Pattern Registry v0.2

**Status:** Draft physical-table mapping, 2026-11-10. **90 access patterns** (original 82 + 8 geo-band and pagination patterns). Physical table names are defined in `02_PHYSICAL_SCHEMA.md`. Runtime behavior is NOT verified.

Changes from v0.1: all three modes support 0–10, 10–35, 35–50 and All 0–50 km; H3 **resolution 6** is selected; Local posts use one home-cell pointer and transparent near-first bands; multi-cell cursor progress and boundary checks are explicitly required. Previous 5/10 km Local ceiling is retired.

## Registry

| ID | Feature | Action | Access key / locator | Operation | Mapped table(s) | Invariant |
|---|---|---|---|---|---|---|
| AP-001 | Account | Look up Google sign-in | AuthLink(provider, externalSubject) → uniqueId | GetItem | `accounts`; `operations` (audit) | Provider-specific subject; no email-as-immutable-ID |
| AP-002 | Account | Look up email-OTP account | AuthLink(normalizedEmail) → uniqueId | GetItem | `accounts`; `operations` (audit) | Normalized email uniqueness |
| AP-003 | Account | Create new user and auth link | Users(uniqueId) + AuthLink → write | TransactWrite | `accounts`; `operations` (audit) | Conditional uniqueness / idempotent signup |
| AP-004 | Account | Read own account/settings | Users(uniqueId) | GetItem | `accounts`; `operations` (audit) | Authorization, no public private fields |
| AP-005 | Account | Update profile identity and settings | Users(uniqueId) | UpdateItem conditional | `accounts`; `operations` (audit) | Version checks; privacy |
| AP-006 | Account | Look up public handle | UserDirectory(handle) → uniqueId | GetItem | `accounts`; `operations` (audit) | Unique handle, changeable |
| AP-007 | Account | Save age-eligibility decision | Eligibility(uniqueId) | UpdateItem conditional | `accounts`; `operations` (audit) | Risk/appeal; do not treat face detection as proof |
| AP-008 | Account | Read user eligibility/restriction | Users(uniqueId) / Eligibility(uniqueId) | GetItem | `accounts`; `operations` (audit) | Required on write actions |
| AP-009 | Account | List own privacy and security events | UserAudit(uniqueId, timestamp#id) | Query | `accounts`; `operations` (audit) | Retention limited by policy |
| AP-010 | Profiles | Get own Dating profile | Profiles(uniqueId, DATING) | GetItem | `accounts`; `discovery` | Private fields never sent to public |
| AP-011 | Profiles | Get own Friendship profile | Profiles(uniqueId, FRIENDSHIP) | GetItem | `accounts`; `discovery` | Separate mode |
| AP-012 | Profiles | Save incomplete mode profile | Profiles(uniqueId, mode) | Put/Update conditional | `accounts`; `discovery` | Draft is not discoverable |
| AP-013 | Profiles | Publish/hide active mode | Profiles + discovery pointer | Transactional/conditional write | `accounts`; `discovery` | 2-photo minimum, eligibility, consent |
| AP-014 | Profiles | Fetch limited public profile by IDs | Profiles(public projection) IDs | BatchGetItem/GetItem | `accounts`; `discovery` | Contact-safe projection, blocks |
| AP-015 | Profiles | Update photos/intentions/visibility | Profiles + discovery pointer | Conditional write | `accounts`; `discovery` | Hide mode if photo count <2 |
| AP-016 | Profiles | Read mode-specific discovery preferences | Preferences(uniqueId,mode) | GetItem | `accounts`; `discovery` | No hidden recommendation ranking |
| AP-017 | Profiles | Update selected locality and invalidate old discovery pointers | Locality(uniqueId) → coarse center + cell | UpdateItem conditional | `accounts`; `discovery` | Close old local posts; no migration; user-selected center, not live GPS |
| AP-018 | Discovery | Nearby eligible Dating candidates | Discovery(mode#H3_R6_homeCell,time#uniqueId) | Parallel Query + merge | `discovery`; `accounts`; `relationships` | Geographic radius + two-sided prefs, block/privacy; near-first 0–10 / 10–35 / 35–50 or selected band |
| AP-019 | Discovery | Nearby eligible Friendship people | Discovery(mode#H3_R6_homeCell,time#uniqueId) | Parallel Query + merge | `discovery`; `accounts`; `relationships` | Mode active; no romantic preferences; near-first 0–10 / 10–35 / 35–50 or selected band |
| AP-020 | Discovery | Direct candidate profile preview | Profiles(public view, uniqueId,mode) | Get/BatchGet | `discovery`; `accounts`; `relationships` | Final authoritative active/blocked check |
| AP-021 | Discovery | Exclude blocked pairs | Blocks(blockerId,targetId) and reverse | BatchGet/GetItem | `discovery`; `accounts`; `relationships` | Both directions |
| AP-022 | Discovery | Exclude prior Pass / Like if desired | DatingPair(pairId) or edges | Get/BatchGet | `discovery`; `accounts`; `relationships` | No popularity ordering |
| AP-023 | Dating | Create ordinary right Like | Pair(pairId)+incoming/outgoing projections+quota | TransactWrite | `relationships`; `wallet`; `operations` | Free; conditional cap; race-safe mutual match |
| AP-024 | Dating | Show incoming Liked You page | LikeInbox(recipientId,createdAt#likerId) | Query descending | `relationships`; `wallet`; `operations` | All genuine likes paginated, zero reveal fee |
| AP-025 | Dating | Show Likes Sent page | LikeOutbox(likerId,createdAt#recipientId) | Query descending | `relationships`; `wallet`; `operations` | Remove withdrawn/invalid entries |
| AP-026 | Dating | Read pair Like/match status | Pair(sortedUserIds) | GetItem | `relationships`; `wallet`; `operations` | Canonical pair |
| AP-027 | Dating | Paid Like Back from Liked You | Pair+inbox/outbox+Wallet+Ledger+operation | TransactWrite | `relationships`; `wallet`; `operations` | 1 credit; require active incoming Like; retry-safe |
| AP-028 | Dating | Mutual match list | MatchInbox(userId,matchedAt#pairId) | Query descending | `relationships`; `wallet`; `operations` | Actual two-sided Likes only |
| AP-029 | Dating | Withdraw Like/Pass | Pair + relevant projections | Conditional write | `relationships`; `wallet`; `operations` | No incorrect refunds or visibility |
| AP-030 | Dating | Unlock matched chat (Connect) | Pair entitlement+Wallet+Ledger+operation | TransactWrite | `relationships`; `wallet`; `operations` | 1 credit once per pair; concurrent race-safe |
| AP-031 | Dating | Read unlocked chat entitlement | Pair(pairId) | GetItem strongly consistent | `relationships`; `wallet`; `operations` | No duplicate unlock; block must override |
| AP-032 | Dating | Track free daily Like allowance | Usage(userId,day#datingLikes) | Update conditional / transaction | `relationships`; `wallet`; `operations` | 100 initially; config changes supported |
| AP-033 | Friendship | View received requests | RequestInbox(recipientId,createdAt#requestId) | Query descending | `relationships`; `wallet`; `operations` | Unexpired/current statuses |
| AP-034 | Friendship | View sent requests | RequestOutbox(senderId,createdAt#requestId) | Query descending | `relationships`; `wallet`; `operations` | Pending max 5 |
| AP-035 | Friendship | Send request and pay | Request+in/out projections+Wallet+Ledger+operation | TransactWrite | `relationships`; `wallet`; `operations` | 1 credit at successful send; NOT reserved |
| AP-036 | Friendship | Accept received request | Request+Pair entitlement+projections | TransactWrite | `relationships`; `wallet`; `operations` | No credit on acceptance; no duplicates |
| AP-037 | Friendship | Decline/cancel request | Request state+projections | Conditional update | `relationships`; `wallet`; `operations` | Credit stays spent on valid send |
| AP-038 | Friendship | Read request by ID | Requests(requestId) | GetItem | `relationships`; `wallet`; `operations` | Owner/recipient/moderator access |
| AP-039 | Friendship | Expire stale request | ExpiryQueue(expireBucket,expiresAt#requestId) | Query + conditional update | `relationships`; `wallet`; `operations` | At seven days or activity ending; no refund |
| AP-040 | Friendship | Prevent repeated request to same person | Pair / RequestDedup(pairId,mode) | GetItem + conditional write | `relationships`; `wallet`; `operations` | Blocks and cooldowns |
| AP-041 | Wallet | Read credit balances | Wallet(uniqueId) | GetItem strongly consistent | `wallet` | Free vs purchased balances |
| AP-042 | Wallet | List credits and charge history | Ledger(userId,occurredAt#txnId) | Query descending | `wallet` | Immutable audit |
| AP-043 | Wallet | Apply monthly free allocation | Wallet+monthlyGrantKey+Ledger | TransactWrite | `wallet` | Women 4; other users 2; one grant/period |
| AP-044 | Wallet | Expire unused monthly free credits | Wallet+period marker+Ledger | Conditional/transactional update | `wallet` | Anniversary cutoff; no rollover |
| AP-045 | Wallet | Purchase credit pack | PaymentReceipt(storeTxnId)+Wallet+Ledger | TransactWrite | `wallet` | Store verification; credit once |
| AP-046 | Wallet | Restore failed/duplicate charge | Wallet+Ledger+reversal marker | TransactWrite | `wallet` | Refund exception only; idempotent |
| AP-047 | Wallet | Read purchase transaction | PaymentReceipt(storeTxnId) | GetItem | `wallet` | Support/refund/reconciliation |
| AP-048 | Local | Create post with up to five photos | Posts(postId)+owner list+geoCell index+usage | TransactWrite / staged media publish | `local`; `operations` | Up to 5 photos; selected locality; H3 res 6; post locality anchored, global reach 50 km max |
| AP-049 | Local | Get post by ID (including admin) | Posts(postId) | GetItem | `local`; `operations` | Check status, expiry, permissions |
| AP-050 | Local | Fetch Local feed within user-selected 0–10 / 10–35 / 35–50 / All 0–50 | LocalIndex(FEED#R6#homeCell, POST#time#postId) | Bounded multi-cell Query + canonical BatchGet + cursor | `local`; `operations` | Priority by near distance band; authoritative distance/expiry/block checks; no global exact-nearest claim |
| AP-051 | Local | Get Activity-only local feed | LocalIndex(ACTIVITY#R6#homeCell,POST#time#postId) | Bounded multi-cell Query | `local`; `operations` | Type-specific pointer for Activity only; 50 km hard ceiling |
| AP-052 | Local | Show posts in nearby People feed | LocalIndex cells + author relation | Query + bounded in-memory join | `local`; `operations` | Shared canonical postId in People/Local/Activities; no copy; band eligibility checked |
| AP-053 | Local | List own posts | PostByAuthor(userId,createdAt#postId) | Query descending | `local`; `operations` | Owner edit/close/delete |
| AP-054 | Local | Edit/close/delete post | Posts(postId) + index pointer(s) | Conditional write + cleanup | `local`; `operations` | Old locality closed; no duplicate index |
| AP-055 | Local | Read post comment page | PostComments(postId,createdAt#commentId) | Query paginated | `local`; `operations` | Chronological, live posts only |
| AP-056 | Local | Add a comment | PostComments + Usage + optional counts | Transaction / conditional update | `local`; `operations` | 10 comments/day; contact/text guards |
| AP-057 | Local | Remove comment | PostComments(commentId/postId) + counters | Conditional delete | `local`; `operations` | Owner/moderator permissions |
| AP-058 | Local | Add/remove a reaction | PostReactions(postId,userId)+Usage | Conditional transaction | `local`; `operations` | 1 reaction/user/post; 30/day |
| AP-059 | Local | Read reaction count | PostStats(postId) | GetItem | `local`; `operations` | Counter reconciliation; no sort by popularity |
| AP-060 | Local | Expire posts and children | ExpiryQueue(dateBucket,expiresAt#postId) | Query + state transition | `local`; `operations` | 7-day max; activity earlier |
| AP-061 | Local | Clean expired post photos | PostMediaByPost(postId) / media manifest | Query + delete assets | `local`; `operations` | Do not rely on TTL alone |
| AP-062 | Chat | List user's conversations | ConversationInbox(userId,lastActivity#pairId) | Query descending | `chat`; `relationships` | Never leak blocked/expired chat |
| AP-063 | Chat | Fetch last 7 days of messages | Messages(pairId,createdAt#messageId) | Query using time boundary | `chat`; `relationships` | Check entitlement, block, clear-generation |
| AP-064 | Chat | Send a text or photo message | Messages+conversation updates | Conditional write / transaction | `chat`; `relationships` | Unlocked and not blocked; expiry metadata |
| AP-065 | Chat | Delete history for both | Conversations(pairId) historyGeneration | Conditional update | `chat`; `relationships` | Immediate visibility cut-off for both |
| AP-066 | Chat | Remove expired message media | MessageMediaByConversation(pairId) | Query + delete media | `chat`; `relationships` | Seven-day lifespan; legal exceptions |
| AP-067 | Chat | Mark read/unread | UserConversationState(userId,pairId) | UpdateItem conditional | `chat`; `relationships` | Read receipts disabled by default |
| AP-068 | Chat | Mute/archive chat | UserConversationState(userId,pairId) | UpdateItem | `chat`; `relationships` | User-private preference |
| AP-069 | Safety | Block target user | Blocks(blockerId,targetId) + reverse | Conditional write | `safety`; `accounts`; `relationships`; `local` | Immediately stop new interactions in both modes |
| AP-070 | Safety | Unblock target user | Blocks(blockerId,targetId) + reverse | Conditional write | `safety`; `accounts`; `relationships`; `local` | No automatic match restoration |
| AP-071 | Safety | Submit post/profile/conversation report | Reports(reportId)+ReportByTarget(targetId,at#id)+queue | TransactWrite | `safety`; `accounts`; `relationships`; `local` | Report user/conversation, not granular message report |
| AP-072 | Safety | Get moderator report queue | ModerationQueue(status#bucket,createdAt#reportId) | Query | `safety`; `accounts`; `relationships`; `local` | No scans; status transitions |
| AP-073 | Safety | Admin lookup post/user by ID | Posts(postId) or Users(uniqueId) | GetItem | `safety`; `accounts`; `relationships`; `local` | Staff-only access, audited |
| AP-074 | Safety | Admin hide/restrict/restore post | Posts(postId) authoritative status | Conditional update | `safety`; `accounts`; `relationships`; `local` | All feed read paths enforce status |
| AP-075 | Safety | Admin restrict profile privileges | Users(uniqueId)+mode restrictions | Conditional write | `safety`; `accounts`; `relationships`; `local` | Clear privilege scope, appeals |
| AP-076 | Safety | Audit admin actions | AdminAudit(adminId,occurredAt#actionId) | PutItem+Query | `safety`; `accounts`; `relationships`; `local` | Limited appropriate retention |
| AP-077 | Safety | Appeal moderator decision | Appeals(targetId,createdAt#appealId) | Query/conditional write | `safety`; `accounts`; `relationships`; `local` | Owner and staff access |
| AP-078 | Lifecycle | Store genuine user notification | Notifications(userId,createdAt#eventId) | PutItem | `operations`; `accounts`; `local`; `chat` | Privacy-safe previews |
| AP-079 | Lifecycle | Get notification page | Notifications(userId,createdAt#eventId) | Query descending | `operations`; `accounts`; `local`; `chat` | Category settings/quiet hours |
| AP-080 | Lifecycle | Deactivate profile/account | Users+Profiles+visibility state | Conditional write | `operations`; `accounts`; `local`; `chat` | Hidden immediately despite stale projections |
| AP-081 | Lifecycle | Delete account and linked content | User-owned partition lists + expiry queue | Queries, bounded cleanup | `operations`; `accounts`; `local`; `chat` | No scans; defined retention exceptions |
| AP-082 | Lifecycle | Re-match existing pair after unmatch | Pair(pairId) | Conditional write | `operations`; `accounts`; `local`; `chat` | Fresh mutual consent; reusable Connect entitlement |
| AP-083 | Profiles | Read/update per-mode distance band choice | accounts(USER#uid, SETTINGS) | GetItem / UpdateItem | `accounts` | 0–10, 10–35, 35–50, All 0–50; no hidden ranking |
| AP-084 | Discovery | Enumerate H3 resolution 6 cells intersecting selected band | h3 gridDisk + conservative boundary coverage | In-process H3 calculation | `discovery` / `local` | Cover all edge cells; home cell only; near-first staged |
| AP-085 | Local | Publish post with selected local reach band | local POST#id + FEED#R6#homeCell | TransactWriteItems | `local`; `operations` | Viewer band and 50 km ceiling checked |
| AP-086 | Local | Close previous locality posts on chosen-location change | AUTHORPOST#uid and POST#id | Query / bounded conditional write | `accounts`; `local`; `discovery` | Do not silently migrate social posts to a new locality |
| AP-087 | Discovery | Read a paginated multi-cell near-first page | Cell query cursor + pending candidate IDs | Query / BatchGet | `discovery`; `local` | Bounded operations, secure cursor; pagination does not eliminate cell fanout |
| AP-088 | Discovery | Apply final exact approximate-center distance and band | Candidate center + selected center | Application validation | `discovery`; `local` | [0,10], (10,35], (35,50]; ordered only over fetched candidates |
| AP-089 | Discovery | Invalidate cursor after locality/filter change | Signed cursor with localityRevision | Application validation + GetItem | `accounts` | Do not accept arbitrary client cells or stale location |
| AP-090 | Local | Retrieve activity-only distance-band page | ACTIVITY#R6#homeCell | Bounded Query / BatchGet | `local` | Activity end-time <= post seven-day expiry |

## Registry coverage checks

- Original AP-001 through AP-082 remain represented; AP-083 through AP-090 are new.
- Every route listed here must be mapped to a documented exact key or bounded in-process computation; no request-path `Scan`.
- `Conditional` and `TransactWrite` items require actual implementation-specific transaction shape validation, especially wallet + pair + mirrored records and counters.
- Geographic cell fan-out, nearest-first ordering, exact-distance checks, and cursor progression require integration tests; a paper registry cannot prove them correct.
- `No GSI` is a first-design hypothesis, not a rule to hide inefficient query patterns.
