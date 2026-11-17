# P02 — Product contract and profile journey

**Scope:** P02-0 design through P02-5 visual polish. This is a consolidated record of approved and implemented behavior, not a new feature request. Product/security source contracts still take precedence when conflicts occur.

## Approved decisions (P02-0, 15 November 2026)

| ID | Contract | Current consequence |
|---|---|---|
| A01 | One account-wide unique, editable public `@handle` | Immutable P01 UID remains internal; handle alias reservation is atomic |
| A02 | Dating and Friendship have independent display names | Separate mode drafts, bios, intentions, interests and photos |
| A03 | Each enabled mode uses **2–6** valid photos for setup completion and activation | 0–1 may remain in a draft but cannot pass the final readiness gate |
| A04 | The same owned photo can be selected in both modes | One private media object with reference-safe assignment/deletion |
| A05 | Activation intention is explicit, independent, reversible | No implicit activation from saving a draft |
| A06 | Age is derived from the P01 signup self-declared DOB | Never ask for or publish editable age or raw DOB |
| A07 | P02 broad locality is *not* trusted H3 locality | No P02 user-supplied exact GPS coordinate as a discovery pointer |
| A08 | Sensible image/text input safeguards; do not claim full moderation | Technical image sanitation and contact-safe fields, not comprehensive content screening |

## What users do (implemented P02)

1. Authenticate through the existing P01 login/signup session. Returning signed-in users use the authenticated P02 shell (Home + Settings).
2. Enter a single account-wide `@handle` and common profile details including shared name, broad city/locality label, explicitly selected gender and desired enabled modes. Actual screens and server requirements determine the available fields; do not infer a trusted GPS location from text.
3. In the **conditional, horizontal swipeable wizard**, complete: **Common → enabled Dating details → Dating photos → enabled Friendship details → Friendship photos → Review**. Friendship-only users do not encounter Dating steps and vice versa. Saved current step plus server eligibility gates all forward actions; Back and backward swipe permit correction.
4. Use exactly **one Save & Next** button for each saved step. An incomplete or unsuccessfully saved step cannot advance. Retain approved step tabs and swipe behavior; do not replace the wizard with a long form.
5. Upload and attach up to six photos per mode, reorder/replace/remove, and reuse private images between Dating and Friendship. Each enabled mode must have at least **two distinct saved owner-READY photo assignments** before Continue becomes available.
6. Review saved account/mode details and authorized private thumbnails. Complete setup, then independently **request/deactivate** Dating/Friendship activation on the private completion screen. These are activation **intents**, not public discovery listings.
7. Change common/mode details or remove necessary photos later: affected activation must pause or be invalidated safely; restoring missing information does not silently reactivate the profile.

## Identity, gender, matching and settings

- The immutable P01 `uniqueId` differs from the user's public `@handle`; each mode has its own display name.
- Gender identity is an explicit selection. Romantic preference is separate; do not force opposite-gender/heterosexual Dating filtering or apply Dating preferences as a Friendship restriction.
- P02 signed-in navigation has **Home + Settings**. This is a deliberate pre-discovery shell. Full Dating/Friendship/Local Feed tabs and their business actions belong to P03 and later phases.
- Settings reuse actual P01 password reset/change, signed-in device management and logout flows. No fake app actions are considered implemented.
- The P02-5 owner UI reference pack is **nonbinding visual inspiration**; its future discovery, Local, chats, monetization and other screens are not part of P02.

## What P02 never did

No public card search, H3 spatial discovery, fake match results, cross-user profile/media access, algorithmic ranking, likes/connect payment logic, chat/Local feed, production AWS migration, or full photo content moderation. Self-declared DOB and locality are not independent verification. Read the [P03 boundary](../handoff/P02_TO_P03_BOUNDARY_2026_11_16.md).
