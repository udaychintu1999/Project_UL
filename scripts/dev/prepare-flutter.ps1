$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../../apps/flutter_app")
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw 'Flutter SDK missing or not on PATH.' }
flutter create --platforms=android --project-name uluv .
if ($LASTEXITCODE -ne 0) { throw 'Flutter Android platform bootstrap failed.' }
flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'Flutter pub get failed.' }
Write-Host 'Check android/app/src/debug/AndroidManifest.xml for cleartext developer-only settings.'
