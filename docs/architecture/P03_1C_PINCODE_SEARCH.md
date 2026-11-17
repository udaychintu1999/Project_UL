# U_luv P03-1C — India postal PIN code lookup (foundation only)

**Status: SOURCE IMPLEMENTED / PARTIALLY VERIFIED. No owner acceptance. P03 remains open.**

## Source and separation of concerns

The GeoNames `IN.txt` file contains settlements and administrative records **not postal PIN assignments**. Therefore PIN/office data must be sourced separately from the **Department of Posts — All India Pincode Directory**, published via https://data.gov.in/resource/all-india-pincode-directory-till-last-month (Government Open Data License - India). Actual snapshot provenance, date, SHA, row/office/PIN counts are recorded by the local builder; do not cite unverified counts. Data from a third-party mirror may be outdated/transformed and needs independent licensing/provenance review before redistribution.

Never invent a PIN→GeoNames place-ID mapping or assume a PIN is a unique point or radius. One PIN may identify many post offices or districts. PIN search only supplies postal state/district/office suggestions. User must confirm a **real GeoNames locality** and perform the existing authenticated `/v1/me/geo/manual` save. This keeps H3 R6 authority in P03-1B. Profile visibility remains `discoveryEnabled=false` and no new `uluv_discovery` pointers are created. No paid geocoding, Google Maps, external runtime PIN API, additional DynamoDB table or cloud operation.

## Import and storage

Owner supplies a UTF-8 CSV with `pincode`, `officename`, `districtname`, `statename` (capitalization/spaces variants tolerated), optionally `officetype` and `deliverystatus`. Required fields are strictly checked, PINs are exactly six digits, names are bounded and Unicode-normalized, exact duplicate office records collapse, and arbitrary additional columns (including coordinates) are excluded. The Python importer produces deterministic **plain JSON** **an external owner-installed postal-data directory** (`ULUV_PIN_PRIVATE_DIR/manifest.json`), `prefixes/500.json`, etc. Each pack represents a three-digit PIN prefix, contains all eligible post offices for each PIN, and is individually SHA-256/byte/row-count verified. Import fails without a real CSV; no fake data is published.

`manifest.json` records `sourceSha256`, `sourceBytes`, `sourceDate`, original source URL, version `PIN-<source-hash-prefix>`, distinct PINs and accepted/duplicate rows. `attribution.json` retains the government source and transformation notice. This dataset is NOT added to Android APK and never contains account/user information. For a new postal CSV snapshot, build in a new temporary target, verify, stop the local API, rename the old `v1` directory to an owner-retained backup, then rename the new verified directory to `v1` and restart API. Never overwrite a working catalogue in place or delete the only valid copy.

## API contract

`GET /v1/geo/india/pincodes/:pin` — authenticated owner session, strict `^[1-9][0-9]{5}$` PIN, `Cache-Control: no-store`. The API loads only a manifest-allowlisted prefix pack, verifies SHA before parsing, maintains bounded in-memory prefix cache, and returns up to 100 office records (with `totalOffices` and `truncated`), never coordinates, profile data, H3 or user-linked data.

Success shape:

```json
{
  "pin": "500001",
  "version": "PIN-<actual-source-hash-prefix>",
  "source": "Department of Posts — All India PIN Code Directory",
  "totalOffices": 2,
  "truncated": false,
  "offices": [
    {"office":"<actual office>","district":"<actual district>","state":"<actual state>","officeType":"<type>","delivery":"<delivery>"}
  ],
  "requiresManualPlaceConfirmation": true,
  "discoveryEnabled": false
}
```

The record count and office names above are illustrative; tests use synthetic records only. Errors: `400 invalid_india_pin`, `401/403 inherited auth`, `404 india_pin_not_found`, `503 india_pincode_catalogue_unavailable`. No mutation, no new GPS validation, no unreviewed postal-code geocoding, no public exposure.

## Flutter behavior

The existing P03-1B `IndiaLocationPanel` gets an integrated six-digit PIN search and postal-office result picker. Input is digits-only/length-six; lookup occurs only on explicit Search or keyboard submit. Selecting a postal office *suggests* the associated state/district only if uniquely matched to GeoNames display names. User must download/select a place from the authoritative district pack and press the existing `Save selected location` button. Failed/ambiguous matches fall back to existing manual State→District selection. Offline/API failure never claims a completed PIN or locality save.

GPS remains disabled/fail-closed until the separate licensed India boundary geometry and tests are provided; PINs cannot substitute for that boundary. P03-2 geographic discovery and P03-3 publication remain out of scope.

## Merge safety

This delivery is **additive** because the current user-committed P03-1B tree was not attached. `scripts/geo/apply_p031c.mjs --check/--apply` validates that P03-1B is present before changing only the central API route registrar, P03-1B IndiaLocationPanel, and npm scripts. Do not use it on the older P02-5 source or on a project where P03-1B tests are failing. Full P02-5/P03-1/P03-1B regressions remain owner-required.

**2026-11-17 CDN note:** Postal data is separate from GeoNames public S3 packs. The source ZIP contains no postal directory, and no India Post CSV was provided. The PIN importer now requires an explicitly supplied `--out` folder outside Git; Fastify reads it from `ULUV_PIN_PRIVATE_DIR` only.
