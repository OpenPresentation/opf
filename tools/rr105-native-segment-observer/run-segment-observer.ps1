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
    if($value.schemaVersion -ne 1 -or $value.profile -cne 'b07-independent-segments-readonly-v1' -or $value.nativeAcceptance -isnot [bool] -or $value.nativeAcceptance -or $value.registryAcceptance -isnot [bool] -or $value.registryAcceptance) { throw 'Unsupported referenceWitness execution envelope' }
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
    $required=@('tools/rr105-native-segment-observer/profile.mjs','tools/rr105-native-segment-observer/data-tools.mjs','tools/rr105-native-segment-observer/segment-worker.ps1','tools/rr105-native-segment-observer/run-segment-observer.ps1','tools/rr105-native-segment-observer/native-process.ps1','tools/rr105-native-segment-observer/SOURCE.json')
    if($Identity.files -isnot [array] -or $Identity.files.Count -ne $required.Count) { throw 'ReferenceWitness controller requires all six exact code identities' }
    foreach($name in $required) {
        $matches=@($Identity.files | Where-Object {$_.path -ceq $name});if($matches.Count -ne 1) { throw 'Missing/duplicate referenceWitness controller code identity' }
        $file=Assert-ReferenceWitnessBootstrapPath (Join-Path $full $name);$item=Get-Item -LiteralPath $file -Force
        if($item.PSIsContainer -or $item.Length -ne $matches[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $matches[0].sha256) { throw 'ReferenceWitness controller code bytes differ' }
    }
}
function Copy-ReferenceWitnessExclusive([string]$Source,[string]$Destination) {
    $input=[IO.File]::OpenRead($Source)
    try { $target=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try {$input.CopyTo($target)} finally {$target.Dispose()} } finally {$input.Dispose()}
    return [ordered]@{bytes=(Get-Item -LiteralPath $Destination).Length;sha256=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Write-ReferenceWitnessRunner { $script:referenceWitnessRunner | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $script:referenceWitnessRunnerPath -Encoding UTF8 }

# No child or process query precedes complete envelope, Node, clean-controller and source checks.
$profile=Read-ReferenceWitnessBootstrapEnvelope $ExecutionEnvelope $ExpectedEnvelopeSha256
Assert-ReferenceWitnessBootstrapNode $NodeExecutable $profile.node
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-ReferenceWitnessBootstrapController $controller $profile.controllerRepository
if($TimeoutSeconds -ne 45 -or $profile.timeoutSeconds -ne 45) { throw 'Closed segment observer requires its unchanged 45-second deadline' }
$validator=Join-Path $PSScriptRoot 'profile.mjs'
$checked=& $NodeExecutable $validator verify --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
if($LASTEXITCODE -ne 0) { throw 'Segment pure verification failed; Office was not started' }
$binding=($checked | Out-String) | ConvertFrom-Json
$output=Assert-ReferenceWitnessBootstrapPath $OutputDirectory
if(Test-Path -LiteralPath $output) { throw 'Segment observer requires absent fresh output' }
foreach($protected in @($controller,(Split-Path -Parent $ExecutionEnvelope))) {
    $p=[IO.Path]::GetFullPath($protected).TrimEnd('\');$o=$output.TrimEnd('\')
    if($o -ieq $p -or $o.StartsWith($p+'\',[StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith($o+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Output overlaps immutable controller/admission inputs' }
}
if(-not (Test-Path -LiteralPath (Split-Path -Parent $output) -PathType Container)) { throw 'Fresh output parent must already exist' }
[void](New-Item -ItemType Directory -Path $output)
[void](New-Item -ItemType Directory -Path (Join-Path $output 'inputs'))
$script:referenceWitnessRunnerPath=Join-Path $output 'runner.json'
$script:referenceWitnessRunner=[ordered]@{schemaVersion=1;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;timeoutSeconds=45;runOfficeRequested=[bool]$RunOffice;nativeAcceptance=$false;registryAcceptance=$false;publicImportAcceptance=$false;status='snapshots-pending';snapshots=@()}
Write-ReferenceWitnessRunner
try {
    $copies=@(@($ExecutionEnvelope,'execution-envelope.json'),@($binding.inputPath,'inputs/case.pptx'),@($binding.workerPath,'inputs/segment-worker.ps1'),@($binding.supervisorPath,'inputs/native-process.ps1'))
    foreach($copy in $copies) { $id=Copy-ReferenceWitnessExclusive $copy[0] (Join-Path $output $copy[1]);$script:referenceWitnessRunner.snapshots+=@([ordered]@{path=$copy[1];bytes=$id.bytes;sha256=$id.sha256});Write-ReferenceWitnessRunner }
    $ownedEnvelope=Join-Path $output 'execution-envelope.json'
    & $NodeExecutable $validator verify-execution --envelope $ownedEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
    if($LASTEXITCODE -ne 0) { throw 'Segment owned snapshots failed verification' }
    if(-not $RunOffice) { $script:referenceWitnessRunner.status='pure-checks-completed; native-not-run';Write-ReferenceWitnessRunner;return }
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Explicit root-authorized native execution requires Windows' }
    # Unchanged b944 supervisor is not loaded until all checks and explicit RunOffice.
    $native=Join-Path $output 'native';[void](New-Item -ItemType Directory -Path $native)
    . (Join-Path $output 'inputs/native-process.ps1')
    $arguments=@('-ExecutionEnvelope',$ownedEnvelope,'-ExpectedEnvelopeSha256',$ExpectedEnvelopeSha256,'-NodeExecutable',$NodeExecutable,'-OutputDirectory',$native,'-TimeoutSeconds','45','-Worker')
    $terminal=Invoke-OpfNativeWorker -ScriptPath (Join-Path $output 'inputs/segment-worker.ps1') -WorkerArguments $arguments -OutputDirectory $native -TimeoutSeconds 45
    # No COM cleanup/kill/retry on any outcome. Raw worker.json remains unmodified.
    $success=(-not $terminal.timedOut -and $terminal.exitCode -eq 0);$report=$null
    if($success -and (Test-Path -LiteralPath (Join-Path $native 'report.json') -PathType Leaf)) {$report=Get-Content -LiteralPath (Join-Path $native 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json}
    $confirmed=($success -and $null -ne $report -and $report.cleanupConfirmed -ceq $true -and $report.officeOperationsStopped -ceq $false -and $report.lastStage -ceq 'worker.complete' -and $report.lastStatus -ceq 'success')
    $remaining=$null;if($confirmed){$remaining=@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count;$confirmed=($remaining -eq 0)}
    [ordered]@{schemaVersion=1;profile=$profile.profile;timedOut=[bool]$terminal.timedOut;exitCode=$terminal.exitCode;cleanupConfirmed=[bool]$confirmed;powerPointPostflightCount=$remaining;originalSupervisorSha256='b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c';nativeAcceptance=$false;registryAcceptance=$false;publicImportAcceptance=$false} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
    if(-not $confirmed) { throw 'Worker failed/cleanup unconfirmed; preserve all output. No retry or COM cleanup.' }
    & $NodeExecutable $validator verify-execution --envelope $ownedEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
    if($LASTEXITCODE -ne 0) { throw 'Segment postflight source/controller binding failed' }
    $script:referenceWitnessRunner.status='native-observation-completed; root-review-required';Write-ReferenceWitnessRunner
} catch {
    $script:referenceWitnessRunner.status='failed; preserve-output; no-retry';$script:referenceWitnessRunner.error=$_.Exception.Message;Write-ReferenceWitnessRunner;throw
}
