# U_luv UI Reference Pack v1.0

**Purpose:** 80 individual mobile UI PNGs, 4 desktop admin PNGs, 11 contact sheets and 13 inspiration boards for U_luv's designers, owners, Flutter developers and AI coding agents. All imagery is **conceptual reference**, not working application code.

## Start here

1. Human review: `docs/ui/UI_REFERENCE_GUIDE.docx` (short illustrated guide), then `images/contact_sheets/00_ALL_GROUPS_OVERVIEW.jpg`.
2. AI coding agent: read `docs/ui/AI_IMPLEMENTATION_CONTRACT.md` and `docs/ui/SCREEN_REGISTRY.md`; inspect only images for the feature being implemented.
3. Individual mobile references: `images/canonical_screens/S01_*.png` through `S80_*.png` (660 × 1380 pixels).
4. Admin references: `images/admin/A01_*.png` through `A04_*.png`.
5. Index in spreadsheet-friendly form: `docs/ui/SCREEN_REGISTRY.csv`; exact machine-readable captions: `docs/ui/SCREEN_DATA.json`.
6. Style inspiration: `images/inspiration_boards/` — less authoritative than canonical screen PNGs and the product contract.

## Authority and scope

This pack is a **visual design companion** to the authoritative U_luv Developer Handoff FINAL v2.0. Product contract, security rules, billing rules and the phase plan take precedence over all pictures and captions. Some inspiration boards were created before product decisions were finalized and may depict *unapproved* functionality. Do not implement it.

Specifically: Google Sign-In and email OTP, **no mandatory phone/password auth**; exactly **four main tabs** (Dating, Friendship, Connects, Profile); no launch group chats, calls, mandatory photo verification, paid boosts, event ticketing, RSVP/group roster, or subscriptions. Paid **Like Back** and **Connect** are separate 1-credit transactions. Ordinary Dating Likes are free. Friendship requests charge 1 credit on successful send, no second charge on acceptance. Posts/messages expire in 7 days. User-selected distance bands are **0–10, 10–35, 35–50 km or all 0–50 km**. Never expose a person's precise location.

## File organization

- `images/canonical_screens/`: authoritative *visual* depiction of individual launch screens/states (80)
- `images/admin/`: administrator website visual references (4)
- `images/contact_sheets/`: quick browsing, 11 sheets
- `images/inspiration_boards/`: larger mood/style references, 13 boards; not an approved product spec
- `docs/ui/`: design system, screen registry, business flows, QA checklist, AI-specific implementation rules, Word guide and data
- `reference_html/`: **non-functional static reference-only HTML**; never copy directly as Flutter UI or call it a tested app

## Implementation and testing

Use existing Flutter feature folders, UI tokens, state management and routing defined by the handoff. Implement one phase-scoped vertical slice at a time. Generate widget/semantics/visual regression tests and execute all tests possible. If images or live Flutter cannot be tested, mark tests UNVERIFIED with exact manual steps. No AWS/cloud writes or secrets access without explicit owner permission; all .env and signed URLs remain private.
