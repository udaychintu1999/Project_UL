# India boundary for one-time GPS coverage

- File: `india-boundary.geojson` (1,362,454 bytes)
- Original input: `geoBoundaries-IND-ADM1_simplified.geojson` (India ADM1)
- Derivation: geometric union of the 36 ADM1 polygons, removing internal state borders **without further exterior simplification**.
- Dataset: geoBoundaries / DataMeet India community (refer to original geoBoundaries metadata).
- Licence stated for this source snapshot: CC BY 2.5 India; verify official attribution terms on redistribution.
- Source and terms: https://www.geoboundaries.org/api/current/gbOpen/IND/ADM1/ and https://creativecommons.org/licenses/by/2.5/in/
- Geographic accuracy: already simplified upstream, not legal border evidence. Near coastline or international boundaries may be inaccurate. Do not use to verify residence or citizenship.
- Bundle is only public geographic reference data; never record a person's raw GPS fix in logs or public GeoJSON.
- SHA-256 (verified in source, checked on every backend startup): `b1af3edb4f806a1b787ff61e366cfae15b14407bda4c131dbff914193f1a65f8`

**Acceptance:** Coordinate fixtures for Hyderabad, Mumbai, Delhi, Port Blair and Kavaratti should pass; London, Kathmandu and Colombo should fail. Field-test coastal/border GPS fixes with actual device accuracy; reject uncertain results and offer manual selection. GPS is optional and not background tracking.
