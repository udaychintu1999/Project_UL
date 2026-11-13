param(
  [string]$DynamoHome = $env:ULUV_DYNAMODB_LOCAL_HOME,
  [int]$Port = 8000,
  [switch]$SkipProvision
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root
if (-not $DynamoHome) { $DynamoHome = Join-Path $root '.local\tools\dynamodb-local' }
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Port must be between 1 and 65535.' }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Java not found. Install Java 17+ and verify java -version.' }
$javaText = (& java -version 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw "Java runtime failed: $javaText" }
if ($javaText -notmatch 'version\s+"(?<major>\d+)') { throw "Cannot identify Java version: $javaText" }
$major = [int]$Matches.major
if ($major -lt 17) { throw "Java 17+ required for DynamoDB Local; detected $major." }
$jar = Join-Path $DynamoHome 'DynamoDBLocal.jar'
$lib = Join-Path $DynamoHome 'DynamoDBLocal_lib'
if (-not (Test-Path -LiteralPath $jar -PathType Leaf) -or -not (Test-Path -LiteralPath $lib -PathType Container)) {
  throw "DynamoDB Local archive not extracted at '$DynamoHome'. Set ULUV_DYNAMODB_LOCAL_HOME to the directory containing DynamoDBLocal.jar AND DynamoDBLocal_lib. Official: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html"
}
$state = Join-Path $root '.local'
$dbPath = Join-Path $state 'data\dynamodb'
$logPath = Join-Path $state 'logs'
$runPath = Join-Path $state 'run'
@($dbPath,$logPath,$runPath) | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
$pidFile = Join-Path $runPath 'dynamodb-local.pid'
$started = $false
$client = New-Object System.Net.Sockets.TcpClient
try {
  $connect = $client.BeginConnect('127.0.0.1',$Port,$null,$null)
  $listening = $connect.AsyncWaitHandle.WaitOne(200)
  if ($listening) { try { $client.EndConnect($connect) } catch { $listening = $false } }
} finally { $client.Close() }
if ($listening) {
  Write-Host "Something already listens on 127.0.0.1:$Port; will verify it via provisioning (not assume identity)."
} else {
  $arguments = '-Djava.library.path="{0}" -jar "{1}" -sharedDb -dbPath "{2}" -port {3} -disableTelemetry' -f $lib,$jar,$dbPath,$Port
  $p = Start-Process -FilePath (Get-Command java).Source -ArgumentList $arguments -WorkingDirectory $DynamoHome -PassThru -RedirectStandardOutput (Join-Path $logPath 'dynamodb.stdout.log') -RedirectStandardError (Join-Path $logPath 'dynamodb.stderr.log')
  Set-Content -LiteralPath $pidFile -Value $p.Id
  $started = $true
  Write-Host "Started Java DynamoDB Local (PID=$($p.Id), port=$Port, persistent local data=$dbPath)."
}
$env:DYNAMODB_ENDPOINT = "http://127.0.0.1:$Port"
$env:AWS_REGION = 'ap-south-1'
$env:AWS_ACCESS_KEY_ID = 'local'
$env:AWS_SECRET_ACCESS_KEY = 'local'
if ($SkipProvision) { Write-Host 'SkipProvision: table initialization not attempted.'; exit 0 }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm missing. Install Node.js 22+ and run npm install before provisioning.' }
for ($n=0; $n -lt 30; $n++) {
  npm run db:provision
  if ($LASTEXITCODE -eq 0) { Write-Host 'Verified/provisioned 18 LOCAL tables; no AWS access used.'; exit 0 }
  Start-Sleep -Seconds 2
}
throw "Local provisioning failed. Inspect $logPath, ensure port $Port hosts DynamoDB Local, and run npm run db:provision."
