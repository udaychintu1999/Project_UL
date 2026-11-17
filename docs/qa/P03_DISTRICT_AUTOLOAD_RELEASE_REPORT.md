# P03 — District auto-load regression repair — execution report

## Triggering owner reports

- Selecting a district shows: `Could not load district. Saved cache data was not replaced. Retry.`
- A separate `Download / load selected district` button remains, contrary to the one-step UX.
- `test:p03:gps:api` failed at a privacy assertion; source test contained an unreliable floating-point **substring** check.
- `flutter test test/p03_location_recovery_test.dart` timed out in `pumpAndSettle` during an indeterminate load.
- `flutter analyze` found six `prefer_const_constructors` info diagnostics in a PageStorage test fixture.

## Root-cause assessment and repairs

- The district picker consumed remote assets directly but reported all network, schema, and disk failures with one generic message; without API-provided CloudFront delivery metadata it had no alternate download path. Added automatic load and a Fastify fallback that validates against the canonical published checksums. Network readiness and misconfigured `ULUV_GEO_*` env variables **cannot be inferred from source**; the acceptance runbook verifies both.
- Removed the extra button. The dropdown `onChanged` initiates loading immediately and shows progress, cancel, and error-only retry. Preserved offline fallback and cache integrity. Verified-current-pack gating prevents saving a stale pack under the current version.
- Replaced the brittle GPS test's raw-coordinate-substring assertions with structural checks against actual H3 cell-centre coordinates and absence of raw fix metadata.
- Widget recovery test uses bounded pumps and an injected temporary cache path; a new real-production-fixture widget test exercises automatic download via API fallback. Both require the owner's Flutter SDK to verify.
- Converted PageStorage test fixture's widget tree to transitive `const` to address analyzer infos.

## Executed here

| Test | Result |
|---|---|
| `npm run test:p03:district-autoload:contracts` | PASS 4/4 |
| `node --experimental-strip-types --test apps/api/tests/unit/p03-district-fallback.test.ts` | PASS 2/2 (real immutable pack; tampering / 404 / traversal rejection) |
| `npm run test:p03:location-repair:contracts` | PASS 4/4 |
| `npm run test:p03:gps:contracts` | PASS 3/3 |
| `npm run test:p03:gps:unit` | PASS 3/3 |
| `npm run verify:p02-5:portable` | PASS |
| Published 798 packs verified against manifest using source ZIP | PASS, zero schema/provenance/checksum mismatches |
| Full dependency install / TypeScript typecheck | UNVERIFIED — npm install timed out in this environment |
| Flutter analyze/widget tests | UNVERIFIED — no Flutter SDK |
| Live Fastify/DynamoDB/CloudFront and moto g04s | UNVERIFIED — no attached live services/device |

## Security and scope

- The public India GeoNames source data remains in **one existing S3 bucket**. No new AWS service, ACL, data migration or paid API.
- All HTTP fallbacks are authenticated and source-verified; GPS boundary stays bundled in Fastify and GPS privacy rules remain unchanged.
- No private account records are ever cached in public geographic packs; no raw GPS data is saved.
- PIN lookup remains on hold.
- The code update is an **update-only delta**, not a full repository and not a guarantee that every unobserved device/network condition is fixed.
