# P03-1/P03-2 — Windows/Android test commands

**Current complete runbook:** [`../p03/04_ACCEPTANCE_AND_RELEASE_GATES.md`](../p03/04_ACCEPTANCE_AND_RELEASE_GATES.md). Use [`../p03/README.md`](../p03/README.md) for architecture, user flows, exact APIs and privacy boundaries. The older long P03 manual runbooks are historical and may conflict with the new five-tab UI.

From `C:\Dump\Projects\Project-ULuv-Space` (or your actual project root), with Java DynamoDB Local manually started, the original 18 tables ready, the existing private `.env` unchanged, Fastify running with `npm run dev:api` in a separate terminal, and a physical authorized Android device connected:

```powershell
npm run verify:p03:acceptance:plan
npm run test:p03:acceptance:types
npm run test:p03:acceptance:flutter-analyze
npm run test:flutter
npm run test:flutter:p03:e2e
npm run verify:p03:acceptance
```

The expanded isolated Android suite must show **seven** named device tests (three original + four new journeys). A passed **old 3/3 run** is not evidence that these four additions passed. The runner uses the dedicated test package, never uninstalls the normal app, binds its fixture to the device's own loopback address, and sends no owner JWT to external services. Its `--reporter expanded` output prints individual scenario names.

**Manual owner closeout:** real GPS permissions/accuracy, genuine CloudFront failure and safe fallback, normal application login persistence after an actual OS force-stop, profile editor in Settings, accessibility and multi-device stale settings. These are not silently covered by synthetic test fixtures. Do not run AWS operations or expose private `.env` values to troubleshoot.
