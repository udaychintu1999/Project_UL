# P02-1 — Second Windows Failure Report and Targeted Repair

**Date:** 2026-11-15  
**Scope:** P02-1 shared-profile onboarding, existing two-tab Home/Settings; **not P02-2**.  
**Data/environment:** User-owned Java DynamoDB Local and physical Android; no AWS, production storage, new DynamoDB tables, payment integration or auth protocol changes.

## Owner-observed results before this repair

| Check | Reported result | Interpretation |
|---|---|---|
| `npm run verify:p02-1:portable` | PASS | 33 backend tests plus established P01/contract regression chain |
| `npm run typecheck` | PASS | TypeScript semantic compilation succeeded on Windows |
| `npm run lint` | PASS | ESLint API and verification scripts |
| `npm run test:p02-1:integration` | **PASS** | Real Fastify + DynamoDB Local, identity, privacy, mode drafts and persisted setup gate |
| `npm run test:flutter` | **FAIL** | Flutter analyze passed; two widget assertions failed (handle action disabled, setup fixture still incomplete) |
| `npm run test:flutter:p02-1:e2e` | **FAIL before Flutter** | Runner reported unavailable plus failed test-app cleanup; no physical-device verification |

The earlier contradictory cross-account fixture assertion has already been repaired and its real local integration test passed. No evidence of a cross-user data leak was present in the logs.

## Root causes and repair

### 1. Android first-run package check — confirmed implementation defect

The previous runner used `adb shell pm path com.example.uluv.p02isolated` and the generic `adb()` helper rejected any nonzero exit status. On Android versions returning a nonzero status when a package is **not installed**, the very first cleanup check threw before fixture creation. The `finally` block then ran the same check and emitted a misleading cleanup warning.

**Repair:** Use `adb shell pm list packages <exact-test-package>` and detect **only** the exact `package:com.example.uluv.p02isolated` line. An absent test APK is a normal first-run result and never triggers an uninstall. Only the exact isolated application can be uninstalled. Preflight failures are reported by stage without sensitive subprocess output; post-run cleanup is attempted only after successful preflight. Synthetic local account cleanup now runs even if optional profile-record cleanup fails.

**Safety:** The normal application `com.example.uluv` must never be uninstalled, cleared, or have its Keystore/preferences reset by this runner. The Flutter integration test still verifies the native runtime application ID before reading/writing test credentials. If the package ID is wrong, the test fails rather than bypassing isolation.

### 2. Handle-save button — cross-form coupling

The handle Save action was blocked by `dirty || commonDirty` even though the handle is an independent account-level field. A typed handle could therefore leave the action disabled when another form had pending changes. Moreover, an earlier successful save called `load(first: true)` which would discard other unsaved forms.

**Repair:** The handle action is enabled only when the widget has finished loading and the handle actually differs from the saved canonical value. An independent handle save preserves pending common/mode edits, updates the accepted revision after the conditional write, then reloads backend setup status **without overwriting dirty controllers**. The server still enforces handle syntax and uniqueness; no invalid value bypasses backend validation.

### 3. Setup-Continue widget failure

The fixture reported incomplete saved setup after its mode draft write. The earlier disabled handle action can leave the fixture's account handle absent, causing this result; the UI now permits the handle write independently. The existing server-derived setup gate remains mandatory: the test must observe a saved shared profile, at least one mode, and a completed saved draft. **Do not force the fixture's ready flag, skip the assertion or bypass the gate.** This particular Flutter widget result is still **UNVERIFIED after repair** until the owner reruns `npm run test:flutter`.

## Tests added and run by authoring environment

- `npm run test:p02-1:android-package` — **5/5 PASS**; covers the exact package, absent first-run APK, safe uninstall, failed uninstall and failed ADB checks.
- `npm run verify:p02-1:portable` — **PASS** (33 existing backend unit tests, all existing P00/P01 portable/contract gates, P02 guards and new package tests).
- New Flutter widget regression for independently saving a handle while keeping unsaved common name/bio — **NOT EXECUTED** here because Flutter SDK is not available.
- JavaScript `node --check` for changed verification files — **PASS**.
- Windows semantic typecheck/lint, Flutter widget tests and physical Android run — **NOT EXECUTED for this patch** here.
- Real local integration — **OWNER_REPORTED_PASS** immediately before this patch; backend code is unchanged in this repair.

## Windows acceptance sequence

1. Overlay update-only ZIP at project root, preserving `.env`, local database and device app.
2. Keep Java DynamoDB Local started manually. Keep `npm run dev:api` running.
3. In project root:

```powershell
npm run verify:p02-1:portable
npm run typecheck
npm run lint
npm run test:flutter
npm run test:p02-1:integration
npm run test:flutter:p02-1:e2e
```

If Android tests fail, report the **first** `FAIL P02-1 Android <stage>` line, any non-sensitive Flutter error output and whether the isolated package appears in `adb shell pm list packages com.example.uluv.p02isolated`. Do not share `.env`, OTPs, session tokens or protected credential JSON.

Manual UX gate: create new test account; confirm handle can save with pending common/bio edits, the latter edits remain in the fields, setup cannot Continue until valid saved common data + one selected complete mode, and Settings/Logout still work. Confirm device sessions of the normal `com.example.uluv` app are retained.

## Status

**SOURCE_REPAIRED / PORTABLE_VERIFIED / OWNER_ANDROID_AND_FLUTTER_RETEST_PENDING**. The owner has NOT yet reported post-repair Flutter widget or Android E2E passes. P02-2 is not started. The historical P01-1 Android OTP automation exception remains unchanged.
