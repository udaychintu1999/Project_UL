# P03-only, opt-in cleanup. Dry-run unless -Apply is supplied.
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$package = Join-Path $projectRoot 'package.json'
if (-not (Test-Path -LiteralPath $package -PathType Leaf)) { throw 'Not a U_luv project root.' }
$project = Get-Content -LiteralPath $package -Raw | ConvertFrom-Json
if ($project.name -ne 'uluv') { throw 'Project package name does not match U_luv.' }
$obsolete = @(
  'docs/manual/P03_AUTO_DISTRICT_LOAD_WINDOWS_ANDROID_ACCEPTANCE.md',
  'docs/manual/P03_GPS_BOUNDARY_AND_SETTINGS_CRASH_WINDOWS_ACCEPTANCE.md',
  'docs/manual/P03_LOCATION_RECOVERY_AND_ONE_TAP_GPS_WINDOWS_ACCEPTANCE.md',
  'docs/manual/P03_PRE_DISCOVERY_NAVIGATION_WINDOWS_ACCEPTANCE.md'
)
foreach ($rel in $obsolete) {
  $target = Join-Path $projectRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { Write-Host "Absent: $rel"; continue }
  if ($Apply) {
    Remove-Item -LiteralPath $target -Force
    Write-Host "Removed: $rel"
  } else {
    Write-Host "DRY RUN, would remove: $rel"
  }
}
if (-not $Apply) { Write-Host 'No files were changed. Back up or commit docs before optional -Apply.' }
