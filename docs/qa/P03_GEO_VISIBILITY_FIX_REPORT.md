# P03 Geo Location Visibility + Logging — Implementation and QA

**Date:** 2026-11-17

## Reported issues and root causes

1. **Place list stayed open:** `IndiaLocationPanel` kept rendering the full `ListView.builder` even after `selectedPlace` had been assigned. It also left the outer Settings `ExpansionTile` open after the API's 200 save. Solution: `showPlaceResults=false` on tap, selected preview + Change action, notify parent **only after** valid server acknowledgment, and collapse `ExpansionTileController`.
2. **Initial never-ending spinner perception:** `_init()` set `initializing=true` while it sequentially fetched from API/CDN and loaded account data, and showed an indeterminate progress indicator even before a district was requested. Solution: remove the unconditional initial animation. The Settings tile defers inner widget mounting until first expand; account summary loads independently in the collapsed tile. Discovery-preferences bootstrap has text instead of an endless-looking loader.
3. **Saved selection not visible:** `GET /v1/me/geo/location` was performed only inside expanded `IndiaLocationPanel`; collapsed Settings subtitle was static and did not reflect successful saves. Solution: independent, authenticated GET on tile mount/expand; confirmed save immediately updates the tile header; stale pending GETs cannot overwrite a new confirmed save; GET is performed again after app remount. The backend already performs a DynamoDB consistent read.
4. **Backend raw JSON logs:** Fastify's local logger was in the default Pino JSON format, with duplicate incoming/completed logs. Solution: use existing local-dev `pino-pretty` transport; keep JSON in non-local environments; log clean `[API]` request results and `[GEO]` asset events. Added privacy-safe server read/write commit traces.
5. **Windows-only cloud contract ENOENT:** `new URL(...).pathname` produced a leading slash for a Windows drive, causing `C:\C:\...` in `path.join`. Solution: `fileURLToPath()`.

## Verification performed in container

- `npm run verify:p03:geo-visibility:portable`: **PASS**, including source tests, previous API diagnostic tests, district autoload, saved-location contract, CloudFront source contracts, secrets/cloud safety checks, and GPS boundary tests.
- Direct `node --test scripts/verify/p03-geo-cloud-source-contracts.test.mjs`: **PASS** (4/4).
- Direct `node --test scripts/verify/p03-geo-visibility-contracts.test.mjs`: **PASS** (4/4).
- Source package ZIP integrity and update-only path test: see packaging report.

## Not verified in this environment

- Flutter analyzer and compilation, `flutter test` widget test runtime (Flutter SDK not installed).
- Full TypeScript typecheck/API integration (NPM dependencies unavailable offline; `npm ci --offline` fails on uncached `h3-js`).
- DynamoDB Local transaction after actual auth, CDN availability from owner's Android network, and moto g04s interaction.

**QA policy:** Features are coded but must pass Windows+device acceptance in `docs/manual/P03_GEO_SAVED_LOCATION_WINDOWS_ACCEPTANCE.md` before declaring the user-reported problem resolved.
