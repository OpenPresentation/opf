param(
    [string]$InputPath = '',
    [string]$AttemptDirectory = '',
    [switch]$Worker,
    [ValidateRange(1, 60)][int]$TimeoutSeconds = 60
)
# RR-87: edit a fresh copy of the browser export in desktop PowerPoint, in a bounded worker. Only the root session runs this, on the
# Windows host (see docs/native-harness-retirement.md). Without -Worker it starts itself as an owned worker with a deadline and never
# kills Office; with -Worker it does the Office work. The fixture is never opened: the worker copies it into a fresh attempt directory,
# refuses when the fixture or the copy is already open, and closes only presentations it opened.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-playground-lib.ps1')
$evidence = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../artifacts/browser-evidence'))
if ($InputPath -eq '') { $InputPath = Join-Path $evidence 'export.pptx' }
if ($AttemptDirectory -eq '') { $AttemptDirectory = Join-Path $evidence ('native-attempts/' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfff') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)) }

if (-not $Worker) {
    . (Join-Path $PSScriptRoot '../../pptx/test/native-process.ps1')
    $attempt = Get-OpfFullPath $AttemptDirectory
    $workerLogs = $attempt + '-worker'
    [void](New-Item -ItemType Directory -Path $workerLogs -Force)
    $result = Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-Worker', '-InputPath', (Get-OpfFullPath $InputPath), '-AttemptDirectory', $attempt) -OutputDirectory $workerLogs -TimeoutSeconds $TimeoutSeconds
    if ($result.timedOut) { throw "Native worker timed out after $TimeoutSeconds s. Office was not terminated; check it by hand. Logs: $workerLogs" }
    if ($result.exitCode -ne 0) { throw "Native worker failed with exit code $($result.exitCode). Logs: $workerLogs" }
    Get-Content -LiteralPath (Join-Path $attempt 'native.json') -Raw
    return
}

$owned = New-OpfOwnedCopy -FixturePath $InputPath -AttemptDirectory $AttemptDirectory
# Attach to a PowerPoint that is already running (so open presentations can be checked first); start one only when none is.
$application = $null
try { $application = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') } catch { }
if ($null -eq $application) { $application = New-Object -ComObject PowerPoint.Application }
$report = Invoke-OpfOwnedEdit -Application $application -Owned $owned
$report.powerpointVersion = $application.Version
$report.sourceSha256 = $report.fixtureSha256
$report.attempt = Split-Path -Leaf $owned.attempt
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $owned.attempt 'native.json') -Encoding utf8
