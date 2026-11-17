# P03-2 — Windows + moto g04s acceptance (infrastructure-only)

Run from `C:\Dump\Projects\Project-ULuv-Space`, or your own checked-out project root. Use Windows 10 PowerShell. **No real AWS call or `.env` contents should be displayed or sent to an AI.**

## Setup

1. Apply the update-only ZIP **to the exact latest source checkout**. It does not contain `node_modules`, geography data, cloud credentials or generated builds.
2. Ensure Java DynamoDB Local is running manually on loopback, with the existing 18 tables and sentinel already provisioned. Do not start Docker or AWS automatically for this phase.
3. Keep `apps/api/.env` privately configured from previous P00/P01/P03 work (do not paste it into chats). Install project deps normally using `npm ci` as needed.

## Required automated gates

```powershell
npm ci
npm run verify:p03-2:portable
npm run typecheck
npm run lint
npm run test:p03:gps:api
npm run test:flutter
npm run test:p03-2:integration
```

Or use `npm run verify:p03-2` for the combined gate. **Each individual result must be recorded**; don't mark a group PASS if any command fails. If local DynamoDB is unavailable, the integration gate is UNVERIFIED, not passed.

## API and privacy inspection

- Verify no new `/v1/discovery` route is live and no `uluv_discovery` pointer is published just by saving a location or activating a profile.
- Run `npm run dev:api`; existing GeoNames, GPS and settings API logs must remain readable and secrets/coordinates absent.
- Verify that `uluv_settings` still stores approved R6 cell center and revision; phone GPS coordinates must not be stored as raw fix.
- New synthetic DynamoDB Local test must query only the expected `DISC#DATING#R6#...` partition, never Scan, and delete its five fixture rows.
- Test stale/tampered cross-user/page/filter/locality cursor rejection and boundary-cell coverage (including islands). The unit suite contains fixed cases.
- On the moto g04s, confirm **Dating, Friendship, Local Feed & Activities, Connects, Settings** remain in that order for completed profiles; incomplete profiles retain Dating/setup + Settings.
- In Settings, confirm saved manual or GPS location survives force-close/reopen. No new discovery UI should unexpectedly expose other people.
- Decline GPS permission and manually select a location: the preexisting fallback must still work.

## Fail/recovery and measurement

If a gate fails, preserve the failing command, test name, safe request ID and sanitized error *code*; never paste credentials, tokens, raw GPS, user IDs or complete `.env`. No claim of full verification until typecheck, unit, lint, Java DynamoDB Local and Flutter/device checks are green. No CloudFront upload needed for P03-2.
