# U_luv UI QA and Acceptance Checklist

## Visual and accessibility

- [ ] Every in-scope screen has corresponding reference ID and route; no duplicated main tabs.
- [ ] Four main tabs: Dating, Friendship, Connects, Profile.
- [ ] Image cards are legible, crop without distortion, and have placeholders/retry states.
- [ ] 320–430 dp phone widths and large system font scales remain usable; keyboard does not hide Send or Continue.
- [ ] Tap areas >= 44–48 dp where feasible; form inputs have semantic labels; voice-over/navigation ordering works.
- [ ] Contrast, inactive and disabled states are distinguishable without color alone.
- [ ] Motion is optional/minimal; respect reduced motion accessibility settings.

## Business states

- [ ] Like from Dating discovery free; 100/day cap configurable and Pass free.
- [ ] Liked You previews free; paid Like Back always shows explicit 1-credit confirmation and no promise of chat unlock.
- [ ] Connect confirmation shows 1 credit and doesn't bill after entitlement already exists.
- [ ] Friendship request charges exactly once on successful send; no false refund on rejection/expiry.
- [ ] Zero-credit and backend failure states accurately preserve wallet balance.
- [ ] Seven-day Local and chat content no longer visible after expiry; media link refresh and unauthorized responses handled.
- [ ] User-selectable four distance modes including All 0–50; no popularity/sponsored ranking.
- [ ] Block supersedes connections; reports/admin actions hide content consistently.
- [ ] No unapproved phone/password auth, group chat, calls, paid boosts, or verification badge.

## Verification evidence per screen

Record: screen ID, phase, changed Flutter files, fixture ID, static/unit/widget/golden/API integration commands, observed PASS/FAIL/UNVERIFIED, screenshot paths if actually rendered, accessibility checks, defects fixed, and exact next manual steps. Do not mark visually compared unless a screenshot was actually captured and inspected.

## Pack QA (asset level)

- 80 mobile PNG images, 4 admin PNG images, 11 contact sheets, 13 inspiration boards.
- Manifest paths in `SCREEN_REGISTRY.csv` must resolve; ID uniqueness enforced.
- All ZIP members under the package root; no .env or private keys.
- Tests of mobile app functionality were **not** executed as part of producing these references.
