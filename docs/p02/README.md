# P02 — Profile identity, onboarding, photos, activation & visual upgrade

**Status as of 17 November 2026:** **P02-0 through P02-5 owner-accepted for local development**, based on the owner's final report on 16 November that *all tests passed* after the P02-5 Android photo-count repair. The full verifier and physical Android suites were executed by the owner, not independently by this documentation cleanup. **P03 is now in progress.** P02 is not a production-release approval.

## Read in this order

| Need | Read | Why |
|---|---|---|
| Five-minute overview | [P02 phase summary](../implementation/phases/P02.md) | Milestones, real status, what is complete |
| Product behavior and owner decisions | [01 — Product & user journey](01_PRODUCT_AND_USER_JOURNEY.md) | Profiles, conditional swipe wizard, photos, mode boundaries |
| Backend, data, privacy | [02 — Technical & privacy contract](02_TECHNICAL_AND_PRIVACY_CONTRACT.md) | Exact routes, ownership, activation, no public discovery |
| Visual design | [03 — UI / reference mapping](03_UI_VISUAL_REFERENCE.md) | Reference-inspired colors, implemented screens, no mock features |
| Test or troubleshoot P02 | [04 — Verification & acceptance](04_VERIFICATION_AND_ACCEPTANCE.md) | Commands, 12 gates, separate native picker/visual checks |
| Understand past problems | [05 — Repair history](05_REPAIR_HISTORY.md) | Consolidated root causes and provenance, not active blockers |
| Start or continue P03 | [P02 → P03 boundary](../handoff/P02_TO_P03_BOUNDARY_2026_11_16.md) | Trusted location, H3, fail-closed visibility |
| Find an old document filename | [06 — Legacy document map](06_LEGACY_DOCUMENT_MAP.md) | Pointers from historical ZIPs and shared docs |

## Verification terms — do not conflate

- **Owner-accepted / locally verified:** Owner reported successful complete Windows/Flutter/real API/DynamoDB Local and isolated Android automated verification. P02-5 acceptance supersedes older *pending* checkpoint labels.
- **Not separately evidenced:** A **manual native Android SAF gallery/files chooser test** and the complete device-by-device visual/accessibility checklist have not been explicitly confirmed. Automated UI tests inject picker responses; they do **not** prove the native chooser.
- **Not delivered by P02:** Trusted H3 R6 discovery pointers, cross-account profile visibility, real Dating/Friendship discovery, Local feed, payment or cloud production integration. P03 owns these.
- **Historic P01 caveat:** P01-1 standalone Android OTP automation had a documented failed/local-development exception. P02 acceptance does not turn it into a PASS or waive production gates.

**Documentation rule:** Use this folder and `docs/implementation/phases/P02.md` for *current* P02. Older P02 filenames elsewhere are compatibility pointers, not separate active implementation instructions. Do not run outdated per-repair ZIP or retest commands as the next phase. P03 documentation remains authoritative for P03.

## Merge safely while P03 is being developed

Use the **update-only** docs ZIP rather than replacing the entire `docs/` directory if P03 files may have changed since the uploaded snapshot. Back up `docs/` first, extract the update ZIP at project root, and review `git diff -- docs`. From project root, run `./docs/p02/PRUNE_OBSOLETE_P02.ps1` to see the **dry-run** removal list. Only if it is correct, run `./docs/p02/PRUNE_OBSOLETE_P02.ps1 -Apply` to remove 13 old, unreferenced P02 notes whose SHA-256 contents still match the uploaded ZIP. Changed files are skipped, not deleted.

Run `npm run test:docs` in your local project afterward. This documentation-only authoring environment cannot execute the project's `docs-check.mjs` because the source repository is not attached.

## Merge safely while P03 is being developed

Use the **update-only** docs ZIP rather than replacing the entire `docs/` directory if P03 files may have changed since the uploaded snapshot. Back up `docs/` first, extract the update ZIP at project root, and review `git diff -- docs`. From project root, run `./docs/p02/PRUNE_OBSOLETE_P02.ps1` to see the **dry-run** removal list. Only if it is correct, run `./docs/p02/PRUNE_OBSOLETE_P02.ps1 -Apply` to remove 13 old, unreferenced P02 notes whose SHA-256 contents still match the uploaded ZIP. Changed files are skipped, not deleted.

Run `npm run test:docs` in your local project afterward. This documentation-only authoring environment cannot execute the project's `docs-check.mjs` because the source repository is not attached.
