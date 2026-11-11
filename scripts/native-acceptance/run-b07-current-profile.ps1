param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$RunOffice
)
$ErrorActionPreference='Stop'

# Trust bootstrap only: no imported code, executable or process query precedes external envelope/code/Node checks.
function Assert-B07BootstrapPath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or $Path -match '[\x00-\x1f]' -or -not [IO.Path]::IsPathRooted($Path)) { throw 'B07 requires an absolute local path' }
    $full=[IO.Path]::GetFullPath($Path);if($full.StartsWith('\')) { throw 'B07 refuses UNC paths' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'B07 refuses aliased paths' }
        $parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent
    }
    return $full
}
function Assert-B07BootstrapFile([string]$Path,$Identity) {
    $full=Assert-B07BootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($file.PSIsContainer -or ($Identity.bytes -isnot [int] -and $Identity.bytes -isnot [long]) -or $Identity.bytes -lt 0 -or $file.Length -ne $Identity.bytes -or $Identity.sha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Identity.sha256) { throw 'B07 bootstrap file bytes differ' }
}
function Read-B07BootstrapEnvelope([string]$Path,[string]$Sha256) {
    $full=Assert-B07BootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($file.PSIsContainer -or $file.Length -gt 4194304 -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Sha256) { throw 'External B07 envelope hash/size differs' }
    $value=Get-Content -LiteralPath $full -Raw -Encoding UTF8 | ConvertFrom-Json
    if($value.schemaVersion -ne 1 -or $value.profile -cne 'b07-current-one-case-readonly-v1' -or $value.nativeAcceptance -isnot [bool] -or $value.nativeAcceptance -or $value.registryAcceptance -isnot [bool] -or $value.registryAcceptance) { throw 'Unsupported B07 profile' }
    return $value
}
function Assert-B07BootstrapController([string]$Root,$Identity) {
    $full=Assert-B07BootstrapPath $Root
    if(-not [string]::Equals($full,$Identity.directory,[StringComparison]::Ordinal) -or $Identity.dirty -isnot [bool] -or $Identity.dirty -or $Identity.revision -cnotmatch '^[a-f0-9]{40}$') { throw 'B07 controller must have its separate clean identity' }
    $head=(& git -C $full rev-parse HEAD | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $Identity.revision) { throw 'B07 controller HEAD differs' }
    $status=(& git -C $full status --porcelain --untracked-files=normal | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne '') { throw 'B07 controller must remain clean' }
    if($Identity.files -isnot [array] -or $Identity.files.Count -eq 0 -or $Identity.files.Count -gt 1000) { throw 'B07 requires bounded controller code identities' }
    $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($file in $Identity.files) {
        if($file.path -isnot [string] -or -not $seen.Add($file.path) -or $file.path.Contains('\') -or $file.path -match '[\x00-\x1f<>:"|?*]' -or [IO.Path]::IsPathRooted($file.path)) { throw 'Unsafe B07 controller identity path' }
        foreach($part in $file.path.Split('/')) { if($part -eq '' -or $part -in @('.','..') -or $part -match '[. ]$') { throw 'Unsafe B07 controller identity segment' } }
        Assert-B07BootstrapFile (Join-Path $full $file.path) $file
    }
    foreach($required in @('scripts/native-acceptance/b07-current-profile.mjs','scripts/native-acceptance/run-b07-current-profile.ps1','scripts/native-acceptance/run-windows.ps1','scripts/native-acceptance/identity.mjs','scripts/native-acceptance/b07-current-generate.mjs','scripts/native-acceptance/b07-current-source.mjs','scripts/native-acceptance/b07-stages.mjs','scripts/native-acceptance/b07-postflight.mjs','scripts/native-acceptance/b07-postflight.ps1','scripts/native-acceptance/run-reference-chart-profile.ps1','scripts/native-acceptance/table-profile.mjs','scripts/native-acceptance/reference-chart-profile.mjs','scripts/native-acceptance/reference-runtime-routes.mjs')) {
        if(@($Identity.files | Where-Object {[string]::Equals($_.path,$required,[StringComparison]::Ordinal)}).Count -ne 1) { throw 'Missing B07 controller input' }
    }
}
function Import-B07PureDispatcher([string]$Path) {
    $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'B07 bound dispatcher parse failure' }
    foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-NativeFileRecords','Assert-NativeRepositoryIdentity','Assert-FreshNativeOutput','Import-NativePlanValidation','Assert-NativeFontCaptureSupport','Invoke-NativeChild')) {
        $found=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($found.Count -ne 1) { throw 'Missing/duplicate B07 pure dispatcher definition' }
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}
function Copy-B07Exclusive([string]$Source,[string]$Destination) {
    $input=[IO.File]::OpenRead($Source)
    try { $target=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try {$input.CopyTo($target)} finally {$target.Dispose()} } finally {$input.Dispose()}
    return [ordered]@{bytes=(Get-Item -LiteralPath $Destination).Length;sha256=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Get-B07SnapshotCopies([string]$Envelope,$Profile) {
    # Preserve the first pair as an array element, including through PowerShell's function-output enumeration.
    $copies=@(,@($Envelope,'execution-envelope.json'))
    foreach($record in $Profile.snapshots) { $copies+=,@((Join-Path $Profile.output $record.path),$record.path) }
    return ,$copies
}
function Get-B07WorkerArguments([string]$InputPath,[string]$PlanPath,[string]$ProbePath,[string]$NativeDirectory,[int]$Timeout) {
    # The existing supervisor remains the sole owner. Never pass -Worker or -ReadOnlySurvey here.
    return @('-InputPresentation',$InputPath,'-ActionPlan',$PlanPath,'-OutputDirectory',$NativeDirectory,'-TimeoutSeconds',([string]$Timeout),'-CaptureTextFonts','-TextProbePlan',$ProbePath)
}
function Write-B07Runner { $script:b07Runner | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $script:b07RunnerPath -Encoding UTF8 }

$profile=Read-B07BootstrapEnvelope $ExecutionEnvelope $ExpectedEnvelopeSha256
$node=Assert-B07BootstrapPath $NodeExecutable
if(-not [string]::Equals($node,$profile.node.path,[StringComparison]::Ordinal) -or $profile.node.version -cnotmatch '^v24\.') { throw 'Pinned B07 Node path/version differs' }
Assert-B07BootstrapFile $node $profile.node.identity
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-B07BootstrapController $controller $profile.controllerRepository
if((Test-Path Env:NODE_OPTIONS) -or (Test-Path Env:NODE_PATH)) { throw 'B07 refuses Node preload/resolution environment before any child' }
$validator=Join-Path $PSScriptRoot 'b07-current-profile.mjs'
function Assert-B07Binding {
    $checked=& $node $validator verify --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256
    if($LASTEXITCODE -ne 0) { throw 'B07 pure identity/probe verification failed; no retry' }
    return (($checked | Out-String) | ConvertFrom-Json)
}
$binding=Assert-B07Binding
Import-B07PureDispatcher (Join-Path $PSScriptRoot 'run-windows.ps1')
. (Join-Path $PSScriptRoot 'b07-postflight.ps1')
Import-B07PostflightObserver (Join-Path $PSScriptRoot 'run-reference-chart-profile.ps1')
$workerRoot=$profile.spec.workerRepository;$worker=Resolve-NativeAsset $workerRoot 'packages/pptx/test/native-furniture-control.ps1'
$required=@('packages/pptx/test/native-furniture-control.ps1','packages/pptx/test/native-process.ps1','packages/pptx/test/native-process-check.ps1','packages/pptx/test/native-furniture-harness-check.ps1','packages/pptx/test/native-text-probes-check.ps1')
$null=Assert-NativeRepositoryIdentity $workerRoot $profile.workerRepository $required
Import-NativePlanValidation $worker $false $true
Assert-NativeFontCaptureSupport $worker $true
$actions=Read-AndValidateActionPlan $binding.planPath
if($actions -isnot [array] -or $actions.Count -ne 0) { throw 'B07 actions must remain empty' }
$null=Read-AndValidateTextProbePlan $binding.probePath $profile.selectedCase.archiveSha256 $true $actions
$protected=@($profile.output,$profile.spec.suiteDirectory,$profile.spec.producerRepository,$profile.spec.consumer,$workerRoot,$controller,$ExecutionEnvelope,$profile.spec.packedProof,$profile.spec.probePlan,$profile.spec.sourceMapping)
$output=Assert-FreshNativeOutput $OutputDirectory $protected
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'B07 managed/native launcher requires Windows; module tests are Office-free' }
$shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
if(-not (Test-Path -LiteralPath $shell -PathType Leaf)) { throw 'B07 requires maintained Windows PowerShell5 lifecycle' }
[void](New-Item -ItemType Directory -Path $output);[void](New-Item -ItemType Directory -Path (Join-Path $output 'inputs'));[void](New-Item -ItemType Directory -Path (Join-Path $output 'harness'))
$script:b07RunnerPath=Join-Path $output 'runner.json'
$script:b07Runner=[ordered]@{schemaVersion=1;profile=$profile.profile;postflightPolicy=$profile.postflightPolicy;envelopeSha256=$ExpectedEnvelopeSha256;caseId=$profile.selectedCase.id;timeoutSeconds=$TimeoutSeconds;runOfficeRequested=[bool]$RunOffice;status='snapshots-pending';snapshots=@();nativeAcceptance=$false;registryAcceptance=$false}
Write-B07Runner
try {
    $copies=Get-B07SnapshotCopies $ExecutionEnvelope $profile
    foreach($copy in $copies) {
        $identity=Copy-B07Exclusive $copy[0] (Join-Path $output $copy[1])
        if($copy[1] -ceq 'execution-envelope.json') { if($identity.sha256 -cne $ExpectedEnvelopeSha256) { throw 'B07 execution envelope changed during copy' } }
        else {
            $expected=@($profile.snapshots | Where-Object {[string]::Equals($_.path,$copy[1],[StringComparison]::Ordinal)})
            if($expected.Count -ne 1 -or $identity.bytes -ne $expected[0].bytes -or $identity.sha256 -cne $expected[0].sha256) { throw 'B07 input changed during exclusive snapshot copy' }
        }
        $script:b07Runner.snapshots+=@([pscustomobject]@{path=$copy[1];bytes=$identity.bytes;sha256=$identity.sha256});Write-B07Runner
    }
    Assert-NativeFileRecords $output $script:b07Runner.snapshots
    Invoke-NativeChild $shell (Join-Path $workerRoot 'packages/pptx/test/native-process-check.ps1') @('-OutputDirectory',(Join-Path $output 'harness/process')) (Join-Path $output 'process-check.log')
    Invoke-NativeChild $shell (Join-Path $workerRoot 'packages/pptx/test/native-furniture-harness-check.ps1') @('-ScriptPath',$worker,'-ReportPath',(Join-Path $output 'harness/furniture.json')) (Join-Path $output 'furniture-harness.log')
    Invoke-NativeChild $shell (Join-Path $workerRoot 'packages/pptx/test/native-text-probes-check.ps1') @('-ScriptPath',$worker,'-RunnerPath',(Join-Path $PSScriptRoot 'run-windows.ps1')) (Join-Path $output 'text-probes-check.log')
    Invoke-NativeChild $shell (Join-Path $PSScriptRoot 'run-b07-current-profile-self-test.ps1') @() (Join-Path $output 'b07-profile-check.log')
    Invoke-NativeChild $shell (Join-Path $PSScriptRoot 'b07-postflight-self-test.ps1') @() (Join-Path $output 'b07-postflight-check.log')
    $null=Assert-B07Binding;Assert-NativeFileRecords $output $script:b07Runner.snapshots
    $input=Join-Path $output 'inputs/case.pptx';$plan=Join-Path $output 'inputs/action-plan.json';$probe=Join-Path $output 'inputs/text-probe-plan.json'
    $actions=Read-AndValidateActionPlan $plan
    $null=Read-AndValidateTextProbePlan $probe $profile.selectedCase.archiveSha256 $true $actions
    if(-not $RunOffice) { $script:b07Runner.status='pure-checks-completed; native-not-run';Write-B07Runner;return }
    $script:b07Runner.status='native-worker-pending';Write-B07Runner
    # Invoke ordinary existing furniture supervisor. Its own child enforces global-zero/windowless/ownership/fault-latch.
    $arguments=Get-B07WorkerArguments $input $plan $probe (Join-Path $output 'native') $TimeoutSeconds
    Invoke-NativeChild $shell $worker $arguments (Join-Path $output 'native-worker.log')
    $null=Assert-B07Binding;Assert-NativeFileRecords $output $script:b07Runner.snapshots
    $terminal=Get-Content -LiteralPath (Join-Path $output 'native/supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $report=Get-Content -LiteralPath (Join-Path $output 'native/report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($terminal.timedOut -isnot [bool] -or $terminal.timedOut -or $terminal.exitCode -ne 0 -or $terminal.cleanupConfirmed -isnot [bool] -or -not $terminal.cleanupConfirmed -or $report.cleanupConfirmed -isnot [bool] -or -not $report.cleanupConfirmed -or $report.officeOperationsStopped -isnot [bool] -or $report.officeOperationsStopped -or $null -ne $report.error -or $report.lastStage -cne 'worker.complete' -or $report.lastStatus -cne 'success') { throw 'B07 owned worker did not complete; preserve outputs, no retry or cleanup' }
    # NEW prospective policy: the worker's unchanged45s deadline is separate
    # from the exact reviewed5s/100ms/51-query read-only global observation.
    # No PID ownership is inferred and no failed/old runner can enter this path.
    $script:b07Runner.status='native-worker-completed; bounded-postflight-pending';Write-B07Runner
    $checked=& $node $validator verify-postflight --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output
    if($LASTEXITCODE -ne 0) { throw 'B07 completed worker/request/stage/runtime binding failed; no process observation started' }
    $postflightBinding=($checked | Out-String) | ConvertFrom-Json
    Assert-NativeFileRecords $output $postflightBinding.rows
    $native=Join-Path $output 'native';$postflightPath=Join-Path $native 'postflight.jsonl'
    $stream=[IO.File]::Open($postflightPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $writer=[IO.StreamWriter]::new($stream,[Text.UTF8Encoding]::new($false));$watch=[Diagnostics.Stopwatch]::StartNew()
    $postflightRows=[Collections.Generic.List[object]]::new();$postflightResult=$null;$postflightError=$null
    try {
        $append={param($row) $writer.WriteLine(($row | ConvertTo-Json -Compress -Depth 8));$writer.Flush();$postflightRows.Add($row)}
        $evidence=[pscustomobject]@{report=$report;binding=$postflightBinding}
        $postflightResult=Invoke-ReferenceWitnessPostflight $terminal $evidence { @([Diagnostics.Process]::GetProcessesByName('POWERPNT') | ForEach-Object {$_.Id}) } { $watch.Elapsed.TotalMilliseconds } { [DateTime]::UtcNow.ToString('o') } {param($milliseconds) [Threading.Thread]::Sleep($milliseconds)} $append
    } catch { $postflightError=$_.Exception.Message } finally { $watch.Stop();$writer.Dispose() }
    # Preserve the raw first sample, including any nonzero IDs, on every outcome.
    $samples=@($postflightRows | Where-Object {$_.status -ceq 'observed'})
    $initialCount=if($samples.Count -gt 0){@($samples[0].processIds).Count}else{$null}
    $finalCount=if($samples.Count -gt 0){@($samples[-1].processIds).Count}else{$null}
    $postflightIdentity=[ordered]@{path='native/postflight.jsonl';bytes=(Get-Item -LiteralPath $postflightPath).Length;sha256=(Get-FileHash -LiteralPath $postflightPath -Algorithm SHA256).Hash.ToLowerInvariant()}
    if($null -eq $postflightError) {
        try { $null=Assert-B07Binding;Assert-NativeFileRecords $output $postflightBinding.rows }
        catch { $postflightError=$_.Exception.Message }
    }
    $script:b07Runner.postflight=[ordered]@{policy=$profile.postflightPolicy;workerCleanupConfirmed=$postflightBinding.ready.workerCleanupConfirmed;initialCount=$initialCount;finalCount=$finalCount;result=$postflightResult;identity=$postflightIdentity;error=$postflightError};Write-B07Runner
    if($null -ne $postflightError -or $null -eq $postflightResult) { throw 'B07 bounded postflight failed; preserve samples and stop without further query, retry or Office action' }
    $script:b07Runner.status='native-worker-completed; offline-observation-requested';Write-B07Runner
    & $node $validator observe --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output
    if($LASTEXITCODE -ne 0) { throw 'B07 raw offline observation binding failed; preserve all findings' }
    # Success leaves this bound runner immutable. Exclusive observation.json is the completion receipt.
} catch { $script:b07Runner.status='failed; preserve-output; no-retry';$script:b07Runner.error=$_.Exception.Message;Write-B07Runner;throw }
