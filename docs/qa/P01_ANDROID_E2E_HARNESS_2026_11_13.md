# P01 — Android E2E harness isolation and manual verification (2026-11-13)

## Evidence before change

- Owner's physical Android manual app, launched with `npm run dev:flutter`, reached authenticated P01 screen. Account access button displayed **`Account access confirmed`**; logout displayed **`Signed out`** and navigated to the email sign-in form. This is manual PASS for account access/logout. Prior OTP/request/verify success is inferred from access to the signed-in screen, not separately observed here.
- Owner's prior `npm run test:flutter:p01:e2e` failed on the OTP request at response stage: **`response_headers_truncated`**. Subsequent same-phone readiness GET and diagnostic POST both returned a generic connection failure. The cause is not established by those logs. A device-test-runner ending an app after failure does not itself establish a native crash.
- Owner previously reported `verify:p01:portable`, typecheck and 14 Flutter widget tests passing, along with real P00 and P01 backend/database checks. These are prior-machine evidence, not reruns after this patch.

## Hypothesis and tightly limited repair

The manual and automated Flutter sign-in screens call the same production `HttpAuthService`. The E2E test previously invoked the UI callback during `testWidgets` fake-clock pumping and then repeatedly pumped frames while the real Dart HTTP Future was in flight. This can mix test time scheduling with real Android I/O. Flutter supports `WidgetTester.runAsync` specifically for real async operations; the test should initiate the network work *inside* that context, not merely call `Future.delayed` inside it. **This is a harness timing hypothesis; not a proven explanation of the truncated HTTP response.**

Changes:

1. New test-only `apps/flutter_app/integration_test/auth_test_observer.dart`: all five AuthService methods record one pending closure when invoked by the actual UI, without executing it yet. The harness calls `PendingAuthCall.execute()` exactly once inside `tester.runAsync`. That calls the unchanged real `HttpAuthService` against unchanged Fastify/DynamoDB, then completes the Future awaited by the real Flutter screen.
2. `apps/flutter_app/integration_test/auth_integration_test.dart`: tap → capture queued action → start/await in real-async zone → pump UI → assert success or provide sanitized failure and same-device GET/POST probe. Preserves real request, outbox, OTP verification, eligibility/consent, account check and logout. Does not auto-retry side-effecting requests or fabricate success.
3. `apps/flutter_app/test/auth_test_observer_test.dart`: synthetic unit regressions for no early execution, all five delegations, single execution, and stale-call removal. The fake service exists **only** in tests and cannot replace the physical-device E2E.
4. `scripts/verify/p01-source-contract.mjs`: checks test harness uses observer, `runAsync`, guarded one-shot call and actual delegation; rejects old frame-delay polling.

**Unchanged:** `apps/flutter_app/lib/`, Fastify API routes and TypeScript, DynamoDB 18-table schema, ports, authentication rules, OTP rate limits, developer key handling, ADB launcher, P00 tests, cloud/payment boundaries.

## Verification provenance

| Test/check | Status | Evidence |
|---|---|---|
| Source contract `node scripts/verify/p01-source-contract.mjs` | PASS | Authoring Linux Node 22 |
| `npm run verify:p01:portable` | PASS | Authoring Linux Node 22 (P00/P01 portable/static/security/docs/guards) |
| Flutter analyzer and new observer widget tests | UNVERIFIED | Flutter SDK unavailable in authoring runtime |
| USB Android P01 real E2E after patch | UNVERIFIED | Physical phone unavailable in authoring runtime |
| Real Fastify/Java DynamoDB Local after patch | UNVERIFIED | No local Java DynamoDB service provisioned here; backend unchanged |
| Manual account access/logout (before patch) | PASS | Owner's direct observations on physical USB Android |

P01 is still **PARTIALLY_VERIFIED**; P00 historical **CORE_FLOW_VERIFIED**. Do not begin P02.

## Exact owner verification

Keep Java DynamoDB Local manually started at port 8000 and `npm run dev:api` running visibly on port 3000. Stop interactive `npm run dev:flutter` before the automated run. Apply ZIP with project-relative paths without deleting `.env`, node_modules or database files:

```cmd
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

The last owner-confirmed Flutter test suite had 14 tests. The intervening POST transport patch added one expected pure test (unverified on the phone); this harness adds four more, so 19 are expected from the cumulative source if all are discovered. Do not mark that number PASS without observing it. If the Android test passes, complete `npm run verify:p01` then `npm run verify:p00`.

If Android still fails, **immediately** check `curl.exe http://127.0.0.1:3000/health/ready`, `adb reverse --list` and whether the Fastify terminal restarted/exited. Capture only sanitized service uptime/error categories and the `OTP request failed` line. Do not paste `apps/api/.env`, OTP values, user email, developer key, session token, signed URL, or request/response bodies. If the server is down or ADB reverse mapping missing, address the runtime problem rather than modifying working app logic.
