param(
  [string]$Device='',
  [ValidateSet('http://10.0.2.2:3000','http://127.0.0.1:3000')]
  [string]$ApiBaseUrl='http://10.0.2.2:3000'
)
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path "$PSScriptRoot/../../apps/flutter_app")
$envFile=Resolve-Path '../../apps/api/.env'
$token=(Get-Content $envFile | Where-Object { $_ -match '^ULUV_DEV_TOKEN=' } | Select-Object -Last 1) -replace '^ULUV_DEV_TOKEN=',''
if (-not $token -or $token.StartsWith('REPLACE_')) { throw 'Configure a real local dev token first.' }
$args = @('run',"--dart-define=ULUV_API_BASE_URL=$ApiBaseUrl","--dart-define=ULUV_DEV_TOKEN=$token")
if ($Device) { $args += @('-d',$Device) }
& flutter @args
