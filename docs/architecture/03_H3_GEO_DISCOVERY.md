# H3 Resolution 6 — Geo Discovery with separate Local tables

**Unchanged product rule:** User chooses 0–10 km, 10–35 km, 35–50 km, or All 0–50 km across Dating, Friendship and Local. Locality comes from `uluv_settings`, not live GPS. Nearer bands win before farther bands.

## Profile candidate flow

1. `GetItem uluv_settings USER#viewer SETTINGS` for selected locality, radius and locality revision. (The space-free actual table name is `uluv_settings`.)
2. Use actual H3 library `latLngToCell(selectedCenter, 6)` and a conservative surrounding-cell cover for each configured distance band; include boundary-overlapping cells.
3. Query `uluv_discovery` cells using `PK=DISC#DATING#R6#cell` or `DISC#FRIENDSHIP#R6#cell`, paginating per cell.
4. BatchGet canonical `uluv_profiles` mode items; check active/complete profile, latest `uluv_users` eligibility, `uluv_blocks` both directions, gender/age/intention filtering and selected-center distance.
5. Merge only valid candidates, nearer bands first. Within a fetched page, sort by approximate-center distance with stable ID tie-breaker; do not claim complete globally exact nearest-first ordering unless all closer candidates have been enumerated.
6. Store signed/opaque progress cursor with `localityRevision`, band index, queried cells, LastEvaluatedKey per cell, stable tie-breaker and any buffered candidates. Limit work per request.

## Local post / activity flow

1. Publish a Local post with one canonical `uluv_local_posts POST#id/META`, one home-cell pointer `FEED#R6#cell`, and an `AUTHORPOST#uid` pointer. Include up to five S3 image references.
2. If type ACTIVITY, create `uluv_activities POST#id/META` with schedule fields and an activity-only pointer `ACTIVITY#R6#cell / POST#ISO#id`. These reference the same post ID.
3. Feed: query per-neighbor-cell `uluv_local_posts FEED#R6#cell`, then BatchGet canonical posts, check distance/radius, expiry, moderation, blocks and mode eligibility.
4. Activities-only: query `uluv_activities ACTIVITY#R6#cell`, hydrate canonical `uluv_local_posts` post + activity details, apply identical checks.
5. Nearby People feed may reuse the same canonical Local post ID (shared reactions/comments). Never create separate copies of posts for different feed surfaces.
6. Local post comments: query `uluv_local_comments POST#id`; personal reaction: Get `uluv_local_reactions POST#id/USER#viewer`.
7. If user changes locality, close previous active Local posts via the bounded `AUTHORPOST` listing rather than silently moving posts to a new geographic cell.

## Why H3 R6 rather than 7?

H3 resolution 6 has larger average cells (about 36 km² versus 5 km² for R7), reducing average candidate-cell fan-out in a 50-km search, at the cost of filtering more candidates per queried cell. This is a chosen prototype hypothesis, not production benchmark evidence. Boundary, dense-city and sparse-area tests are required.

## Pagination and distance integrity

- DynamoDB `Query` is scoped to a partition key. A cursor limits items fetched from that partition; it does NOT eliminate the need to query other intersecting geographic cells.
- Exact inclusion depends on selected locality centers and the user-selected range [0,10], (10,35], (35,50], or all [0,50]. Distance tie-breaks must be deterministic.
- A post's allowed visibility circle and the viewer's selected range should both be respected where product policy applies.
- No automated radius widening outside user settings, no popularity or spending ranking.
- Verify behavior with neighboring cells and posts exactly at 10, 35 and 50 km, including roundoff tolerance.
