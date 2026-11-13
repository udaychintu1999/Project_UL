$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../..")
./scripts/verify/verify-phase.ps1 -Phase P00
Write-Host 'For P01–P17 consult phase-specific acceptance suites; these phases have NOT been implemented.'
