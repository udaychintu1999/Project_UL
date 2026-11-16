> **LATEST P02-2 gate repair (2026-11-15):** Owner confirmed the original Dating/gender-preference contract and mandated **two valid saved photos for EACH enabled Dating/Friendship mode before Continue**. Source now checks owner READY media records via bounded batch read, requires photo assignments per selected mode and refreshes Flutter readiness after photo writes. Draft saves (including incomplete photos) remain allowed; public discovery is still inactive. Authoring unit/portable checks PASS; Windows semantic/Flutter/live DB/Android/manual verification remains UNVERIFIED for this patch. Read `docs/qa/P02_2_TWO_PHOTO_CONTINUE_GATE_REPAIR_2026_11_15.md` and `docs/manual/P02_2_TWO_PHOTO_CONTINUE_WINDOWS_ACCEPTANCE_2026_11_15.md`. Historical status below is not superseding this latest contract.

# U_luv — P02-2 Windows / Android Photo Verification

**Latest owner workstation:** Windows 10, PowerShell/Command Prompt, Java DynamoDB Local manually started, Fastify on `http://127.0.0.1:3000`, physical Android via USB debugging and ADB reverse. No AWS/paid services.

> **Windows first-run failure repair:** The initial P02-2 ZIP triggered an ESLint `no-unsafe-finally` error, a Windows `EPERM` symlink test setup error, and two Dart analyzer diagnostics. Apply the targeted repair before rerunning acceptance. The corrected store test uses a Windows junction, with a diagnostic if even junction creation is disallowed by local policy. Full evidence: `docs/qa/P02_2_WINDOWS_LINT_STORE_FLUTTER_ANALYZER_REPAIR_2026_11_15.md`. Do not treat an unsupported junction attack test as security-verified, and do not use `npm audit fix --force` to address the separate audit warnings.

## 1. Safely merge the update-only ZIP

Extract into the existing `Project-ULuv-Space` project root with project-relative paths. Back up your Git commit first. **Do not** clear or replace `apps/api/.env`, your existing DynamoDB Local database, signed-in normal Android app, or local `.local/` media. This milestone adds the `sharp` dependency and its lockfile: `npm ci` is **required** before the API will start; it should download Sharp's matching Windows binary. Do not use `npm audit fix --force` during this acceptance because it can introduce unrelated breaking changes.

## 2. Automated checks

Run from the project root:

```powershell
npm ci
npm run verify:p02-2:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
```

If any command fails, **stop, retain failure output, and do not treat the source as verified.** `npm ci` requires network access for the new Sharp dependency. Flutter analyzes and runs widget tests including the P02-1 retention regression and P02-2 picker/preview/failed-upload tests.

Manually start Java DynamoDB Local as you normally do. Then in a second terminal run `npm run dev:api` and ensure `/health/ready` is healthy. Run the real Fastify/DynamoDB integration test:

```powershell
npm run test:p02-1:integration
npm run test:p02-2:integration
```

These use generated, synthetic `.invalid` identities; test images are programmatically generated. The P02-2 integration verifies actual streaming image bytes, PNG→JPEG normalization, EXIF stripping, cross-account read denial, stale mode revisions, multi-mode reuse, reference counts, removal and deletion. The scripts clean up synthetic owner records and their local media folder; **no real accounts are touched**.

With the USB phone connected and API running:

```powershell
flutter test --help | findstr /I uninstall
npm run test:flutter:p02-2:e2e
```

Ensure `--no-uninstall` is supported. This Android runner uses the exact disposable `com.example.uluv.p02isolated` package and **never uninstalls the normal `com.example.uluv` package**. Keep a real user session/private data out of synthetic fixtures. The app may still be force-stopped by Flutter tooling; normal app data must not be erased. Never paste full authentication, device or refresh tokens into issue reports.

## 3. Mandatory manual photo workflow

Launch the normal app using `npm run dev:flutter`. Use a local test account containing no private photos, or your own account with synthetic test images. Sign in and complete one selected mode's profile draft.

1. Open Home → Edit my profile details (if you are on the setup-complete summary) → Dating photos. Tap **Select photo from device**. Verify Android system image chooser opens; cancel and confirm no image is uploaded.
2. Select a known JPEG or PNG under 8 MiB. Confirm its preview appears before upload. Tap **Upload and add photo**. Expect progress and a new thumbnail. Reopen the app; expect the same private photo and order.
3. Add a second image. Move up/down; verify order survives Reload and app restart. Replace one image with another through the replace control. Verify max six attached photos and no duplicate IDs.
4. Switch to Friendship and attach an existing image using **Use in this mode**. Verify only one object is stored, with a reference count of two. Removing it from Dating must leave the Friendship thumbnail intact.
5. Try deleting a still-assigned image; Delete should be disabled or the server must reject it. Remove it from **both** modes; now delete the unused library image. Confirm the image is no longer retrievable.
6. Test an invalid renamed text/SVG masquerading as an image, an oversized file, lost local API, interrupted upload and a retry. The UI must not falsely claim success; a corrupt image must not become `READY`.
7. Check Settings password/device/logout buttons and preserved Home text edits. Photos must **never enable discovery** in P02-2; the `requestedActive` flag remains false and public preview routes are still absent.

## 4. Expected pass/fail distinctions

- `PORTABLE_VERIFIED` means source/unit/contract/safety checks run here or on Windows; not Android acceptance.
- `AUTOMATED_VERIFIED` requires semantic TypeScript, Flutter widgets, real Java DynamoDB + API, and isolated physical Android E2E all green.
- `MANUAL_VERIFIED` requires the actual native chooser, preview, upload, reuse, edit, restart, removal and recovery observations above.
- `OWNER_ACCEPTED` can only be recorded after the owner confirms real functionality. Never mark P02-3/P03 discovery implemented because photo storage works.

Important: `.local/media/` is a development-only private store; ordinary API restarts do not erase files. It is Git-ignored and must not be added to the ZIP. Production media storage/migration is a later, separately approved phase.
