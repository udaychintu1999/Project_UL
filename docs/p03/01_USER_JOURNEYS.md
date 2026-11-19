# 01 — P03-1 user journeys and navigation

## Account routing (server-owned decision)

The app authenticates via the existing P01-3 session flow; the server's `onboarding.ready` from the P02 profile contract decides whether the person completed the profile. **Never infer readiness from local flags or saved text fields.** A returning completed profile must not see the onboarding wizard flash during startup.

| Owner state | Main bottom navigation | First selected page | Profile editor |
| --- | --- | --- | --- |
| Incomplete profile | **Dating/setup · Settings** | Dating/setup | Guided setup remains under Dating; security/location settings under Settings |
| Completed profile | **Dating · Friendship · Local Feed · Connects · Settings** | Dating | View/edit summary and security under Settings |

**Local Feed is third.** Its page is **Local Feed & Activities**; the two activities are inside that tab. Friendship is separate. There is no Home tab. Connects and discovery result feeds still have later-phase placeholders, not fictional working endpoints.

## Missing-location flows (completed profile)

- Dating, Friendship and Local Feed/Activities each read the owner's saved location using authenticated `GET /v1/me/geo/location` when active. Do not show the selection prompt until an authoritative response confirms `location: null`. On error, show a retry rather than falsely claiming the user has no location.
- The prompt offers explicit **Use GPS** and **Manual selection**. There is no automatic permission request or background tracking.
- **Manual:** tapping Manual opens a bottom sheet → State/UT → District → auto-loaded, checksum-verified Village/Town options → select a place → Save. A successful Fastify 200 ACK closes the sheet and immediately updates the saved label. Re-entering any relevant tab or Settings must independently read the saved label from the server.
- **GPS:** one explicit tap requests one current fix. Fastify rejects stale/inaccurate/malformed/out-of-India fixes, derives H3 R6 and stores the approximate center only. No second confirmation button. Permission denial or GPS unavailability must leave manual selection accessible.
- **Settings:** concise **Location & discovery** expandable row with saved-place subtitle; no unsolicited cache meters, debug explanations or automatic district bulk download. Saved profile and edit controls live in Settings.

## State and failure scenarios

| Condition | Correct behavior |
| --- | --- |
| Already completed profile after relaunch | Five tabs; no repeat onboarding; profile in Settings |
| Incomplete account | Two tabs, no full discovery/navigation |
| Stored location present | No location-required prompt; show the saved label |
| Location GET unavailable / invalid | Preserve prior verified label; explicit retry, not false `null` |
| CDN unavailable | Bundled verified state/district index remains; authenticated Fastify pack fallback can deliver the exact checksum-pinned pack |
| Wrong pack SHA, unrecognized pack or untrusted manifest | No save based on unverified bytes; retry/fail closed |
| Manual save 409 revision conflict | Inform owner and refresh private settings; don't claim save |
| Manual save 429 cooldown | Explain cooldown and allow later retry; don't claim save |
| Duplicate/late GPS or older location read | One save per explicit action; late response cannot overwrite a newer ACK |
| Device/account inactive or underage | Fastify transactional guard rejects location write |
| No location but tab active | Show GPS/manual, not real people/posts |

**Privacy:** location is an approximate locality. No raw GPS or real names are sent to S3; P03-1 does not publish discovery pointers. The public user-facing feature is intentionally not implemented in P03-2.

**Later-stage eligibility:** P03-3 may create an unverified private pointer only after explicit mode activation, and may revoke it after owner or trusted restriction changes. This does not expose people. `uluv_blocks` will be viewer-specific at P03-4 canonical hydration; an individual block must not globally deactivate the target's mode. See [05 — safety](05_POINTER_LIFECYCLE_AND_SAFETY.md).
