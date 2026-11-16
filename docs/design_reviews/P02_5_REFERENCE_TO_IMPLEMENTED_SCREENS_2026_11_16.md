# P02-5 — U_luv UI Reference → Current Flutter implementation

**Date:** 2026-11-16  
**Owner intent:** polished reference-inspired UI, not strict pixel cloning. The working swipeable P02 setup with a combined **Save & Next** is immutable product behavior.  
**Authority:** root security/product contracts > accepted P01–P02 backend and UX > reference pack's visual suggestions.  
**Reference:** `U_luv_Complete_UI_Reference_Pack_v1_0.zip` (owner committed separately), `docs/ui/DESIGN_SYSTEM.md`, `docs/ui/AI_IMPLEMENTATION_CONTRACT.md`, canonical PNGs listed below.

## Scope and deliberate non-scope

P02-5 upgrades **existing** Flutter UI only. It does not create P03 discovery, the final four-tab navigation, fake profiles, likes, friends, chat, billing, Local posts, admin, unsupported authentication or media-provider integration. Do not make a mock Dating screen that appears functional. Until P03, the **actual** authenticated navigator retains Home + Settings, both fully functional.

| Reference | Existing U_luv UI upgraded | Outcome |
|---|---|---|
| S01, S03–S05 | P01 AuthScreen login, signup, OTP, eligibility/password flows | Shared warm theme, round text fields/buttons, small brand cue, accessible errors. Existing owner-approved P01 authentication remains; the screenshots do not replace it |
| S06–S08 | P02 guided Common Profile | Mode cards, coral Dating vs mint Friendship, shared name/city/gender, interest input kept in per-mode details; saved server gate unchanged |
| S09, S15, S77 | P02 photo assignment and private library | Rounded preview/thumbnail cards; separate photo reorder/replace/remove controls wrap on narrow screens; existing SAF image picker and backend rules unchanged |
| S10–S11 | P02 Dating/Friendship details | Separate mode-colored intro banners and fields; existing conditional swipe steps and Save & Next retained |
| S13–S14 | Final review and owner-only preview | Grouped saved details with mode-specific tints and actual authorized photo previews; no illustrative person data copied into runtime |
| S16 | P02-3 activation controls | Private activation intent stays independent per mode and blocked from public discovery |
| S65–S66 | Actual P02 authenticated shell and Settings | Distinct brand header, warm card/banner, functional Home/Settings tabs, same P01 password/session/device/logout wiring |
| S74–S75 | Session restore / offline state | Global typography, palette, rounded buttons; actual retry, restored-session and fail-closed behavior unchanged |
| S17–S64 and S67–S80, A01–A04 | Not implemented in P02 | **Reference only; future phases**, do not fabricate features or extra navigation |

## Style tokens and accessibility

- `apps/flutter_app/lib/design/uluv_design.dart`: warm canvas `#FFF7F6`, paper `#FFFDFC`, content `#24222B`, stronger high-contrast button pink `#CD275C`, coral accent `#FF4E7A`, mint/teal action `#00866F`, dark error `#C12C55`.
- Coral-pink for Dating and primary action, teal for Friendship; no color-only status interpretation. The text/CTA variants were chosen to exceed 4.5:1 on white; `test/p02_5_visual_reference_test.dart` asserts this.
- Buttons are at least 44–50dp high, warnings bold red, controls labeled, persistent text wrapped in scrollable containers; photos no longer cram four action icons into one inflexible horizontal row.
- No copied stock user photos, synthetic profiles, or remote font dependencies. Existing stored photos must be read via authenticated private repository only.
- The reference images are design data only; no image assets are shipped to the running app by this change. The owner already committed the reference pack.

## Unchanged behavior and keys

- Common → enabled Dating details → Dating photos → enabled Friendship details → Friendship photos → Review.
- `p02-swipe-region` retains horizontal gesture; step tabs and Back remain available; forward navigation is gated by saved state and the server's two-READY-photo rule per enabled mode.
- `p02-save-next` is the **single** save-and-forward action. Failure or incomplete data must never advance. No redundant standalone Save and Next buttons.
- Final review `p02-continue` opens the private setup-complete screen and independent activation controls; `pending_trusted_locality` is **not** discoverable.
- P00 diagnostics, P01 authentication/session, API, local media, DynamoDB schema, billing, and P03 boundary are untouched.

## Boundaries of verification

Visual PNG comparisons, Flutter analyze/widgets and real Android E2E must be executed on the owner's Windows setup. No screenshot of the *running* Flutter UI was generated or claimed from this headless authoring environment. See `docs/manual/P02_5_WINDOWS_VISUAL_ACCEPTANCE_2026_11_16.md`.
