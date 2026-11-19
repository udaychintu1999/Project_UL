# 04 — P03 Windows verification, evidence and manual release gates

## Authoritative owner evidence — 19 November 2026

**Verified P03-3 baseline (before the new P03-4 candidate):** `npm run verify:p03-3` **completed successfully** on the owner's Windows machine. The log ended `P03 LOCAL AUTOMATED GATES PASSED`. It includes **15/15 P03 portable checks**, **11/11 inherited full acceptance gates**, **81/81 Flutter widget tests**, **7/7 physical Android isolated UI/loopback HTTP journeys**, both real DynamoDB Local integrations for P03-3 publication and already-restricted-account repair (`reconcileRestrictedPointers`), TypeScript, lint and security/docs/cloud guards. This supersedes earlier failure logs about missing historical files, GPS test fixtures and the stale `NOT YET RUN` assertion. Do not repeat obsolete status text as current.

| Component | Last owner result | Scope limit |
| --- | --- | --- |
| P03-1 and P03-2 core | **PASS** | Authenticated Fastify/real Java DynamoDB Local geo writes and bounded private H3 Query; no public discovery |
| P03-3 explicit activation/pointer invalidation | **PASS** | Real DynamoDB Local, owner CAS/revocation, mode/photo/setup/geo safety |
| P03-3 already-restricted pointer repair | **PASS** | Real DynamoDB Local bounded, idempotent, transaction rollback test |
| Flutter analyzer + widgets | **PASS; 81/81** | Actual Flutter runtime, P01/P02/P03 regressions |
| Physical Android isolated E2E | **PASS; 7/7** | Real UI tap + locally hosted synthetic loopback HTTP; not hardware GPS, real account sign-in or CloudFront |
| Internal trusted restriction + atomic audit | **PASS (owner 19 Nov)** | Real DynamoDB Local restricted-account integration and full P03-3 rerun |
| Native GPS, normal app force-stop/relaunch, approved live CloudFront | **MANUAL PENDING** | Not covered by synthetic Android fixture |
| P03-4 authenticated canonical hydration | **CANDIDATE / NOT YET OWNER-RUN** | New guarded route, reciprocal block and media proofs; independent local integration + full inherited verifier required |
| Staff moderation authorization, block management, full account deletion | **DEFERRED** | Authorized future safety workflows; no privileged staff endpoint |

## One definitive Windows command (after overlay)

From `C:\Dump\Projects\Project-ULuv-Space`, with **Java DynamoDB Local started manually** and 18 existing tables provisioned, keep the local Fastify API running in another terminal (`npm run dev:api`), and connect your authorized physical Android device over USB. Protect private `apps/api/.env`; do not share its values or point the tests at remote AWS.

```powershell
# Optional fast diagnosis before the full suite:
npm run test:p03-3:policy
npm run test:p03-3:contracts
npm run test:p03-3:repair:contracts
npm run test:p03-3:restriction:contracts
npm run test:p03-3:restriction:integration
# Mandatory full post-change regression and physical device gate:
npm run verify:p03-3
```

`verify:p03-3` runs pointer/source tests, the full 15/15 P03 portable plan (inheriting P00–P02), TypeScript/ESLint, **both existing and new real P03-3 DynamoDB tests**, 11/11 combined P03 acceptance (live Fastify+DB, Flutter analyzer, 81 widgets and seven isolated physical Android journeys). It is fail-fast: a failed stage cancels acceptance, not an invitation to reduce assertions. The new internal restriction test is in the verifier after the two previously accepted P03-3 tests. `npm run verify:p03:acceptance` alone does not include all P03-3 private tests. The narrower `npm run verify:p03:geo-visibility` remains a historical diagnostic sub-slice, not a final acceptance gate.

## What the seven Android journeys actually prove

Actual Flutter on an Android device with controlled local server transport tests: correct five completed/two incomplete tabs; no unsolicited GPS; manual State/District/Place selection with **verifiably SHA-pinned pack**; one authenticated synthetic save acknowledged; Settings refresh and widget remount/re-read; 409 revision conflict and 429 cooldown recover without fake success; 503 location GET retries rather than pretending null; incomplete profiles never expose private discovery action. These runs use a local synthetic HTTP fixture, not the actual P01 login, live CloudFront OAC, hardware GPS, full app force-stop or a live partner profile result.

## Owner-only manual acceptance (not replaced by automation)

- [ ] **Normal installed app**: sign in with a real test account, confirm returning profile doesn't flash onboarding, force-stop via Android Settings and reopen, confirm secure session restoration and saved location. Never use the isolated test runner to uninstall or reset the normal app.
- [ ] Native permission dialogs: GPS permission denial → manual fallback; precise/approximate granted → one explicit fix and single save; no background activity. Test poor accuracy, stale/outside-boundary, coast/island and manual fallback without weakening the India polygon. Never paste GPS fixes in logs.
- [ ] Manual picker live with approved immutable S3/CloudFront release: checksum-pinned selected district, CDN 403/timeout fallback, safe cached label, genuine server save and no JWT sent to CDN. Use authorized staging/DEV resources; no agent-side AWS uploads.
- [ ] Accessibility/narrow screens/Android Back/scroll and Settings profile summary; two-device 409 revision and 15-second cooldown; verify unauthenticated discovery is 401 and arbitrary third-party preview remains 404.
- [ ] Authorized staff moderation/block/deletion and appeal/restore workflows **when they exist** must be tested separately; do not simulate them by directly changing a real person's database row.

## Evidence and release boundary

Owner's previous successful full log is **proof of the baseline only**. The owner supplied a later full `verify:p03-3` PASS after the trusted restriction and documentation cleanup; this P03-4 candidate remains independently unverified. Mark pending gates honestly as `NOT RUN` rather than PASS. The compiler may report that newer Flutter packages exist; do not update dependency versions just to silence informational output. Production deployment, P03-5 media/UI and full public rollout remain off until separately authorized and verified.

## P03-4 authoritative Windows verification (not yet executed by owner)

```powershell
# Start Java DynamoDB Local manually; keep Fastify on loopback running and Android connected.
npm run test:p03-4:request
npm run test:p03-4:contracts
npm run test:p03-4:coverage
npm run test:p03-4:integration
npm run verify:p03-4
```

`verify:p03-4` is fail-closed: it runs focused P03-4 request, source and H3 tests, then full `verify:p03-3` inherited Node/TypeScript/Flutter/Android acceptance exactly once, followed by new real-DDB candidate hydration. Tests must verify unauthorized HTTP = 401; stale/restricted/mismatched candidate rejection; both blocking directions; READY media; safe allowlist; cursor replay/change; selected band; no Scan, AWS, new tables or P03-5 mock UI. **No Windows P03-4 result has been supplied yet.** Manual native GPS/force-stop/CloudFront remains **MANUAL PENDING**, and no production approval is implied by local PASS.
