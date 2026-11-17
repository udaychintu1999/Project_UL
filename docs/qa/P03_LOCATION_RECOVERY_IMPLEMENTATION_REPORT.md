# P03 Location recovery — implementation and verification

## User-reported regressions

1. Only GPS appeared; manual State → District → Village/Town was hidden behind `if (manifest != null)` whenever the CloudFront delivery bootstrap failed. No bundled bootstrap was available on first run.
2. The saved location read was nested in the successful manifest-fetch path. On a CDN outage, the client never attempted to get saved `/v1/me/geo/location`, producing a misleading empty UI despite server-side persistence existing.
3. `OneTimeGpsPanel` captured a fix and required a separate Confirm button, contrary to the product's preferred one-tap GPS save flow.

## Changes

- Added verified 175,054-byte public manifest bootstrap to Flutter assets; `sha256=97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887`. It matches the already delivered S3 public `manifest.json`; it is **only an index** (State/District metadata, counts and public pack SHA-256), not the actual large village/town data.
- Detached private saved-location fetch from catalogue loading; require account revision and show an explicit failure state rather than silent disappearance. On successful manual/GPS save, update label and source locally, and re-read from account when the panel is recreated.
- Automated GPS request/save after the sole action button, preserving Android explicit permission, one-time fix, optimistic revision, server-authorized India boundary check and H3-only storage. No local raw GPS persistence.
- New widget recovery test and updated one-tap GPS widget tests. Preserved PIN hold and unique PageStorage keys.

## Commands executed and results

| Command | Result |
| --- | --- |
| `npm run test:p03:location-repair:contracts` | PASS (4) |
| `npm run test:p03:gps:contracts` | PASS (3) |
| `npm run test:p03:gps:unit` | PASS (3) |
| `npm run test:p03:cloud-contracts` | PASS (4) |
| `npm run verify:p02-5:portable` | PASS |
| Flutter analyze + widget tests | UNVERIFIED (no Flutter SDK in this environment) |
| `npm run typecheck` + live integration | UNVERIFIED (workspace deps / live services absent) |
| Android device relaunch and persistence E2E | UNVERIFIED |

## Scope and limitations

All source edits are relative to the previously supplied P02-5 + P03 OneBucket + P03 GPS code overlay. Owner's separately developed later P03 Settings/Gate-5 sources were not available for a merge. Apply cautiously and reconcile differences. The CloudFront catalogue must still be configured and reachable for online village/town downloads and manual saves. No S3 data upload, backend storage schema change, new paid API, or location-tracking feature has been introduced.
