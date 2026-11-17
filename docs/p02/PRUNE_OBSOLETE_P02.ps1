# P02 documentation-only obsolete-file cleanup

param([switch]$Apply)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$items = @(
  @{ Path = "docs/architecture/P02_3_ACTIVATION_VISIBILITY_AND_PRIVACY_2026_11_16.md"; Sha256 = "B12A25615F17B2CB0CA43ECA3C1DB715A5327B98C7C59DE6DBA96CED0A51D49D" },
  @{ Path = "docs/design_reviews/P02_1_COMMON_PROFILE_AND_ONBOARDING_GATE_2026_11_15.md"; Sha256 = "345443546681816E2319ED94F7C7E8ECEEADCEC4B72A178430982FEA0D8885A6" },
  @{ Path = "docs/design_reviews/P02_2_LOCAL_MEDIA_IMPLEMENTATION_CONTRACT_2026_11_15.md"; Sha256 = "1A6E10E4CF2B8AF5BD4A1ABFBEF5D5EE4502E1CDAD9086445BDDE9909B204B40" },
  @{ Path = "docs/handoff/P02_1_COMMON_PROFILE_CONTINUATION_MANIFEST_2026_11_15.md"; Sha256 = "C9BDA5CAE78FAE546CE697490AD3DA17EA7002F8AAD2E4C5A393F4A436D7FEB8" },
  @{ Path = "docs/handoff/P02_1_DELIVERY_MANIFEST_2026_11_15.md"; Sha256 = "B80DB0D70AD8433D3A2FF2548A427BAA6FB5E24AE2452449734F8DB93DD9D983" },
  @{ Path = "docs/handoff/P02_1_HOME_SETTINGS_UPDATE_MANIFEST_2026_11_15.md"; Sha256 = "4045D78969D68FEA1A315827ED3888355E09D5E15B8E7438554A5480F65C550E" },
  @{ Path = "docs/manual/P02_1_WIDGET_ANDROID_RETEST_2026_11_15.md"; Sha256 = "414F19314153A04157386850FB874BE4F5A5141316BDBE006F8DF1142DDCDB6D" },
  @{ Path = "docs/manual/P02_2_GUIDED_ONBOARDING_WINDOWS_CHECKLIST_2026_11_16.md"; Sha256 = "9E9DFE284505C6044BC578F1DC099B6BB59859C8AEC3F429CC560DBB15E903B4" },
  @{ Path = "docs/qa/P02_2_GUIDED_ONBOARDING_REDESIGN_2026_11_16.md"; Sha256 = "09BFA05D24CC1C1D33F8EF27F76149D0794FD926A6D2C162F3921DDD0F900C16" },
  @{ Path = "docs/qa/P02_4_GATE5_FLUTTER_CONST_LINT_REPAIR_2026_11_16.md"; Sha256 = "F4D60B2B064480F8E95D12573FC3FBA979A1A4B9E2FEEB02D97B362774100D3B" },
  @{ Path = "docs/qa/P02_4_GATE5_WIDGET_HIT_TEST_AND_SCROLL_REPAIR_2026_11_16.md"; Sha256 = "998DDBDEA85154D661A32BD1520C124955ED4EA14E7CBF028C6C814F10C47735" },
  @{ Path = "docs/qa/P02_5_FLUTTER_WIDGET_RUNTIME_ROOT_CAUSE_REPAIR_2026_11_16.md"; Sha256 = "21CA16C183E42224E6B30B1C59055C5ACD76D4687337D978C78780B883B0257E" },
  @{ Path = "docs/qa/P02_5_UI_REFERENCE_VISUAL_IMPLEMENTATION_EVIDENCE_2026_11_16.md"; Sha256 = "239466D44B30AF016D435B277DEE51A1D4D36F15057C76A4EA3DC2EB52DA6326" }
)
Write-Host "P02 cleanup: only the listed obsolete docs, and only if unchanged from the uploaded snapshot."
if (-not $Apply) { Write-Host "DRY RUN. Pass -Apply only after reviewing output and backing up docs/." }
foreach ($item in $items) {
  $target = Join-Path $root ($item.Path.Replace("/", [IO.Path]::DirectorySeparatorChar))
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { Write-Host "Already absent: $($item.Path)"; continue }
  $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($actual -ne $item.Sha256) { Write-Warning "SKIP MODIFIED: $($item.Path) (protecting newer edits)"; continue }
  if ($Apply) { Remove-Item -LiteralPath $target -Force; Write-Host "Removed: $($item.Path)" }
  else { Write-Host "Would remove: $($item.Path)" }
}
Write-Host "P02 cleanup finished. P03 and P01 files were not targets."
