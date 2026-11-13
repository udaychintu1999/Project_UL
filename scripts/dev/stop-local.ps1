$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pidFile = Join-Path $root '.local\run\dynamodb-local.pid'
if (-not (Test-Path $pidFile)) { Write-Host 'No recorded locally started Java DynamoDB process; if started manually, press Ctrl+C in its terminal.'; exit 0 }
$pidText = (Get-Content $pidFile -Raw).Trim()
if ($pidText -notmatch '^\d+$') { throw 'Invalid local pid file; inspect manually.' }
$targetId = [int]$pidText
$proc = Get-Process -Id $targetId -ErrorAction SilentlyContinue
if (-not $proc) { Remove-Item $pidFile -Force; Write-Host 'Process not running; stale PID removed.'; exit 0 }
# Do not kill a reused PID unless this exact process still runs DynamoDBLocal.jar.
$details = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $targetId" -ErrorAction SilentlyContinue
if (-not $details -or $details.CommandLine -notmatch 'DynamoDBLocal\.jar') {
  throw "PID $targetId is not verified as U_luv DynamoDB Local. Not stopping. Inspect manually."
}
Stop-Process -Id $targetId -ErrorAction Stop
Remove-Item $pidFile -Force
Write-Host "Stopped only the recorded Java DynamoDB Local process (PID $targetId). Local DB files remain on disk."
