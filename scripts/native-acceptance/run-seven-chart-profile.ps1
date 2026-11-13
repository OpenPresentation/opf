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
function Assert-SevenBootstrapPath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or $Path -match '[\x00-\x1f]' -or -not [IO.Path]::IsPathRooted($Path)) { throw 'Seven bootstrap requires an absolute local path' }
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\')) { throw 'Seven bootstrap refuses UNC paths' }
    $cursor=$full
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Seven bootstrap refuses aliased paths' }
        $parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent
    }
    return $full
}
function Read-SevenBootstrapEnvelope([string]$Path,[string]$Sha256) {
    $full=Assert-SevenBootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($file.PSIsContainer -or $file.Length -gt 4194304 -or $Sha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Sha256) { throw 'External seven execution envelope SHA-256/size differs' }
    $value=Get-Content -LiteralPath $full -Raw -Encoding UTF8 | ConvertFrom-Json
    if($value.schemaVersion -ne 2 -or $value.profile -cne 'seven-chart-original-readonly-v2' -or $value.nativeAcceptance -isnot [bool] -or $value.nativeAcceptance -or $value.registryAcceptance -isnot [bool] -or $value.registryAcceptance) { throw 'Unsupported seven execution envelope' }
    return $value
}
function Assert-SevenBootstrapNode([string]$Path,$Identity) {
    $full=Assert-SevenBootstrapPath $Path;$file=Get-Item -LiteralPath $full -Force
    if($full -cne $Identity.path -or $Identity.version -cnotmatch '^v24\.' -or $file.PSIsContainer -or $file.Length -ne $Identity.identity.bytes -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Identity.identity.sha256) { throw 'Pinned seven Node executable differs' }
}
function Assert-SevenBootstrapController([string]$Root,$Identity) {
    $full=Assert-SevenBootstrapPath $Root
    if($full -ine $Identity.directory -or $Identity.dirty -isnot [bool] -or $Identity.dirty -or $Identity.revision -cnotmatch '^[a-f0-9]{40}$') { throw 'Seven controller requires its separate clean Git identity' }
    $head=(& git -C $full rev-parse HEAD | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $Identity.revision) { throw 'Seven controller HEAD differs' }
    $status=(& git -C $full status --porcelain --untracked-files=normal | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne '') { throw 'Seven controller must remain clean' }
    $required=@('scripts/native-acceptance/identity.mjs','scripts/native-acceptance/owned-postflight.mjs','scripts/native-acceptance/owned-postflight.ps1','scripts/native-acceptance/reference-chart-archive.mjs','scripts/native-acceptance/reference-chart-profile.mjs','scripts/native-acceptance/reference-runtime-routes.mjs','scripts/native-acceptance/run-reference-chart-profile.ps1','scripts/native-acceptance/run-seven-chart-profile.ps1','scripts/native-acceptance/run-windows.ps1','scripts/native-acceptance/seven-chart-archive.mjs','scripts/native-acceptance/seven-chart-profile.mjs','scripts/native-acceptance/seven-chart-worker.ps1','scripts/native-acceptance/seven-postflight.mjs','scripts/native-acceptance/seven-postflight.ps1')
    $required+=@('scripts/native-acceptance/seven-signed-pareto.mjs','scripts/native-acceptance/chart-data-contract.mjs')
    if($Identity.files -isnot [array] -or $Identity.files.Count -ne $required.Count) { throw 'Seven controller requires the exact closed controller dependency identities' }
    foreach($name in $required) {
        $matches=@($Identity.files | Where-Object {$_.path -ceq $name});if($matches.Count -ne 1) { throw 'Missing/duplicate seven controller code identity' }
        $file=Assert-SevenBootstrapPath (Join-Path $full $name);$item=Get-Item -LiteralPath $file -Force
        if($item.PSIsContainer -or $item.Length -ne $matches[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $matches[0].sha256) { throw 'Seven controller code bytes differ' }
    }
}
function Import-SevenPurePaths([string]$Path) {
    $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'Seven bound path helper has parse errors' }
    foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-FreshNativeOutput')) {
        $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
        if($found.Count -ne 1) { throw 'Missing/duplicate pure path definition' }
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}
function Copy-SevenExclusive([string]$Source,[string]$Destination) {
    $input=[IO.File]::OpenRead($Source)
    try { $target=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try {$input.CopyTo($target)} finally {$target.Dispose()} } finally {$input.Dispose()}
    return [ordered]@{bytes=(Get-Item -LiteralPath $Destination).Length;sha256=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Write-SevenRunner { $script:sevenRunner | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $script:sevenRunnerPath -Encoding UTF8 }

# No executable path, imported definition, child or Office query precedes these checks.
$profile=Read-SevenBootstrapEnvelope $ExecutionEnvelope $ExpectedEnvelopeSha256
Assert-SevenBootstrapNode $NodeExecutable $profile.node
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-SevenBootstrapController $controller $profile.controllerRepository
$validator=Join-Path $PSScriptRoot 'seven-chart-profile.mjs'
$checked=& $NodeExecutable $validator verify --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256
if($LASTEXITCODE -ne 0) { throw 'Seven pure verification failed; Office was not started' }
$binding=($checked | Out-String) | ConvertFrom-Json
Import-SevenPurePaths (Join-Path $PSScriptRoot 'run-windows.ps1')
$protected=@($profile.generation.suiteDirectory,$profile.generation.preparationRepository,$profile.generation.workerRepository,$profile.generation.consumer,$controller,$ExecutionEnvelope)
$output=Assert-FreshNativeOutput $OutputDirectory $protected
[void](New-Item -ItemType Directory -Path $output)
[void](New-Item -ItemType Directory -Path (Join-Path $output 'inputs'))
$script:sevenRunnerPath=Join-Path $output 'runner.json'
$script:sevenRunner=[ordered]@{schemaVersion=2;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;timeoutSeconds=$TimeoutSeconds;runOfficeRequested=[bool]$RunOffice;nativeAcceptance=$false;registryAcceptance=$false;status='snapshots-pending';snapshots=@();request=$null}
Write-SevenRunner
try {
    $copies=@(@($ExecutionEnvelope,'execution-envelope.json'),@($binding.inputPath,'inputs/case.pptx'),@($binding.planPath,'inputs/action-plan.json'),@((Join-Path $PSScriptRoot 'seven-chart-worker.ps1'),'inputs/seven-chart-worker.ps1'),@((Join-Path $profile.generation.workerRepository 'test/native-process.ps1'),'inputs/native-process.ps1'))
    foreach($copy in $copies) { $id=Copy-SevenExclusive $copy[0] (Join-Path $output $copy[1]);$script:sevenRunner.snapshots+=@([ordered]@{path=$copy[1];bytes=$id.bytes;sha256=$id.sha256});Write-SevenRunner }
    $script:sevenRunner.status=if($RunOffice){'native-worker-pending'}else{'pure-checks-completed; native-not-run'};Write-SevenRunner
    $requestCreated=& $NodeExecutable $validator create-request --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
    if($LASTEXITCODE -ne 0) { throw 'Seven immutable request creation failed before Office' }
    $requestBinding=($requestCreated | Out-String) | ConvertFrom-Json
    $script:sevenRunner.request=$requestBinding.identity;Write-SevenRunner
    & $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
    if($LASTEXITCODE -ne 0) { throw 'Seven owned execution snapshot verification failed' }
    if(-not $RunOffice) { return }
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Seven Office execution requires Windows and explicit coordinator authorization' }
    # The unchanged ce92 supervisor is loaded only after explicit RunOffice and all pure checks.
    $native=Join-Path $output 'native';[void](New-Item -ItemType Directory -Path $native)
    . (Join-Path $output 'inputs/native-process.ps1')
    $arguments=@('-ExecutionEnvelope',(Join-Path $output 'execution-envelope.json'),'-ExpectedEnvelopeSha256',$ExpectedEnvelopeSha256,'-NodeExecutable',$NodeExecutable,'-OutputDirectory',$native,'-TimeoutSeconds',"$TimeoutSeconds",'-ExpectedRequestSha256',$requestBinding.identity.sha256,'-Worker')
    $terminal=Invoke-OpfNativeWorker -ScriptPath (Join-Path $output 'inputs/seven-chart-worker.ps1') -WorkerArguments $arguments -OutputDirectory $native -TimeoutSeconds $TimeoutSeconds
    # No COM cleanup on any outcome. Raw worker.json remains the original supervisor's receipt.
    $admissionJson=& $NodeExecutable $validator verify-postflight --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
    if($LASTEXITCODE -ne 0) { throw 'Seven typed completion admission failed; no observer query is permitted' }
    $admissionIdentity=($admissionJson | Out-String) | ConvertFrom-Json
    . (Join-Path $PSScriptRoot 'owned-postflight.ps1')
    $postflight=Invoke-OwnedProfilePostflight -AdmissionFile $admissionIdentity.path -ExpectedAdmissionSha256 $admissionIdentity.sha256 -Profile $profile.profile -ControllerRoot $controller
    $confirmed=($null -eq $postflight.error -and $null -ne $postflight.result -and $postflight.result.observedZero -ceq $true)
    [ordered]@{schemaVersion=2;profile=$profile.profile;timedOut=$terminal.timedOut;exitCode=$terminal.exitCode;workerCleanupConfirmed=$true;cleanupConfirmed=$confirmed;postflight=$postflight;nativeAcceptance=$false;registryAcceptance=$false} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
    if(-not $confirmed) { throw 'Seven bounded global-zero observation failed; preserve output; no retry or cleanup' }
    & $NodeExecutable $validator observe --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output
    if($LASTEXITCODE -ne 0) { throw 'Seven offline observation binding failed; preserve the native outputs' }
    $script:sevenRunner.status='native-observation-completed; supervisor-review-required';Write-SevenRunner
} catch {
    $script:sevenRunner.status='failed; preserve-output; no-retry';$script:sevenRunner.error=$_.Exception.Message;Write-SevenRunner
    throw
}
