# 05 — P03 documentation history and safe cleanup

This folder is now the **reader-friendly P03-1/P03-2 entry point**. It does **not** replace source-level contracts, rewrite P01/P02, or claim future P03-3+ features are active.

## What to use now

| Question | Active document |
| --- | --- |
| What is visible in the app? | `docs/p03/01_USER_JOURNEYS.md` |
| Where is GeoNames and private location stored? | `docs/p03/02_GEO_DATA_STORAGE_AND_H3.md` |
| What are the exact HTTP routes/internal H3 interfaces? | `docs/p03/03_API_REFERENCE.md` |
| Which tests really passed, and what still needs real-device checking? | `docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md` |
| Original detailed implementation / data-pipeline specs | `docs/architecture/P03_GEO_LOCATION_COMPLETE_HANDBOOK.md`, `docs/architecture/P03_2_H3_R6_DISCOVERY_INFRASTRUCTURE.md`, `docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md` |
| Original wider D1–D3 P03 product roadmap (not a completion report) | `docs/implementation/phases/P03.md` |

## Historical records, not active runbooks

P03 files in `docs/qa/` recording historical bugs (terminal diagnostics, Flutter compile, first-save visibility, boundary, P03-2 implementation, analyzer/TypeScript/fake-async repairs) are **evidence and history**. Do not rewrite their past observed results to imply a later fix had already passed. Historical `P03_FOUR_TAB_*` documents reflect an intermediate proposal; the adopted navigation is five tabs, with Local Feed/Activities as the third destination. Retain these referenced documents until other indexes are reconciled.

## Optional, safe cleanup of only unreferenced P03 manuals

`docs/p03/PRUNE_SUPERSEDED_P03.ps1` **prints proposed deletions only by default**. It contains an explicit allowlist of four P03-only legacy Windows manuals already superseded by `04_ACCEPTANCE_AND_RELEASE_GATES.md`. If you want to remove those after reviewing their historical details, back up your docs/Git history first, then run with `-Apply`. It never targets P01/P02, product/design, broad progress, secrets or code. The zip itself has no delete instructions and cannot delete repository files on extraction.

```powershell
.\docs\p03\PRUNE_SUPERSEDED_P03.ps1
# Optional only, after checking the printed paths and keeping a Git backup:
.\docs\p03\PRUNE_SUPERSEDED_P03.ps1 -Apply
```

**Retained due references:** `P03_FOUR_TAB_SETTINGS_WINDOWS_ANDROID_ACCEPTANCE.md`, `P03_API_TERMINAL_LOGGING_AND_DART_COMPILE_REPAIR_2026_11_17.md`, `P03_GEO_SAVED_LOCATION_WINDOWS_ACCEPTANCE.md` are still linked from historical P03 QA or shared indexes; don't delete blindly. Some source contract tests require the detailed P03 architecture and API files; keep those. `docs/architecture/P03_1C_PINCODE_SEARCH.md` remains on hold; it is not a current P03-1/P03-2 behavior.

Never treat the older P03 docs' "full local acceptance pending" statements as current evidence; use the owner 18 Nov 2026 test log and new gate results. Preserve other phases' documentation exactly.
