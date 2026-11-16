# U_luv — P02-2 Onboarding Persistence & UI Visibility Repair (2026-11-15)

## Why this repair exists

The owner reported that the P02-2 automated suite passed, yet common city/locality, gender and enabled Dating/Friendship modes appeared not to save or reflect in the app. The test suites were strongest for media and API boundaries, but did **not** adequately validate that the Flutter common-profile form persisted these choices and visibly restored them after recreating the widget. The old Flutter launch behavior also automatically displayed the success/placeholder page for previously completed setup, concealing the editable persisted values.

This is a real verification gap; previous all-green test results do **not** prove complete human-facing onboarding behavior.

## Owner-required fields and the correct gate

- Public username / account `@handle`: required, unique, saved separately from common details.
- Common display name: required and saved once for the account. A mode-specific nickname is optional.
- Broad city/locality: required **self-declared city**, never a verified geolocation or address.
- Gender selection: **explicit selection required**. `prefer_not_to_say` counts as an intentional, privacy-respecting choice. Empty string remains a valid saved *draft*, but never completes onboarding.
- At least one enabled connection mode: required. Every enabled mode must have a persisted draft with bio, intention and at least one interest; enabling both requires completing both.
- Photos: **not required for the P02 onboarding Continue step**, and still required in the later P02-3 discovery activation contract (2–6 per active mode).
- Continue is an active button for genuinely completed **saved** onboarding, opening a private completion placeholder. It is not deliberately disabled throughout P02-2 and does not open future P03 discovery.

## Source behavior changed

1. Backend `onboardingMissing()` includes `gender` when no explicit value was selected. `parseSetup()` still allows a partially completed draft to be stored.
2. Flutter now labels the required fields, makes the empty gender choice clearly a prompt, and shows owner-only **Saved account details** separate from unsaved editor values.
3. The saved preview shows username, display name, city, selected gender and selected connection modes from the authoritative backend response; it does not treat local toggle changes as persisted.
4. After a successful `saveSetup`, Flutter verifies that the response matches the fields it attempted to save. If not, it leaves unsaved text intact and advises reload, rather than falsely claiming success.
5. Reopening the profile always shows editable persisted details instead of automatically hiding them behind `Profile setup complete`. Continue can still open that private completion page.
6. Enabling a mode can automatically select that mode's draft editor when the current editor is disabled and there are no unsaved mode edits. Editor selection is **not** mode enablement.
7. Existing authentication, DynamoDB keys/18 tables, media upload/storage and photo constraints remain unchanged.

## Tests added and strengthened

- **Backend unit:** blank gender prevents ready status; explicit gender or `prefer_not_to_say` can meet the rule.
- **Real local API/DynamoDB:** verifies blank-gender draft write and reload remain incomplete; explicit gender CAS update unlocks readiness; asserts persisted city, gender and selected-mode values and their independent isolation.
- **Flutter widgets:** real controller interaction with gender dropdown, city text field and Friendship switch, save, authoritative saved-state labels, full widget recreation, mode restoration, Continue activation and privacy-preserving gender selection.
- **Physical Android E2E:** existing real Keystore/API persisted-session assertions now also check city, gender, and mode selections after login restoration. **This still uses repository methods, not taps through the entire UI, so the separate widget tests are important and full device UI acceptance remains necessary.**

## Verification status at package authoring

- Backend Node unit tests: **36 passed** in authoring environment.
- Full P02-2 portable regression including P00/P01/P02-1: **PASSED** in authoring environment.
- P02-1/P02-2 source-contract tests: **PASSED** in authoring environment.
- Real Java DynamoDB Local integration, TypeScript typecheck, ESLint, Flutter analysis/widget tests and Android E2E of this patch: **NOT EXECUTED** here. Do not claim green until actual Windows output is received.
- Earlier owner-reported all-green P02-2 commands refer to the **pre-repair** source and do not verify this patch. Earlier acceptance of P02-1 does not imply acceptance of the revised gender requirement.

## Windows automated gate

Merge changed files into the existing project. Keep the normal Android app's data intact and Java DynamoDB Local manually managed:

```powershell
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
# Start your usual manually managed Java DynamoDB Local and Fastify API.
npm run test:p02-1:integration
npm run test:p02-2:integration
npm run test:flutter:p02-1:e2e
npm run test:flutter:p02-2:e2e
```

If `npm run test:flutter` fails, **do not ignore** its failures or change the test to check labels alone. It must verify value preservation, mode switches and persistence across re-mount. The real Android media picker needs additional manual attention; device integration exercises synthetic fixture media.

## Owner manual acceptance (must be done even with green tests)

1. On actual Android, enter a new public `@handle`, shared display name, city, explicit gender selection; enable only Friendship; press **Save common details and mode choices**. Verify the **Saved account details** preview has the exact saved values. Do not confuse an enabled mode switch with the Dating/Friendship editor chips.
2. Complete Friendship bio, intention, interests; **Save mode details**. Confirm Continue is enabled **without photos**. Tap Continue: it should open **Profile setup complete**, not the future discovery screen.
3. Tap **Edit my profile details**, close and relaunch the app, and verify the city, gender, selected Friendship mode and draft persist and remain visibly editable.
4. Disable Friendship, enable Dating, Save, and verify Continue blocks until the selected Dating mode's required fields have been saved; the old Friendship draft must remain stored.
5. Enable both modes and verify both must be complete. Select blank gender again and save: Continue must disable. Select **Prefer not to say**, save, and verify eligibility can recover. Never treat unsaved changes as ready.
6. Retry with network unavailable / stale revision; never show successful-save text or silently drop edits. Confirm Settings actions and device session are unaffected.
7. Repeat photo import → process → export/assignment workflow, including two modes, ordering, remove/reuse, and app restart. Photos remain private; no P02-3 public activation occurs.

Do not mark P02-2 `OWNER_ACCEPTED` until this manual checklist and all post-repair Windows gates pass.
