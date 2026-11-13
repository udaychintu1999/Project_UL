$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../..")
if (-not (Test-Path 'apps/api/.env')) { throw 'Create apps/api/.env from .env.example and generate a new ULUV_DEV_TOKEN.' }
npm run dev:api
if ($LASTEXITCODE -ne 0) { throw 'API process exited with error.' }
