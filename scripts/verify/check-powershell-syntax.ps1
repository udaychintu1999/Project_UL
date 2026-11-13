$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$files = @(
  'scripts/dev/start-local.ps1',
  'scripts/dev/stop-local.ps1',
  'scripts/dev/diagnose-local.ps1',
  'scripts/dev/run-api.ps1',
  'scripts/verify/verify-phase.ps1'
)
foreach ($file in $files) {
  $tokens = $null
  $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root $file), [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) { throw "PowerShell syntax error in $file`: $($errors | Out-String)" }
  Write-Host "PASS PowerShell parse: $file"
}
Write-Host 'PowerShell script syntax passed. This does not prove Java DynamoDB Local startup.'
