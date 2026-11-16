# U_luv Visual Design System — Reference v1.0

## Visual direction

Premium, welcoming, modern people-centric mobile experience influenced by the user's original pink Dating and green Friendship inspiration (not a direct clone). Light warm surfaces; distinctive coral for Dating CTAs, teal/mint for Friendship, restrained shadows, round cards, meaningful photos and clear status feedback.

## Illustrative tokens (not immutable product requirements)

| Token | Suggested value | Application |
|---|---|---|
| `dating.primary` | `#FF4E7A` | Dating actions, Like hearts, active Dating tab |
| `dating.dark` | `#F93571` | Gradient accent |
| `friendship.primary` | `#0EA98E` | Friendship actions, requested/accepted indicators |
| `friendship.selected` | `#DBF8EE` | Selected chip backgrounds |
| `surface.background` | `#FFF7F6` | App canvas |
| `surface.card` | `#FFFDFC` | Cards and sheet surfaces |
| `surface.pinkTint` | `#FFECF0` | Dating notices |
| `surface.mintTint` | `#E0F9F3` | Friendship notices |
| `content.primary` | `#21212A` | Text |
| `content.muted` | `#77707B` | Secondary text |
| `error` | `#C83C62` | Errors and destructive actions |

Keep accessible contrast; some aesthetically generated tones may require darker text or accent adjustments for WCAG compliance. Meet 44–48 dp interactive targets and support screen readers and dynamic text. Do not interpret generated status-bar, icons or system chrome as pixel-perfect Flutter requirements.

## Typography and spacing

- Headers: bold/semibold rounded sans such as Poppins (properly licensed), fallback system fonts.
- Body: Inter or Flutter's system sans. No font files packaged.
- Body 14–16 sp, secondary 12–13 sp, card title 16–18 sp, page title 22–28 sp; adapt to user text scaling.
- Suggested 4/8/12/16/24 px scale, 16–22 px card radii and pill buttons 24–28 px.
- Avoid horizontal content clipping and stacked floating bottom nav on small Android screens.

## Four main tabs (authoritative)

1. **Dating** — Discover, profile detail, preference filters, free Likes; mutual matching.
2. **Friendship** — People, Local Feed and Activities subtabs; send/receive paid requests.
3. **Connects / Chats** — Liked You, Matches, Likes Sent, Friendship Requests and unlocked one-to-one chats.
4. **Profile** — Dating/Friendship profiles, Wallet, settings, privacy, notifications, help and deletion.

Bottom bar stays consistent. Profile setup / auth screens may omit bottom bar. Desktop Admin uses a separate side navigation.

## Components to share in Flutter

`UluvScaffold`, `UluvBottomNav`, `ModeHeader`, `ProfileImageCarousel`, `DiscoveryCard`, `DistanceBandSelector`, `LocalPostCard`, `ActivityCard`, `PhotoGrid`, `CreditConfirmSheet`, `ExpiryNotice`, `ConfirmDestructiveDialog`, `EmptyState`, `ErrorRetryState`, `SafeMediaImage`, `PermissionGuard`, `SkeletonCard`.

Create widget constructors that accept data and callbacks instead of hardcoding screen examples. Use mock fixtures for screenshots, while real API data must be used in integrated workflows.

## Media and privacy

Images are served via backend-authorized short-lived CloudFront signed URLs when AWS media is enabled; source keys and signing secrets never appear in responses. UI handles expiration, loading placeholders and refresh. Profiles show approximate selected-locality distance, not precise GPS. Profile photos persist until policy deletion; chat/Local/Activity media expire with content. No screenshot or sample asset is consented for real-user production use.
