param(
    [Parameter(Mandatory=$true)][string]$SuiteDirectory,
    [Parameter(Mandatory=$true)][string]$PptxRepository,
    [Parameter(Mandatory=$true)][string]$Case,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$ValidateOnly,
    [switch]$CaptureTextFonts,
    [switch]$ReadOnlySurvey,
    [switch]$CaptureTextProbes,
    [string]$ExecutionEnvelope='',
    [string]$ExpectedEnvelopeSha256='',
    [string]$ExpectedRequestSha256='',
    [string]$NodeExecutable='',
    [switch]$RunOffice,
    [switch]$DenseEvents,
    [switch]$ReferenceNameEdit
)
$ErrorActionPreference='Stop'

function Assert-PlainNativePath([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\\')) { throw 'Native inputs and outputs must use local paths, not UNC shares' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Reparse-point path is forbidden: $cursor" }
        $parent=Split-Path -Parent $cursor
        if($parent -eq $cursor) { break }
        $cursor=$parent
    }
    return $full
}
function Resolve-NativeAsset([string]$Root,[string]$Relative) {
    if([string]::IsNullOrEmpty($Relative) -or $Relative.Contains('\') -or $Relative -match '[\x00-\x1f<>:"|?*]' -or [IO.Path]::IsPathRooted($Relative)) { throw 'Asset must have a portable relative path' }
    foreach($part in $Relative.Split('/')) {
        if($part -eq '' -or $part -in @('.','..') -or $part -match '[. ]$') { throw 'Invalid relative asset path segment' }
    }
    $rootPath=Assert-PlainNativePath $Root
    $full=Assert-PlainNativePath (Join-Path $rootPath $Relative)
    if(-not $full.StartsWith($rootPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Asset escaped its root' }
    $item=Get-Item -LiteralPath $full -Force
    if($item.PSIsContainer) { throw 'Asset must be a regular file' }
    return $full
}
function Assert-NativeFileRecords([string]$Root,$Records) {
    if($Records -isnot [array] -or $Records.Count -eq 0 -or $Records.Count -gt 1000) { throw 'Identity files must be a nonempty bounded list' }
    $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($file in $Records) {
        if($file.path -isnot [string] -or -not $seen.Add($file.path)) { throw 'Identity has invalid or duplicate file paths' }
        if($file.sha256 -isnot [string] -or $file.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Identity requires a lowercase SHA-256' }
        if(($file.bytes -isnot [int] -and $file.bytes -isnot [long]) -or $file.bytes -lt 0) { throw 'Identity requires an exact nonnegative byte count' }
        $full=Resolve-NativeAsset $Root $file.path
        if((Get-Item -LiteralPath $full).Length -ne $file.bytes -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $file.sha256) { throw "File identity differs: $($file.path)" }
    }
}
function Assert-NativeRepositoryIdentity([string]$Root,$Identity,[string[]]$RequiredFiles) {
    $rootPath=Assert-PlainNativePath $Root
    if($Identity.revision -isnot [string] -or $Identity.revision -cnotmatch '^[a-f0-9]{40}$' -or $Identity.dirty -isnot [bool]) { throw 'Repository identity requires revision and boolean dirty state' }
    $revision=(& git -C $rootPath rev-parse HEAD | Out-String).Trim()
    if($LASTEXITCODE -ne 0 -or $revision -cne $Identity.revision) { throw 'Repository revision differs from suite provenance' }
    $status=(& git -C $rootPath status --porcelain --untracked-files=normal | Out-String).Trim()
    if($LASTEXITCODE -ne 0 -or ($status -ne '') -ne $Identity.dirty) { throw 'Repository dirty state differs from suite provenance' }
    Assert-NativeFileRecords $rootPath $Identity.files
    foreach($required in $RequiredFiles) {
        if(@($Identity.files | Where-Object { $_.path -ceq $required }).Count -ne 1) { throw "Missing recorded code input: $required" }
    }
    return [ordered]@{revision=$revision;dirty=($status -ne '');files=$Identity.files}
}
function Read-NativeSuite([string]$Directory,[string]$CaseId) {
    $root=Assert-PlainNativePath $Directory
    $manifest=Resolve-NativeAsset $root 'suite.json'
    $suite=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if(($suite.schemaVersion -isnot [int] -and $suite.schemaVersion -isnot [long]) -or $suite.schemaVersion -ne 1 -or $suite.cases -isnot [array] -or $suite.cases.Count -eq 0 -or $suite.cases.Count -gt 1000 -or $null -eq $suite.provenance) { throw 'Unsupported or incomplete suite manifest' }
    Assert-NativeFileRecords $root $suite.files
    $ids=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($item in $suite.cases) {
        if($item.id -isnot [string] -or $item.id -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$' -or -not $ids.Add($item.id)) { throw 'Suite has invalid or duplicate case IDs' }
    }
    $matches=@($suite.cases | Where-Object { $_.id -ceq $CaseId })
    if($matches.Count -ne 1) { throw 'Select one exact case ID from the suite' }
    $selected=$matches[0]
    if($selected.worker -cne 'furniture') { throw 'This runner accepts only the declared furniture worker; dedicated/manual routes remain separate' }
    if($selected.automaticControlEligible -isnot [bool] -or -not $selected.automaticControlEligible) { throw 'This case requires manual review and is not eligible for the automatic furniture control' }
    foreach($field in @('input','actionPlan')) {
        if($selected.$field -isnot [string] -or @($suite.files | Where-Object { $_.path -ceq $selected.$field }).Count -ne 1) { throw "Selected $field must name one recorded suite asset" }
    }
    $inputPath=Resolve-NativeAsset $root $selected.input
    $planPath=Resolve-NativeAsset $root $selected.actionPlan
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx' -or [IO.Path]::GetExtension($planPath) -ine '.json') { throw 'Selected case needs a PPTX input and JSON action plan' }
    if($null -ne $selected.archiveSha256 -and $selected.archiveSha256 -cne (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()) { throw 'Case archive identity differs from its file record' }
    return [ordered]@{root=$root;manifest=$manifest;manifestSha256=(Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant();suite=$suite;selected=$selected;inputPath=$inputPath;planPath=$planPath}
}
function Assert-FreshNativeOutput([string]$Directory,[string[]]$ProtectedRoots) {
    $full=Assert-PlainNativePath $Directory
    if(Test-Path -LiteralPath $full) { throw 'Preserve prior attempts and select a fresh output directory' }
    $parent=Get-Item -LiteralPath (Split-Path -Parent $full) -Force
    if(-not $parent.PSIsContainer) { throw 'Output parent must already be a directory' }
    foreach($root in $ProtectedRoots) {
        $protected=Assert-PlainNativePath $root
        if($full.Equals($protected,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($protected+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $protected.StartsWith($full+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Output must be separate from suite and code repositories' }
    }
    return $full
}
function Import-NativePlanValidation([string]$Worker,[bool]$Survey=$false,[bool]$Probes=$false) {
    $tokens=$null;$parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Worker,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
    $definitions=@('Test-Integer','Require-Property','Assert-String','Assert-LiteralSeriesName','Read-AndValidateActionPlan')
    if($Survey) {
        $surveyParameter=@($ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -ceq 'ReadOnlySurvey' })
        if($surveyParameter.Count -ne 1 -or $surveyParameter[0].StaticType -ne [System.Management.Automation.SwitchParameter]) { throw 'Selected worker does not support reviewed read-only survey mode' }
        $definitions+=@('Get-FurnitureSurveySlideCount','Assert-FurnitureSurvey')
    }
    if($Probes) { $definitions+=@('Assert-FurnitureProbeKeys','Test-FurnitureProbeFinite','Read-AndValidateTextProbePlan') }
    foreach($name in $definitions) {
        $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
        if($null -eq $function) { throw "Missing pure plan validator: $name" }
        # Only these pure definitions are loaded; no worker entrypoint or Office operation is evaluated.
        # Preserve inline parameters as well as the body; Body alone drops the
        # worker's ([string]$Path) signature and makes action-plan paths null.
        $definition=$function.Extent.Text -replace '^function\s+', 'function script:'
        Invoke-Expression $definition
    }
}
function Assert-NativeFontCaptureSupport([string]$Worker,[bool]$Requested) {
    if(-not $Requested) { return }
    $tokens=$null;$errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Worker,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'Font-capture worker has parser errors' }
    $parameters=@($ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -ceq 'CaptureTextFonts' })
    if($parameters.Count -ne 1 -or $parameters[0].StaticType -ne [System.Management.Automation.SwitchParameter]) { throw 'Selected worker does not support the reviewed CaptureTextFonts switch' }
}
function Get-NativeFontCaptureArguments([bool]$Requested) {
    if($Requested) { return '-CaptureTextFonts' }
}
function Read-NativeTextProbeBinding($Binding,[string]$Worker,[bool]$Requested,[bool]$Fonts,$Actions) {
    if(-not $Requested) { return $null }
    if(-not $Fonts -or $Actions -isnot [array] -or $Actions.Count -ne 0) { throw 'Text probes require CaptureTextFonts and an empty action plan' }
    $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Worker,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'Text probe worker has parser errors' }
    $parameter=@($ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -ceq 'TextProbePlan' })
    if($parameter.Count -ne 1 -or $parameter[0].StaticType -ne [string]) { throw 'Selected worker lacks the reviewed TextProbePlan parameter' }
    $relative=$Binding.selected.textProbePlan
    if($relative -isnot [string]) { throw 'Selected case must declare a sealed textProbePlan asset' }
    $records=@($Binding.suite.files | Where-Object { $_.path -ceq $relative })
    if($records.Count -ne 1) { throw 'Text probe plan must name exactly one sealed suite file' }
    $probePath=Resolve-NativeAsset $Binding.root $relative
    $null=Read-AndValidateTextProbePlan $probePath (Get-FileHash -LiteralPath $Binding.inputPath -Algorithm SHA256).Hash.ToLowerInvariant() $Fonts $Actions
    return [ordered]@{path=$probePath;record=$records[0]}
}
function Invoke-NativeChild([string]$Shell,[string]$Script,[string[]]$Arguments,[string]$Log) {
    & $Shell -NoProfile -NonInteractive -File $Script @Arguments *> $Log
    if($LASTEXITCODE -ne 0) { throw "Child failed; preserve $Log. No retry was started." }
}

# Explicit prospective mode. The unchanged legacy path below still requires
# exact producer provenance; this mode never selects that legacy entrypoint.
if($DenseEvents -and $ReferenceNameEdit){throw 'Choose one closed furniture route'}
if($ExecutionEnvelope -cne '') {
    if($ReadOnlySurvey -or $CaptureTextProbes -or ($ValidateOnly -and $RunOffice)){throw 'Typed ordinary furniture refuses survey/probe or conflicting execution modes'}
    if($ExpectedEnvelopeSha256 -cnotmatch '^[a-f0-9]{64}$' -or $ExpectedRequestSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $ExecutionEnvelope).Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'Exact external furniture envelope/request pins required'}
    $profile=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8 | ConvertFrom-Json
    $controller=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
    $expectedProfile=if($ReferenceNameEdit){'reference-line-one-series-name-edit-v1'}elseif($DenseEvents){'full59-dense-events-furniture-lifecycle-v1'}else{'full59-ordinary-furniture-lifecycle-v1'}
    if($profile.profile -cne $expectedProfile -or $profile.controller.directory -cne $controller -or $profile.controller.dirty -isnot [bool] -or $profile.controller.dirty){throw 'Wrong clean furniture controller'}
    $null=Assert-NativeRepositoryIdentity $controller $profile.controller @('scripts/native-acceptance/run-windows.ps1','scripts/native-acceptance/furniture-profile.mjs','scripts/native-acceptance/furniture-postflight.ps1','scripts/native-acceptance/owned-postflight.ps1','scripts/native-acceptance/run-reference-chart-profile.ps1')
    $node=Assert-PlainNativePath $NodeExecutable
    if($node -cne $NodeExecutable -or $node -cne $profile.node.path -or (Get-Item -LiteralPath $node).Length -ne $profile.node.identity.bytes -or (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant() -cne $profile.node.identity.sha256 -or (Test-Path Env:NODE_OPTIONS) -or (Test-Path Env:NODE_PATH)){throw 'Exact non-preloaded furniture Node required'}
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Typed furniture launcher requires separate Windows assignment'}
    . (Join-Path $PSScriptRoot 'owned-postflight.ps1')
    . (Join-Path $PSScriptRoot 'furniture-postflight.ps1')
    Invoke-FurnitureTypedRunner -Envelope $ExecutionEnvelope -Sha256 $ExpectedEnvelopeSha256 -RequestSha256 $ExpectedRequestSha256 -Node $node -Suite $SuiteDirectory -WorkerRoot $PptxRepository -CaseId $Case -Output $OutputDirectory -Seconds $TimeoutSeconds -Office ([bool]$RunOffice) -Fonts ([bool]$CaptureTextFonts) -DenseEvents:$DenseEvents -ReferenceNameEdit:$ReferenceNameEdit
    return
}
if($DenseEvents -or $ReferenceNameEdit -or $RunOffice -or $ExpectedEnvelopeSha256 -cne '' -or $ExpectedRequestSha256 -cne '' -or $NodeExecutable -cne ''){throw 'Typed furniture arguments require an explicit envelope'}

# All identity, eligibility, path and plan refusals precede output creation and Office.
$binding=Read-NativeSuite $SuiteDirectory $Case
$workerRoot=Assert-PlainNativePath $PptxRepository
$suiteRoot=Assert-PlainNativePath (Join-Path $PSScriptRoot '../..')
$workerIdentity=Assert-NativeRepositoryIdentity $workerRoot $binding.suite.provenance.workerRepository @('test/native-furniture-control.ps1','test/native-process.ps1','test/native-process-check.ps1','test/native-furniture-harness-check.ps1')
$suiteIdentity=Assert-NativeRepositoryIdentity $suiteRoot $binding.suite.provenance.suiteRepository @('scripts/native-acceptance/run-windows.ps1')
$worker=Resolve-NativeAsset $workerRoot 'test/native-furniture-control.ps1'
Import-NativePlanValidation $worker ([bool]$ReadOnlySurvey) ([bool]$CaptureTextProbes)
Assert-NativeFontCaptureSupport $worker ([bool]$CaptureTextFonts)
$validatedActions=Read-AndValidateActionPlan $binding.planPath
$probeBinding=Read-NativeTextProbeBinding $binding $worker ([bool]$CaptureTextProbes) ([bool]$CaptureTextFonts) $validatedActions
if($ReadOnlySurvey) {
    if(-not (Test-Integer $binding.selected.slideCount) -or $binding.selected.slideCount -ne 1) { throw 'Read-only survey requires exactly one declared slide' }
    Assert-FurnitureSurvey $true $validatedActions $binding.inputPath
}
$output=Assert-FreshNativeOutput $OutputDirectory @($binding.root,$workerRoot,$suiteRoot)
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Run this entrypoint on Windows; pure self-tests do not require Office' }
$shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
if(-not (Test-Path -LiteralPath $shell -PathType Leaf)) { throw 'Windows PowerShell is required for the existing native worker' }
[void](New-Item -ItemType Directory -Path $output)
$harness=Join-Path $output 'harness';[void](New-Item -ItemType Directory -Path $harness)
$receipt=[ordered]@{schemaVersion=1;case=$Case;timestamp=(Get-Date).ToUniversalTime().ToString('o');manifestSha256=$binding.manifestSha256;selectedCase=$binding.selected;provenance=$binding.suite.provenance;executingCode=[ordered]@{suite=$suiteIdentity;workers=$workerIdentity};timeoutSeconds=$TimeoutSeconds;status='pure-checks-pending';nativeAcceptance=$false;registryAcceptance=$false}
if($CaptureTextFonts) { $receipt.captureTextFonts=$true }
if($ReadOnlySurvey) { $receipt.readOnlySurvey=$true }
$snapshots=Join-Path $output 'inputs';[void](New-Item -ItemType Directory -Path $snapshots)
$inputSnapshot=Join-Path $snapshots 'case.pptx';$planSnapshot=Join-Path $snapshots 'action-plan.json'
$expectedInput=@($binding.suite.files | Where-Object { $_.path -ceq $binding.selected.input })[0]
$expectedPlan=@($binding.suite.files | Where-Object { $_.path -ceq $binding.selected.actionPlan })[0]
$snapshotRecords=@([pscustomobject]@{path='case.pptx';sha256=$expectedInput.sha256;bytes=$expectedInput.bytes},[pscustomobject]@{path='action-plan.json';sha256=$expectedPlan.sha256;bytes=$expectedPlan.bytes})
$probeSnapshot=$null
if($null -ne $probeBinding) {
    $probeSnapshot=Join-Path $snapshots 'text-probe-plan.json'
    $snapshotRecords+=@([pscustomobject]@{path='text-probe-plan.json';sha256=$probeBinding.record.sha256;bytes=$probeBinding.record.bytes})
    $receipt.textProbePlan=[ordered]@{source=$probeBinding.record;snapshotPath=$probeSnapshot;nativeAcceptance=$false}
}
$receiptPath=Join-Path $output 'runner.json'
function Write-RunnerReceipt { $receipt | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $receiptPath -Encoding UTF8 }
Write-RunnerReceipt
try {
    Copy-Item -LiteralPath $binding.inputPath -Destination $inputSnapshot
    Copy-Item -LiteralPath $binding.planPath -Destination $planSnapshot
    if($null -ne $probeBinding) { Copy-Item -LiteralPath $probeBinding.path -Destination $probeSnapshot }
    Assert-NativeFileRecords $snapshots $snapshotRecords
    Invoke-NativeChild $shell (Join-Path $workerRoot 'test/native-process-check.ps1') @('-OutputDirectory',(Join-Path $harness 'process')) (Join-Path $output 'process-check.log')
    Invoke-NativeChild $shell (Join-Path $workerRoot 'test/native-furniture-harness-check.ps1') @('-ScriptPath',$worker,'-ReportPath',(Join-Path $harness 'furniture.json')) (Join-Path $output 'furniture-harness.log')
    $again=Read-NativeSuite $SuiteDirectory $Case
    if($again.manifestSha256 -cne $binding.manifestSha256) { throw 'Suite manifest changed during pure checks' }
    $null=Assert-NativeRepositoryIdentity $workerRoot $binding.suite.provenance.workerRepository @('test/native-furniture-control.ps1')
    $null=Assert-NativeRepositoryIdentity $suiteRoot $binding.suite.provenance.suiteRepository @('scripts/native-acceptance/run-windows.ps1')
    if($ValidateOnly) { $receipt.status='pure-checks-completed; native-not-run';Write-RunnerReceipt;return }
    $validatedActions=Read-AndValidateActionPlan $planSnapshot
    if($ReadOnlySurvey) { Assert-FurnitureSurvey $true $validatedActions $inputSnapshot }
    Assert-NativeFileRecords $snapshots $snapshotRecords
    if($null -ne $probeBinding) { $null=Read-AndValidateTextProbePlan $probeSnapshot (Get-FileHash -LiteralPath $inputSnapshot -Algorithm SHA256).Hash.ToLowerInvariant() ([bool]$CaptureTextFonts) $validatedActions }
    $receipt.status='native-worker-pending';Write-RunnerReceipt
    $workerArguments=@('-InputPresentation',$inputSnapshot,'-ActionPlan',$planSnapshot,'-OutputDirectory',(Join-Path $output 'native'),'-TimeoutSeconds',([string]$TimeoutSeconds)) + @(Get-NativeFontCaptureArguments ([bool]$CaptureTextFonts))
    if($ReadOnlySurvey) { $workerArguments+='-ReadOnlySurvey' }
    if($null -ne $probeBinding) { $workerArguments+=@('-TextProbePlan',$probeSnapshot) }
    Invoke-NativeChild $shell $worker $workerArguments (Join-Path $output 'native-worker.log')
    $terminal=Get-Content -LiteralPath (Join-Path $output 'native/supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($terminal.timedOut -ne $false -or $terminal.exitCode -ne 0 -or $terminal.cleanupConfirmed -ne $true) { throw 'Worker did not confirm successful completion and cleanup; preserve the attempt and inspect Office' }
    $after=Read-NativeSuite $SuiteDirectory $Case
    if($after.manifestSha256 -cne $binding.manifestSha256) { throw 'Original suite changed during native observation' }
    $receipt.status='native-observation-completed; acceptance-requires-supervisor-review';Write-RunnerReceipt
} catch {
    $receipt.status='failed; no-retry';$receipt.error=$_.Exception.Message;Write-RunnerReceipt
    throw
}
