> **2026-11-13 owner rerun update:** Earlier failed/stalled checks in this document were **resolved and rerun successfully** on the owner's Windows machine. `npm run verify:p00` now passes every automated gate, and the owner confirms both buttons succeed on the physical USB Android phone. This document remains a historical patch/test record; see `P00_FULL_STACK_AUTOMATED_PASS_2026_11_13.md` for the current status and the outstanding manual DB stop/restart acceptance.

# P00 — Physical Android USB configuration and integration gate (2026-11-13)

## Owner-provided Windows logs (reported, not rerun by agent)

- `npm run typecheck`: **PASS** (TypeScript `tsc --noEmit` completed with no errors). Confirms prior TS18046 repair on owner machine.
- `npm run test:db`: **PASS** all 18 real DynamoDB Local table schemas + conditional Put/Get/Query/Delete on owner Windows host.
- `npm run test:integration`: **BLOCKED** `ECONNREFUSED 127.0.0.1:3000`; Fastify was not listening during this command. No API integration result can be claimed. Restart `npm run dev:api` in a persistent terminal and retry.
- `npm run test:flutter`: analyzer reported one `prefer_const_constructors` info at `lib/main.dart:65` and exited before widget test stage. Fixed that constructor call in this update; **post-fix Flutter analyze/tests UNVERIFIED** until owner reruns.
- User reports opening Android app with USB debugging; this is **not evidence of a successful Flutter → API → DynamoDB call**.

## Implemented (not a completed live device test)

- `apps/flutter_app/dev_connection.config.mjs` controls USB vs emulator, with comments for Android localhost, emulator host bridge and optional device ID. Default USB uses `127.0.0.1:3000`; emulator uses `10.0.2.2:3000`.
- `scripts/dev/flutter.mjs` validates only local debug HTTP addresses and performs `adb reverse` automatically **for USB localhost URLs** before launching Flutter. `--target emulator` is a one-off switch; CLI overrides remain local-only. No Wi-Fi binding, no remote API, no AWS, no new table.
- `scripts/verify/p00-integration.mjs` reports a clear actionable BLOCKED message when no API process is reachable. It still returns nonzero, never reports success on failure.
- `apps/flutter_app/lib/main.dart` uses `const TextStyle` to address the reported lint issue.
- Stub-based tests cover USB forwarding, emulator no-forwarding, invalid target, reverse failure, host validation and Flutter failure propagation. Fake SDK tests are **not** a real phone run.

## Owner USB acceptance steps

1. Start DynamoDB Local manually and keep Java process running. `npm run db:provision` if needed.
2. In a second persistent terminal start `npm run dev:api`. Check `http://127.0.0.1:3000/health/live` returns JSON and `/health/ready` reports database connected.
3. Plug in an authorized USB Android phone. `adb devices` must list its serial as `device`.
4. With `target: 'usb'` in `apps/flutter_app/dev_connection.config.mjs`, run `npm run dev:flutter` in a third terminal. The launcher automatically establishes `adb reverse tcp:3000 tcp:3000`. Tap **Check server** and **Test database**, record observed messages without sharing the token.
5. From a fourth terminal: `npm run test:integration`, `npm run test:flutter`, `npm run test:flutter:e2e`, `npm run verify:p00`. Run the tests while the API/DB/phone are active.
6. Stop Java, verify healthy live endpoint but unavailable database; restart Java, recheck Flutter failure and recovery, retries, duplicate-action prevention and unchanged 18 table schemas. Record observed results and screenshots with no secrets.

## Status

P00 remains **PARTIALLY_VERIFIED**. Owner's direct real database T2 pass is recorded, but Fastify integration T2 and Flutter Android T3 end-to-end/outage-recovery acceptance are still UNVERIFIED. No P01 work, production access, AWS writes, payments or schema changes.
