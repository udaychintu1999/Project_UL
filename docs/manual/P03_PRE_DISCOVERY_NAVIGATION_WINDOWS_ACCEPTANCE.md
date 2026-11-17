# P03 — Pre-discovery navigation & location acceptance (Windows + moto g04s)

**Environment:** existing manually running local DynamoDB, Fastify API, protected Android session, correct pinned GeoNames CloudFront configuration. This handoff does not call AWS or read private `.env`.

From project root:

```powershell
npm run verify:p03:pre-discovery
# Separate terminals:
npm run dev:api
npm run dev:flutter
```

**User A, incomplete profile**
1. Sign in with an account whose server dashboard has `onboarding.ready=false`.
2. Verify bottom bar is exactly **Home | Settings**. Home shows the guided wizard. No Dating/Friendship/Local Feed tabs are exposed.
3. Open Settings. Confirm Password settings, Location, Manage signed-in devices and Log out work; future profile/discovery/notifications settings are not shown prematurely.
4. Complete the saved profile through the existing guided `Save & Next`, including handle, common profile, enabled mode details and required saved photos. Confirm with `GET /v1/profiles/me` (server output, don't log bearer token). Five tabs must appear **only** after response says `onboarding.ready=true`.

**User B, previously completed profile**
1. Force-stop and relaunch the application, or sign out/in with an account whose dashboard is already `onboarding.ready=true`.
2. Verify no first-time profile entry form flashes. Home is a saved summary with an **Edit profile details** action. Bottom bar has **Home | Dating | Friendship | Local Feed | Settings**.
3. Open each discovery tab. If no saved location, show one explanatory message and two actions: **Use GPS** and **Manual selection**. GPS permission must **not** be requested on tab entry.
4. Tap Manual selection. Verify separate sheet displays real State/District/Place dropdowns, auto district downloads, verified cache, retries, search and Save. There must be no redundant GPS button inside the manual sheet. Cancel should close without saving.
5. Save a manual place. The sheet should close after server 200. The tab should now show **Your selected location** and no longer show the two location-setup actions.
6. Switch across Dating, Friendship and Local Feed. All three should show the persisted saved label; no feed is fabricated.
7. Restart the app. The five-tab state and location must come back from authenticated server reads, not stale device state.
8. On a second test account with no saved location, explicitly tap GPS; accept permission, verify immediate server save and updated location, with no extra confirmation step. Also test permission denial, outside India, timeout, API unavailable; manual alternative remains accessible.
9. Open post-profile Settings. Confirm Profile & modes opens Home, Location & discovery still allows location changes and distance preferences, password/devices/logout work, future options are labelled only.
10. Temporarily stop Fastify and reopen a discovery tab. The UI must show **Retry**, not incorrectly assert that a saved location is absent. Restart API, retry and verify persisted location. No developer/production logs should print bearer tokens, raw GPS coordinates or full private user data.

**Additional transitions**
- From incomplete Settings, complete the profile and confirm Settings tab index 1 remaps to index 4 without navigating to a different page.
- From a saved five-tab account, a server-confirmed readiness revocation must return to two tabs and never keep discovery content accessible.
- Check 320/360dp layouts, keyboard and sheet scrolling, Android Back behavior, and no main-thread freeze. Recheck P02-5 media/source and P03-1 GPS/manual persistence regressions.

**Release status:** Until `flutter analyze`, all widget tests, owner authentication, live API/DynamoDB and moto g04s acceptance pass, mark this cleanup **PARTIALLY_VERIFIED**, not `CORE_FLOW_VERIFIED`.
