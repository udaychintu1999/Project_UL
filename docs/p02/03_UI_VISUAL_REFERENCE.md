# P02-5 — Visual language and reference-to-screen map

**Accepted P02-5 visual implementation (owner report, 16 November 2026).** Reference pack: `U_luv_Complete_UI_Reference_Pack_v1_0.zip`, committed by the owner separately. The mockups are styling guidance **not** strict layouts, additional backend authorization, or permission to change the approved swipe wizard.

## Current P02 Flutter design

- Shared warm light canvas (`#FFF7F6`) and paper (`#FFFDFC`), body ink (`#24222B`), rounded surfaces, clearer field/button labels and strong readable errors.
- Dating/primary action uses deeper high-contrast pink `#CD275C` plus coral `#FF4E7A`; Friendship uses teal `#00866F`; status text must not rely on color alone.
- Shared tokens live in `apps/flutter_app/lib/design/uluv_design.dart`. No remote fonts or copied reference people/photos should be added to runtime.
- Proper **Material** surfaces around interactive tiles are required: a colored `DecoratedBox` between `SwitchListTile` and Material caused widget exceptions and was fixed. Preserve ink/splash accessibility.
- Keep scrollable forms, reachable fixed bottom nav, visible keyboard controls and adaptive photo actions at ~320dp and larger; no invisible/off-screen click targets.

## Reference coverage (existing screens only)

| Reference IDs | P02 screen(s) | Constraints |
|---|---|---|
| S01, S03–S05 | P01 authentication visually polished in P02-5 | P01 OTP/password/session semantics unchanged |
| S06–S08 | Shared profile and mode selection | Conditional swipe + **Save & Next** preserved |
| S09, S15, S77 | Photo library, assignment, private thumbnails | Real own photos, 2–6 per enabled mode, responsive actions |
| S10–S11 | Independent Dating/Friendship text steps | Coral vs teal accents; real saved drafts |
| S13–S14 | Review and owner-only preview | Real authorized data only |
| S16 | Independent private activation controls | No public discovery enabled |
| S65–S66 | Home/Settings signed-in shell | Exactly the existing functional P02 Home + Settings tabs |
| S74–S75 | Session restore, offline and recovery | Preserve actual failure/retry semantics |
| S17–S64, S67–S80, A01–A04 | **Not in P02 scope** | P03/later reference only; never fabricate tab actions |

## Visual acceptance evidence and limits

The owner confirmed all P02-5 automated verification passed after Gate 12 photo-count repair. No explicit confirmation of **manual** native SAF picker, device-by-device screenshot comparison, high text scale, TalkBack or accessibility checklist is present. These items are not automatically marked PASS. Consult [verification runbook](04_VERIFICATION_AND_ACCEPTANCE.md) for optional revalidation and remaining manual checks.
