# U_luv — P03 pre-discovery authenticated shell, location gate, settings

**Decision date:** 2026-11-17. **Phase:** P03-1 cleanup before P03-2. **Status:** implementation authored; full Windows/Flutter/physical device verification pending. **Do not** read this as authorization to publish public discovery data.

## Product decisions

- A newly authenticated account with **server-confirmed incomplete onboarding** has exactly two bottom destinations: **Home** (guided profile setup) and **Settings** (essential security/location tools).
- An authenticated account with `GET /v1/profiles/me` returning `onboarding.ready == true` has exactly five destinations, in order: **Home**, **Dating**, **Friendship**, **Local Feed**, **Settings**. This is a saved-state decision, never based on draft text, local app flags, or locally cached profile fields.
- `onboarding.ready` comes from Fastify's saved common profile, selected mode and existing per-mode readiness checks, including required saved photos. It is not the same as `SharedProfile.locality`, which is self-declared, and is not the same as **verified location** from `/v1/me/geo/location`.
- A returning complete account sees **Checking your saved profile** and no bottom navigation until the authoritative response; it does **not** flash the blank wizard or show an incorrect two-tab state. Complete accounts land on a summary and can deliberately select **Edit profile details**. This keeps P02 Save & Next, edits, private preview and activation requests intact.
- The Dating, Friendship and Local Feed tabs are **shells**, not live feeds. Each tab reads private account location only when opened or when the account's saved-location generation changes. If the server explicitly confirms no location, show the prompt **We need your location to get started** with **Use GPS** and **Manual selection**.
- **Use GPS** invokes the existing one-shot permission/fix/backend-save path. **Manual selection** opens a bottom sheet containing the already-verified State → District → Village/Town picker, with the duplicate GPS control hidden. Only a server-confirmed save removes the prompt. A failed/unauthenticated GET shows **Retry**, not an incorrect "no location" state.
- Once location exists, the tab shows the stored approximate-area label and a truthful not-yet-implemented message. No people, posts, location ranking, H3 queries, discovery publication or fake data is returned by this change.
- Settings has two states. **Pre profile:** password configuration/change, location, signed-in devices, logout. **Post profile:** adds a grouped base for Profile & modes, Location & discovery, future notifications/privacy/visibility; existing security controls remain active. Future actions are labelled **future** as text rather than fake buttons.
- Incomplete owner profiles stay private; no auto-profile activation, media publication, direct CDN token forwarding or GPS permission on tab launch.

## State and screen ownership

| Component | Owned responsibility |
| --- | --- |
| `persistent_gate.dart` | P01-3 Keystore-backed session; wires repository, API origin, token supplier; removes account tree on signout |
| `auth_screen.dart` | Server-reported profile completion controls 2/5 tabs; remaps Settings 1 ↔ 4 on completion transitions; refresh generation for geo tabs; authenticated settings actions |
| `account_navigation.dart` | Mounted bottom-bar surfaces and IndexedStack, retaining unsaved Home edits across tab switching |
| `profile_workspace.dart` | Authenticated `GET /v1/profiles/me`, private onboarding wizard or saved owner summary, revisioned writes and status-refresh callback |
| `discovery_location_gate.dart` | Read-only private saved-location check, empty-location GPS/manual gateway and truthful future-phase placeholder |
| `india_location.dart` | SHA-verified State/District/place pack picker, local cache and authenticated manual save; `showGps=false` inside manual sheet |
| `gps_location.dart` | One-shot Android GPS + existing Fastify boundary/H3 save; compact button presentation for the discovery tab |
| `geo_settings_panel.dart` | Collapsible location editor, independent saved-label read, callback on confirmed save; hides future distance preferences in pre-profile Settings |

## Authoritative API and storage paths

- `GET /v1/profiles/me` → complete/incomplete **from the backend**. No new endpoint or migration.
- `GET /v1/me/geo/location` → `settingsRevision`, nullable `location` with display `name`. Authenticated. A nullable `location` means the account needs location setup; **network failures do not**.
- `PUT /v1/me/geo/manual` → selected GeoNames ID, version, state/district and revision. Fastify validates against pinned canonical S3/CloudFront index and persists private H3 R6 home center in DynamoDB `uluv_settings`.
- `POST /v1/me/geo/gps` → only on explicit tap. Fastify validates bundled `india-boundary.geojson`, fresh/accurate coordinates, revision and cooldown; persists approximate H3 R6, not raw fix.
- GeoNames catalogue remains in one S3 bucket under `geo/india/v1/`; bundled Flutter manifest is small metadata only, with district packs fetched, verified and cached on demand. Country boundary stays in the API codebase, not S3. PIN-code search remains on hold.
- Existing server-side `discoveryEligible` flags continue **false**, no `uluv_discovery` publication or scanning in this patch.

## Navigation transitions and privacy invariants

1. Authenticate: no profile form is shown until `GET /v1/profiles/me` resolves. If the fetch fails, show a retry in Home; do not guess that the owner is new or complete.
2. Incomplete profile: Home wizard, Settings at tab 1. When a verified save/read reports `onboarding.ready`, expand to five tabs. If Settings is open, retain Settings by remapping 1 → 4.
3. Complete profile: Home saved summary; the owner may choose Edit profile details. When a later verified response reports incomplete status, collapse to two tabs and move from a discovery page to Home, or remap Settings 4 → 1.
4. On discovery-tab activation, read saved location with current P01-3 auth. If null, prompt GPS/manual; if present, show it without the setup controls.
5. On a confirmed location save, locally show the server label and increase a refresh generation. Other tabs reread when activated and the Settings header receives the same refresh generation; no account label survives sign-out because the authenticated tree is disposed.
6. No automatic device GPS permission, raw GPS persistence, public discovery API, or background location collection.

## Deferred to P03-2 and later

H3 geographic query planning, discovery pointer management, eligibility publication, mode filtering, distance-band query APIs, paginated results and real Dating/Friendship/Local Feed content. Their existing contracts stay gated and do **not** become active merely because a five-tab shell is present.

## Verification

Portable gate: `npm run verify:p03:pre-discovery:portable`.
Full Windows gate (from repository root): `npm run verify:p03:pre-discovery`. This additionally requires TypeScript typechecking, real GPS API tests and the entire Flutter analyzer/widget suite. It does not substitute for the authenticated Android manual tests in `docs/manual/P03_PRE_DISCOVERY_NAVIGATION_WINDOWS_ACCEPTANCE.md`.
