# 04 — P03-1/P03-2 evidence, P03-3 verified core and security closeout

## Commands (Windows PowerShell at project root)

Keep the owner's Java DynamoDB Local running manually, the existing 18 P00 tables initialized, the Fastify API running via `npm run dev:api` in a separate terminal, and one authorized physical Android device attached. The test runner denies remote API/DB endpoints; **do not copy secrets into documentation**.

```powershell
npm run verify:p03:acceptance:plan
npm run test:p03:acceptance:types
npm run test:p03:acceptance:flutter-analyze
npm run test:flutter
npm run test:flutter:p03:e2e
npm run verify:p03:acceptance
```

Run `npm run verify:p03:acceptance` for definitive full acceptance; it checks TypeScript, analyzer, lint, 15 inherited+P03 portable gates, live Fastify HTTP, real DynamoDB Local synthetic accounts and pointers, all Flutter widgets and isolated Android integration. Fail-fast means **a single failing gate blocks acceptance**. Individual failures may be retried only for diagnosis; always rerun the full verifier after fixing.

## Owner-reported execution evidence (18 November 2026)

**Status (updated 19 Nov 2026):** P03-1 and P03-2 are **owner-accepted at the local automated-development milestone** based on the earlier full 11/11 and later 7/7 expanded device execution. The owner subsequently supplied the **final post-recovery `verify:p03-3` log: 15/15 portable and 11/11 full P03 PASS**, including the private P03-3 publication test. The owner then separately ran `test:p03-3:repair:contracts` and `test:p03-3:repair:integration` on 19 Nov: **1/1 PASS each**, including real Java DynamoDB Local. The full 19 Nov `verify:p03-3` run stopped at portable gate 15/15 because of an obsolete documentation-status assertion; later stages did **not run in that attempt**. The assertion and combined test wiring are repaired in this patch and require a fresh owner rerun. OS/manual checks, complete moderation/delete lifecycle, public discovery and production release remain unverified/not approved.

| Layer | Previous actual owner run | Scope |
| --- | --- | --- |
| Strict acceptance test TS, application TS, lint | PASS | Real local Windows toolchain, not stubs |
| Portable security/GeoNames/H3/privacy suite | PASS 15/15 | Includes inherited P01/P02 regressions; pin and negative tests |
| Fastify/DynamoDB Local | PASS | Five HTTP/DB roundtrips; isolated manual/GPS save/read/conflict and P03-2 bounded PK Query |
| Flutter analyzer/widget | PASS, **81/81** | Actual Flutter analyzer and widget test runtime |
| Isolated physical Android integration (original) | PASS, **3/3** | Bottom navigation states and simulated one-tap GPS, not native GPS permission |
| Combined full automated runner | **PASS 11/11, twice** | Log ends `P03 LOCAL AUTOMATED GATES PASSED` |
| **Expanded Android journeys after final recovery** | **PASS 7/7 (owner log, 18 Nov)** | Real Android Flutter screens + authenticated loopback HTTP fixture, NOT native GPS, real app session or live CDN |
| **Latest post-recovery Flutter analyzer** | **PASS, No issues found (owner log, 18 Nov)** | Four accepted Flutter production files restored; no reported analyzer issues |
| Full post-recovery `npm run verify:p03-3` (owner 18 Nov log) | **PASS**: 15/15 portable; 11/11 full P03, including 81/81 widget + 7/7 physical Android E2E | Owner-run local evidence after restored tests and GPS fixture repair; no P03-4/public feature |
| Restricted-pointer repair (19 Nov) | **1/1 contract PASS; 1/1 real DynamoDB Local PASS** | Owner executed both commands separately; full post-repair chain still blocked on stale docs assertion in reported log |
| Full `verify:p03-3` (19 Nov attempt) | **STOPPED at portable gate 15/15** | `NOT YET RUN` stale historical assertion; not a P03-3 DB failure; all later gates not executed in this attempt |
| Native GPS, OS force-stop/relaunch, live CDN | **MANUAL PENDING** | Not proven by simulated fixture or by the local-DB tests |

## What the expanded isolated Android tests exercise

Existing three device tests: completed navigation Dating → third Local Feed → Settings; incomplete 2-tab shell; no automatic GPS and one mocked GPS save. New tests are registered **in the same physical-device suite**, so the command executes **7** named scenarios total, with expanded console reporting. The four new tests (owner-reported **4/4 PASS**, alongside original **3/3 PASS**) use production Flutter widgets and **real `dart:io` HTTP GET/PUT** to an `HttpServer` bound to the test app's own loopback interface (random local port). The fixture requires a fixed synthetic bearer token; it contains no real account credentials, no AWS access and no external network.

1. Full real-picker journey: initial private GET returns no location → explicit Manual opens sheet → State/UT → Nicobar District → verifiably unchanged 5,908-byte pack from published fixture with manifest SHA → select place → authenticated PUT → authoritative saved ACK → Dating, Friendship and Local Feed show saved location → Settings shows it → unmount/remount Flutter widget tree → fresh authenticated GET rehydrates it. Assert **one save only**, zero GPS calls and no public discovery.
2. Manual save rejection: synthetic HTTP 409 revision conflict and 429 cooldown must not dismiss the gate or claim success; after rereading/handling errors, a valid retry saves **once**.
3. Location read outage: synthetic HTTP 503 must show retry, not a false missing-location prompt; retry must rehydrate a preexisting saved label.
4. Incomplete profile: exactly two tabs; no discovery or manual picker before setup, and Settings remains reachable.

**Fixture limitation:** this is NOT the actual Fastify server, P01 cryptographic login, CloudFront OAC, or hardware GPS; it is real Android UI + real HTTP transport + a controlled fake backend. Actual Fastify and DynamoDB Local run in separate mandatory gates. A **Flutter widget remount** is not a true Android **OS force-stop/restart**. Labels and screenshots from the test app must not be represented as evidence of a real user session.

### Physical-device manual acceptance that automation cannot replace

- [ ] Normal, non-test app: sign in to an existing completed profile; force-stop via Android Settings or `adb shell am force-stop <real-app-package>` ONLY after positively identifying the intended app; reopen and confirm 30-day session restoration and no wizard flash. Do **not** use the test runner to reset the normal app.
- [ ] With no selected location, tap Manual, choose a real State/District/Place from your approved CloudFront release; verify save, tab prompt disappears and Settings shows the same label. Reopen the normal app and independently re-read from DynamoDB.
- [ ] Native GPS on a safe physical location: deny permission → manual fallback; grant approximate/precise permission as intended → tap once → no additional confirmation → saved approximate location; never background tracking. Do not publish exact coordinates or diagnostic GPS fixes in logs.
- [ ] Unavailable GPS, poor accuracy and false/foreign/border/island fixes fail safely; the owner must assess actual device/location conditions, not override the India boundary to force a pass.
- [ ] Test a real CloudFront outage/403 only with approved controlled staging (no AWS action by agent); expected pinned-SHA Fastify fallback, verified cache and safe retry. Verify no owner JWT is sent to CDN.
- [ ] Confirm display at narrow screen size, Android Back behavior, screen reader labels, and no tapped/hidden controls or blocked scroll.
- [ ] Confirm 15-second server cooldown and settingsRevision conflict across signed-in devices if two authorized devices are available.

Do not run an owner's acceptance test against production AWS/real user fixtures; do not create/edit P01/P02 documentation. **P03-3 public discovery still disabled** after these gates.

The historical narrower `npm run verify:p03:geo-visibility` command remains valid for the earlier geo visibility sub-slice, but it is **not** the final combined P03 release gate.

## P03-3 — Targeted Windows/Android proof (core and repair separately owner-run; full post-fix rerun pending)

**First apply the changed-files ZIP at project root, do not replace prior full source.** Use the owner's already-running Java DynamoDB Local and the existing P00 18 tables. Run the new private tests before the full inherited verifier. No AWS credentials should be passed to the test. **Source preflight:** the original supplied repository ZIP omitted four historical test paths; the owner restored these from GitHub and obtained the full 18 Nov PASS. Keep the owner's recovered files. Do not overwrite them with incomplete ZIP copies or replace them with no-op tests.

```powershell
# Once, at repository root, before launching the API:
npm ci
# Fail-fast required source guard: recover originals from Git if ANY is False.
@(
  'scripts/verify/p02-1-account-navigation.test.mjs',
  'scripts/verify/p02-5-visual-contracts.test.mjs',
  'scripts/verify/p03-pre-discovery-shell.test.mjs',
  'scripts/verify/p03-four-tabs-and-documentation.test.mjs'
) | ForEach-Object { "$_ : $(Test-Path $_)" }
# Terminal 1: leave manually started Java DynamoDB Local running at loopback:8000
# Terminal 2: owner-started Fastify API for inherited P03 acceptance
npm run dev:api
# Terminal 3: at repository root, physical Android connected via USB
npm run test:p03-3:policy
npm run test:p03-3:contracts
npm run test:p03-3:integration
npm run test:p03-3:repair:integration
npm run test:p03:acceptance:types
npm run typecheck
npm run lint
npm run test:p03:acceptance:flutter-analyze
npm run test:flutter
npm run test:flutter:p03:e2e
npm run verify:p03-3
```

The integration command reads the *owner's existing local environment by Node* using `--env-file=apps/api/.env`; the agent must not open that file. It asserts `APP_ENV=local`, validates the loopback DynamoDB endpoint before network access, and uses synthetic user and mode keys with scoped cleanup. The full `verify:p03-3` is fail-fast: it includes P03-3 targeted tests and previous full P03-1/P03-2 acceptance (which runs live Fastify/DynamoDB + the physical phone). If any command fails, stop acceptance, retain the failing log, fix only the demonstrated root cause and re-run the complete gate.

Manual checks still separate: physical Android native GPS permission/accuracy, actual normal-app force-stop/reopen, live CloudFront/OAC with fresh operation authorization, new privacy/block/moderation/account deletion transitions, geo movement choice and real preview authorization in future P03-4. These are **not** checked by loopback fixture E2E. No one has yet owner-accepted P03-3 and no current automated test proves the future moderation/delete integration.

## Follow-up P03-3 restricted-account repair (owner targeted PASS; combined rerun required)

`reconcileRestrictedPointers` is a private **post-restriction** repair for up to two canonical pointer anchors of a single UID. It is **not a moderation route**, not an account deletion implementation and not a background worker. A separately authorized trusted workflow must first mark the account non-active. The helper uses 3 strongly consistent `GetItem` calls plus at most 5 conditional `TransactWrite` actions; no Scan. A missing anchor cannot locate a legacy orphan. See `07_P03_3_SECURITY_CLOSEOUT.md`.

```powershell
# With manually started Java DynamoDB Local and the existing local environment:
npm run test:p03-3:repair:contracts
npm run test:p03-3:repair:integration
npm run verify:p03-3:closeout  # includes the entire owner acceptance chain again
```

**Owner 19 Nov logs confirm the first two commands PASS (1/1 each) on Windows/real DynamoDB Local.** The old combined verifier omitted the repair integration and its portable gate 15 had an outdated `NOT YET RUN` assertion. This patch updates the assertion and makes `verify:p03-3` **mandatorily run both integration tests** before the full 11-stage inherited acceptance. Neither the corrected combined command nor the added activation-snapshot guard has been owner rerun yet. Native GPS, OS force-stop/reopen, CloudFront/OAC, moderation/block/deletion policy and production release remain separate blockers.
