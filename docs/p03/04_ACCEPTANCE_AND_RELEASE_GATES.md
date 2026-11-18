# 04 — P03-1/P03-2 automated acceptance and physical-device closeout

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

| Layer | Previous actual owner run | Scope |
| --- | --- | --- |
| Strict acceptance test TS, application TS, lint | PASS | Real local Windows toolchain, not stubs |
| Portable security/GeoNames/H3/privacy suite | PASS 15/15 | Includes inherited P01/P02 regressions; pin and negative tests |
| Fastify/DynamoDB Local | PASS | Five HTTP/DB roundtrips; isolated manual/GPS save/read/conflict and P03-2 bounded PK Query |
| Flutter analyzer/widget | PASS, **81/81** | Actual Flutter analyzer and widget test runtime |
| Isolated physical Android integration (original) | PASS, **3/3** | Bottom navigation states and simulated one-tap GPS, not native GPS permission |
| Combined full automated runner | **PASS 11/11, twice** | Log ends `P03 LOCAL AUTOMATED GATES PASSED` |
| **Expanded Android journeys delivered in this patch** | **NOT YET RUN** | Requires a new Windows/Android execution; do not combine with prior 3/3 evidence |
| Native GPS, OS force-stop/relaunch, live CDN | **MANUAL PENDING** | Not proven by simulated fixture or by the local-DB tests |

## What the expanded isolated Android tests exercise

Existing three device tests: completed navigation Dating → third Local Feed → Settings; incomplete 2-tab shell; no automatic GPS and one mocked GPS save. New tests are registered **in the same physical-device suite**, so the command executes **7** named scenarios total, with expanded console reporting. The four new tests use production Flutter widgets and **real `dart:io` HTTP GET/PUT** to an `HttpServer` bound to the test app's own loopback interface (random local port). The fixture requires a fixed synthetic bearer token; it contains no real account credentials, no AWS access and no external network.

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
