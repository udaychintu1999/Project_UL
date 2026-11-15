# P02-1 Continuation — Home/Settings Navigation & Owner Verification (2026-11-15)

## Scope and status

**P02-1 CONTINUATION: IMPLEMENTED IN SOURCE; PORTABLE_VERIFIED; OWNER FLUTTER/TYPECHECK RETEST PENDING.**

The owner requested a proper authenticated home with exactly two bottom-navigation tabs, without advancing to P02-2. This change does not add profile media, locality, activation, matching or P03 discovery. The accepted P00/P01 authentication, the existing `uluv_` table set, and local-only infrastructure remain unchanged.

## Owner evidence received before this continuation

- `npm run test:p02-1:integration`: **PASS**, owner Windows, real Fastify + Java DynamoDB Local (registration, authentication, atomic handles, revisions, mode drafts, privacy/validation/restrictions).
- `npm run test:flutter:p02-1:e2e`: **PASS**, physical Android, ADB reverse, Keystore session, handle, independently persisted drafts, restored session; synthetic fixture removed.
- `npm run verify:p02-1:portable`: **PASS**, owner Windows.
- `npm run test:flutter`: **PASS**, Flutter analyzer no issues, 40 widget tests (before this navigation change).
- `npm run lint`: completed **with 3 existing unused-import warnings** and no errors.
- `npm run typecheck`: **FAILED**, TS18046 in `apps/api/src/app.ts` accessing `error.code` where Fastify passed `unknown`. The continuation adds an object/code property guard; owner retest pending.
- Owner ran `npm ci`, reported npm audit's **7 moderate vulnerabilities**. This continuation does not blindly upgrade dependency versions or use `npm audit fix --force`; audit separately prior to production deployment.
- Owner explicitly accepts doing manual phone testing. **Manual acceptance of this continuation has not yet been reported.**

## Implemented changes

1. `AccountNavigation` uses a Material 3 `NavigationBar` with **Home** and **Settings** only; compact brand header, width-constrained scrollable cards, safe areas and responsive layout.
2. `IndexedStack` preserves mounted Home profile form and unsaved text while navigating to Settings. Android Back closes a Settings password subpanel first, then returns to Home; it cannot expose P00 diagnostics from an authenticated session.
3. Home opens the actual `ProfileWorkspace` automatically (no extra setup tap), retrieves mode drafts from the authenticated API and retains handle, Dating/Friendship fields, validation, save/reload/discard and conflict handling.
4. Settings reuses the exact P01-2 password setup/change, existing account access, logout, P01-3 signed-in-device list/revocation and session controllers. No duplicate auth API or new backend credentials.
5. Leaving Settings for Home clears unsubmitted password inputs; leaving the persistent authenticated gate after session revocation destroys both tabs.
6. Default/legacy standalone `AuthScreen` stays compatible with the pre-existing P01 widget and API test surfaces, while `PersistentAuthGate` enables the new two-tab UI.
7. Fastify unknown-error code is checked with type narrowing before comparing its 413 category. Three unused P01 imports removed to resolve owner-observed lint warnings; no auth logic changed.
8. New Flutter widget regressions for tab switching, unsaved input, password action, small viewport and Back; existing profile widget regression for auto-open; Node structural/negative tests for route wiring and TS guard.

## Verification actually executed in authoring environment

- `npm run verify:p02-1:portable`: **PASS** (existing P00/P01/P02 portable gates and new navigation checks).
- `npm run test:p02-1:navigation:contracts`: **PASS**, four cases including negative mutations.
- Flutter analyzer/widget tests and physical Android navigation test: **UNVERIFIED HERE** (Flutter SDK and connected device unavailable).
- Real Fastify/DynamoDB Local integration: **UNVERIFIED FOR THIS CONTINUATION**. Owner's previous P02-1 integration PASS is recorded, not misrepresented as a rerun.
- `npm run typecheck` and `npm run lint`: **UNVERIFIED HERE** because the authoring environment lacks an installable npm dependency tree; `npm ci --offline` stopped with `ENOTCACHED` for `yocto-queue`.

## Required remaining gate

Follow `docs/manual/P02_1_HOME_SETTINGS_WINDOWS_ACCEPTANCE_2026_11_15.md`. Do not mark owner-accepted until the owner's new typecheck, lint, Flutter widget check, full real API/DB check, and manual two-tab phone workflow pass. Preserve the historical P01-1 standalone OTP Android automation exception; do not relabel it as passing.
