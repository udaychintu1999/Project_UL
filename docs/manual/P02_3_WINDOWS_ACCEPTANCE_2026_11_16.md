# P02-3 — Windows / real Android acceptance guide (2026-11-16)

This milestone **does not** make a profile public. Activation records a private owner request and shows `pending_trusted_locality` when all current P02 requirements are met. P03 handles trusted locality and authorized public discovery.

## 1. Update safely

1. Make a commit/backup of your working P02-2 project.
2. Extract the P02-3 update-only ZIP into project root, preserving paths and overwriting matching changed files. **Do not delete `.env`, `.local/media`, Android Keystore storage or DynamoDB Local data.**
3. The patch does not add npm/Flutter dependencies and does not require new tables. No `npm ci` unless your local installation is missing dependencies.
4. Start Java DynamoDB Local **manually** using your established runbook. In a second PowerShell terminal run `npm run dev:api`.

## 2. Mandatory automated verification

From the repository root:

```powershell
npm run verify:p02-3:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
npm run test:p02-1:integration
npm run test:p02-2:integration
npm run test:p02-3:integration
npm run test:flutter:p02-3:e2e
```

The last test is the **UI-driven physical Android test**, not just direct API calls. It runs P02-2 checkpoints 01–13 plus P02-3 checkpoints 14–15, using the isolated package. Keep the PC API and Java DB running; USB debugging and ADB reverse are configured by the runner. Ensure the native Android picker is manually checked separately (automation injects test photos through the picker channel).

If a command fails, **stop before declaring acceptance**. Share redacted error messages only (never complete refresh tokens, passwords, OTPs, `.env` content or signed credentials). Do not use destructive Gradle/ADB cleanup on the normal app.

## 3. Manual profile and privacy check

- Log into your normal app and confirm Home / Settings, password/device controls and saved P02-2 data still function.
- On Common Profile, change a field. There should be **one** `Save & Next` button rather than separate save and next buttons. A partial/invalid current step must not advance; a successful save should advance exactly one step. Back/right swipe may return to prior steps without wiping typed edits.
- Create complete Dating-only, Friendship-only and both-mode profiles, using **two genuine images for each selected mode**, with permitted reuse. The final review must show correct common/mode information and photo thumbnails.
- Tap Continue. On the private completion page, request Dating activation. Expect `pending_trusted_locality`, `discoveryEligible=false`, and no public search/listing. Friendship remains independently off.
- Turn Friendship on separately and check Dating stays unchanged. Turn Dating off and verify Friendship stays on. Tap private preview for each mode: maximum two owner photos and no email, DOB, precise location or internal UID.
- Remove one Dating photo: Dating must clear the activation request while Friendship is unaffected. Restore the photo: Dating must **not** silently reactivate.
- Change city, mode selection or public handle: any previous activation request must show paused/ineligible until explicitly renewed. The old handle must not expose a public profile.
- Restart the Android app and verify saved fields, both mode requests and private visibility statuses persist.
- Check narrow/mobile layout, offline response, request version conflict, Back navigation, error messages and no dead buttons.

## 4. Closeout

Record command exits and manual outcomes in `docs/qa/EVIDENCE_LOG.md`. Mark P02-3 `AUTOMATED_VERIFIED`, `MANUAL_VERIFIED` and `OWNER_ACCEPTED` only upon real evidence. Do not mark full P02 complete until the phase exit criteria and owner acceptance are satisfied. P03 discovery remains a separate phase.


## P02-3 guided step tap repair (2026-11-16)

The first P02-3 physical Android run reached UI PASS 03 but missed `p02-save-next` with a Flutter hit-test warning. Apply the focused repair ZIP before retrying; it does **not** change the production app. Run `npm run test:flutter` followed by `npm run test:flutter:p02-3:e2e`. Check for `P02-3 UI ACTION: p02-save-next unobstructed; tapping real button` and all real UI checkpoints through PASS 15. A partial set of PASS messages is **not** a passing integration test. See `docs/qa/P02_3_GUIDED_SAVE_NEXT_HIT_TEST_REPAIR_2026_11_16.md` for diagnosis, verification limitations and no-destructive-cleanup precautions.
