# CURRENT PROJECT CHECKPOINT — 2026-11-14 (P01-3 V3)

**P00:** historical owner `CORE_FLOW_VERIFIED`. **P01-1:** manual core accepted, Android OTP automated FAIL accepted only for local development (not a PASS). **P01-2:** owner explicitly reported all latest automated and manual checks PASS, accepted. **P01-3:** design and security decisions APPROVED, **NO CODE YET**; owner requested complete docs before authorizing coding. **P02:** not started.

**Current P01-3 authority:** `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` and companion simple-refresh/device/UX/QA docs. V2 proposals and archived `PENDING` markers are historical, not present directions. No AWS, live email, Google, or payment authorization.

---

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# U_luv product contract — current authoritative delta

**Supersedes:** `docs/reference/PRODUCT_REQUIREMENTS_v1_1_ARCHIVED.md` on the topics below. All unchanged agreed business rules from that archived specification remain applicable. This file intentionally stays concise so coding agents can start here instead of rereading old drafts.

## Product identity

- U_luv: Pan-India adults-only Dating, Friendship and hyperlocal social feed, **Algorithm-Free Connections**.
- Algorithm-free = no secret popularity/engagement/spend-based rankings; transparent user-selected distance ordering is allowed.
- Four main tabs: Dating, Friendship (People / Local / Activities), Connects/Chats, Profile.
- Google Sign-In and email OTP; no mandatory phone. Separate Dating/Friendship profiles, minimum 2 photos each (up to 6).

## Updated distance requirement — FINAL, 10 November 2026

- Applies to **Dating discovery, Friendship people discovery, and Local feed/Activities**.
- User-selectable ranges: **0–10 km**, **10–35 km**, **35–50 km**; user may select **All 0–50 km**.
- Boundaries do not overlap in storage/filtering: [0,10], (10,35], (35,50]; exact 10 km belongs to band 1, exact 35 km to band 2.
- **Closer gets higher priority**, with bands 0–10 then 10–35 then 35–50 in All mode. No hidden attractiveness/paid ranking. A user who selects only 35–50 sees only that band; nearest of the selected band is prioritized.
- Distance is from **selected approximate locality centers**, not actual GPS or a user's home address.
- Local posts use the author's already-selected locality, never require a new post location; same canonical post may appear in nearby People/Local/Activities views.
- Pan-India availability does **not** mean a nationwide Local feed. Local content is visible only within selected radius and geographic authorization checks. Location-selection spoofing is a documented launch limitation.
- Earlier 5 km default and 10 km maximum Local radius are **RETIRED**.

## Dating and credits

- Ordinary right Like: free within 100/day cap; free mutual match if reciprocating during regular Dating discovery. Unlimited Passes.
- All eligible incoming Likes shown free with safe limited profile preview.
- **Like Back inside Liked You costs 1 credit** (creates match only); **Connect costs 1 more credit** to open chat. Both are explicit, separate confirmations.
- Mutual matches and incoming Likes free to view; no pay-to-be-seen. First successful Connect unlock paid exactly once per pair, regardless of simultaneous taps.
- Women (self-identified, including trans women) receive 4 monthly free credits; other eligible users receive 2. One shared wallet across modes. Free credits renew on activation anniversary, do not roll over; purchased credits have no arbitrary expiration; spend free before purchased.
- Credit pack targets: ₹49/3, ₹149/10, ₹399/30, subject to accurate storefront prices.
- Friendship invitation: 1 credit **at successful send**, nonrefundable on rejection, cancellation or 7-day expiry; no further charge on acceptance. Failures/duplicate deductions corrected.
- Already connected pairs do not pay a second Connect charge. Unmatching ends relationship and requires fresh mutual interest; a prior valid lifetime chat entitlement is not charged again on voluntary reconnection; blocking overrides.

## Local community

- Types: activity, question, recommendation, discussion; text plus **up to five photos**, no post videos at launch.
- Per-user caps: 3 new posts/day, 5 active posts, 10 comments/day, 30 reactions/day, one active reaction per user per post.
- Posts/comments/reactions/photos disappear normally after maximum 7 days; activities expire earlier at activity end. A location change closes prior locality posts.
- No algorithmic trending, paid boosts or nonlocal viral distribution.
- Lightweight text guards, best-effort on-device image checks, post/profile/conversation reporting, admin hide/delete/restrict. Comprehensive media screening and photo verification badges deferred.

## Chat and privacy

- Chat text/photos, per-message expiry 7 days; user-invoked clear-history applies to both participants' ordinary views.
- Lifetime unlocked pair conversation, no recurring charge in initial version; future pricing may change only with separate clear terms.
- Contact details never auto-disclosed; public text/photographs subject to restrictions on advertising off-platform contact.
- Respect blocks, visibility, account restrictions, age eligibility. Preserve only narrowly necessary transaction, support, investigation and legal records after ordinary expiry.

## Design decisions vs proof points

The above is the **product contract**. H3 resolution 6, the proposed 18-table physical schema, specific cursor fields, budgets and optional sharding are **technical proposals** subject to actual load tests. This stage makes no claim of tested runtime functionality.

## Authentication owner decision — P01-2/P01-3 (2026-11-13)
Support email+password as primary regular sign-in (no routine OTP cost); preserve optional email OTP and future Google Sign-In. Registration proves email via OTP, self-declares adult eligibility and consent, then creates password against the **same immutable ID**. Password creation policy (2026-11-13 OWNER-APPROVED DESIGN): NIST SP 800-63B-4-aligned single-factor minimum **15 Unicode code points**, **no mandatory special character/uppercase/digit**, accept spaces/passphrases and support >=64 characters; block common/compromised passwords. Current local P01-2 source still enforces obsolete 8+symbol and must be updated in a separately authorized implementation; do not represent target policy as shipped. No plaintext password storage. Use Argon2id, rate limits, secure recovery and revocation. P01-2 retains short-lived existing opaque sessions; **P01-3** will provide 30-day continuously renewable persistent authentication across device/app restarts.
