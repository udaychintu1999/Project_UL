# P01 Slice 01 — Android asynchronous outbox regression repair (2026-11-13)

**Status:** P01 `PARTIALLY_VERIFIED`. P00 `CORE_FLOW_VERIFIED` retained. P02 remains unauthorized.

## Latest owner Windows evidence (after the previous T1/T3 corrective ZIP)

The owner re-ran the real local stack after applying the TypeScript/Flutter rendering repair. `npm run verify:p01` advanced **past the earlier TS2345**. The provided logs show:

| Gate | Owner-observed result |
|---|---|
| `npm run test:p01:integration` | **PASS** — real Fastify + Java DynamoDB Local; OTP, rate limit, consent/age, concurrent signup, UID immutability, restriction, logout/re-entry and session revocation |
| `npm run test:portable` within `verify:p01` | **PASS** — 14 unit tests, 2 local guards, 9 CLI stubs, 3 env-init fixtures, source/docs/environment/secrets/cloud checks |
| `npm run typecheck` within `verify:p01` | **PASS** — earlier optional-secret TS2345 resolved |
| `npm run test:db` | **PASS** — all 18 actual tables + conditional Put/Get/Query/Delete |
| `npm run test:integration` | **PASS** — P00 real Fastify + DB roundtrips |
| `npm run test:flutter` | **PASS** — analyzer no issues; 9 Flutter widget tests |
| `npm run test:flutter:e2e` | **PASS** — P00 physical Android diagnostics via ADB reverse |
| `npm run test:flutter:p01:e2e` | **FAIL** — physical Android test `auth_integration_test.dart:26` did not observe expected UI status `Local development code retrieved.` after tapping dev outbox |
| `npm run verify:p01` overall | **FAIL** due solely to P01 physical Android gate in the supplied run; later gates never need to be invented |

The Java/Gradle `java.lang.System::load` warnings are incidental, not the failure. **The failure log did not expose the actual UI status**, so it cannot distinguish a slow/pending HTTP response, an ignored tap, an outbox 403/404, or other API/network error. Backend integration proves the outbox route works on Windows from the Node HTTP client; it does not guarantee each Flutter device tap/API response. No UI/API failure outcome should be guessed.

## Targeted repair

- `apps/flutter_app/integration_test/auth_integration_test.dart`: Replace network-action `pumpAndSettle()` checks with bounded, real-time polling of the existing user-visible `auth-message` status after every HTTP action (request, outbox, verify, me, logout). `pumpAndSettle` checks Flutter frames, **not** completion of arbitrary `HttpClient` I/O. Let native I/O run briefly using `tester.runAsync`, pump updated Flutter state, and return only on the exact expected success prefix. On failure, report the **sanitized visible error message** and action name; on timeout, report the last visible status. No OTP, bearer token, or developer key is logged. Keep the original full Flutter → Fastify → DynamoDB + outbox → logout path; no mock success or bypass.
- `apps/flutter_app/test/auth_widget_test.dart`: Add a controlled pending-outbox fixture: busy status appears, duplicate tapping is disabled, a denied response remains clearly visible and no local code widget is fabricated.
- `scripts/verify/p01-source-contract.mjs`: Assert Android E2E awaits actual asynchronous outcomes instead of only render settling.
- Documentation/evidence updated with owner-observed outcomes and continued P01 limits.

No backend source, DynamoDB tables/indexes, app environment, launch commands, ports, secret handling, Google integration, production AWS or payments were changed in this patch.

## Acceptance on owner Windows/USB phone

Apply update-only ZIP from project root, preserving `.env`, existing DynamoDB Local data, `.git`, and dependencies. Keep Java DynamoDB Local running manually on 8000 and Fastify via `npm run dev:api` on 3000. Stop any *interactive* `npm run dev:flutter` on the same phone before automated tests. The E2E command itself builds and launches the application and runs `adb reverse`.

```powershell
npm run verify:p01:portable
npm run test:flutter
npm run test:flutter:p01:e2e
npm run verify:p01
```

`test:flutter` must report **10** widget tests after the new negative fixture (earlier owner result was 9). If P01 device E2E still fails, its updated failure should state the operation and **sanitized UI status**; share only that error category, not raw codes/tokens or `.env` contents. Only report the repaired Android gate PASS if a real owner-device run actually passes. P00 baseline must remain usable; `npm run verify:p00` can be run as the separate original full regression gate. The P01 phase remains incomplete regardless of this single slice.

## Authoring environment evidence

The Linux authoring runtime has Node 22 but no installed Flutter SDK, USB Android device or owner-secret local DB/API. Executed in this authoring environment after this patch: `npm run verify:p01:portable` **PASS** (14/14 Node unit, 2/2 local guards, 9/9 CLI stubs, 3/3 env-init fixtures, P00 and P01 source-contract tests, docs/environment/secrets/cloud guards). Flutter/Android integration and TypeScript semantic compilation **cannot** be claimed as post-patch PASS from this environment. The previous owner typecheck and P00 Android results apply to the prior patch, which this update does not modify in those paths.
