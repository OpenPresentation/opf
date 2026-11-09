param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$RunOffice
)
$ErrorActionPreference='Stop'

function Assert-DensePlainPath([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\\')) { throw 'Dense survey requires local non-UNC paths' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Dense survey refuses reparse-point paths' }
        $parent=Split-Path -Parent $cursor
        if($parent -eq $cursor) { break }
        $cursor=$parent
    }
    return $full
}
function Assert-DenseControllerBootstrap([string]$Root,$Identity) {
    $rootPath=Assert-DensePlainPath $Root
    if(-not $rootPath.Equals($Identity.directory,[StringComparison]::OrdinalIgnoreCase) -or $Identity.dirty -ne $false) { throw 'Dense controller must be the separately reviewed clean repository' }
    $head=(& git -C $rootPath rev-parse HEAD | Out-String).Trim()
    if($LASTEXITCODE -ne 0 -or $head -cne $Identity.revision) { throw 'Dense controller HEAD changed before contract execution' }
    $status=(& git -C $rootPath status --porcelain --untracked-files=normal | Out-String).Trim()
    if($LASTEXITCODE -ne 0 -or $status -ne '') { throw 'Dense controller must remain clean' }
    if($Identity.files -isnot [array] -or $Identity.files.Count -ne 4) { throw 'Dense controller requires its four exact code identities' }
    $expected=@('scripts/native-acceptance/dense-survey-contract.mjs','scripts/native-acceptance/run-dense-survey-windows.ps1','scripts/native-acceptance/identity.mjs','scripts/native-acceptance/run-windows.ps1')
    foreach($name in $expected) {
        $matches=@($Identity.files | Where-Object { $_.path -ceq $name })
        if($matches.Count -ne 1) { throw 'Missing or duplicate dense controller code input' }
        $record=$matches[0];$file=Assert-DensePlainPath (Join-Path $rootPath $name)
        if(-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -ne $record.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record.sha256) { throw 'Dense controller code changed before execution' }
    }
}
function Import-DensePureHelpers([string]$Runner) {
    $tokens=$null;$errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Runner,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'Reviewed runner helper file did not parse' }
    foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-NativeFileRecords','Assert-FreshNativeOutput','Import-NativePlanValidation','Invoke-NativeChild')) {
        $functions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($functions.Count -ne 1) { throw "Missing or duplicate pure helper: $name" }
        # Only exact already-bound definitions are loaded; never the generic entrypoint.
        $definition=$functions[0].Extent.Text -replace '^function\s+','function script:'
        Invoke-Expression $definition
    }
}
function Copy-DenseSnapshot([string]$Source,[string]$Destination) {
    $bytes=[IO.File]::ReadAllBytes($Source)
    $stream=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
}
function Get-DenseWorkerArguments([string]$InputPath,[string]$PlanPath,[string]$OutputPath,[int]$Seconds) {
    if($Seconds -lt 5 -or $Seconds -gt 60) { throw 'Dense worker timeout must stay within5..60 seconds' }
    return @('-InputPresentation',$InputPath,'-ActionPlan',$PlanPath,'-OutputDirectory',$OutputPath,'-TimeoutSeconds',([string]$Seconds),'-ReadOnlySurvey')
}

# The externally pinned envelope is checked before trusting its executable path.
$envelopePath=Assert-DensePlainPath $ExecutionEnvelope
if(-not (Test-Path -LiteralPath $envelopePath -PathType Leaf)) { throw 'Execution envelope must be one existing file' }
if((Get-Item -LiteralPath $envelopePath).Length -gt 4194304) { throw 'Execution envelope exceeds4MiB' }
if((Get-FileHash -LiteralPath $envelopePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256) { throw 'Execution envelope digest differs' }
$envelope=Get-Content -LiteralPath $envelopePath -Raw -Encoding UTF8 | ConvertFrom-Json
$nodePath=Assert-DensePlainPath $NodeExecutable
if(-not (Test-Path -LiteralPath $nodePath -PathType Leaf) -or -not $nodePath.Equals($envelope.node.path,[StringComparison]::OrdinalIgnoreCase)) { throw 'Node executable differs from reviewed envelope' }
if((Get-Item -LiteralPath $nodePath).Length -ne $envelope.node.identity.bytes -or (Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $envelope.node.identity.sha256) { throw 'Node executable bytes differ' }
$controllerRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-DenseControllerBootstrap $controllerRoot $envelope.controllerRepository
$contract=Join-Path $PSScriptRoot 'dense-survey-contract.mjs'
function Read-DenseBinding {
    Assert-DenseControllerBootstrap $controllerRoot $envelope.controllerRepository
    $value=& $nodePath $contract verify --envelope $envelopePath --expected-envelope-sha256 $ExpectedEnvelopeSha256
    if($LASTEXITCODE -ne 0) { throw 'Dense envelope preflight failed; no worker was started' }
    return ($value | Out-String | ConvertFrom-Json)
}
$binding=Read-DenseBinding
Import-DensePureHelpers (Join-Path $PSScriptRoot 'run-windows.ps1')
$workerRoot=$binding.generation.workerRepository
$worker=Resolve-NativeAsset $workerRoot 'test/native-furniture-control.ps1'
Import-NativePlanValidation $worker $true
$actions=Read-AndValidateActionPlan $binding.planPath
Assert-FurnitureSurvey $true $actions $binding.inputPath
$output=Assert-FreshNativeOutput $OutputDirectory @($binding.generation.suiteDirectory,$binding.generation.preparationRepository,$workerRoot,$binding.generation.consumer,$binding.controllerRepository.directory,$envelopePath)
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'The dense survey launcher is Windows-only; pure contracts require no Office' }
$shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
if(-not (Test-Path -LiteralPath $shell -PathType Leaf)) { throw 'Windows PowerShell is required for the unchanged reviewed delegate' }
[void](New-Item -ItemType Directory -Path $output)
$harness=Join-Path $output 'harness';[void](New-Item -ItemType Directory -Path $harness)
$inputs=Join-Path $output 'inputs';[void](New-Item -ItemType Directory -Path $inputs)
$inputSnapshot=Join-Path $inputs 'case.pptx';$planSnapshot=Join-Path $inputs 'action-plan.json'
$receipt=[ordered]@{schemaVersion=1;profile='dense-events-readonly-v1';envelopeSha256=$ExpectedEnvelopeSha256;generation=$binding.generation;controllerRepository=$binding.controllerRepository;readOnlySurvey=$true;runOfficeRequested=[bool]$RunOffice;timeoutSeconds=$TimeoutSeconds;status='pure-checks-pending';nativeAcceptance=$false;registryAcceptance=$false}
$receiptPath=Join-Path $output 'runner.json';$journal=Join-Path $output 'runner-stages.jsonl'
function Write-DenseReceipt {
    $receipt | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    [ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');status=$receipt.status} | ConvertTo-Json -Compress | Add-Content -LiteralPath $journal -Encoding UTF8
}
Write-DenseReceipt
try {
    Copy-DenseSnapshot $envelopePath (Join-Path $output 'execution-envelope.json')
    Copy-DenseSnapshot $binding.inputPath $inputSnapshot
    Copy-DenseSnapshot $binding.planPath $planSnapshot
    $expectedInput=@($binding.generation.provenance.suiteRepository.files | Where-Object { $_.path -ceq 'scripts/native-acceptance/run-windows.ps1' })
    if($expectedInput.Count -ne 1) { throw 'Missing original generator source identity' }
    Invoke-NativeChild $shell (Join-Path $workerRoot 'test/native-process-check.ps1') @('-OutputDirectory',(Join-Path $harness 'process')) (Join-Path $output 'process-check.log')
    Invoke-NativeChild $shell (Join-Path $workerRoot 'test/native-furniture-harness-check.ps1') @('-ScriptPath',$worker,'-ReportPath',(Join-Path $harness 'furniture.json')) (Join-Path $output 'furniture-harness.log')
    $again=Read-DenseBinding
    if($again.envelopeSha256 -cne $binding.envelopeSha256) { throw 'Execution envelope changed during pure checks' }
    $plan=Read-AndValidateActionPlan $planSnapshot
    Assert-FurnitureSurvey $true $plan $inputSnapshot
    if((Get-FileHash -LiteralPath $inputSnapshot -Algorithm SHA256).Hash.ToLowerInvariant() -cne $binding.generation.selectedCase.archiveSha256 -or (Get-FileHash -LiteralPath (Join-Path $output 'execution-envelope.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256) { throw 'Owned input snapshot changed' }
    $originalPlanHash=(Get-FileHash -LiteralPath $binding.planPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if((Get-FileHash -LiteralPath $planSnapshot -Algorithm SHA256).Hash.ToLowerInvariant() -cne $originalPlanHash) { throw 'Owned plan snapshot changed' }
    if(-not $RunOffice) { $receipt.status='pure-checks-completed; native-not-run';Write-DenseReceipt;return }
    # Only this explicitly requested delegate can perform COM. Its reviewed idle,
    # ownership, failure latch, process supervisor and60-second cap are unchanged.
    $receipt.status='native-worker-pending';Write-DenseReceipt
    $workerArguments=Get-DenseWorkerArguments $inputSnapshot $planSnapshot (Join-Path $output 'native') $TimeoutSeconds
    Invoke-NativeChild $shell $worker $workerArguments (Join-Path $output 'native-worker.log')
    $null=Read-DenseBinding
    & $nodePath $contract observe --envelope $envelopePath --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output *> (Join-Path $output 'observation-binding.log')
    if($LASTEXITCODE -ne 0) { throw 'Native observation failed its exact profile binding; preserve the attempt, no retry' }
    $receipt.status='native-observation-completed; acceptance-requires-supervisor-review';Write-DenseReceipt
} catch {
    $receipt.status='failed; no-retry';$receipt.error=$_.Exception.Message;Write-DenseReceipt
    throw
}
