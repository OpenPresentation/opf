param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedRequestSha256,[switch]$Worker)
$ErrorActionPreference='Stop'
function Assert-SevenValueOfficeIdle {
    $count=Invoke-SevenCom 'preflight.globalIdle' {
        try {return @(Get-Process -Name POWERPNT -ErrorAction Stop).Count}
        catch {if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return 0};throw}
    }
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) 'preflight.globalIdle' 0 $count
}
if(-not $Worker){throw 'Value worker requires its new typed controller'}
# Minimal pre-import boundary: externally pinned data, local paths and exact
# bootstrap bytes. No executable source/Node/Office loads before this boundary.
foreach($entryPath in @($ExecutionEnvelope,$PSCommandPath)) {
    if(-not [IO.Path]::IsPathRooted($entryPath) -or $entryPath.StartsWith('\') -or $entryPath -match '[\x00-\x1f]'){throw 'Local value entry required'}
    $cursor=[IO.Path]::GetFullPath($entryPath)
    while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased value entry'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
}
$entryItem=Get-Item -LiteralPath $ExecutionEnvelope -Force
if($entryItem.PSIsContainer -or $entryItem.Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'External value envelope differs'}
$profile=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8 | ConvertFrom-Json
$bootstrap=Join-Path $profile.base.controllerRepository.directory 'scripts/native-acceptance/seven-value-bootstrap.ps1'
if(-not [IO.Path]::IsPathRooted($bootstrap) -or $bootstrap.StartsWith('\') -or $bootstrap -match '[\x00-\x1f]' -or [IO.Path]::GetFullPath($bootstrap) -cne $bootstrap){throw 'Canonical local value bootstrap required'}
$cursor=$bootstrap
while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased value bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
$record=@($profile.base.controllerRepository.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/seven-value-bootstrap.ps1'})
if($record.Count -ne 1 -or (Get-Item -LiteralPath $bootstrap -Force).Length -ne $record[0].bytes -or (Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record[0].sha256){throw 'Bound value bootstrap differs'}
. $bootstrap
$controller=Assert-SevenValueBootstrap $profile $NodeExecutable
$root=Assert-SevenValuePath $OutputDirectory;$execution=Split-Path -Parent $root
if($root -cne (Join-Path $execution 'native') -or $ExecutionEnvelope -cne (Join-Path $execution 'execution-envelope.json') -or $PSCommandPath -cne (Join-Path $execution 'inputs/seven-value-worker.ps1')){throw 'Foreign owned value snapshot'}
$validator=Join-Path $controller 'scripts/native-acceptance/seven-value-profile.mjs'
$verified=& $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
if($LASTEXITCODE -ne 0){throw 'Value source/request validation failed before Office'}
$binding=($verified | Out-String) | ConvertFrom-Json
if($binding.requestSha256 -cne $ExpectedRequestSha256){throw 'External value request pin differs'}
$requestFile=Join-Path $execution 'execution-request.json'
if((Get-FileHash -LiteralPath $requestFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedRequestSha256){throw 'Value request bytes changed'}
$request=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($request.timeoutSeconds -ne $TimeoutSeconds -or $request.nativeRoot -cne $root -or $request.workerPath -cne $PSCommandPath -or $request.profile -cne $profile.profile -or $request.runOfficeRequested -isnot [bool] -or -not $request.runOfficeRequested){throw 'Value worker arguments differ'}
$kernelNames=@('worker.stdout.log','worker.stderr.log','worker.json')
foreach($item in @(Get-ChildItem -LiteralPath $root -Force)){if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Name -cnotin $kernelNames){throw 'Pre-existing value native evidence refused'}}
# Definitions only from individually hash-bound sources; zero-action executable
# bootstrap and lifecycle are not imported or relaxed.
Import-SevenValueDefinitions (Join-Path $controller 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation','New-SevenApplication','Read-SevenPresentations','Own-SevenApplication','Open-SevenOwned','Read-SevenPhase','Save-SevenCopy','Close-SevenOwned','Quit-SevenOwned')
Import-SevenValueDefinitions (Join-Path $controller 'scripts/native-acceptance/seven-value-actions.ps1') @('Assert-SevenValueAction','Assert-SevenValueActionIdentity','Assert-SevenValueTargetOwnership','Get-SevenValueTarget','Read-SevenValueArray','Assert-SevenValueReadback','Set-SevenNumericArray','Read-SevenReopenedNumericArray')
$actionFile=Assert-SevenValuePath (Join-Path $execution 'inputs/action.json')
# ONE immutable wire buffer supplies both hash/size verification and parsing.
$actionBytes=[IO.File]::ReadAllBytes($actionFile);$algorithm=[Security.Cryptography.SHA256]::Create()
try{$wireHash=([BitConverter]::ToString($algorithm.ComputeHash($actionBytes))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
if($actionBytes.Length -ne $binding.actionFileIdentity.bytes -or $wireHash -cne $binding.actionFileIdentity.sha256){throw 'Value action wire differs before Office'}
$actionText=[Text.UTF8Encoding]::new($false,$true).GetString($actionBytes);if($actionText.Length -gt 0 -and $actionText[0] -eq [char]0xfeff){$actionText=$actionText.Substring(1)};$action=$actionText | ConvertFrom-Json
if($action.sourceType -cne 'treemap' -or $action.branch -cne 'choice' -or $action.comChartType -ne 117 -or $action.slideIndex -ne 1){throw 'Only current treemap target is reviewed'}
$script:root=$root;$script:sourcePath=$binding.inputPath;$script:savedPath=Join-Path $root 'saved.pptx';$script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null;$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
$script:report=[ordered]@{schemaVersion=3;profile=$profile.profile;requestSha256=$ExpectedRequestSha256;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.base.generation;controllerRepository=$profile.base.controllerRepository;node=$profile.base.node;limits=$profile.limits;sourcePath=$script:sourcePath;sourceSha256=$script:hashes[$script:sourcePath];savedPath=$script:savedPath;savedSha256=$null;workerPath=$PSCommandPath;workerSha256=(Get-SevenHash $PSCommandPath);phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;error=$null;lastStage=$null;lastStatus=$null}
try {
    Assert-SevenValueAction $action;Assert-SevenValueActionIdentity $binding.actionModelSha256 $binding.actionFileIdentity
    Write-SevenStage 'worker.initialize' 'success'
    Assert-SevenValueOfficeIdle
    $application=New-SevenApplication;Own-SevenApplication $application
    Open-SevenOwned $script:sourcePath 'original';Read-SevenPhase 'original'
    Set-SevenNumericArray $action $binding.actionModelSha256 $binding.actionFileIdentity
    Save-SevenCopy;Close-SevenOwned $script:sourcePath 'original'
    Open-SevenOwned $script:savedPath 'saved-reopened'
    Read-SevenReopenedNumericArray $action $binding.actionModelSha256 $binding.actionFileIdentity
    Read-SevenPhase 'saved-reopened';Close-SevenOwned $script:savedPath 'saved-reopened'
    Assert-SevenProbe ((Get-SevenHash $script:sourcePath) -ceq $script:report.sourceSha256) 'source.unchanged' $script:report.sourceSha256 (Get-SevenHash $script:sourcePath)
    Quit-SevenOwned
    & $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
    if($LASTEXITCODE -ne 0){throw 'Value source/runtime/request changed after owned Quit'}
    Write-SevenStage 'worker.complete' 'success'
}catch{
    $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;$script:report.error=$_.Exception.Message
    Write-SevenStage 'worker.failed' 'error' $null $_.Exception.Message
    throw
}
