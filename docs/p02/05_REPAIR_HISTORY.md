# P02 — Condensed incident and decision history

**Purpose:** Keep meaningful root-cause lessons without treating old failed test logs or patch ZIP instructions as current active blockers. This is a historical summary, not new source verification. Source records were consolidated from the P02-specific `docs/qa/`, `docs/manual/` and handoff notes supplied on 17 November 2026.

| Date / slice | Previously observed problem | Resolved approach / why it mattered |
|---|---|---|
| 15 Nov, P02-1 | Common profile save, test fixture state retention, premature widget queries, Android isolated uninstall safety | Persist shared setup; guard frontend state and server revision; settle/pump real widget frames; ensure isolated package does not touch normal app |
| 15–16 Nov, P02-2 | Photo count or setup readiness inconsistent, two-photo gating and enabled-mode checks | Evaluate **two own READY** images for each enabled mode; update readiness after backend write; preserve reuse/reference counts |
| 15–16 Nov, P02-2 | Android UI E2E tested lower-level media API without tapping the real screen, Continue overlapped nav, long scroll deadlocked | Add actual screen-driven 15-checkpoint journey, ensure visible real tap, and never await Flutter animations without pumping |
| 16 Nov, P02-2 | Guided onboarding became a large/duplicated form; Flutter compile errors during repair | Conditional swipeable steps, one Save & Next, authoritative server-gated progress; correct compile and QA issues |
| 16 Nov, P02-3 | `p02-save-next` button missed hit target below fixed nav bar | Move scrollable button safely into viewport and verify real pointer hit; preserve Back/saved-state guards |
| 16 Nov, P02-4 | `const` analyzer lint and widget test gender-dropdown off-screen taps; unpumped scroll test | Fix fixtures, use correctly centered interactive targets, reject missed pointer interactions; the full 12-gate chain later reported passed |
| 16 Nov, P02-5 | New visual test omitted `const` in a widget fixture | Fix const root; source regression prevents repeat |
| 16 Nov, P02-5 | Colored `DecoratedBox` obscured `ListTile` ink; brittle photo-copy assertion; off-screen swipe/login test taps | Replace tile wrapper with valid `Material`; use stable `p02-photo-count`, visible gestures, accessible alignment; retain behavior |
| 16 Nov, P02-5 | Physical Android Gate 12 timed out after photo upload because UI text changed from `1/6 assigned` to `1 / 6` | Check stable server-backed photo counter instead; cover first/second Dating photo, Friendship reuse and removal. Owner subsequently reported **all tests passed** |

## Important provenance distinctions

- Individual historical authoring packages were often *portable-verified only*; their `Windows retest pending` lines were accurate **when written** and are not current blockers after the owner's final acceptance.
- The 16 November Windows log before the last repair showed Flutter analysis with 54 widgets passed, 40 backend unit tests, real API/database integration and Android P02-1/P02-2 passed. P02-3 guided UI passed checkpoints 1–4 and stopped at a stale photo label. The **subsequent owner message** reports all tests passed after that repair. Do not invent later raw logs or exact UI screenshot evidence.
- Native Android gallery chooser *manual* acceptance and complete visual/accessibility review were not explicitly confirmed. Keep those unverified separately from the passing automated pipeline.
- Original P02-1/P02-2 implementer notes occasionally described proposed numeric limits or future services as not-yet-implemented. Treat final consolidated technical contract and current source as authoritative; do **not** promote proposals to features.
- Old source ZIP filenames, line numbers and temporarily failing gate counts were delivery-specific troubleshooting data, not current instructions. For new failures, use the [verification runbook](04_VERIFICATION_AND_ACCEPTANCE.md).
