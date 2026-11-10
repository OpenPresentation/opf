param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$RunOffice
)
$ErrorActionPreference='Stop'

# These bootstrap definitions are also AST-loaded by the hash-bound worker.
function Assert-ReferenceWitnessBootstrapPath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or $Path -match '[\x00-\x1f]' -or -not [IO.Path]::IsPathRooted($Path)) { throw 'ReferenceWitness bootstrap requires an absolute local path' }
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\')) { throw 'ReferenceWitness bootstrap refuses UNC paths' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'ReferenceWitness bootstrap refuses aliased paths' }
        $parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent
    }
    return $full
}
function Read-ReferenceWitnessBootstrapEnvelope([string]$Path,[string]$Sha256) {
    $full=Assert-ReferenceWitnessBootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($file.PSIsContainer -or $file.Length -gt 4194304 -or $Sha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Sha256) { throw 'External referenceWitness execution envelope SHA-256/size differs' }
    $value=Get-Content -LiteralPath $full -Raw -Encoding UTF8 | ConvertFrom-Json
    if($value.schemaVersion -ne 1 -or $value.profile -cne 'reference-chart-original-readonly-v1' -or $value.nativeAcceptance -isnot [bool] -or $value.nativeAcceptance -or $value.registryAcceptance -isnot [bool] -or $value.registryAcceptance) { throw 'Unsupported referenceWitness execution envelope' }
    return $value
}
function Assert-ReferenceWitnessBootstrapNode([string]$Path,$Identity) {
    $full=Assert-ReferenceWitnessBootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($full -cne $Identity.path -or $Identity.version -cnotmatch '^v24\.' -or $file.PSIsContainer -or $file.Length -ne $Identity.identity.bytes -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Identity.identity.sha256) { throw 'Pinned referenceWitness Node executable differs' }
}
function Assert-ReferenceWitnessBootstrapController([string]$Root,$Identity) {
    $full=Assert-ReferenceWitnessBootstrapPath $Root
    if($full -ine $Identity.directory -or $Identity.dirty -isnot [bool] -or $Identity.dirty -or $Identity.revision -cnotmatch '^[a-f0-9]{40}$') { throw 'ReferenceWitness controller requires its separate clean Git identity' }
    $head=(& git -C $full rev-parse HEAD | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $Identity.revision) { throw 'ReferenceWitness controller HEAD differs' }
    $status=(& git -C $full status --porcelain --untracked-files=normal | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne '') { throw 'ReferenceWitness controller must remain clean' }
    $required=@('scripts/native-acceptance/reference-chart-profile.mjs','scripts/native-acceptance/reference-chart-archive.mjs','scripts/native-acceptance/reference-runtime-routes.mjs','scripts/native-acceptance/run-reference-chart-profile.ps1','scripts/native-acceptance/reference-chart-worker.ps1','scripts/native-acceptance/identity.mjs','scripts/native-acceptance/run-windows.ps1')
    if($Identity.files -isnot [array] -or $Identity.files.Count -ne $required.Count) { throw 'ReferenceWitness controller requires all seven exact code identities' }
    foreach($name in $required) {
        $matches=@($Identity.files | Where-Object {$_.path -ceq $name});if($matches.Count -ne 1) { throw 'Missing/duplicate referenceWitness controller code identity' }
        $file=Assert-ReferenceWitnessBootstrapPath (Join-Path $full $name);$item=Get-Item -LiteralPath $file -Force
        if($item.PSIsContainer -or $item.Length -ne $matches[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $matches[0].sha256) { throw 'ReferenceWitness controller code bytes differ' }
    }
}
function Import-ReferenceWitnessPurePaths([string]$Path) {
    $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'ReferenceWitness bound path helper has parse errors' }
    foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-FreshNativeOutput')) {
        $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
        if($found.Count -ne 1) { throw 'Missing/duplicate pure path definition' }
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}
function Copy-ReferenceWitnessExclusive([string]$Source,[string]$Destination) {
    $input=[IO.File]::OpenRead($Source)
    try { $target=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try {$input.CopyTo($target)} finally {$target.Dispose()} } finally {$input.Dispose()}
    return [ordered]@{bytes=(Get-Item -LiteralPath $Destination).Length;sha256=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Write-ReferenceWitnessRunner { $script:referenceWitnessRunner | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $script:referenceWitnessRunnerPath -Encoding UTF8 }

# No executable path, imported definition, child or Office query precedes these checks.
$profile=Read-ReferenceWitnessBootstrapEnvelope $ExecutionEnvelope $ExpectedEnvelopeSha256
Assert-ReferenceWitnessBootstrapNode $NodeExecutable $profile.node
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-ReferenceWitnessBootstrapController $controller $profile.controllerRepository
$validator=Join-Path $PSScriptRoot 'reference-chart-profile.mjs'
$checked=& $NodeExecutable $validator verify --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256
if($LASTEXITCODE -ne 0) { throw 'ReferenceWitness pure verification failed; Office was not started' }
$binding=($checked | Out-String) | ConvertFrom-Json
Import-ReferenceWitnessPurePaths (Join-Path $PSScriptRoot 'run-windows.ps1')
$protected=@($profile.generation.suiteDirectory,$profile.generation.preparationRepository,$profile.generation.workerRepository,$profile.generation.consumer,$controller,$ExecutionEnvelope)
$output=Assert-FreshNativeOutput $OutputDirectory $protected
[void](New-Item -ItemType Directory -Path $output)
[void](New-Item -ItemType Directory -Path (Join-Path $output 'inputs'))
$script:referenceWitnessRunnerPath=Join-Path $output 'runner.json'
$script:referenceWitnessRunner=[ordered]@{schemaVersion=1;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;timeoutSeconds=$TimeoutSeconds;runOfficeRequested=[bool]$RunOffice;nativeAcceptance=$false;registryAcceptance=$false;status='snapshots-pending';snapshots=@()}
Write-ReferenceWitnessRunner
try {
    $copies=@(@($ExecutionEnvelope,'execution-envelope.json'),@($binding.inputPath,'inputs/case.pptx'),@($binding.planPath,'inputs/action-plan.json'),@((Join-Path $PSScriptRoot 'reference-chart-worker.ps1'),'inputs/reference-chart-worker.ps1'),@((Join-Path $profile.generation.workerRepository 'test/native-process.ps1'),'inputs/native-process.ps1'))
    foreach($copy in $copies) { $id=Copy-ReferenceWitnessExclusive $copy[0] (Join-Path $output $copy[1]);$script:referenceWitnessRunner.snapshots+=@([ordered]@{path=$copy[1];bytes=$id.bytes;sha256=$id.sha256});Write-ReferenceWitnessRunner }
    $script:referenceWitnessRunner.status=if($RunOffice){'native-worker-pending'}else{'pure-checks-completed; native-not-run'};Write-ReferenceWitnessRunner
    & $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
    if($LASTEXITCODE -ne 0) { throw 'ReferenceWitness owned execution snapshot verification failed' }
    if(-not $RunOffice) { return }
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'ReferenceWitness Office execution requires Windows and explicit coordinator authorization' }
    # The unchanged ce92 supervisor is loaded only after explicit RunOffice and all pure checks.
    $native=Join-Path $output 'native';[void](New-Item -ItemType Directory -Path $native)
    . (Join-Path $output 'inputs/native-process.ps1')
    $arguments=@('-ExecutionEnvelope',(Join-Path $output 'execution-envelope.json'),'-ExpectedEnvelopeSha256',$ExpectedEnvelopeSha256,'-NodeExecutable',$NodeExecutable,'-OutputDirectory',$native,'-TimeoutSeconds',"$TimeoutSeconds",'-Worker')
    $terminal=Invoke-OpfNativeWorker -ScriptPath (Join-Path $output 'inputs/reference-chart-worker.ps1') -WorkerArguments $arguments -OutputDirectory $native -TimeoutSeconds $TimeoutSeconds
    # No COM cleanup on any outcome. Raw worker.json remains the original supervisor's receipt.
    $success=(-not $terminal.timedOut -and $terminal.exitCode -eq 0)
    $reportPath=Join-Path $native 'report.json';$report=$null
    if($success -and (Test-Path -LiteralPath $reportPath -PathType Leaf)) { $report=Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json }
    $confirmed=($success -and $null -ne $report -and $report.cleanupConfirmed -ceq $true -and $report.officeOperationsStopped -ceq $false -and $report.lastStage -ceq 'worker.complete' -and $report.lastStatus -ceq 'success')
    $remaining=$null
    if($confirmed) { $remaining=@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count;$confirmed=($remaining -eq 0) }
    [ordered]@{schemaVersion=1;profile=$profile.profile;timedOut=[bool]$terminal.timedOut;exitCode=$terminal.exitCode;cleanupConfirmed=[bool]$confirmed;powerPointPostflightCount=$remaining;originalSupervisorSha256='b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c';nativeAcceptance=$false;registryAcceptance=$false} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
    if(-not $confirmed) { throw 'ReferenceWitness worker failed or cleanup is unconfirmed; preserve outputs and stop. No retry or COM cleanup was attempted.' }
    & $NodeExecutable $validator observe --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output
    if($LASTEXITCODE -ne 0) { throw 'ReferenceWitness offline observation binding failed; preserve the native outputs' }
    $script:referenceWitnessRunner.status='native-observation-completed; supervisor-review-required';Write-ReferenceWitnessRunner
} catch {
    $script:referenceWitnessRunner.status='failed; preserve-output; no-retry';$script:referenceWitnessRunner.error=$_.Exception.Message;Write-ReferenceWitnessRunner
    throw
}
