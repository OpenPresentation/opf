param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedRequestSha256,[switch]$RunOffice)
$ErrorActionPreference='Stop'
# Separate getter-free archive protocol. Default is pure; no retry or v1 continuation.
foreach($entryPath in @($ExecutionEnvelope,$PSCommandPath)) {
    if(-not [IO.Path]::IsPathRooted($entryPath) -or $entryPath.StartsWith('\') -or $entryPath -match '[\x00-\x1f]'){throw 'Local value entry required'}
    $cursor=[IO.Path]::GetFullPath($entryPath)
    while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased value entry'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
}
$entryItem=Get-Item -LiteralPath $ExecutionEnvelope -Force
if($entryItem.PSIsContainer -or $entryItem.Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'External value envelope differs'}
$profile=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8 | ConvertFrom-Json
$bootstrap=Join-Path $profile.controller.directory 'scripts/native-acceptance/seven-value-snapshot-bootstrap.ps1'
if(-not [IO.Path]::IsPathRooted($bootstrap) -or $bootstrap.StartsWith('\') -or $bootstrap -match '[\x00-\x1f]' -or [IO.Path]::GetFullPath($bootstrap) -cne $bootstrap){throw 'Canonical local value bootstrap required'}
$cursor=$bootstrap
while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased value bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
$record=@($profile.controller.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/seven-value-snapshot-bootstrap.ps1'})
if($record.Count -ne 1 -or (Get-Item -LiteralPath $bootstrap -Force).Length -ne $record[0].bytes -or (Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record[0].sha256){throw 'Bound value bootstrap differs'}
. $bootstrap
$controller=Assert-SevenSnapshotBootstrap $profile $NodeExecutable
if($PSCommandPath -cne (Join-Path $controller 'scripts/native-acceptance/run-seven-value-snapshots.ps1')){throw 'Launcher is not bound controller source'}
$output=Assert-SnapshotPath $OutputDirectory
if($ExecutionEnvelope -cne (Join-Path $output 'execution-envelope.json')){throw 'Use the owned prepared envelope snapshot'}
$validator=Join-Path $controller 'scripts/native-acceptance/seven-value-snapshot-profile.mjs';$required=([bool]$RunOffice).ToString().ToLowerInvariant()
$verified=& $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office $required
if($LASTEXITCODE -ne 0){throw 'Value snapshot/source/request refused before Office'}
$binding=($verified | Out-String) | ConvertFrom-Json
if($binding.requestSha256 -cne $ExpectedRequestSha256){throw 'External prepared request pin differs'}
if(-not $RunOffice){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Value Office route requires separately authorized Windows execution'}
$request=Get-Content -LiteralPath (Join-Path $output 'execution-request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$native=Join-Path $output 'native';if(Test-Path -LiteralPath $native){throw 'Preserve existing value native attempt'};[void](New-Item -ItemType Directory -Path $native)
. (Join-Path $output 'inputs/native-process.ps1')
$arguments=@($request.workerArguments | ForEach-Object {if($_ -ceq '@request-sha256'){$ExpectedRequestSha256}else{$_}})
$terminal=Invoke-OpfNativeWorker -ScriptPath (Join-Path $output 'inputs/seven-value-snapshot-worker.ps1') -WorkerArguments $arguments -OutputDirectory $native -TimeoutSeconds $request.timeoutSeconds
# Failed/partial worker is terminal: the typed verifier refuses before observer.
$admissionJson=& $NodeExecutable $validator verify-postflight --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
if($LASTEXITCODE -ne 0){throw 'Value completion/data/style admission refused; no observer or cleanup'}
$admission=($admissionJson | Out-String) | ConvertFrom-Json
. (Join-Path $controller 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $controller 'scripts/native-acceptance/seven-value-postflight.ps1')
. (Join-Path $controller 'scripts/native-acceptance/seven-value-snapshot-postflight.ps1')
$postflight=Invoke-SevenSnapshotPostflight -AdmissionFile $admission.path -ExpectedAdmissionSha256 $admission.sha256 -ControllerRoot $controller
$confirmed=($null -eq $postflight.error -and $null -ne $postflight.result -and $postflight.result.observedZero -ceq $true)
[ordered]@{schemaVersion=1;profile=$profile.profile;timedOut=$terminal.timedOut;exitCode=$terminal.exitCode;workerCleanupConfirmed=$true;cleanupConfirmed=$confirmed;postflight=$postflight;nativeAcceptance=$false;registryAcceptance=$false} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
if(-not $confirmed){throw 'Value bounded postflight failed; preserve output; no retry or cleanup'}
& $NodeExecutable $validator observe --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
if($LASTEXITCODE -ne 0){throw 'Value final source/observations binding refused'}
