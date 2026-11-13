# U_luv — Product & Business Requirements v1.1

**Pre-Architecture Product Baseline | India-first social discovery | 9 November 2026**  
**Product motto:** **Algorithm-Free Connections — Real People. Real Choices. Real Connections.**  
**Status:** Product features and recommended launch policy defaults consolidated for pre-architecture review. The remaining gates concern operational readiness, app-store compliance, and legal validation; these cannot be closed by document wording alone. **This is NOT technical architecture or implementation design.**

> **Document convention:** **CONFIRMED** means agreed in product discussions. **ADOPTED DEFAULT** means the founder broadly accepted a recommended operating rule; revise if needed before public policy publication. **POLICY LOCK (V1.1)** means a specific recommended product default established in this revision; it is not represented as an explicitly spoken founder decision. **LAUNCH GATE** means an external, legal or operational requirement that must be verified before public release. **LATER** means explicitly deferred. No unapproved functionality should be silently presented as confirmed.

## Executive product summary

U_luv is an adults-only, Pan-India mobile experience for **Dating**, **Friendship**, and a **hyperlocal social/activity feed**. Users discover people through explicit, understandable preferences and transparent ordering—not popularity, attractiveness, engagement-maximizing or spend-based ranking. Public previews are meaningful but contact-safe. All genuine incoming Dating Likes and mutual matches are visible without reveal fees. Monetization is through explicit Connect-credit actions: **paid Like Back from the incoming Likes area**, **unlocking a Dating chat**, and **sending a Friendship request**. Existing unlocked relationships remain available without recurring charges. Messages are short-lived, while the connection permission persists.

The launch includes Google/Email OTP onboarding; two or more photos per enabled profile mode; text/photo chat; local posts with up to five images; area-restricted feed; comments/reactions with limits; expiring content; privacy controls; community reporting; and a lean moderation admin website. Photo verification badges, video posts, voice notes, calls, group chats, and complex event management are deferred.

## 1. Product principles and scope

| ID | Principle | Required outcome | Status |
|---|---|---|---|
| PR-01 | Algorithm-free social discovery | No hidden engagement, attractiveness, behavioral, credit-spend or popularity ranking | CONFIRMED |
| PR-02 | User choice | User-selected filters; transparent sort such as newest or approximate distance | CONFIRMED |
| PR-03 | No pay-to-be-seen | Buying credits must not increase ranking or visibility | CONFIRMED |
| PR-04 | Genuine interest | No fabricated Likes, profiles, matches, messages, or false scarcity | CONFIRMED |
| PR-05 | Clear value exchange | Show the exact credit fee before each charge; never silently combine fees | CONFIRMED |
| PR-06 | Local relevance | Social posts limited to the user's selected local discovery area | CONFIRMED |
| PR-07 | Pan-India | Registration and core discovery available across India from day one | CONFIRMED |
| PR-08 | Privacy by default | Do not publicly expose exact contact information, birthday, or precise/live location | CONFIRMED |
| PR-09 | User safety | Block, report, moderation, age eligibility, and responsive safety action | LAUNCH GATE |
| PR-10 | Minimal retention | Seven-day chat message expiry; expiring Local content; limited legitimate exceptions | CONFIRMED / LEGAL REVIEW |

**Algorithm-free definition:** Eligibility filtering, user-chosen ordering, anti-abuse checks and accessibility adaptations are permitted. Invisible personalized reordering based on user engagement, predicted attraction, payment behavior or popularity is not. The system must explain why a person/post is displayed and what ordering is selected. When eligible candidates are exhausted, display an honest empty state rather than fabricated content.

**Audience:** Adults 18+ in India. Dating and Friendship independently available within the same account. The initial user interface is English-first, with Indian languages a later expansion. Public launch availability is nationwide, not restricted to a selected set of launch cities.

## 2. Roles and high-level navigation

| Role | Product access |
|---|---|
| Visitor | Intro, policies, signup/login; no private profiles or local feed |
| Registered, profile incomplete | Edit/save profile; view onboarding; no discoverability or eligible local posting until required setup complete |
| Eligible member | Dating and/or Friendship based on separately enabled modes; wallet; chats; Local feed |
| Restricted member | Clearly specified reduced privileges; ability to see restriction and appeal/contact support |
| Moderator/admin | Separate staff-only admin website for safety reviews and targeted moderation |

**Four primary app tabs (CONFIRMED):**

1. **Dating** — discover, filters, Like/Pass, swipe alternatives.
2. **Friendship** — People, Local Feed, Activities, with cross-surfaced relevant local posts.
3. **Connects / Chats** — Liked You, Matches, Likes Sent, Friendship Requests, Conversations; Dating/Friendship filters.
4. **Profile** — separate profile editors, photos, privacy, location, wallet, purchased credits, account controls.

No separate top-level fifth tab for Local or Activities at initial launch. Admin website is distinct from the consumer app.

## 3. Authentication, eligibility, and onboarding

**Confirmed:** Google Sign-In and Email OTP. Phone number is never a mandatory signup requirement. Date of birth and adults-only eligibility are required. Users choose Dating, Friendship or Both, and may later pause either mode independently.

**Recommended onboarding journey:**

1. Present 18+ eligibility statement, terms, privacy summary, and Google/Email OTP choices.
2. Create account and obtain required acknowledgements/consent.
3. Collect display name, date of birth, relevant gender identity/preference fields, and selected city/locality.
4. Choose Dating, Friendship or Both.
5. Upload **at least two photos for each active mode**; allow reuse of the same selected photos across modes; proposed maximum six per mode.
6. Complete a short, contact-safe biography, interests and mode-specific intentions.
7. Configure mode-specific preferences and review privacy/visibility.
8. Explicitly activate complete Dating/Friendship mode(s). On eligibility/activation, issue first monthly allowance according to published policy.

**Important:** Google account ownership, entered date of birth, simple face detection, or facial age estimation alone does not reliably prove adulthood. At launch, apply applicable app-store adult-restriction settings, age declaration, user reporting, protective account restriction, and a workable risk/appeal path. The proposed low-cost age-assurance escalation is specified in §16.2; its effectiveness and platform compliance remain a **LAUNCH GATE**. Future selfie Photo Verified badges do not solve this launch requirement.

**Profile completeness and visibility:** An incomplete or photo-deficient mode is not discoverable. Saving a draft is allowed. Removing a photo so that fewer than two eligible photos remain pauses that mode's new discovery until corrected. Enabling both modes does not automatically publish private Dating details to Friendship.

## 4. Profiles and contact-safe discovery

| Attribute | Dating | Friendship | Visibility |
|---|---|---|---|
| First/display name | Required | Required | Public preview |
| Age (derived from DOB) | Required | Required | Age visible, exact DOB private |
| Photos | 2–6 recommended | 2–6 recommended | Public eligible profile photos |
| Short bio | Required | Required | Limited contact-safe preview |
| Interests | Required choices | Required choices | Limited public preview |
| Intentions | Relationship intention | Friendship / activity intention | Relevant public preview |
| Gender/preference fields | User-controlled and relevant | No romantic preference needed | Minimize exposure |
| Approximate area | Required | Required | City/locality or broad band only |
| Email/phone/precise address | Private | Private | Never automatically visible |
| Mode activity status | Independently configured | Independently configured | No precise last-seen by default |

**Public pre-connection preview:** Show both required photos, first/display name, age, broad area, intention, two or three interests and one short moderated bio. Viewing a profile does not consume credits. Exact contact information, phone/email, social handles, QR contact promotions, external meeting/contact links and precise residence must not appear in public bios, image captions, posts or comments. Apply the restriction to discovery itself—not just match previews. After connecting, users may voluntarily share information privately; the app never automatically reveals private details.

**Photo safeguards:** Validate format/size/integrity, restrict clearly inappropriate uploads, support complaints and review; optional on-device face or restricted-image screening may supplement moderation but must not be described as comprehensive. No mandatory Photo Verified badge at launch.

## 5. Dating — discovery, Likes, and matches

**Initial free swipe policy:** 100 right Likes per day, configurable later; passing/left swipe unlimited and free. The right-Like quota applies to regular Dating discovery; charging of explicit Liked You Like Back is a separate rule. Do not secretly reorder the population by behavior or spending. Filters: age range, broad geographic distance, romantic gender preferences and relationship intentions.

**Dating discovery path — ordinary Like:**

1. User inspects the contact-safe profile.
2. User Likes or Passes. Passing is free. An ordinary first Like is free within the daily allowance.
3. If recipient has not Liked the user, the Like is outstanding.
4. If the recipient already Liked the user, this ordinary Like creates a **free mutual match**. No unexpected 1-credit charge is imposed in the Dating feed.
5. Either matched person may choose **Connect — 1 credit**. The first successful unlock charges once for the pair; both may then chat.

**Incoming Liked You path — intentionally different fee:**

1. All genuine incoming Likes appear, unblurred, in **Liked You**, sorted newest first by default. No paywall to reveal identities or photos.
2. User may inspect the limited profile or Pass for free.
3. **Like Back — 1 credit**, explicitly disclosed and confirmed before execution, creates the mutual match. This charge **does not** unlock chat.
4. **Connect — another 1 credit** when someone chooses to open the conversation. Either matched person may pay that Connect credit; if the other person already unlocked it, no second Connect charge.
5. The two charges therefore total **2 credits if the same person performs both actions**, though a different matched person may fund the Connect step.

**Explicit accepted distinction:** Finding someone who Liked you again in a large city's regular Dating feed may be unlikely, but if it happens, ordinary Like remains free even when it creates a mutual match. We accept the different screen economics rather than silently charging the ordinary feed. Clearly label the different product actions in each screen.

**Matches:** Mutual Likes only; never show unreciprocated incoming Likes as mutual. Save/view mutual matches free without artificial expiry or message countdown. A user may inspect an unlocked or locked match. Both parties may report, hide, block or unmatch as permitted by published rules.

**Likes Sent:** Include a view of users the member Liked; remove unavailable/blocked/deleted profiles appropriately. This view does not expose whether a person privately reviewed the Like.

**No double-charge invariant:** Duplicate taps, retried confirmations or concurrently initiated Connect actions must never charge twice for the same unlock. If a match or recipient is unavailable before charge completion, do not charge. A successfully unlocked chat is not charged again while that same connection remains valid.

## 6. Friendship — nearby people and paid requests

Friendship enables all-gender, nonromantic nearby discovery. Users browse limited profiles, shared interests, and intentions without spending credits. There is **no mutual romantic Like prerequisite**.

**Request lifecycle (CONFIRMED revised commercial rule):**

1. Sender selects a person/activity author and chooses **Send Friendship Request — 1 credit**.
2. Before sending, disclose: **“This credit is charged when you send; it is not returned if the request is declined, cancelled or unanswered.”**
3. Consume exactly one credit upon successful request submission. This replaces the earlier credit-reservation/release policy.
4. Recipient sees incoming request and may Accept, Decline, Block or Report without a credit charge.
5. Acceptance opens a one-to-one lifetime-unlocked conversation with no second request fee.
6. Decline, sender cancellation and normal expiry **do not refund** the consumed credit.
7. Unanswered requests expire after **seven days**, or upon activity end if earlier for activity-related requests.
8. Suggested launch cap: maximum **five simultaneously pending outgoing requests**; prohibit duplicate pending requests to the same person and repeated harassment.

**Fairness exception:** A request that fails before it is submitted, is double-charged, or is never deliverable due to a platform error is not an ordinary rejection and requires correction/refund. The system must never describe an unsent request as successfully delivered.

**Cross-context relationship:** If two people already share an active, unlocked Friendship connection, require mutual consent before labeling it romantic. **ADOPTED DEFAULT:** Do not charge another Connect fee solely to keep messaging the same pair. When an already-connected Friendship pair reciprocates a Dating Like through Liked You, the explicitly disclosed Like Back fee still applies; no second Connect fee applies to their already-unlocked chat. Full policy in §16.5.

## 7. U_luv Local — hyperlocal social and activities

**Confirmed product extension:** The Friendship experience contains a small, local-first social feed. Members may create text/photo posts for a local question, recommendation, discussion, or real-world activity. Videos, full-scale event ticketing, public attendee rosters, event-management tools and group chats are **LATER**.

### 7.1 Locality and ordering

- Publish using the user's already-selected Dating/Friendship discovery locality; do not require selecting a new location for each post.
- **Default radius: 5 km; maximum radius: 10 km** (ADOPTED DEFAULT), applied to Local posting/discovery according to the user's selected location.
- Pan-India account access, **not** an India-wide Local feed.
- Newest-first chronological ordering; filters by category/activity. No paid boosts, engagement rank, or nationwide trending algorithm.
- Show approximate locality and configured reach; **never** reveal precise coordinates or home location.
- A post may appear in Local feed, Nearby People feed and Activities as applicable; it remains **one** post with one comment/reaction record and one expiration time.
- Location selected by users is not guaranteed to prove current physical presence; avoid claims of verified physical proximity. Do not automatically expand reach beyond the user's maximum.

### 7.2 Post types and fields

| Type | Required content | Timing |
|---|---|---|
| Local question | Short title/body, topic | Expires seven days after publish |
| Recommendation | Short title/body, optional images | Expires seven days after publish |
| Local discussion | Short title/body, topic | Expires seven days after publish |
| Activity invitation | Title/body, broad meeting area, date/time, category | At activity end or seven days, whichever is earlier |

**Photo posts are mandatory for launch:** A post may contain **zero to five images**; video is not supported in v1. All eligible post types may include images. No public contact details, URLs for direct contact, QR contact codes, private addresses or commercial spam. Activity listings should encourage public meetup venues.

### 7.3 User interaction caps

| Action | Adopted initial limit |
|---|---|
| New posts | 3 per user per day |
| Active posts | 5 simultaneously |
| Public comments | 10 per user per day |
| Post reactions | 30 per user per day |
| Reactions per post | One active reaction per user; can undo |
| Images per post | 5 |
| Local discovery radius | Default 5 km, max 10 km |

Counts are adjustable business policy limits, not entitlements to publish abusive material. Do not confuse Local reactions with Dating right Likes. Clearly show remaining allowances near relevant actions; reject over-limit attempts without making duplicate posts/comments.

### 7.4 Full post lifecycle

1. Eligible user opens Friendship > Local Feed or Activities and selects Create Post.
2. Choose post type and enter text, category, optional photos, and timing for an activity.
3. Validate locally available fields and run inexpensive best-effort text/media checks; no false claim of comprehensive image safety.
4. Display a preview with **selected locality**, maximum visibility, community guidelines, post expiration, and Submit.
5. Publish once to eligible nearby feeds, newest-first.
6. Nearby users can view/like/react/comment, open the author's contact-safe Friendship profile, or request a one-to-one Friendship connection (1 credit on send).
7. Creator may edit, close, or delete. Significant time/area changes on an activity should be transparent to responders.
8. Post and attached images/comments/reactions expire automatically at applicable cutoff; they disappear from all surfaced feeds. Limited evidence may be preserved for valid complaints or legal duties.
9. Blocking hides the blocker/blocked interaction across Dating/Friendship/Local as required by policy.

**Moderation philosophy:** At launch use code-based text guards, practical file checks, user reporting and quick admin action. This is a low-budget approach, **not an assurance that objectionable imagery is automatically prevented**. A posted image that is reported must be actionable by a moderator. No permanent deletion solely from unverified mass-report counts; prevent report brigading. Serious content requires escalation.

### 7.5 Local discovery acceptance rules

- Users outside the allowed local area do not see the post through Local/People/Activities discovery.
- A single post appearing in two nearby views does not double-count reaction or comment caps.
- No exact GPS location is displayed.
- Post images disappear when the parent post expires or is deleted, subject only to clearly disclosed exceptions.
- Expired activities cannot accept new requests. A pending activity-related request expires at the earlier applicable deadline.
- Out-of-area posting attempts cannot silently increase visibility radius.

## 8. Connect credits and purchases

### 8.1 Confirmed core economics

| Action | Credits | When charged |
|---|---:|---|
| View incoming Liked You profiles | 0 | Never |
| Ordinary Dating Like | 0 | Within free quota |
| Mutual match from ordinary Dating discovery | 0 | Never |
| Like Back in incoming Liked You | 1 | Explicit confirmation; creates mutual match |
| Unlock Dating chat from mutual match | 1 | First successful Connect unlock for pair |
| Send Friendship request | 1 | On successful request submission |
| Recipient accepts Friendship request | 0 additional | Chat already covered by sender's request fee |
| Declined/cancelled/expired Friendship request | No refund | Original send fee retained |
| React/comment on Local feed | 0 | Within local rate limits |
| Continue unlocked conversation | 0 | Lifetime permission at v1 |

**Free monthly allowance:** **4 shared Connect credits for women and 2 for other eligible users.** The user has confirmed the allowances and a single wallet across Dating/Friendship. Women-benefit eligibility and changes are defined for product planning in §16.1. Fairness, lawful eligibility, and platform review remain launch gates; do not demand identity documents solely to claim a credit benefit.

**ADOPTED DEFAULT:** Issue first allowance on qualifying profile activation; renew on monthly activation anniversary; unused free credits do not roll over; purchased credits do not arbitrarily expire; spend free first. Pending requests no longer reserve credits because their price is consumed at send time. Credits are units, not rupee balances.

### 8.2 Price proposals — not final public commitments

| Pack | Credits | Proposed INR price | Approx. unit price |
|---|---:|---:|---:|
| Starter | 3 | ₹49 | ₹16.33 |
| Standard | 10 | ₹149 | ₹14.90 |
| Value | 30 | ₹399 | ₹13.30 |

Adopt these three prices as launch pricing **targets**, not yet verified store price-point or tax promises; see §16.3 for billing terms, refunds and release checks. There is no required subscription at v1 and no paid profile boosting.

### 8.3 Wallet UX and consumer protections

- Show free, purchased, spent, and available credit counts clearly; show renewal date, payment history and purchase terms.
- Before **Like Back**, **Connect**, or **Send Friendship Request**, show explicit action and exact credit cost. For Friendship, show nonrefundability for ordinary rejection/expiry.
- If insufficient credits, offer eligible purchase flow without applying the action until the purchase/credit is confirmed; never consume credits twice on retries.
- Failed/double charge, undeliverable request, unavailable match and payment reversal handling require a disclosed remediation policy.
- No recurring fee for an already unlocked connection at v1. Future changes may be configurable for new offerings, but **previously sold lifetime unlocks must not be retroactively converted into recurring charges without an appropriate lawful agreement**.
- A consumer credit purchase must not create the impression of a guaranteed reply, meeting, identity verification or relationship.

## 9. Chat, history expiry, and connection lifecycle

**Launch:** One-to-one text and photo messages. Voice notes, calls and groups later. A successful Connect unlock grants ongoing chat access while both parties remain eligible and connected, **without further credits**.

**Message retention:** Individual messages automatically expire **seven days after sending**. Manual **Delete Conversation History for Both** clears the displayed history for both participants and is independently confirmed. Removing history does not necessarily terminate the unlocked relationship. The app should state that recipients may have screenshots or saved content, and limited records may be retained for valid safety/legal needs.

**Chat controls (adopted defaults):** Mute, archive, view/unread state, accessible chat menu, block and report user/conversation. Read receipts off by default, online/last-seen hidden by default. Optional reply-to-message/emoji reactions can be delivered as convenience functions if they do not jeopardize the core launch flow.

**No granular message-reporting UI required in v1** per founder preference. However, **Report User / Conversation** and Block must remain available from chat for abuse reporting; a post-only report control would not cover private messaging. Preserve relevant evidence only when necessary and disclosed, rather than routinely retaining all conversation history indefinitely.

**Unmatch vs history delete:** Unmatch stops Dating-context communication according to user-consent rules. Blocking immediately prevents interaction across modes. Deleting chat history does not unblock, unmatch or repay a consumed credit. If an already unlocked person is disabled or banned, the other user cannot continue messaging them.

Reconnection and previously purchased unlock rights are defined in §16.5: fresh mutual consent is required after unmatching; any surviving prior Connect entitlement does not automatically reopen communication and is not charged a second time when both voluntarily reconnect.

## 10. Privacy and account management

| Feature | Default / expected behavior | Status |
|---|---|---|
| Dating mode visibility | Off until profile complete and user activates | ADOPTED DEFAULT |
| Friendship visibility | Off until profile complete and user activates | ADOPTED DEFAULT |
| Pause mode | Hide from future discovery, preserve existing eligible chats | ADOPTED DEFAULT |
| Exact DOB, phone, email | Not publicly visible | CONFIRMED |
| Approximate locality | Used for discovery; no public precise/home location | CONFIRMED |
| Online/last seen | Hidden | ADOPTED DEFAULT |
| Read receipts | Off | ADOPTED DEFAULT |
| Block and report | Free for all genders/payment tiers | CONFIRMED |
| Photo removal below minimum | Automatically pause that mode's new discovery | ADOPTED DEFAULT |
| Temporary deactivation | Hide profiles and Local participation; preserve appropriate eligible state | ADOPTED DEFAULT |
| Permanent deletion | In-app, with clear explanation of what can/cannot be erased immediately | LAUNCH GATE |
| Contact book access | Not required for launch | RECOMMENDED |

**Minimal retention policy:** Keep active account/profile details and only necessary relationship, credit, purchase, safety and administrative state. Local content expires, and ordinary chats expire after seven days. Product deletion behavior is specified in §16.6, subject to legal/safety exceptions and review; never promise universal instant deletion if legally required data may remain.

## 11. Notifications and user psychology

Use genuine attraction, curiosity, reciprocity, anticipation and desire to communicate **without manufactured pressure**:

| Real event | User-visible treatment |
|---|---|
| New incoming Like | Optional notification; limited contact-safe profile visible in Liked You |
| Mutual match | Celebrate genuinely; no fake urgency or expiry countdown |
| Friendship request | Notify recipient with contextual Friendship intention |
| Accepted request | Notify sender and expose unlocked chat |
| New message | Optional push, with private-content preview controls |
| Local post comment/reaction | Optional, rate-limited notification |
| New credits / low balance | Balance notice or real renewal notice; no misleading scarcity |

No fabricated profile availability, paid priority, false compatibility percentages, forced first-message windows or notification spam. Offer category notification controls and quiet hours (adopted default). Do not require women to message first; either side may Connect after a genuine mutual Dating match.

## 12. Trust, authenticity and moderation — launch minimum

### 12.1 Practical first-release safeguards

- Adult-only onboarding, app-store restriction controls, age declarations, suspected-underage reports and a human escalation option.
- Basic image-format/size checks, optional low-cost on-device face/image-quality or safety classification as **supplemental signals**, not guaranteed content moderation or proof of age.
- Code-based text guards for bios, public posts, comments and direct-contact bypass attempts.
- Clear community guidelines prohibiting harassment, impersonation, scams, unlawful sexual imagery, exploitation, stalking, doxxing and spam.
- In-app **Report Post**, **Report Profile/User**, **Report Conversation**, and **Block User** actions, with timely handling and a support/grievance contact.
- Account and post restriction action; emergency escalation for serious safety issues; basic appeals.
- Report count alone is not proof: suspected mass-report abuse should not permanently delete innocent posts.

**Launch limitations must be candid:** No optional Photo Verified badge at launch; no guaranteed 18+ verification from a photograph; no promise that all harmful images are automatically detected. Flutter/on-device image analysis may assist but cannot substitute for an adequate age-protection or responsive moderation program.

### 12.2 Separate lightweight admin website

| Admin capability | Launch requirement |
|---|---|
| Find post by Post ID | View limited post details, images, expiry, reports |
| Post actions | Hide/restrict, restore, delete |
| Comment actions | Review and remove abusive public comments |
| Find profile by User ID | Restrict Dating, Friendship, Local posting, messaging or whole account as appropriate |
| Reports | Queue, reason, status, resolution |
| Repeat offenses | Review prior relevant decisions |
| Appeals | Receive and review restrictions |
| Staff accountability | Staff access controls and action audit trail |

A usable moderation response process—not just a button—is an operational requirement. Serious reports need a way to receive timely attention. Preserve only necessary evidence for safety/legal duties under a published retention policy.

## 13. Screen inventory and acceptance contract

| Screen / surface | Essential controls | P0 acceptance outcome |
|---|---|---|
| Welcome/Auth | Google, Email OTP, policies | Valid account created; no mandatory phone |
| Age & eligibility | DOB, notices, restriction flow | Underage/ineligible user prevented from discovery |
| Mode selection | Dating, Friendship, Both | Independently controllable modes |
| Profile setup | Photos, interests, bios, intentions | Cannot activate with fewer than 2 eligible photos/mode |
| Dating Discover | Profile, Like, Pass, filters/sort | Free ordinary Like within allowance; clear results |
| Liked You | All genuine inbound Likes, limited profile, Pass, Like Back | Free preview; 1-credit confirmed Like Back |
| Matches | Mutual matches, Connect | One-credit unlock, never duplicate |
| Likes Sent | Outgoing Likes | Correct visibility, no hidden reveal charge |
| Friendship People | Nearby eligible profiles, Request | Charge 1 on successful request send |
| Requests | Incoming/outgoing, accept/decline/cancel | Accepted unlock; rejection/expiry no ordinary refund |
| Local Feed | Newest-first nearby posts, React/Comment | Only eligible area sees post; caps enforced |
| Activity Detail | Time/area/category, request, close | Locality safe; auto-expiry at cutoff |
| Create/Edit Post | Text, up to 5 images, preview | Limit checks, one publish, proper expiry |
| Chats | Text/photos, delete-for-both, block/report | Lifetime connection permission; 7-day message expiry |
| Wallet/Shop | Balance, packs, purchases, history | Transparent fees; no duplicate deductions |
| Privacy/Account | Modes, pause, deactivate, delete | Correct discovery and lifecycle outcomes |
| Admin website | Post ID, User ID, reports, actions | Traceable, enforceable moderation action |

### Core end-to-end journeys (P0)

**J01 — Signup and Dating activation:** Email OTP/Google → adult eligibility → two-photo Dating profile → explicit enable → appear in eligible discovery only. **Pass:** No phone required; no incomplete-profile exposure.

**J02 — Free normal mutual match:** A Likes B through Dating; B encounters A through Dating and Likes → mutual match free → either pays 1 credit for Connect → both can chat. **Pass:** No paid Like Back charge is silently introduced in Dating.

**J03 — Paid Like Back:** B sees A in Liked You free → B confirms Like Back 1 credit → mutual match → one person confirms Connect 1 credit → chat opens. **Pass:** Like Back and Connect are distinct, auditable user-facing actions; no surprise double deduction.

**J04 — Friendship accepted:** A pays 1 credit to send request → B accepts → one-to-one chat immediately available. **Pass:** No second credit charged on acceptance.

**J05 — Friendship rejected/expired:** A pays 1 credit to send → B declines OR request expires at seven days. **Pass:** Original charge retained, no hidden refund; failed/undeliverable requests separately remedied.

**J06 — Local post:** User with valid selected locality creates post with five images → validates and publishes → eligible nearby users see same post via Local/People views → reactions/comments count once → post and images disappear after seven days or earlier activity ending. **Pass:** Outside-radius profiles cannot discover it; no video upload.

**J07 — Content report and admin action:** Nearby member reports Local post → moderator locates Post ID → hides post → it disappears from all surfaces → moderator records reason and may restore/delete. **Pass:** Report status and action outcome coherent.

**J08 — Ephemeral conversation:** Connected users exchange text/photo messages → seven days elapse from each message's send time → expired content disappears; manual delete-for-both clears visible shared history sooner → unlocked connection remains. **Pass:** No repeat Connect fee; legitimate narrow retention exceptions not exposed as ordinary chat history.

**J09 — Block/pause/account controls:** User blocks other person or pauses one mode → no new discovery/contact in restricted context, other mode follows its own visibility policy; account delete path is accessible. **Pass:** No continued unauthorized messaging or exact-location exposure.

**J10 — Wallet renewal and purchases:** Eligible account receives 4 or 2 free credits based on published benefit policy, then spends credits across modes, purchases eligible packs, and reaches anniversary reset. **Pass:** Spend order, expiry, history, no rollover and nonexpiring purchased credits align with published rules; no negative balance or duplicate deduction.

## 14. Priority and release gates

**P0 — Must function before public launch:** Login; 18+ gate; mode/profile eligibility; Dating and Liked You rules; correct wallet; Friendship send/accept/expiry; Local text + up-to-five-image posts; local radius; posting/reaction/comment limits; seven-day content expiry; text/photo chat; report/block; admin hide/restrict; service-error correction; privacy controls; basic support process.

**P1 — Valuable, but may be simplified if it protects P0:** Sophisticated animations; message reply/emoji reaction; quiet hours; nuanced categories; multi-language localization; extensive analytics; elaborate moderator dashboard.

**LATER — Explicitly excluded from v1:** Photo Verified badges; dedicated selfie verification; Local videos; voice notes; audio/video calls; group chats; paid boosts; engagement-based recommendations; subscriptions; ticketing; attendee rosters; complex event management; automated personalized match scoring.

**Hard no-go triggers:** Core fee ambiguity or double deductions; credible underage access without mitigation; inability to report/block users; no way to remove reported abusive media; unavailable admin response; undisclosed retention; visible precise location; broken post expiry; fundamentally misleading algorithm-free claim; missing current store/legal compliance.

## 15. Decision register — resolved, adopted, and remaining

### 15.1 Confirmed / adopted decisions

| Decision | Status |
|---|---|
| Pan-India app launch | CONFIRMED |
| Algorithm-free, transparent discovery | CONFIRMED |
| Four main tabs | CONFIRMED |
| Google Sign-In + Email OTP; no mandatory phone | CONFIRMED |
| Two profile photos minimum for Dating and Friendship | CONFIRMED |
| 100 normal right Likes/day initially; Passes free | CONFIRMED |
| All inbound Likes visible free, contact-safe | CONFIRMED |
| Like Back from incoming Likes = 1 credit | CONFIRMED |
| Normal Dating swipe creating match = no Like Back fee | CONFIRMED |
| Connect Dating conversation = 1 credit | CONFIRMED |
| Friendship request paid 1 credit on send; no normal decline/expiry refund | CONFIRMED |
| 4 monthly credits women, 2 other users | CONFIRMED |
| Seven-day message expiry; manual delete-for-both | CONFIRMED |
| Lifetime unlocked connection, no recurring chat fees in v1 | CONFIRMED |
| Local social feed has images, up to five/post | CONFIRMED |
| Local feed user-selected location, geo-limited and auto-expiring | CONFIRMED |
| Lean admin website and reporting | CONFIRMED |
| Radius 5 km default / 10 km max; balanced activity caps | ADOPTED DEFAULT |
| 7-day local post expiration, activity earlier | ADOPTED DEFAULT |
| Monthly anniversary, no free rollover, purchased non-expiry | ADOPTED DEFAULT |
| No dedicated Photo Verified badge at launch | CONFIRMED |

### 15.2 Product policy defaults closed in v1.1

The following are **POLICY LOCK (V1.1)**: women's additional-credit eligibility; 18+ screening and risk escalation; proposed INR price targets and service-error remedies; rematch and existing unlock treatment; cross-mode charge treatment; message/post/account deletion behavior; local-area changes; notification privacy; and recommended Android-first Pan-India release sequencing. They are defined in §16 and must not be silently reinterpreted in development.

**External launch gates remain:** (a) documented app-store policy and billing compliance, (b) an adequate real-world age-assurance process, (c) operating moderation coverage including reported images/private chats, (d) published and legally reviewed privacy, refund, terms and deletion policies, (e) final verified store checkout prices and (f) an accountable person/team assigned to complaints and appeals. These are **release validation obligations**, not missing feature-design decisions.

## 16. Final launch-policy decisions — v1.1 product closure

> **Interpretation:** These are concrete **POLICY LOCK (V1.1)** defaults recommended to complete product planning. They preserve founder-confirmed economic mechanics. They do not certify legal compliance or imply that regulators, store reviewers, or a moderator have signed off.

### 16.1 Monthly credit eligibility, gender inclusivity and renewal

- Every eligible account receives **2 free monthly Connect credits**; a user who **self-identifies as a woman (including a trans woman)** receives **2 additional free credits**, for **4 total per month**. Nonbinary users who do not identify as women, men, and users who choose not to disclose gender receive the base 2 credits. No inference from photos/voice/name; no mandatory documentary proof solely for a credit promotion.
- Gender identity is self-described for the benefit rule, independent of romantic discovery preferences. The terms clearly explain what changes to a profile do to credit eligibility; abuse checks should address repeated account creation without imposing blanket invasive verification.
- A gender/eligibility change **does not retroactively remove issued credits or issue a second bonus mid-cycle**. The appropriate allowance applies at the **next renewal** after the user updates the self-declared status. A documented review and appeal path is available for disputed restrictions.
- First free allowance issues on the first qualifying profile activation; renew on its **monthly anniversary**, using the last calendar day when the same day number does not exist. No free-credit rollover; purchased credits are kept separately and **do not expire arbitrarily**. Spend available free credits before purchased credits.
- This benefit structure must pass a specific fairness, non-discrimination, consumer disclosure, and applicable app-store/legal review before launch. The product cannot claim gender verification merely from self-attestation.

### 16.2 Adult eligibility and suspected-underage cases

- Both Dating and Friendship/Local are **18+ only**. Require an age declaration and date of birth during onboarding; block declared minors. Use available Google Play minor-access restrictions and appropriate platform age classifications/controls.
- Basic face detection, selfie presence and age-estimation models **are not proof** that someone is 18+. If used, they are secondary indicators, never the sole grounds for granting or permanently denying adult eligibility.
- Provide **Report suspected underage user**. A credible report or strong signal triggers protective restrictions on discovery, local posting and new messaging while a staff member reviews the case. Provide a noninvasive opportunity to appeal. Where adulthood cannot be reasonably established, keep the restrictions in place.
- Do not require every user to supply government ID or store selfie video solely as a default onboarding condition. If an exceptional case requires proof, collect the least intrusive suitable evidence and define short retention and access limits.
- **Release gate:** Document a staffed review/escalation process and demonstrate that underage/ineligible users cannot use adult social discovery; platform controls plus a DOB box alone are not presented as a guarantee.

### 16.3 Prices, purchase flow and credit semantics

- **Launch INR pricing targets**: Starter **₹49 / 3 credits**, Standard **₹149 / 10 credits**, Value **₹399 / 30 credits**. Display store-verified customer price before confirmation; reconcile any platform-localized amount, taxes and currency before publication. No required subscriptions, paid boosts, paid match reveals or expiry on purchased credits.
- Credit spend remains **screen-specific**: ordinary first Dating Like free within quota; ordinary mutual match free; explicit **Like Back in Liked You = 1 credit**; **Connect = 1 additional credit** unless a valid pair chat is already unlocked; **Friendship Request = 1 credit on successful send**, not refunded merely for decline/cancel/no reply.
- A credit is **not cash, not transferable or redeemable as rupees**, and neither a reply nor a date is guaranteed. The wallet shows free/purchased balances, their renewal/expiry treatment, and every spend and purchase. Every charge requires clear confirmation with action and cost.
- For Android distribution through Google Play, use Google Play Billing by default unless an applicable authorized alternative billing program is correctly enrolled and disclosed. For a later iOS release, use Apple's applicable in-app purchasing terms. Final supported billing channels are a **store-compliance launch gate**, not an assumption that direct UPI checkout is always permissible.

### 16.4 Credits, refunds, purchase disputes and deletion

- **No ordinary refund** for a successfully sent Friendship request that is declined, cancelled by sender or expires, or for a legitimate unlocked Dating conversation in which the other person does not respond or subsequently unmatches. State this **before the paid action**.
- **Restore or correct** a credit when no request/match/chat was actually made available due to service failure, an action is duplicated/double-debited, a blocked or unavailable recipient was incorrectly charged, or a purchase payment succeeds without credits being delivered. Reverse associated benefits if a store payment is reversed, subject to platform dispute processes.
- Offer a visible **Report a billing problem** path with a reference number and review status. Cash refunds for purchased packs follow the store process, applicable consumer protections and published terms; the app must never guarantee that all purchases are categorically nonrefundable.
- On voluntary permanent account deletion, warn before confirmation about unused balances and inability to continue purchased connections. Close access immediately, erase eligible account material according to the published process, and handle unresolved refund rights or legally required transaction records separately. No promise of monetary payout for unused credits unless law/store rules require it.

### 16.5 Re-match, block/unmatch, and Dating–Friendship overlap

- An **unmatch** removes romantic mutual consent and disables Dating-context conversation. A **block** prohibits cross-mode contact and discovery until explicitly lifted. Neither unmatch nor block exposes private data or produces a refund for a correctly delivered paid connection.
- People may reconnect only after **fresh mutual consent**. An old Like does not silently revive a match; there is no automatic chat reopening or notification of a blocked person.
- If the pair has a **previously valid paid Connect entitlement**, do not charge another Connect fee for that same pair when both later voluntarily re-establish a permitted connection. Previously deleted messages stay deleted; the entitlement never overrides a block or lack of consent.
- If two people are already connected through Friendship, switching their romantic context requires mutual Dating interest. An explicit **Like Back inside Liked You still costs 1 credit** when it newly creates a Dating match, but no extra Connect credit is charged for a chat that is already unlocked. Ordinary Dating Likes remain free even if they create that romantic match.
- If the previously connected pair has no remaining valid communication entitlement because of a confirmed fraud remedy or other lawfully explained exception, communicate the applicable rule before any new charge; do not silently reset entitlements.

### 16.6 Expiry, deletion, privacy and account control

- Individual text/photo **chat messages disappear from ordinary access 7 days after sending**; the lifetime connection permission remains. **Delete Conversation History for Both** removes both parties' ordinary visible history sooner, with confirmation and a neutral notice to the other participant. Users may already have screenshots; deletion is not a guarantee of erasing third-party copies.
- Local questions, discussions and recommendations expire after **7 days**; activity posts expire at activity end or after 7 days, whichever is earlier. Their photos, visible reactions and comments expire with the parent post. No automatic repost after expiry.
- Profiles and essential settings persist while accounts are active. Account deletion removes public discoverability immediately and initiates deletion of eligible profile and content data; wallet entitlements and access cease in accordance with disclosed terms. Keep only narrow payment records, relevant evidence and information required by applicable legal/safety duties for approved periods, not indefinite copies of ordinary chats or feeds.
- Users can pause either profile mode without destroying already permitted chats. Public contact details and precise/live location remain hidden. Written privacy and retention policies must state the exceptions, actual timing and complaint routes. **Release gate:** legally review the India retention/deletion terms and demonstrate that the announced expiry behavior works.

### 16.7 Selected locality changes and hyperlocal reach

- Local posts use the member's **selected locality at publishing time**; visibility is within **5 km by default, at most 10 km**, with the disclosed selection determining eligibility. One post may appear in multiple nearby views but keeps one identity and engagement count.
- **Changing selected locality does not teleport existing posts.** Close/remove the member's still-active posts from discovery in the former locality; the member may create a new post in the new locality subject to the normal caps. A closed post's remaining data follows the same expiry/deletion policy.
- To discourage artificial location hopping, recommend a **24-hour change cooldown**, with an accessible correction/travel exception, and temporarily restrict accounts repeatedly using contradictory localities for abuse. Neither self-selected locality nor optional location sharing is marketed as verified physical proximity.
- Outside-range users cannot discover Local posts. No automatic geographic expansion to increase engagement, and no public precise coordinates or residence.

### 16.8 Notifications, public comments and interaction abuse

- Offer genuine new-Like, mutual-match, Friendship request/acceptance, new message, Local reply and credit-renewal notifications. Notification previews must be privacy-safe (no exact locality, personal contact data or sensitive message body by default). Allow per-category opt-outs and **optional** quiet hours.
- Local caps remain **3 new posts/day, 5 simultaneous active posts, 10 comments/day, 30 reactions/day, one active reaction per post; up to 5 post images**. Reactions may be withdrawn. Public posts and comments cannot distribute contact handles, addresses, direct-contact links, QR contact details, harassing content or commercial spam.
- A post's multiple displays in Local/People/Activities views cannot multiply allowed interactions. Report volume is an indicator for human review, not proof of wrongdoing or an automatic permanent ban. A user can block a harasser without paying.

### 16.9 Admin operations, media and reports

- The separate Admin website must enable authorized staff to find a **Post ID/User ID**, inspect the relevant reported content, **hide/delete/restore posts**, restrict user privileges, record actions and handle appeals.
- Keep **Report Post, Report Profile/User, Report Conversation, and Block User**. No costly per-message selection/evidence-builder interface is required in v1. If a user reports serious chat abuse, give a way to provide context, and safeguard only necessary evidence under disclosed retention terms.
- At minimum, apply text guards, file safety/size/type checks, available practical on-device signals, user reports and human moderation. Image detectors are best-effort, not guaranteed; age estimates are not adulthood verification.
- **Operational release gate:** Before photo-enabled public posting, there must be a documented human process with coverage for reported images, serious incidents and appeals. Propose **same-day triage for urgent reports** and **within 72 hours for ordinary reports** as service targets, adjusted to applicable law; if staffing cannot meet a viable safety response, do not launch the affected high-risk media surface yet.

### 16.10 Nationwide store release and readiness

- **Pan-India** remains non-negotiable. Recommended low-budget sequencing is **Android public launch across India first**, with iOS released afterward when the same feature, payment, age-gate and UGC protections are validated. This is a platform sequencing default, **not a geographic limitation**.
- Both launch targets must use the same core credit and content rules. Android store listing must disclose paid Like Back and Connect functions, and paid Friendship requests, along with relevant terms. Do not claim verified profiles or fully automated content moderation when neither is provided.
- **Final release gates, not architecture questions:** independently verify actual app-store policy compliance; minor-access restrictions; approved billing and price display; consumer notices/refund handling; real-world moderation staffing; India-specific privacy, grievance and retention obligations; and essential end-to-end acceptance journeys.

### 16.11 Additional P0 policy acceptance scenarios

- **J11 — Gender allowance change:** Eligible user renews with 2 or 4 credits based on current self-declared eligibility; mid-cycle identity change does not mint or claw back credits; no mandatory document upload solely for the promotion.
- **J12 — Cross-mode pair:** Friendship-connected pair reciprocates through Liked You; one Like Back fee applies, chat remains already unlocked, and no second Connect fee is deducted.
- **J13 — Reconnection consent:** One user unmatches/blocks; other cannot contact. If both later reconnect voluntarily, old deleted messages do not return; surviving prior Connect entitlement is not charged again.
- **J14 — Location change:** Existing Local post closes in old locality, does not reappear in new locality, and follows expiry rules; post limits remain enforced.
- **J15 — Billing failure:** Payment succeeds but credit delivery fails, or paid action double-debits; user has a visible remedy; wallet repaired without duplicate entitlement.
- **J16 — Suspected minor / reported image:** Protective restriction or hide action occurs; admin can investigate and record outcome; appeal path remains usable; no false claim that face detection proved the person's age.

## 17. External-policy verification and official references

This document is product planning, **not legal advice**. The following official policy sources were checked on **9 November 2026**. App-store and Indian requirements may change before release; have an appropriate reviewer check current versions and determine which obligations apply to U_luv's exact business/role.

- **Google Play — User Generated Content:** Requires appropriate ongoing UGC moderation, clear terms, in-app reporting and blocking. https://support.google.com/googleplay/android-developer/answer/9876937/user-generated-content
- **Google Play — Age-Restricted Content and Functionality:** Core dating/matchmaking apps must use applicable Play Console controls to block minors. https://support.google.com/googleplay/android-developer/answer/16302250
- **Google Play — Payments:** In-app digital currency/services generally fall under billing rules, subject to stated exceptions and eligible programs. https://support.google.com/googleplay/android-developer/answer/9858738
- **Apple — App Review Guidelines:** Section 1.2 (UGC filtering/reporting/blocking); in-app purchases and purchased in-app currency rules; age and safety requirements. https://developer.apple.com/app-store/review/guidelines/
- **India — DPDP Rules announcement:** Government summary of data-minimization, consent and phased operational requirements. https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&lang=2&reg=3
- **India — DPDP commencement notification:** Official gazette with staggered commencement dates. https://egazette.gov.in/WriteReadData/2025/267647.pdf
- **India — IT intermediary rules and amendments:** Verify current classification, grievance handling and data-retention duties with the official MeitY rules and current amendments. https://www.meity.gov.in/
- **NIST — Face Age Estimation evaluation:** Reports model error and age-threshold tradeoffs; a face-age score alone is not reliable proof of 18+. https://pages.nist.gov/frvt/html/frvt_age_estimation.html
- **Google ML Kit — Face Detection:** Detects faces/features; not a built-in identity or adult-age verification. https://developers.google.com/ml-kit/vision/face-detection

## 18. Release decision statement

U_luv can move to architectural planning after review of this product baseline. Product-design choices are closed as confirmed or v1.1 policy defaults; **public release remains conditional** on satisfying the explicitly listed operational, age-safety, store, moderation and legal gates. Its product promise is **Algorithm-Free Connections**: broad India access, transparent local discovery, genuine interest, affordable entry, women-friendly monthly credits, and a human-centered local community. **Charging is transparent, content is short-lived, and trust and safety remain required even under a lean budget.**
