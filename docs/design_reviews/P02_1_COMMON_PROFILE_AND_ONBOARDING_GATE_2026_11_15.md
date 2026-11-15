# P02-1 Continuation — Shared Profile, Mode Choice and Setup Gate (2026-11-15)

## Owner request and approved intent

Following owner-reported successful manual testing of the two-tab Home/Settings interface, the owner requested a **single common profile**, explicit **Enable Dating** / **Enable Friendship** choices, and a requirement to **save the common fields plus at least one selected, completed mode** before proceeding beyond onboarding. The real matchmaking/discovery Home is a later phase. This continuation is actual local source implementation, not P02-2 photo storage or P03 discovery.

### Distinguish three concepts

1. **Selected/enabled for onboarding:** Boolean intent stored in `uluv_settings.selectedModes.{dating,friendship}`. Both may be false while an incomplete setup is saved; continuation is then blocked.
2. **Onboarding ready:** Server-derived `onboarding.ready` for the authenticated owner, not a user-provided flag. The gate requires a saved `@handle`, `commonName`, broad self-declared `locality`, at least one selected mode, and a persisted draft with bio, intention, interests and an effective display name for **each selected mode**. Age must be derivable from the existing self-declared adult DOB.
3. **Discovery active/eligible:** **Not implemented.** This requires 2–6 valid photos, explicit mode-specific activation, trusted locality, moderation and P02-3 visibility conditions. Onboarding-ready **never** means discoverable, and `requestedActive` remains false.

## Data ownership and persistence

- `uluv_users USER#uid/META`: unchanged immutable `uniqueId`, immutable signup `birthDate`, existing account-level `handle`/revision. Age is calculated on the backend at the UTC date boundary and DOB is never returned.
- `uluv_settings USER#uid/SETTINGS`: additive `commonName`, `gender` (optional private enum), `localityLabel` (user-declared city name only), `selectedModes` (two booleans) and monotonic `setupRevision`. Existing `privacyDefault` and unrelated settings are preserved.
- `uluv_profiles USER#uid/MODE#DATING` and `.../MODE#FRIENDSHIP`: independent versioned draft bio, intention, interests, optional display-name override and later photos. An empty mode display name inherits the common name **when resolving the effective name**, without overwriting an existing mode-specific name. Old saved mode names remain untouched. The Flutter common-name input may suggest a previously saved mode name once when `setupRevision == 0`; the owner must explicitly save it.
- No new table, GSI, migration destructive to previous mode drafts, cloud API or paid dependency.

### PUT `/v1/profiles/me/setup`

Auth: existing P01 verified session guard, no parallel auth. JSON request:

```json
{
  "expectedRevision": 0,
  "commonName": "Example",
  "locality": "Hyderabad",
  "gender": "prefer_not_to_say",
  "selectedModes": {"dating": true, "friendship": false}
}
```

- Values are sanitized on the server; any unexpected key or user identity override is rejected. Handle is saved separately through the existing atomic alias endpoint.
- `commonName` is up to 60 Unicode code points; may be temporarily empty while drafting.
- `locality` is a **2–60-character broad self-declared city label** containing letters, spaces, apostrophes or hyphens, not a full street address, phone, coordinate or postal code. It is not geocoded, verified, publicly released or acceptable as P02-3 trusted H3 locality. Global city/catalog selection is deferred to trusted-locality work.
- `gender` is optional/private: `"" | woman | man | non_binary | another_identity | prefer_not_to_say`; it does not influence visibility, eligibility or matchmaking and is not automatically part of public previews.
- `selectedModes` is exactly two real booleans, no arbitrary attributes.
- The write is an account-authorized, atomic transaction that checks active/self-declared-adult account eligibility and version-CAS on the existing Settings record. A stale version returns 409; a restricted account returns 403; store failures return 503.
- Response is the updated `GET /v1/profiles/me` owner dashboard including **private** shared fields, `onboarding.ready`, and `onboarding.missing` reasons. All responses use `Cache-Control: no-store`.

### GET `/v1/profiles/me` additions

```json
{
  "shared": {
    "commonName": "Example",
    "locality": "Hyderabad",
    "localitySource": "self_declared",
    "gender": "prefer_not_to_say",
    "age": 26,
    "selectedModes": {"dating": true, "friendship": false},
    "setupRevision": 1
  },
  "onboarding": {"ready": false, "missing": ["dating.draft"]}
}
```

Example only; existing `handle`, revisions and `profiles` remain. `age` depends on the account DOB/date, never client input. No private UID, email, DOB, coordinates or exact address are returned. `effectiveDisplayName` is added to owner-mode DTOs without removing the prior raw `displayName`.

## UX implementation and failure behavior

1. **Common profile:** Save one account handle, name, broad city/locality, optional gender. Read-only calculated age.
2. **Mode choice:** Persist explicit Dating/Friendship switches; users can select either or both. Editing a disabled mode is allowed as a private draft but does not make it count toward onboarding.
3. **Mode details:** Save name override (optional), bio, intention and at least one interest for each selected mode. The existing versioned draft endpoint and duplicate/contact guards remain.
4. **Continue:** Enabled **only after the backend confirms saved setup ready** and no current form has unsaved edits. If both modes are selected, both must have valid saved details. Disabling all modes re-locks continuation, but never deletes drafts.
5. **After continue:** Display an honest **setup-ready placeholder**, with an Edit button. Do not invent discovery feeds, activation, matching, photo uploads or a production home UI. On reopening a session with verified `onboarding.ready`, return to the placeholder; otherwise show the setup form.
6. **Settings:** Existing password/device/logout functions remain accessible even before onboarding completes. This is necessary for account security and recovery and is not the later discovery Home.

## Important follow-ups for P02-2/P02-3/P03

- Two photos and explicit activation are **not** waived by onboarding readiness. Do not use `selectedModes` as the discovery `requestedActive` flag.
- Since broad city text is unverified, `completeness.ready` for discovery remains false in P02-1 even if other fields are filled. Implement a trusted locality ID/catalog + authorized H3 cell derivation before any public discoverability.
- Never publish `shared.gender` automatically. Revisit public/intent/choice fields and safety policy in subsequent phase review.
- Setup-edit conflict resolution is explicit 409 + reload; no silent overwrite. A lost response is not treated as a confirmed write.
- No production AWS/DEV AWS API calls or S3 adapter activation are authorized by this continuation.
