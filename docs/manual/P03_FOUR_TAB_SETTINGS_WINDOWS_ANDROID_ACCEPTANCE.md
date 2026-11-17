# P03 owner check — five tabs, saved profile in Settings, concise location editor

**Apply target:** Latest P03-1 owner-accepted repository. Apply changed-files-only ZIP without overwriting unreviewed newer local edits. No `.env`, S3 data, or DynamoDB migration. PIN feature stays on hold.

## Automated gates (PowerShell, project root)

**Preflight:** The previous P03 source test incorrectly required a deleted P02 design-review file. That historical filename assertion was removed; the updated test checks current P03 docs and the real P02 profile route instead. Do not recreate P02 files. This is a code+P03-doc navigation correction, not a docs-only release.


```powershell
npm run verify:p03:navigation-docs
npm run verify:p03:navigation-docs:full
```

The first gate is portable in Node and confirms source-architecture/API/docs contracts and selected earlier regressions. The **full** gate additionally runs TypeScript typecheck, GPS API test, Flutter analyzer and **Flutter widget suite**; it requires the local Flutter SDK and Node dependencies. If a required step fails, stop: do not install on Android yet.

Run app with your usual local DynamoDB Local service (manually started) and two terminals:

```powershell
npm run dev:api
npm run dev:flutter
```

## Functional acceptance on moto g04s

1. **Returning completed account:** force-stop, relaunch, restore session. No blank setup screen, no Home destination. Exactly **Dating, Friendship, Local Feed, Connects, Settings** bottom options, Dating selected first.
2. **Dating without saved location:** show GPS/Manual setup only after the authenticated `/v1/me/geo/location` confirms null; if GET fails show Retry instead of assuming null. With saved location, show the saved area, not setup buttons. No public dating cards yet.
3. **Friendship:** separate second bottom tab, no Local Feed/Activities sections. It retains owner-only location gating.
4. **Local Feed:** third bottom tab, with **Local Feed · Activities** two-way section control. Confirm both modes switch correctly, require GPS/Manual only when the authenticated location is absent, and show no fake feed/activity data or public discovery yet.
5. **Connects:** safe future-phase placeholder only; no mock chat/matches or public user data.
6. **Settings, completed profile:** first section shows actual saved name and handle and **Edit**; Profiles & visibility expands to existing Dating/Friendship activation request and owner preview actions. Edit opens existing P02 wizard, preserves photos/drafts and Save & Next. Verify server dashboard changes still drive ready/incomplete tab mode.
7. **Settings, incomplete profile:** only password, devices, location and logout; Dating shows guided P02 onboarding. Completed-only profiles/visibility and unsupported settings actions are absent.
8. **Location & discovery:** one expandable row, not an always-open long form. Saved area in subtitle, short picker when expanded, State/District automatically loads places, selection closes place list, save collapses Settings row. Advanced distance preferences remain nested; no raw technical explanation or cache-maintenance buttons in normal view. Error + Retry remains actionable when API/CDN fails.
9. **Persistence:** save a manual place, force-stop/relaunch, open Settings and verify that `/v1/me/geo/location` returns the persisted label independent of CloudFront. Verify the same in Dating/Local Feed. GPS one tap (with granted permission) also saves; raw GPS isn't exposed.
10. **Security:** password changes, signed-in device list/revocation, logout and P01-3 login restore work. On sign-out, private screens disappear; sign in to another test account and verify no previous saved profile/location appears.
11. **Small screen, keyboard and scroll:** use 360dp Android, tap every bottom option, expand/collapse nested Settings panels, scroll to password/logout, edit profile. Check no offscreen button, nested scroll collision, Flutter exception or repeated loader.

## API observability

Watch only the **API terminal** for the expected private routes: `GET /v1/profiles/me`, `GET /v1/me/geo/location`, `PUT /v1/me/geo/manual`, `POST /v1/me/geo/gps`, and `GET /v1/geo/india/delivery` as relevant. CloudFront requests made directly by phone cannot appear as Fastify requests; fallback calls do. Log status and request ID only; redact tokens, usernames, GPS coordinates, private row fields. 200 save + committed audit should be followed by a successful GET on relaunch.

**Decision gate:** P03 cleanup is only owner-accepted after full Windows + physical Android checks pass. If successful, mark cleanup accepted, then begin P03-2 infrastructure without changing these screens.

## P03-1 regression focus (also required before P03-2)

- Choose State → District; automatic download (no extra load button), offline verified cache, CloudFront to authenticated Fastify fallback and checksum-rejection cases.
- Manual selection: results close, save commits, `GET /v1/me/geo/location` reads the saved label after a force-stop/reopen and account switching never leaks it.
- GPS: permission only after tap, valid India boundary (mainland and islands), one-tap save, server H3 R6, no raw GPS persisted, malformed/stale/inaccurate/out-of-bound fixes rejected.
- No infinite loaders or automatic GPS requests; errors have Retry and backend `[API]` / `[GEO]` diagnostics with no personal data.
- Complete profile: five main tabs. Incomplete profile: two main tabs. Editing a profile happens only inside Settings; readiness re-evaluated by the API.
- PIN-code UI remains on hold. No public discovery or Connects chat is activated.

Store actual command results and Android evidence in a new **P03-only** QA record; portable checks alone do not establish physical acceptance.

**Small-screen navigation regression:** On moto g04s, confirm all five bottom destinations are tappable and labels do not overlap/overflow. Test each tab on 360dp width; check section switching and Settings index 4 after onboarding.ready changes.
