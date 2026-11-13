param([string]$Phase='P00')
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../..")
if ($Phase -eq 'P01') {
  Write-Host '=== P01 full owner-operated local gate (includes P00 regression + P01 API/Flutter) ==='
  npm run verify:p01
  if ($LASTEXITCODE -ne 0) { throw 'P01 gate FAILED or unavailable. Do not claim verification.' }
  Write-Host 'P01 first-slice automation passed; Google and remaining P01 scope still unverified.'
  exit 0
}
if ($Phase -ne 'P00') { throw 'P02-P17 are future phases. No verifier implemented.' }

Write-Host '=== T1: Portable code/docs tests ==='
npm run verify:p00
if ($LASTEXITCODE -ne 0) { throw 'Portable P00 suite FAILED' }

Write-Host '=== T1: Actual API TypeScript typecheck ==='
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Backend typecheck FAILED (install dependencies first)' }

Write-Host '=== T2: Real DynamoDB Local checks ==='
npm run test:db
if ($LASTEXITCODE -ne 0) { throw 'Real DynamoDB Local schema/conditional operations FAILED' }

if (-not (Test-Path 'apps/api/.env')) { throw 'apps/api/.env missing (see LOCAL_START_AND_VERIFY)' }
$line = Get-Content 'apps/api/.env' | Where-Object { $_ -match '^ULUV_DEV_TOKEN=' } | Select-Object -Last 1
$env:ULUV_DEV_TOKEN = $line -replace '^ULUV_DEV_TOKEN=',''
if (-not $env:ULUV_DEV_TOKEN -or $env:ULUV_DEV_TOKEN.StartsWith('REPLACE_')) { throw 'Configure a strong local token in apps/api/.env' }
npm run test:integration
if ($LASTEXITCODE -ne 0) { throw 'Real Fastify+DynamoDB Local API roundtrip FAILED' }

Write-Host '=== T3: Flutter widget / analyzer ==='
if (Get-Command flutter -ErrorAction SilentlyContinue) {
  Push-Location apps/flutter_app
  try {
    flutter analyze
    if ($LASTEXITCODE -ne 0) { throw 'Flutter analyze FAILED' }
    flutter test
    if ($LASTEXITCODE -ne 0) { throw 'Flutter widget tests FAILED' }
  } finally { Pop-Location }
} else {
  Write-Warning 'Flutter SDK unavailable: T3 marked UNVERIFIED, not PASS.'
}
Write-Host 'Portable/API/DB checks completed. Android emulator/device E2E is still UNVERIFIED until separately run.'
Write-Host 'Run: flutter test integration_test --dart-define=ULUV_API_BASE_URL=http://10.0.2.2:3000 --dart-define=ULUV_DEV_TOKEN=<local-token>'
Write-Host 'Record every actual command and result in docs/qa/EVIDENCE_LOG.md before phase signoff.'
