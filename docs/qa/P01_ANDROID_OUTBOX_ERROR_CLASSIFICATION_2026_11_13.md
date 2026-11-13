# P01 Slice 01 — Android outbox error classification repair (2026-11-13)

## Owner-provided evidence (physical Windows/USB phone)

- `npm run verify:p01:portable` — PASS: P00/P01 portable, source, docs, environment, safety, cloud and secret checks.
- `npm run test:flutter` — PASS: Flutter analyze clean and **10 widget tests**.
- `npm run test:flutter:p01:e2e` — **FAIL twice**: `Local development outbox read failed: Connection failed. Check Fastify and DynamoDB Local, then retry.` The test does reach the **outbox** action: its earlier **Request email code** action passed the expected success-status assertion. The automatic test-runner teardown after FAIL may close the test app; this log has no native fatal/crash stack or Android process crash evidence.
- `npm run verify:p01` — typecheck, all 18 real DynamoDB tables, P00 API integration, P01 auth API integration, Flutter analyzer/widgets (10), and P00 Android USB E2E PASS; P01 Android USB E2E FAIL at the same outbox step. Complete P01 gate is **NOT VERIFIED**.

## Defect found

`HttpAuthService._send` previously used a blanket `catch (_)`, mapping all failures (invalid JSON, response type errors, timeouts, socket failures, HTTP client failures) to the same **Connection failed** message. It therefore concealed the error category and misled debugging. Current logs cannot distinguish a genuine network failure from another client exception. Source and API tests do not demonstrate a missing ADB reverse; P00 Android server/DB checks pass on the same machine.

## Targeted source correction

1. Separate parsing/validation from HTTP in `parseAuthResponse`; return safe, explicit errors for invalid JSON and invalid response shapes. Validate a successful outbox result as a six-digit string. No OTP or bearer token appears in failure text.
2. Categorize timeouts, socket failures, HTTP transport, encoding, and unexpected client/runtime failures by *fixed operation name and stage* (`connect`, `send`, `response`, `body`, `parse`). Never print exception objects, headers, URL parameters, codes or tokens.
3. Add four pure Flutter response-parser regression tests: valid outbox code, 403 developer-key rejection, malformed/non-string outbox response, and invalid account response.
4. On outbox device-test failure/timeout, perform a same-device **read-only** `/health/ready` probe. Include only its sanitized status in the failure, never secrets. The probe diagnoses whether the API was accessible at failure time; it does not replace/skip the failed outbox assertion.
5. Preserve all backend auth rules, P00 diagnostics, local-only network restrictions, ADB reverse and DynamoDB schema. Do not remove or relax the private developer-key guard.

This is a targeted **diagnostic and parsing repair**, not evidence that the unknown underlying outbox transport issue is already solved. No hardware root cause or real Flutter device success is claimed until the owner reruns.

## Authoring versus owner verification

Authoring environment: `npm run verify:p01:portable` **PASS (exit 0)** after patch, including 14 Node unit tests, 2 local guard, 9 CLI, 3 environment-init tests, source contract, documentation, environment safety, secrets and cloud-operation checks. Flutter SDK/Android USB device/Java DB unavailable here; `npm run test:flutter`, `npm run test:flutter:p01:e2e`, `npm run verify:p01` must be rerun on Windows. Retain historical owner PASS statuses for prior code; do not treat them as post-patch verification.

## Windows next steps

1. Apply update ZIP over the current project root with project-relative paths (do not replace `.env`, `node_modules` or database data).
2. Keep manually started Java DynamoDB Local on port 8000, and `npm run dev:api` running on the PC on port 3000. Keep USB debugging authorized. Stop interactive `npm run dev:flutter` on the same phone before Android automated tests.
3. Run `npm run verify:p01:portable`, `npm run test:flutter` (expected **14** Flutter widget/unit tests, previously 10), then `npm run test:flutter:p01:e2e`.
4. If failed again, share only the sanitized `Local development outbox read failed: ... | local API probe: ...` error. The stage/message and probe distinguish parse, connection, and API availability. Do **not** share `.env`, dev key, OTP, user tokens or logcat carrying sensitive data. If a native process crash is suspected, report separately whether Android displays an OS crash dialog or the test runner simply closes the app after its own FAIL.
5. If P01 device E2E passes, run `npm run verify:p01` and `npm run verify:p00` and record actual outcomes. Do not start P02.

**State after authoring patch:** P00 historically `CORE_FLOW_VERIFIED`; P01 Slice 01 `PARTIALLY_VERIFIED`; full P01 incomplete and not closed.
