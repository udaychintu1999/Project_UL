# P01 Android — local outbox POST header-order repair (2026-11-13)

## Scope and verified owner evidence

Owner's current Windows logs confirm:

- `npm run verify:p01:portable`: PASS; source-contract/security/document checks included.
- `npm run test:flutter`: PASS, 14 Flutter unit/widget tests, twice; Flutter analyzer clean.
- `npm run test:flutter:p01:e2e`: FAIL, reproducibly at `Read local test outbox` with sanitized message: `Local API HTTP transport failed during outbox read (send). | local API probe: API and DynamoDB Local ready`.
- Earlier owner `verify:p01` evidence shows API TypeScript typecheck, all 18 DynamoDB Local table checks, P00/P01 real backend integration and P00 physical Android E2E PASS. These gates have NOT been rerun after the current fix.

## Root cause confirmed in source

`HttpAuthService._send()` in `apps/flutter_app/lib/features/auth/auth_service.dart` wrote `request.write(jsonEncode(body))` before adding `x-uluv-dev-key` (local outbox POST) or `Authorization` (authenticated logout POST). On Dart's `HttpClientRequest`, writing the body can commit HTTP headers. Calling `request.headers.set` afterward can throw `HttpException`. This precisely fits the outbox HTTP transport failure at stage `send` with readiness still operational. The actual exception text is intentionally not logged because it may contain sensitive context.

The backend `POST /v1/dev/otp/outbox` is already proven by owner real-DB integration, while Android API readiness and initial OTP request work. No DynamoDB schema, OTP policy or auth security changes are indicated.

## Minimal fix

1. Set `Accept`, `x-uluv-dev-key` (development only), `Authorization` (when authenticated), and `Content-Type` **before** the JSON body write.
2. Keep local-only endpoint allowlist and existing key validation, never print the developer key/OTP/bearer.
3. Add a portable P01 contract regression that fails if any request header is moved after `request.write` in the sender.
4. Reuse the existing real-device auth E2E to confirm code request → local outbox → verify → account access → logout. It is an actual network/device test, not a mocked success.

## Environment and truthfulness

- **PASS in authoring container:** `npm run verify:p01:portable` (P00 portable regressions, Node unit tests, P01 source contract, security/docs/cloud guards). No live API/device was used in this portable suite.
- **PASS in authoring container:** `node scripts/verify/p01-source-contract.mjs` with corrected source. The guard was also negative-tested twice: temporarily moving the developer or bearer header after `request.write` caused expected nonzero results; restoring the correct source passed again.
- TypeScript semantic compile and Flutter analyze/device **after this patch: UNVERIFIED here**; require the owner's Windows environment. Previously owner-run API/DB/Flutter passes are historical evidence, not current post-patch results.
- P00 historical status: `CORE_FLOW_VERIFIED`; P01 stays `PARTIALLY_VERIFIED` until real Android E2E and combined gate pass. Full P01 phase is not finished (real Google provider, delivery, restoration etc.). P02 remains not authorized.
- No AWS, Docker, cloud access, payment provider or changes to the 18 canonical tables.

## Windows acceptance

Keep the existing manually started Java DynamoDB Local (8000) and Fastify (3000) running, USB phone authorized, without concurrent interactive Flutter run. Apply the update ZIP over project root preserving `.env` and local DB data. Then:

```powershell
npm run verify:p01:portable
npm run typecheck
npm run test:flutter
npm run test:p01:integration
npm run test:flutter:p01:e2e
npm run verify:p01
npm run verify:p00
```

The corrected Android test should complete outbox retrieval and then sign-in, account check and logout. If it fails, share only the already-sanitized stage/error. To test the app manually, run `npm run dev:flutter` in a separate session (not concurrently with device E2E).
