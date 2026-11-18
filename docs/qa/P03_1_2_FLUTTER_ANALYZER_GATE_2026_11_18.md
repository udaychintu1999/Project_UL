# U_luv P03-1/P03-2 — Flutter analyzer gate repair (2026-11-18)

## Owner-provided failing gate

`npm run verify:p03:acceptance` passed 8/11 gates: strict P03 test TypeScript, backend typecheck, backend/script lint, all 15 portable gates, live HTTP/DynamoDB readiness, live route security, P03-1 real DynamoDB Local, and P03-2 real DynamoDB Local pagination. Gate 9 (`test:p03:acceptance:flutter-analyze`) failed with **12 Dart analyzer diagnostics** (4 infos, 3 visibility errors, 2 constructor-style infos, 3 parser errors; equivalently 6 info messages and 6 error messages). Gate 10 Flutter widget suite and gate 11 device integration were not run.

## Applied surgical corrections

- `apps/flutter_app/test/p03_full_acceptance_test.dart`: remove one extra closing parenthesis in the collapsed Settings widget fixture. Preserves the original runtime assertions.
- `apps/flutter_app/lib/features/geo/india_location.dart`: remove inappropriate `@visibleForTesting` annotations on the three test-transport seam *constructor parameters* forwarded by the production `UluvGeoSettingsPanel` wrapper. Keep the fields, injection behavior, and test interfaces unchanged. These seams should never be populated in production app wiring.
- `apps/flutter_app/lib/features/geo/geo_settings_panel.dart`: remove redundant `dart:typed_data` import, migrate from deprecated `ExpansionTileController` to `ExpansibleController`, and dispose the owned controller in `State.dispose` per Flutter API migration guidance. No change to expansion/collapse behavior.
- `apps/flutter_app/lib/features/geo/discovery_location_gate.dart`: remove redundant `foundation.dart` import (Material exports the used annotation).
- `apps/flutter_app/test/p03_four_tab_friendship_settings_test.dart`: const-fold the immutable MaterialApp/AccountNavigation fixture.
- `scripts/verify/p03-acceptance-plan.mjs` and `scripts/verify/p03-acceptance-plan.test.mjs`: enforce Flutter analyzer as gate **2/11**, immediately after strict P03 test typechecking, and add a fail-closed orchestration regression so a Flutter compile/analyzer error cannot follow a full long DB/portable run. Total gate count remains 11; all backend/database/Android gates preserved.

## What was actually verified in this environment

- `node --test scripts/verify/p03-acceptance-plan.test.mjs`: **6 passed**.
- P02-5 inherited portable gate and P03 navigation-documentation gate: **passed** in reconstructed local source.
- P03 location-repair (4), visibility (4), auto district (4), GPS Flutter contracts (3): **15 tests passed**.
- `npm run test:secrets`, `npm run test:cloud-guards`: **passed**.
- The full portable chain stopped at the first `tsx`-dependent command because the container's prior npm installation is incomplete (`tsx: not found`). The owner's previous Windows logs show 15/15 portable gates passed with actual dependencies.
- No Flutter SDK or Android device is available here, so **full Flutter analyzer, widget, Android integration, and the complete Windows run are UNVERIFIED after this patch**.

## Owner acceptance commands — project root, Windows PowerShell

```powershell
npm run test:p03:acceptance:types
npm run test:p03:acceptance:flutter-analyze
npm run test:flutter
# With owner-started DynamoDB Local, local API, and moto g04s connected:
npm run verify:p03:acceptance
```

Verify the final output prints `P03 LOCAL AUTOMATED GATES PASSED.` before considering the automated phase accepted. One-time native GPS permission/border and app force-close/reopen remain separate manual acceptance checks. P03-3 public discovery must remain disabled. No S3, CloudFront, `.env`, P01/P02 docs, or DynamoDB schema changes are included.
