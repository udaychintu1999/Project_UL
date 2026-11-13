# API-level query contracts (DB-facing draft)

Each Flutter client call is authenticated. The backend derives current user's `uid` and selected locality from authoritative `uluv_users` and `uluv_settings`; never trust arbitrary client-provided DynamoDB PK/SK or longitude/latitude as authorization.

| Screen/API concept | Principal tables | Query strategy |
|---|---|---|
| `GET /me` | users, profiles, settings, wallet | direct Gets / BatchGet |
| `PATCH /me/settings` | settings, discovery, local_posts | conditional update; close old posts on locality change |
| `GET /dating/discover` | settings, discovery, profiles, users, blocks, dating_likes | bounded R6 multi-cell Query, hydrate + eligibility filters |
| `GET /dating/liked-you` | dating_likes, profiles, blocks | `LIKEDYOU#uid` Query + hydrate |
| `GET /dating/matches` | dating_matches, profiles, connections | `MATCHES#uid` Query |
| `POST /dating/like` | dating_likes, dating_matches, operations | free conditional transaction, no wallet debit |
| `POST /dating/like-back` | dating_likes, dating_matches, wallet | paid conditional transaction (1 credit) |
| `POST /connections/unlock` | connections, dating_matches/friendship_requests, wallet | paid exactly-once transaction (1 credit) |
| `POST /friendship/requests` | friendship_requests, wallet, operations | paid successful-send transaction (1 credit) |
| `GET /local/feed` | settings, local_posts, profiles, blocks | H3 R6 band-first pointer queries |
| `GET /local/activities` | settings, activities, local_posts | activity pointer queries + canonical hydrate |
| `POST /local/posts` | local_posts, activities?, operations | canonical post + optional activity extension + quota |
| `GET /local/posts/{postId}/comments` | local_comments, local_posts | Query by `POST#id`, canonical parent check |
| `PUT /local/posts/{postId}/reaction` | local_reactions, operations, local_posts | conditional update + quota |
| `GET /chat/{pairId}` | connections, chat, blocks | check pair entitlement and permission, Query current generation |
| `POST /chat/{pairId}/clear-both` | chat, connections | conditional history generation bump; entitlement remains |
| `GET /admin/posts/{postId}` | local_posts, activities?, safety | direct lookup |
| `POST /admin/users/{uid}/restrict` | users, safety | conditional restriction + audit |

### Cursor contract

Opaque signed cursor containing user/mode/localityRevision, selected band(s), per-cell `LastEvaluatedKey`, candidate buffer/tie-breakers, expiry and safe server-side parameters. Reject stale cursor when locality or filter preferences change. First page can prioritize 0–10 km; farther bands follow only when selected, and the API must not promise perfect global nearest-first among unenumerated candidates.

### Privacy contract

Public profile API never returns raw provider IDs, private email, DOB, home coordinates or full wallet data. Admin routes separately authorized; public reaction/comment user IDs represented by safe public profile handles.


**FINAL v2.0:** Java DynamoDB Local throughout P00–P16. Owner manually sets up two DEV S3 buckets and one DEV CloudFront distribution early; no AI-driven AWS activity without separate scoped explicit approval. Local media adapter remains default; production AWS DynamoDB/media/ECS at P17, payment sandbox P16. See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.
