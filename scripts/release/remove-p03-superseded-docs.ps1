# One-time, explicit P03-only cleanup. Never touches P01/P02 documentation.
# Usage (from project root):
#   .\scripts\release\remove-p03-superseded-docs.ps1
#   .\scripts\release\remove-p03-superseded-docs.ps1 -Apply
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pkg = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $pkg -PathType Leaf)) { throw 'Missing U_luv project root.' }
if ((Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json).name -ne 'uluv') {
  throw 'Refusing cleanup outside the U_luv repository.'
}
$canonical = @(
  'docs/p03/README.md', 'docs/p03/01_USER_JOURNEYS.md',
  'docs/p03/02_GEO_DATA_STORAGE_AND_H3.md', 'docs/p03/03_API_REFERENCE.md',
  'docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md',
  'docs/p03/05_POINTER_LIFECYCLE_AND_SAFETY.md',
  'docs/p03/06_NEXT_STAGES_ROADMAP.md'
)
foreach ($rel in $canonical) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $rel) -PathType Leaf)) {
    throw "Maintained handbook not installed: $rel. Apply the patch first."
  }
}
$manifest = Join-Path $PSScriptRoot 'p03-3-superseded-docs.txt'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'Missing exact deletion manifest.' }
$paths = @(Get-Content -LiteralPath $manifest | Where-Object {
  $_ -and (-not $_.StartsWith('#'))
})
if ($paths.Count -ne 36 -or (@($paths | Select-Object -Unique)).Count -ne 36) {
  throw 'Unexpected deletion list; refusing to prune.'
}
$docsRoot = [IO.Path]::GetFullPath((Join-Path $root 'docs')) + [IO.Path]::DirectorySeparatorChar
$remove = @()
foreach ($rel in $paths) {
  if ($rel -notmatch '^docs/[A-Za-z0-9_./-]+$' -or $rel.Contains('..') -or
      $rel -match '(^|/)(?:P0[012]_[^/]*|p02)(?:/|$)') {
    throw "Unsafe deletion path: $rel"
  }
  $target = [IO.Path]::GetFullPath((Join-Path $root ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)))
  if (-not $target.StartsWith($docsRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Deletion path escapes docs root: $rel"
  }
  if (Test-Path -LiteralPath $target) {
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Not a file: $rel" }
    $remove += @{ Relative = $rel; Full = $target }
  }
}
Write-Host ("P03-only superseded docs: {0} present, {1} already absent." -f $remove.Count, (36-$remove.Count))
$prefix = 'DRY-RUN '; if ($Apply) { $prefix = 'REMOVE ' }
foreach ($file in $remove) { Write-Host ($prefix + $file.Relative) }
if (-not $Apply) {
  Write-Host 'No files changed. Commit/back up the project, then rerun with -Apply.'
  return
}
foreach ($file in $remove) { Remove-Item -LiteralPath $file.Full -Force }
Write-Host 'P03-only legacy files removed. Run npm run test:p03:docs, then npm run verify:p03-3.'
