# Source-only Office verifier for #1127. The coordinator runs it; this file never drives Office without an explicit worker launch.
param(
  [Parameter(Mandatory=$true)][string]$Suite,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$HelperRoot = (Join-Path $PSScriptRoot '../../..'),
  [string[]]$Only = @(),
  [switch]$BeforeControls,
  [switch]$PreflightOnly,
  [ValidateRange(1,60)][int]$TimeoutSeconds = 45
)
$ErrorActionPreference = 'Stop'
$Suite = (Resolve-Path -LiteralPath $Suite).Path
$HelperRoot = (Resolve-Path -LiteralPath $HelperRoot).Path
$Out = [IO.Path]::GetFullPath($Out)
if (Test-Path -LiteralPath $Out) { throw 'Preserve earlier attempts: use a fresh output directory.' }
$helper = Join-Path $HelperRoot 'packages/editor/test/native-playground-lib.ps1'
$processHelper = Join-Path $HelperRoot 'packages/pptx/test/native-process.ps1'
foreach ($file in @($helper,$processHelper)) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing approved helper: $file" } }
. $helper
. $processHelper
function Resolve-SuiteFile([string]$Relative) {
  if ([IO.Path]::IsPathRooted($Relative)) { throw 'Manifest artifact paths must be relative.' }
  $file = [IO.Path]::GetFullPath((Join-Path $Suite $Relative))
  if (-not $file.StartsWith($Suite.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest artifact escapes suite.' }
  return $file
}
$manifestPath = Join-Path $Suite 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.schema -cne 'opf-native-title-wrap/v1' -or @($manifest.cases).Count -ne 50) { throw 'Expected the nonempty 50-case wrapped-title manifest.' }
$Only = @($Only | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$selected = @($manifest.cases | Where-Object { -not $Only.Count -or $Only -contains $_.name })
if (-not $selected.Count -or ($Only.Count -and $selected.Count -ne $Only.Count)) { throw 'Requested cases must be nonempty, unique and present.' }
$names = @{}
foreach ($case in $selected) {
  if ($case.name -cnotmatch '^[a-z0-9][a-z0-9-]+$' -or $names.ContainsKey($case.name)) { throw 'Unsafe or duplicate case name.' }
  $names[$case.name] = $true
  if (-not $case.lines.Count -or -not ([double]$case.width -gt 0) -or -not ([double]$case.height -gt 0)) { throw 'Missing expected title lines or canvas.' }
  $artifacts = @($case.after)
  if ($BeforeControls -and $null -ne $case.wrap) { $artifacts += $case.beforeGeometryControl }
  foreach ($artifact in $artifacts) {
    $file = Resolve-SuiteFile $artifact.path
    if (-not $artifact.path.EndsWith('.pptx') -or (Get-OpfFileSha256 $file) -cne $artifact.sha256) { throw "Artifact hash mismatch: $($artifact.path)" }
  }
}
[void](New-Item -ItemType Directory -Path $Out)
$report = [ordered]@{
  schema='opf-native-title-wrap-office/v1'; sourceCommit=$manifest.sourceCommit; manifestSha256=(Get-OpfFileSha256 $manifestPath)
  selected=$selected.Count; preflightOnly=[bool]$PreflightOnly; beforeControlScope='XML-restored former exact-width native title frame, not an old-source export'
  helperSha256=(Get-OpfFileSha256 $helper); processHelperSha256=(Get-OpfFileSha256 $processHelper); startedAt=(Get-Date).ToUniversalTime().ToString('o')
  files=@(); passed=$false
}
$reportPath = Join-Path $Out 'run.json'
$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportPath -Encoding UTF8
if ($PreflightOnly) { Write-Output "Preflight verified $($selected.Count) cases and requested artifact hashes. No Office call or worker was made."; exit 0 }
# Preflight under the same elevated context used for COM. No waiting, attaching to an existing process, or terminating Office.
if (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw 'POWERPNT.EXE is running; coordinator must wait for it to be free.' }
$workerScript = Join-Path $PSScriptRoot 'title-wrap-worker.ps1'
foreach ($case in $selected) {
  $modes = @('After'); if ($BeforeControls -and $null -ne $case.wrap) { $modes += 'BeforeXmlControl' }
  foreach ($mode in $modes) {
    if (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw 'Office remains running; do not attach or continue the batch.' }
    $attempt = Join-Path $Out ($case.name+'-'+$mode)
    [void](New-Item -ItemType Directory -Path $attempt)
    $arguments = @('-Suite',$Suite,'-ManifestSha256',$report.manifestSha256,'-CaseName',$case.name,'-Mode',$mode,'-OutputDirectory',$attempt,'-HelperRoot',$HelperRoot)
    $worker = Invoke-OpfNativeWorker -ScriptPath $workerScript -WorkerArguments $arguments -OutputDirectory $attempt -TimeoutSeconds $TimeoutSeconds
    $record = [ordered]@{name=$case.name; mode=$mode; worker=$worker; result=$null}
    $resultPath = Join-Path $attempt 'result.json'
    if (Test-Path -LiteralPath $resultPath) { $record.result = Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json }
    $report.files += $record
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    if ($worker.timedOut -or $worker.exitCode -ne 0 -or $null -eq $record.result -or -not $record.result.officeCompleted) { throw 'Worker did not complete; raw logs retained. Office is never killed. Stop the batch.' }
    Write-Output "$($case.name) $mode : title matches=$($record.result.linesMatch), accepted=$($record.result.passed)"
    # The exact-owned presentation closed and its empty application quit successfully. Office can linger briefly while exiting.
    # Bound this read-only shutdown serialization to ten seconds; never attach, terminate Office or wait after a failed worker.
    $shutdown = [Diagnostics.Stopwatch]::StartNew()
    for ($check=0;$check -lt 40;$check++) {
      if (-not (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Milliseconds 250
    }
    $record.shutdownWaitMilliseconds = $shutdown.ElapsedMilliseconds
    $shutdown.Stop()
    $record.officeStillRunning = [bool](Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    if ($record.officeStillRunning) { throw 'Office remains running after bounded shutdown wait; stop without attaching or terminating it.' }
  }
}
$after = @($report.files | Where-Object { $_.mode -ceq 'After' })
$report.passed = $after.Count -eq $selected.Count -and @($after | Where-Object { -not $_.result.passed }).Count -eq 0
$report.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportPath -Encoding UTF8
if (-not $report.passed) { throw 'One or more candidate title comparisons need review; all raw receipts are retained.' }
Write-Output "PASS: $($after.Count) candidate title witnesses; controls are separately labeled, not acceptance."
