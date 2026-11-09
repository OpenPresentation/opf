param(
    [Parameter(Mandatory=$true)][string]$Envelope,
    [Parameter(Mandatory=$true)][string]$EnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$ValidateOnly,
    [switch]$RunOffice
)
$ErrorActionPreference='Stop'
if($EnvelopeSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $Envelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EnvelopeSha256) { throw 'External table profile SHA-256 differs' }
function Assert-TableControllerBootstrap([string]$Root,$Identity) {
    if($Identity.dirty -isnot [bool] -or $Identity.dirty -ne $false -or $Identity.revision -cnotmatch '^[a-f0-9]{40}$') { throw 'New table controller requires clean Git identity' }
    $full=[IO.Path]::GetFullPath($Root)
    if($full -ine $Identity.directory) { throw 'Table controller directory differs' }
    $cursor=$full
    while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Aliased table controller' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
    $head=(& git -C $full rev-parse HEAD | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $Identity.revision) { throw 'New table controller HEAD differs before code loading' }
    $status=(& git -C $full status --porcelain --untracked-files=normal | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne '') { throw 'New table controller must remain clean' }
    $required=@('scripts/native-acceptance/table-profile.mjs','scripts/native-acceptance/run-table-profile.ps1','scripts/native-acceptance/compare-table-profile.mjs','scripts/native-acceptance/compare-table-colors.mjs','scripts/native-acceptance/identity.mjs','scripts/native-acceptance/table-colors.mjs','scripts/native-acceptance/generate.mjs','packages/pptx/test/native-table-colors-v2.ps1')
    if($Identity.files -isnot [array] -or $Identity.files.Count -ne $required.Count) { throw 'Table controller requires all eight exact code identities' }
    foreach($name in $required) {
        $records=@($Identity.files | Where-Object {$_.path -ceq $name});if($records.Count -ne 1) { throw 'Missing or duplicate table code identity' }
        $file=Join-Path $full $name;$item=Get-Item -LiteralPath $file -Force
        if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $records[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $records[0].sha256) { throw 'Table controller code bytes differ before loading' }
    }
}
function Assert-TableNodeBootstrap([string]$Path,$Identity) {
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\\') -or $full -ine $Identity.path) { throw 'Node executable path differs from table envelope' }
    $cursor=$full
    while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Aliased table Node path' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
    $item=Get-Item -LiteralPath $full -Force
    if($item.PSIsContainer -or $item.Length -ne $Identity.identity.bytes -or (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Identity.identity.sha256) { throw 'Node executable bytes differ from table envelope' }
}
if($ValidateOnly -and $RunOffice) { throw 'ValidateOnly and RunOffice are mutually exclusive' }
if((Get-Item -LiteralPath $Envelope).Length -gt 4194304) { throw 'Table envelope exceeds 4 MiB' }
$profile=Get-Content -LiteralPath $Envelope -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-TableNodeBootstrap $NodeExecutable $profile.node
Assert-TableControllerBootstrap (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) $profile.controller
$validator=Join-Path $PSScriptRoot 'table-profile.mjs'
& $NodeExecutable $validator validate-fresh --envelope $Envelope --sha256 $EnvelopeSha256
if($LASTEXITCODE -ne 0) { throw 'Table profile pure validation failed; Office was not started' }
if(-not $RunOffice) {
    [ordered]@{profile='table-colors-v2';envelopeSha256=$EnvelopeSha256;status='pure-validation-completed; native-not-run';nativeAcceptance=$false;registryAcceptance=$false} | ConvertTo-Json -Depth 8
    return
}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Native table execution requires Windows and coordinator authorization' }
$root=Join-Path $profile.output 'table-colors'
$runnerFile=Join-Path $profile.output 'runner.json'
$receipt=[ordered]@{schemaVersion=2;profile='table-colors-v2';envelopeSha256=$EnvelopeSha256;sourceSuiteSha256=$profile.suiteSha256;generationIdentity=$profile.generationIdentity;executionIdentity=$profile.controller;runOfficeRequested=$true;timeoutSeconds=$TimeoutSeconds;status='native-worker-pending';nativeAcceptance=$false;registryAcceptance=$false}
function Write-TableRunner { $receipt | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $runnerFile -Encoding UTF8 }
Write-TableRunner
$helper=Join-Path $profile.output 'inputs/native-process.ps1'
$helperRecord=@($profile.snapshots | Where-Object {$_.path -ceq 'inputs/native-process.ps1'})
if($helperRecord.Count -ne 1 -or (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant() -cne $helperRecord[0].sha256) { throw 'Bound process helper differs before loading' }
. $helper
try {
    $result=Invoke-OpfNativeWorker -ScriptPath (Join-Path $profile.output 'inputs/native-table-colors-v2.ps1') -WorkerArguments @('-Envelope',$Envelope,'-EnvelopeSha256',$EnvelopeSha256,'-OutputDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds $TimeoutSeconds
    $progress=$null
    if(Test-Path -LiteralPath (Join-Path $root 'progress.json')) { $progress=Get-Content -LiteralPath (Join-Path $root 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json }
    $terminal=[ordered]@{timedOut=$result.timedOut;exitCode=$result.exitCode;cleanupConfirmed=($result.timedOut -eq $false -and $result.exitCode -eq 0 -and $null -ne $progress -and $progress.stage -ceq 'worker.complete' -and $progress.status -ceq 'success' -and $progress.cleanupConfirmed -eq $true -and $progress.officeOperationsStopped -eq $false);lastDurableStage=$(if($null -ne $progress){$progress.stage}else{$null});envelopeSha256=$EnvelopeSha256}
    $terminal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root 'supervisor.json') -Encoding UTF8
    if(-not $terminal.cleanupConfirmed) { throw 'Table worker failed/timed out or cleanup is unconfirmed; preserve attempt, no retry' }
    & $NodeExecutable $validator validate --envelope $Envelope --sha256 $EnvelopeSha256
    if($LASTEXITCODE -ne 0) { throw 'Table source/runtime/code changed during execution' }
    $receipt.status='native-observation-completed; comparison-and-coordinator-review-required';Write-TableRunner
} catch {
    $receipt.status='failed; no-retry';$receipt.error=$_.Exception.Message;Write-TableRunner
    throw
}
