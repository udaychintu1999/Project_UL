# P02 — Windows, local API and Android verification

**Status:** Owner reports the complete P02-5 test suite passed on 16 November 2026 after the guided-UI photo-count assertion repair. This supersedes prior P02-1 to P02-5 authoring-package `PENDING` statuses, **but not the separate unconfirmed manual gallery-picker/visual checklist**. A documentation-only cleanup does not rerun Flutter, Java DynamoDB Local or Android.

## Current commands — PowerShell at project root

Prerequisites for full testing: existing installed dependencies, valid owner-managed private local `.env`, manually running **Java DynamoDB Local**, Fastify API started in a separate terminal (`npm run dev:api`), Flutter/Android SDK and a connected authorized USB Android device. Do not print secrets; do not start AWS/cloud operations. Never uninstall the ordinary user app during isolated tests.

```powershell
# Read-only stage list (does not execute tests)
npm run verify:p02-5:plan

# Fast offline regression without Java/Android (not full acceptance)
npm run verify:p02-5:portable

# Analysis and 54-widget suite in owner's accepted test run
npm run test:flutter

# Complete P02-5 automated acceptance: visual contracts, then nested P02-4 12 gates
npm run verify:p02-5
```

For a focused rerun of the real guided onboarding UI, the underlying command is `npm run test:flutter:p02-3:e2e` (the latest journey has **15 checkpoints**). It uses deterministic picker test images with **real API, DB and media writes**. It is not a manual real-device Files/Gallery chooser test.

## P02-4's nested 12-stage verifier

| Gate | Executed command | Responsibility |
|---|---|---|
| 1 | `verify:p02-4:portable` | P00/P01/P02 unit, source, security, doc contracts |
| 2 | `typecheck` | Backend semantic TypeScript |
| 3 | `lint` | Backend and scripts |
| 4 | `test:p02-2:store` | Private image disk adapter |
| 5 | `test:flutter` | Flutter analyzer and widgets |
| 6 | `test:integration` | Real local Fastify and DynamoDB roundtrip |
| 7 | `test:p02-1:integration` | Profiles, handle and drafts |
| 8 | `test:p02-2:integration` | Real photos, ownership, reuse and eligibility |
| 9 | `test:p02-3:integration` | Private activation and fail-closed visibility |
| 10 | `test:flutter:p02-1:e2e` | Isolated Android session/draft |
| 11 | `test:flutter:p02-2:e2e` | Isolated Android real API/media |
| 12 | `test:flutter:p02-3:e2e` | Isolated Android guided 15-checkpoint real UI |

`verify:p02-5` first runs P02-5 contracts, then all above gates. **Any failing stage stops subsequent execution and must never be reported as complete.** The owner's final 16 November report was “looks good all tests passed”; earlier supplied Windows logs had demonstrated P02-4 gates 1–11 and a now-fixed false photo-count timeout in gate 12. Do not pretend this docs ZIP contains an independently captured final 12/12 transcript.

## Separate manual Android / visual checks — evidence not explicitly supplied

- [ ] Open the **real native Android SAF Files/Gallery picker** (without an injected test fixture); choose a real photo, cancel once, upload/save/reopen, then test invalid/oversize files without crashing or exposing file paths.
- [ ] Verify 320/360/430dp screens, larger system text, long names, keyboard visible, TalkBack labels, accessible touch regions, icon layout, no overflow/navigation overlap.
- [ ] Check both Friendship-only and dual-mode wizard paths, Back, horizontal swipes, one Save & Next, 0/1/2 photo Continue gates and mode-private activation.
- [ ] Check own private images, cross-owner denial, no DOB/UID/exact location leakage and no public discovery.
- [ ] Check current signed-in Home/Settings, password/device/logout and ordinary app untouched by isolated Android suite.

**Evidence discipline:** Mark manual items PASS **only** when personally observed and recorded by owner. Local automated acceptance is not production security or provider readiness; P01-1 OTP device automation exception is a historical FAILED/local-waived test, not a PASS.

## What to record on a future rerun

Date; committed revision; exact command/exit code; gate counts; Android test package and redacted device details; 15 UI checkpoints; and separate real picker/visual PASS/FAIL. No OTP, `.env`, tokens, account IDs or private image content in logs. P03 location/discovery checks belong to P03, not this P02 runbook.
