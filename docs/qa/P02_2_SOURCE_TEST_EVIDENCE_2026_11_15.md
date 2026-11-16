# P02-2 — Source and Test Evidence

**Source baseline:** Reconstructed latest available P02-1 V4 by applying the uploaded Project master ZIP and prior P02-0/P02-1 update ZIPs in chronological order. This authoring environment cannot read the owner's current Windows working tree directly. Only changed project-relative source files and full `docs/` are delivered.

## Execution evidence in authoring environment

- `node --experimental-strip-types --test apps/api/tests/unit/p02-2-media-policy.test.ts` — **PASS (3/3)**.
- `node --test scripts/verify/p02-2-contracts.test.mjs` — **PASS (4/4)**.
- `npm run verify:p02-2:portable` — **PASS** (includes P01/P02-1 source regression chain and new P02-2 guards; all existing suites executed).
- Offline actual Sharp image processing smoke: converted real PNG bytes to private JPEG, verified no EXIF, re-read after store reconstruction, deleted — **PASS**. Executed through temporary TypeScript transpilation with the installed global Sharp runtime, not the project's npm install. Dedicated `npm run test:p02-2:store` now makes this reproducible on Windows.
- `node --check` for new JS runners — **PASS**.
- Packaging and scan results — record after final ZIP verification.

## Unverified gates

- `npm ci` on Windows with Sharp optional Windows native package — **UNVERIFIED here** (registry network inaccessible in this environment).
- TypeScript semantic `npm run typecheck` and `npm run lint` with project node_modules — **UNVERIFIED here**.
- `npm run test:p02-2:store` from installed project dependencies — **UNVERIFIED here** (smoke above uses global Sharp and temporary TS translation).
- `npm run test:flutter` / actual native Android picker — **UNVERIFIED here** (Flutter SDK not present).
- `npm run test:p02-2:integration` with running local Fastify/Java DynamoDB — **UNVERIFIED here**.
- `npm run test:flutter:p02-2:e2e` on physical Android — **UNVERIFIED here**.

## Security and scope

No AWS calls, real email or payment operations. Neither real user data nor private `.env` files were read, copied or packaged. Existing P01 persistent-session design was not modified. New photo data are always private, owner-authenticated and inactive for discovery. Production-grade quotas, periodic garbage collection and media moderation remain future requirements, not silently claimed as implemented.
