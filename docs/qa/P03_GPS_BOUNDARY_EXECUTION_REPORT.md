# U_luv — P03 GPS + Settings-crash QA report

Scope: change-only patch against previous OneBucket P03 Geo source update. Source fixture is the owner-provided optimized ADM1-union GeoJSON; source SHA pinned in server code. Frozen P02-5 behavior remains in inherited repo.

| Gate | Result in generation environment | Evidence / notes |
|---|---|---|
| Optimized India GeoJSON present, exact pinned source hash | PASS | 1,362,454 bytes, SHA-256 `b1af3edb4f806a1b787ff61e366cfae15b14407bda4c131dbff914193f1a65f8` |
| Country polygon mainland/island/outside fixtures | PASS | `npm run test:p03:gps:unit`; coastline ambiguity documented |
| Tampered/missing boundary fails closed | PASS | unit source integrity tests |
| Geometric algorithm cross-check | PASS | 500 seeded random points matched independent Shapely polygon coverage, zero mismatches |
| One-time GPS payload finite/accuracy/age/revision validation | PASS | unit tests |
| No background permission; separate GPS capture & save; PIN on hold | PASS | static source contracts; Flutter widget tests **not** executed |
| Scroll PageStorage key paths isolated | PASS source inspection | Physical reproduction/regression on moto g04s **UNVERIFIED** |
| Existing P02-5 portable regressions | PASS | `npm run verify:p02-5:portable` exit 0 |
| New Fastify TypeScript syntax transpile | PASS | TypeScript transpile API, not full typecheck |
| Fastify GPS injection test | UNVERIFIED | `npm run test:p03:gps:api` depends on unavailable npm dependencies |
| Full npm installation/typecheck | UNVERIFIED | package installation timed out in runtime |
| Flutter analyzer/widget tests / geolocator Android compile | UNVERIFIED | Flutter SDK absent |
| Live DynamoDB Local / handset GPS / scroll crash regression | UNVERIFIED | Owner Windows/physical Android required |
| Live CloudFront or real AWS | UNVERIFIED | No remote calls made or authorized |

**Known limitations:** owner-reported `bool` as `double?` restoration crash is addressed by PageStorage key separation and unmounting the PIN view. No real device reproduction was possible here. Simplified geoBoundaries ADM1 union may misclassify coastal/border points; tested overseas and interior fixtures are not complete coverage proof. Permission and precision on moto g04s need direct observation. GPS fixes are self-declared/device-reported, not residence proof. P03 is not yet accepted/completed.
