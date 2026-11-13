# P01 Android POST framing hardening — 2026-11-13

## Owner evidence (before this patch)

- `npm run verify:p01:portable` **PASS** (P00/P01 unit, CLI, source, documentation and security checks).
- `npm run typecheck` **PASS** on the owner's Windows machine.
- `npm run test:flutter` **PASS**: Flutter analyzer clean and 14 widget/unit tests.
- `npm run test:flutter:p01:e2e` **FAIL** on a USB Android phone, after applying the previous header-order repair: `OTP request failed: Local API HTTP transport failed during code request (response).`
- Earlier owner tests separately verified P00 USB Android GET/POST diagnostic functionality and P01 Fastify/DynamoDB Local authentication. Do not confuse a Flutter `HttpException` during `HttpClientRequest.close()` with a confirmed API or DynamoDB outage.

## Source review

- `HttpAuthService._send()` created a new `dart:io` `HttpClient` and wrote short JSON POST bodies using `request.write(jsonEncode(body))` with implicit/chunked framing, without setting an explicit content length. That is valid Dart, but it is a different transport path from a fixed-length HTTP request and may interact differently with the Android↔ADB localhost forwarding or a prematurely closed socket. **This is a transport hypothesis, not a proven root cause.**
- The prior patch fixed a *real* header-order bug: custom headers were being added after writing the body. This report does not retract that finding; it corrects the earlier overstatement that it was the sole confirmed cause of all device failures.
- The Flutter client currently returns a sanitized transport-stage message, not the raw `HttpException` details; the actual socket close reason is not yet known.

## Current limited patch

1. Set all POST headers before writing any body bytes.
2. Explicitly UTF-8 encode JSON and send fixed `Content-Length` bytes using `request.add(payload)`.
3. Request a nonpersistent connection for this local development authentication client (no automatic retries; OTP issuance is side-effecting and must not be repeated blindly).
4. Restrict any `HttpException` classification to a finite allowlist that never prints raw URL, OTP, development key, token, response body or exception message.
5. If P01 Android E2E fails again, run **on the same device** the known P00 authenticated database POST diagnostic in addition to readiness GET; include only their sanitized statuses in test failure. This isolates general Android POST/ADB failures from the specific P01 POST path.
6. Add a Flutter pure category test plus portable guards for content length, nonpersistent connection and all header-before-body ordering.

## What is and is not verified

- Authoring environment: `npm run verify:p01:portable` **PASS** after this patch, including P00 static/unit/docs/security and updated P01 source contract. ZIP integrity checked.
- Flutter analyzer/widget, semantic API typecheck, real Fastify/DynamoDB, USB Android end-to-end after this patch: **UNVERIFIED** in authoring environment (Flutter SDK/device and Java database not present).
- P00 status remains historical owner-confirmed `CORE_FLOW_VERIFIED`. P01 Slice 01 remains `PARTIALLY_VERIFIED`. Full P01 is not completed; P02 not started.
- No backend code, database tables, ports, dev keys or environment secrets, AWS, payments or production identity-provider integration changed.

## Owner acceptance and next evidence

With Java DynamoDB Local manually running on port 8000, Fastify `npm run dev:api` on 3000 and physical USB/ADB reverse active, stop interactive Flutter `run` on the same phone. Extract the update ZIP into project root. Run:

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:flutter:p01:e2e
```

Flutter analyzer/widget tests are expected to report 15 tests if the new pure test is discovered. Do not treat this expectation as proof until it runs. If P01 device E2E passes, run `npm run verify:p01`, then `npm run verify:p00` and manually test using `npm run dev:flutter`.

If P01 device E2E fails, send the **sanitized test failure line** containing `OTP request` or `outbox read` and `readiness GET; diagnostic POST`. If readiness GET and the signed POST probe both pass but P01 POST fails, capture the contemporaneous Fastify console lines for the failed attempt after removing any URLs, emails, tokens, codes and request body; do not paste `.env` or raw device traffic. This will help determine whether Fastify ever observed the request before the connection closed.
