# U_luv UI Flows and Product Rules — Authoritative Design Annotations

## Flow map

| User journey | Suggested reference IDs | Rules to enforce |
|---|---|---|
| Welcome and registration | S01–S06 | Google or email OTP; no mandatory password, phone or Apple Sign-In; 18+ |
| Location, interests, photos | S07–S16 | Two photos minimum per enabled mode; maximum six; separate visibility |
| Dating browsing | S17–S19, S29, S32 | Free right Likes (100/day configurable), free Passes, selected distance bands |
| Incoming likes | S20–S22 | Fully visible contact-safe preview for free; explicit 1-credit Like Back generates mutual match only |
| Mutual match and connect | S23–S28, S30–S31 | Ordinary mutual Likes free; 1-credit Connect separately unlocks lifetime one-to-one chat, only once per pair; block overrides |
| Friendship | S33–S40, S80 | Send request charges 1 credit only on successful send; rejected/expired requests aren't refunded; accepted chat free; five pending cap |
| Local posts | S41–S45, S78–S79 | Selected locality, three posts/day, five active, max five photos, 7-day expiry; local comments and reactions free |
| Activities | S46–S48 | One canonical Local post with activity metadata; no event ticketing, group chat, RSVP roster or automatic connection |
| Connects and chat | S49–S56 | One-to-one chat only; text/photos; each message expires 7 days after sending; clear-for-both does not revoke entitlement |
| Credits and purchases | S57–S64 | Wallet credits, ledger, idempotent charges; 4 free monthly credits for women including trans women, 2 for others; purchases no arbitrary expiry |
| Profile and safety | S65–S72 | Independent mode visibility, receipts off, online status hidden, report/block/delete account |
| Additional states | S73–S80 | Loading, offline, underage, upload failure, post expiry, locality change, pending-request limit |
| Admin | A01–A04 | Lookup by ID, reports queue, hide/delete/restore and scoped user restrictions, audit |

## Distance filter specifics

User-adjustable modes apply to Dating, Friendship and Local/Activities: **0–10 km**, **10–35 km**, **35–50 km**, and **All 0–50 km**. Bands are inclusive of their upper limit and exclusive of previous upper limit. Prioritize closer results and nearer bands using transparent user selection, never popularity or spend. Distances are approximate between selected localities. H3 Resolution 6 is an initial technical choice, not a visible design label.

## Exact payment behavior

1. **Ordinary Dating Like**: free. Free match upon mutual normal Likes.
2. **Liked You**: see all eligible incoming Likes free. Like Back here costs one credit and creates a match, not a chat unlock.
3. **Connect**: separate explicit one-credit confirmation to unlock Dating chat; either person can pay; do not double-charge an already-entitled pair.
4. **Friendship request**: one credit on successful request send; no fee on acceptance; no refund merely because rejected/cancelled/timed out; refund/avoid debit on failed write.
5. **Credits**: 4 monthly free for women (including trans women), otherwise 2; free expire with renewal, purchased do not arbitrarily expire. Spend free before purchased. Display actual provider prices for paid packs.

## Local and chat expiry

- Local content and linked media available for up to 7 days; Activity can end earlier at event end. Comments/reactions tied to post expiry.
- Each message and photo has independent 7-day lifetime from sending.
- UI must not show content after expiry even if asynchronous physical storage cleanup is pending.
- Clearing conversation history for both is a destructive confirmation; the lifetime connection permission persists.
- Signed URLs are temporary bearer URLs; signed access cannot be assumed instantly revoked until token expiry. Always obtain new access through backend permissions.

## Explicit non-features / corrections to old inspiration boards

Do **not** implement phone/password-first mandatory signup, Apple Sign-In at launch, public group chats, chat calls/video, RSVP headcounts/join-group buttons, paid boost/star swipes, subscriptions, permanent Verification badge, fake popularity metrics, public exact GPS, video posts, or paid event ticketing based solely on mockup artwork.

Image and UI reference files can have small typography errors, inconsistent labels and illustrative sample profiles. Business documents and backend contracts win over image text, and designers should fix visible copy when implementing Flutter.
