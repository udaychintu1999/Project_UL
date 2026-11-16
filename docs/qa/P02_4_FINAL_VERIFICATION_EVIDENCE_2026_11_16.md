# P02-4 — Full P02 regression, release-boundary audit and closeout evidence

**Date:** 2026-11-16  
**Current decision:** `PARTIALLY_VERIFIED / OWNER_FULL_ACCEPTANCE_PENDING` — code and automated verification plan delivered; do **not** call P02 `CORE_FLOW_VERIFIED` until the owner has run the full real-device gate and completed the manual picker acceptance. Local-development acceptance is **not** a production-release approval.

## Source baseline, acceptance provenance

- **P02-1:** owner-reported functional acceptance of username, common profile, independent drafts and Home/Settings.
- **P02-2:** owner explicitly approved completion of guided onboarding, local photo management and real Android UI. The screen tests use a deterministic **picker MethodChannel fixture**; separate real Android photo gallery/files chooser use is not confirmed by owner evidence.
- **P02-3:** after repair of the `Save & Next` obstructed-tap regression, owner stated **"all passed"**. Treat this as owner-reported Windows/Android functional acceptance, **not** a freshly captured full P02-4 verifier log.
- **P02-4:** this update adds a single exhaustive, fail-closed verification command and a focused regression test suite, with documented manual acceptance. Existing known P01-1 OTP Android automated failure remains a *historical failed test* accepted for earlier local development; do not rename it PASS or erase it.

## Implementation and audit

- New `scripts/verify/p02-4-plan.mjs`: immutable list of the only authorized 12 stage npm commands; local-only API/database preflight; sequential stage execution with **stop-on-first-failure**, no later fabricated PASS.
- New `scripts/verify/p02-4-verifier.mjs`: full Windows gate with explicit stage progress and a distinct manual-acceptance warning; `--list` is a safe read-only plan.
- New `scripts/verify/p02-4-verifier.test.mjs`: tests stage presence, real DB/Flutter/Android coverage, no duplicated guided UI E2E, error/exception/signal short-circuit behavior, remote endpoint rejection, and P03 public-discovery fail-closed boundary.
- `package.json`: `test:p02-4:contracts`, `verify:p02-4:portable`, `verify:p02-4:plan`, `verify:p02-4`.
- No production API, Flutter runtime, DynamoDB schema, auth, photo storage, discovery pointer, AWS/payment or user-data migration changes. Existing P02 integration and Android tests are *executed* by the full verifier; source-only tests never substitute for them.

## Mandatory full automated gate order

1. Portable P00/P01/P02 source, unit, security and QA regression + P02-4 tests.
2. TypeScript semantic compilation and ESLint.
3. Local media-store tests.
4. Flutter analyzer and widget tests.
5. Live Fastify API and real Java DynamoDB Local health/Put/Get/Query/Delete.
6. P02-1 real account/profile integration.
7. P02-2 real photo validation, mode reuse, ownership, deletion, persistence and 0/1/2 gates.
8. P02-3 real independent activation request, CAS race, stale revision, privacy preview and 404 public access.
9. P02-1 isolated physical Android identity/session E2E.
10. P02-2 isolated physical Android real API/media E2E.
11. P02-3 isolated physical Android screen-tap guided flow through checkpoint 15, incl. Save & Next, photos, restart, activation and owner preview.

P02-2 dedicated `--ui` is intentionally not repeated: P02-3 uses the **same** full guided Android suite with two additional checkpoints. P02-1 and P02-2 direct API/device suites exercise distinct flows.

## Provenance and evidence table

| Gate | Authoring environment | Owner Windows/physical device |
|---|---|---|
| New plan/negative tests | Run `npm run test:p02-4:contracts`; record result below after execution | Covered by `verify:p02-4:portable` |
| Full portable P00–P02-4 chain | Run `npm run verify:p02-4:portable`; record result below after execution | Pending this ZIP |
| TypeScript semantic / ESLint / media store | Unavailable without installed npm packages | Pending new full verifier |
| Flutter analyzer / widgets | Flutter SDK unavailable | Pending new full verifier |
| Live Java DB + Fastify | Java DynamoDB Local and running API unavailable here | Pending new full verifier |
| Three distinct Android suites | USB Android/Flutter SDK unavailable here | Pending new full verifier |
| Native Android system photo chooser | Cannot be established by the test picker fixture | **Manual owner check pending** |
| P03 discovery / production / live AWS | Explicitly out of P02 scope | Not approved |

**Executed authoring results (2026-11-16):** `npm run test:p02-4:contracts` **4/4 PASS (exit 0)**; `npm run verify:p02-4:portable` **PASS (exit 0)** including **40/40 API unit tests**, prior P00/P01/P02 portable suites, **P02-4 4/4** negative-plan tests, `test:docs` PASS, `test:secrets` PASS, `test:cloud-guards` PASS. `npm run verify:p02-4:plan` printed all **12 required stages** without running them. Separately reran `npm run test:docs`, `npm run test:secrets` and `npm run test:cloud-guards` — all **PASS**. The source of P02-3 owner-reported acceptance is the conversation statement rather than an attached full verifier transcript. **Unexecuted in this environment:** semantic TS/lint/media store/Flutter/live Java DB+Fastify/USB Android, so full `npm run verify:p02-4` remains **UNVERIFIED**.

## Exit rule

P02 can be recorded `CORE_FLOW_VERIFIED (LOCAL)` only after **`npm run verify:p02-4` exit 0** on the owner's Windows/USB setup, manual native-picker and high-priority recovery/privacy checks documented PASS, and the owner expressly accepts final P02 closeout. If any check fails, state `RELEASE_BLOCKED` or `PARTIALLY_VERIFIED` with the exact failing gate. Do not deploy, run AWS or unlock public discovery based on P02 results.

See `docs/manual/P02_4_WINDOWS_FINAL_ACCEPTANCE_2026_11_16.md` and `docs/handoff/P02_TO_P03_BOUNDARY_2026_11_16.md`.
