param([int]$Port = 8000)
$ErrorActionPreference = 'Continue'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Write-Host '=== U_luv Java-only local diagnostics ==='
& java -version
Write-Host "DynamoDB home: $($env:ULUV_DYNAMODB_LOCAL_HOME) (blank = .local/tools/dynamodb-local)"
Write-Host "Configured endpoint: http://127.0.0.1:$Port"
Write-Host 'Node:'; node --version
Write-Host 'npm:'; npm --version
Write-Host 'DynamoDB Local JAR:'
$home=$env:ULUV_DYNAMODB_LOCAL_HOME
if(-not $home){$home=Join-Path $root '.local\tools\dynamodb-local'}
Write-Host (Test-Path (Join-Path $home 'DynamoDBLocal.jar'))
Write-Host 'Local database data files:'
Get-ChildItem (Join-Path $root '.local\data\dynamodb') -ErrorAction SilentlyContinue | Select-Object Name, Length
Write-Host 'Local diagnostics do NOT contact production AWS.'
