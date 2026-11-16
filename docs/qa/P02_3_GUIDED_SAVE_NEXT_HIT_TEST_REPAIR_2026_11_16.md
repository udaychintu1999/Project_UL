# P02-3 — Guided Save & Next / Back Android hit-test repair (2026-11-16)

## Owner-observed failure

`npm run test:flutter:p02-3:e2e` compiled and ran on physical Android, passed real UI checkpoints 01–03, then Flutter warned that a pointer tap on `FilledButton-[p02-save-next]` at approximately `(293, 659)` **would not hit the widget**. The subsequent wait for the next onboarding step could not finish. The warning was not a successful tap or an API/database failure. It is an integration UI automation failure (the actual step change was not verified).

The guided Save & Next and Back controls are children of Home's scrollable form and sit above an independent fixed `NavigationBar`. The prior generic `_tap` called `tester.ensureVisible` but never confirmed the button's rectangle was clear of the fixed bottom bar. The same issue previously affected the final Continue tap.

## Repair scope

- Test-only: `apps/flutter_app/integration_test/p02_2_ui_integration_test.dart` adds `_tapGuidedAction(tester, key)` for `p02-save-next` and `p02-back`.
- Dismiss the keyboard, advance a bounded page-transition frame, await a **real enabled** control, then use `Scrollable.ensureVisible` with `alignment: 0.35`, `duration: Duration.zero`, and a subsequent frame pump.
- Confirm the button rectangle is at least 8 logical pixels below the AppBar and above the fixed bottom navigation. Where necessary, use at most eight real drag attempts and pumped frames.
- Fail explicitly if the button remains obstructed. Perform `tester.tap(action)` (a real pointer), then require the expected next/back label before reporting any later checkpoint.
- Retain the previously proven safe final Continue helper and the isolated `com.example.uluv.p02isolated` Android runner; no authentication, production app widgets, API, schema, media or security changes.
- Source regression `scripts/verify/p02-2-ui-journey.test.mjs` checks both guided actions, viewport bounds, instant scrolling, a real pointer tap, actual step-change verification, and negative mutants that remove safeguards.

## Verification performed by authoring environment

- `node --test scripts/verify/p02-2-ui-journey.test.mjs`: **PASS 8/8** including the two new regression tests.
- `npm run verify:p02-3:portable`: **PASS**, preserving P00/P01/P02-1/P02-2 and P02-3 portable chains.
- The actual Flutter SDK/Gradle/ADB, live Fastify+DynamoDB Local and physical Android are not available here. **The physical Android regression is UNVERIFIED.** Do not mark P02-3 automated or owner accepted on the portable results alone.

## Required Windows / physical Android acceptance

1. Merge the update ZIP at repository root with relative paths. Do not remove `.env`, local DB/media or normal Android app data.
2. Keep Java DynamoDB Local (manually started) and `npm run dev:api` running.
3. Run `npm run test:flutter` and `npm run test:flutter:p02-3:e2e`.
4. After PASS 03, expect `P02-3 UI ACTION: p02-save-next unobstructed; tapping real button`, followed by the Dating photos step and remaining checkpoints. The full test must end with **PASS 15** and `All tests passed!`; merely printing checkpoints 01–03 is not sufficient.
5. Check at least one narrow Android screen manually; Save & Next and Back must be scroll-reachable, not overlapped or dead. Retain a separate manual native Android system-photo-picker check.
6. If the exact-pointer test still fails, preserve its logged geometry/hit-test diagnostic. Do not set `warnIfMissed: false`, invoke `onPressed` directly, or skip the navigation assertion.

Current status: **SOURCE_REPAIRED; PORTABLE_VERIFIED; DEVICE_UNVERIFIED**. P02-3 and P02-4 acceptance remain pending.
