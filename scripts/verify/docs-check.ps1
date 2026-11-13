$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../..")
npm run test:docs
if ($LASTEXITCODE -ne 0) { throw 'Docs verification failed.' }
