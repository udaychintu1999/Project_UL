# P03-1 + P03-2 — Current automated acceptance evidence

**Updated 18 Nov 2026.** Canonical maintenance guide: [`../p03/04_ACCEPTANCE_AND_RELEASE_GATES.md`](../p03/04_ACCEPTANCE_AND_RELEASE_GATES.md). Do not confuse isolated device fixtures with a real logged-in owner or physical GPS.

## Owner-confirmed local automated acceptance — P03-1/P03-2 (18 November 2026)

**Decision:** **OWNER-ACCEPTED for local automated development only**. The post-update physical-device suite is **7/7 PASS**; original combined **11/11 PASS (twice)** predates the expanded device/recovery patch. No public discovery, native GPS acceptance, live CloudFront or production release is implied.

The owner supplied Windows PowerShell logs showing `npm run verify:p03:acceptance` **11/11 passing twice**. The portable chain passed **15/15**; backend/application and strict test TypeScript + lint passed; real local Fastify/DynamoDB fixture tests passed; Flutter analyzer and **81/81** widget tests passed; the original **3/3** physical Android integration tests passed. This confirms the preceding P03-1/P03-2 **automated** acceptance baseline, not public discovery or production approval.

### Coverage and remaining boundary

| Surface | Backend/local/UI proof | Separate real-device proof needed |
| --- | --- | --- |
| P03-1 CDN release, trust pins and fallback | Real checksum/source/failure-path test suites, bundle asset pin tests | Owner's live CloudFront/OAC behavior on approved release |
| Manual location save/read | Real conditional DynamoDB Local Fastify test, 409/cooldown/invalid input | User’s normal app manual selection, force-stop/reopen and server persistence |
| One-time GPS | Server boundary/validation tests and original mocked Android tap | Actual OS permission dialogues, hardware accuracy and borderline geolocation |
| Settings and five tabs | Source contracts, Flutter widgets and original Android taps | Normal app across signed-in profile states, accessibility |
| H3 R6 discovery query foundation | Real `h3-js`, cursor mutation, per-page limits and DynamoDB Local PK Query | No public UI exists by design |

## Expanded isolated Android gates — 7/7 owner-reported PASS

The same `test:flutter:p03:e2e` runner now registers **7** named scenarios: the old 3 and 4 new complete-journey/error paths. A test-only `HttpServer` on loopback requires a synthetic bearer; the production Flutter widgets perform actual authenticated GET/PUT on that fixture, verify the *exact* published 5,908-byte Nicobar pack, update across tabs, remount/re-read, handle 409 + 429 and outage retry. This does **not** replace native GPS or real Fastify P01 session integration. The owner subsequently ran this command on a physical Android handset and provided a console log ending **`00:24 +7: All tests passed!`** after recovering missing source files; Flutter analyzer separately reported **`No issues found!`**. This confirms **7/7 device fixture scenarios**, not hardware GPS, live CDN, real Fastify/P01 login, or OS force-stop. The earlier full 11/11 was executed before the final seven-test update; a fresh **combined** 11/11 run remains pending.

**Commands:** `npm run test:p03:acceptance:plan` → `npm run test:p03:acceptance:types` → `npm run test:p03:acceptance:flutter-analyze` → `npm run test:flutter:p03:e2e` → `npm run verify:p03:acceptance`. Real Java DynamoDB Local (18 tables) and live loopback Fastify required for the last command, as before.

Stop on any gate failure; report actual test name/exit code, never modify existing source contracts to make a test pass, and rerun full verification after fixing a defect. Only exact synthetic records are cleaned up; existing P01/P02 profile/auth behavior is frozen.
