# Privacy, safety and Admin access with split tables

## Boundaries

- `uluv_users`: internal identity, eligibility and restrictions; no public access to DOB or account status beyond safe display states.
- `uluv_auth_links`: verified identity mapping; never exposed to public profile or feed queries.
- `uluv_profiles`: allow public **contact-safe** projection only; two-photo minimum for active mode.
- `uluv_settings`: account-local selected locality and privacy preferences; expose only coarse public locality.
- `uluv_blocks`: query both directions in every profile, Like, request, chat and Local-interaction authorization path.
- `uluv_local_posts`/`uluv_activities`/`uluv_local_comments`/`uluv_local_reactions`: public UGC only while eligibility, status, radius and expiry permit.
- `uluv_safety`: limited staff access and audited decisions.

## Low-budget launch moderation

Text guards on bio, captions, public comments and posts; basic file/type checks and optional on-device image signals; post/profile/user-or-conversation reporting; lightweight admin dashboard for Post ID, Comment ID with known parent Post ID, User ID, reporting queue, hide/restore/delete/restrict/ban. Photo checks are not comprehensive NSFW or proof-of-age systems. Underage screening and platform minor-access controls remain required.

## Cross-table admin actions

- Hide post: update `uluv_local_posts POST#id/META` authoritative status; this suppresses activity, feed and comments regardless of stale pointers. Activity metadata may also be marked closed.
- Hide/remove comment: update `uluv_local_comments POST#id/T#time#commentId` state; reports should carry full composite locator.
- Restrict account: update `uluv_users USER#uid/META` status; filters on Dating/Friendship/Local must reject it even if pointers remain.
- Admin audit action: write `uluv_safety ADMINAUDIT#adminId/T#...`; status updates + audit should commit atomically where feasible.
- Report volume suggests investigation; never irreversible ban simply because a threshold of unverified reports is crossed.

## Geographic privacy

Selected locality center, not live phone GPS; user controls band up to 50 km. No precise private addresses, live movements or exact home coordinates in public APIs. Local feed visibility never exceeds the selected policy/area limits and must respect blocking.
