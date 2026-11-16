> **2026-11-16 Gate 12 retest note:** Owner already passed Flutter 54/54, real local Fastify/DynamoDB and physical Android Gates 10–11. The redesigned photo badge says `1 / 6`, so an old test assertion for `1/6 assigned` caused a false timeout after UI checkpoint 04. The new isolated Android test uses `p02-photo-count` and exposes a safe UI status if actual image upload fails. After applying the latest repair, run `npm run test:flutter:p02-3:e2e` to demand all 15 checkpoints, then `npm run verify:p02-5` for complete phase acceptance. No post-repair gate PASS has been asserted. See `docs/qa/P02_5_ANDROID_GATE12_PHOTO_COUNT_COPY_REGRESSION_REPAIR_2026_11_16.md`.

# P02-5 — Windows + Android visual and functional acceptance

**Status:** Owner verification **PENDING**. Do not close P02-5 from portable/source tests alone.

## 0. Apply safely

Merge the update-only ZIP into the **already accepted P02-4 project**. The separately committed UI reference images should remain exactly where the owner placed them. Do not overwrite `.env`, `node_modules`, local DB/media, signing config or real user data. Do not remove committed project files based on the ZIP's omission. Ensure Flutter SDK, Android SDK, your own local Fastify and manually started **Java DynamoDB Local** are available as before.

## 1. Automated checks (PowerShell, project root)

```powershell
npm run verify:p02-5:plan
npm run verify:p02-5:portable
npm run typecheck
npm run lint
npm run test:flutter
```

`npm run test:flutter` performs `flutter analyze` and all Flutter widget tests, including new P02-5 viewport/palette tests. **Stop and report a failure here** rather than proceeding to Android. No warnings should be suppressed by changing lint severity. If normal dependencies remain installed, do not reinstall them.

With local API, Java DynamoDB Local and USB Android device already running:

```powershell
npm run verify:p02-5
```

This runs the P02-5 contract gate and then the **existing** 12-stage P02-4 verification. It does not double-run the Android suites or create an extra public discovery test. An API/DB/phone failure stops the pipeline without false success. `npm run verify:p02-5:plan` only lists commands; it never runs tests.

## 2. Visual review on actual hardware

Compare the **real Flutter app**, not its test runner, with owner-committed references S03, S06–S11, S13–S16, S65–S66. Reference images are inspiration, **not** exact constraints.

1. At approximately 320, 360 and 430 logical pixels (via emulator and/or device), inspect the entire screen. No yellow/black overflow, clipped labels, horizontal form overflow, navigation overlap or hidden buttons.
2. Check system text scales ~1.0, ~1.3 and ~1.6, dark OS mode and display size settings; confirm legibility, text wrapping and scroll accessibility. The app uses a deliberate accessible light theme.
3. On login and signup, inspect round input fields, readable warnings, buttons, OTP, eligibility and persistent session behavior. **Do not** change the accepted password/OTP flow to imitate mock screenshots.
4. Set up **Friendship-only**; confirm Common Profile → Friendship Details → Friendship Photos → Review. Then test **both** modes; ensure all six conditional steps appear with Dating pink and Friendship teal accents.
5. Verify **Save & Next is one action**; required empty/unsaved data cannot advance. Back, step tabs, horizontal swipe and restoration after Settings/Home and app restart keep working. An incomplete step must block left-swipe forward.
6. Photo screens: zero, one, and two **READY** photos per selected mode; preview real private thumbnail; reorder/replace/remove/reuse. At 320dp, all icon actions are visible after scrolling and can be tapped without horizontal overflow. Removal re-locks Continue.
7. Real **Android system SAF picker** manual acceptance: choose a real JPG/PNG/WebP, preview, upload; cancel; reject oversized/invalid image; reopen and confirm privacy; no broad storage permission. The automated Android UI test injects image bytes and **does not** prove the native picker.
8. In Review, both mode summary cards and actual authorized thumbnails display. Continue leads to the private setup completion page, then Dating/Friendship activation intents remain independently controlled, **never publicly discoverable**.
9. In Home/Settings, password change, device list/revocation, logout and return to Home still work. Keyboard and bottom navigation stay reachable. No fabricated Dating/Friendship/Connects tabs should appear before P03.
10. TalkBack/VoiceOver: step headers, warnings, fields, image actions and navigation controls are understandable. Confirm status does not depend on color alone.

## 3. Evidence and closeout

Record for each relevant screen: reference ID, actual screenshot filename, screen width/font scale, PASS/FAIL, and any overflow or unexpected tap. Avoid exposing email, internal IDs, real profile photos, tokens or precise location in reports. Screenshots are owner artifacts only; do not put real personal data in this ZIP.

If all automated gates and real-device visual/native-picker checks pass, the owner may confirm **P02-5 owner accepted** and update the phase-status docs. If one stage fails, mark P02-5 **FAILED at that gate**, retain P02-4 as the accepted baseline, and repair *that exact source/test cause* without rewriting working onboarding.
