param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedRequestSha256,[switch]$Worker)
$ErrorActionPreference='Stop'
if(-not $Worker){throw 'SH21 worker requires its explicitly prepared typed request'}
# No source is executed before the externally pinned envelope/bootstrap boundary.
if(-not[IO.Path]::IsPathRooted($ExecutionEnvelope) -or $ExecutionEnvelope.StartsWith('\') -or [IO.Path]::GetFullPath($ExecutionEnvelope) -cne $ExecutionEnvelope){throw 'Local canonical SH21 envelope required'}
$item=Get-Item -LiteralPath $ExecutionEnvelope -Force
if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'Externally pinned SH21 envelope differs'}
$e=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8|ConvertFrom-Json
$bootstrap=Join-Path $e.controller.directory 'scripts/native-acceptance/sh21-edit-bootstrap.ps1';$record=@($e.controller.files|Where-Object{$_.path -ceq 'scripts/native-acceptance/sh21-edit-bootstrap.ps1'})
if($record.Count -ne 1 -or -not[IO.Path]::IsPathRooted($bootstrap) -or $bootstrap.StartsWith('\') -or [IO.Path]::GetFullPath($bootstrap) -cne $bootstrap -or (Get-Item -LiteralPath $bootstrap).Length -ne $record[0].bytes -or (Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record[0].sha256){throw 'Bound SH21 bootstrap differs'}
$cursor=$bootstrap;while($cursor){$i=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $i -and ($i.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased SH21 bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -ceq $cursor){break};$cursor=$parent}
. $bootstrap
$controller=Assert-Sh21Bootstrap $e $NodeExecutable;$root=Assert-Sh21Path $OutputDirectory;$output=Split-Path -Parent $root
if($root -cne (Join-Path $output 'native') -or $ExecutionEnvelope -cne (Join-Path $output 'execution-envelope.json') -or $PSCommandPath -cne (Join-Path $output 'inputs/sh21-edit-worker.ps1')){throw 'Foreign SH21 worker snapshot'}
$validator=Join-Path $controller 'scripts/native-acceptance/sh21-edit-profile.mjs'
$checked=& $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
if($LASTEXITCODE -ne 0){throw 'SH21 source/runtime/request refused before Office'}
$binding=($checked|Out-String)|ConvertFrom-Json
$requestFile=Join-Path $output 'execution-request.json';if((Get-FileHash -LiteralPath $requestFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedRequestSha256 -or $binding.requestSha256 -cne $ExpectedRequestSha256){throw 'External SH21 request pin differs'}
$q=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8|ConvertFrom-Json
if($q.timeoutSeconds -ne $TimeoutSeconds -or $q.nativeRoot -cne $root -or $q.workerPath -cne $PSCommandPath -or $q.runOfficeRequested -isnot [bool] -or -not $q.runOfficeRequested){throw 'SH21 worker arguments differ'}
foreach($i in @(Get-ChildItem -LiteralPath $root -Force)){if($i.PSIsContainer -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $i.Name -cnotin @('worker.stdout.log','worker.stderr.log','worker.json')){throw 'Preserve existing SH21 native evidence'}}
Import-Sh21Definitions (Join-Path $controller 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation','New-SevenApplication','Read-SevenPresentations','Own-SevenApplication','Open-SevenOwned','Save-SevenCopy','Close-SevenOwned','Quit-SevenOwned')
Import-Sh21Definitions (Join-Path $controller 'scripts/native-acceptance/sh21-edit-actions.ps1') @('Assert-Sh21OfficeIdle','Assert-Sh21Plan','Assert-Sh21Owner','Get-Sh21Target','Get-Sh21ExpectedNodes','Read-Sh21Node','Set-Sh21NodeMap','Read-Sh21Nodes','Get-Sh21SemanticTarget','Invoke-Sh21Edit','Read-Sh21Phase')
# One immutable byte buffer supplies both wire verification and parsing.
$planBytes=[IO.File]::ReadAllBytes((Join-Path $output 'inputs/plan.json'));$hash=[Security.Cryptography.SHA256]::Create();try{$sha=([BitConverter]::ToString($hash.ComputeHash($planBytes))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
if($planBytes.Length -ne $q.planFileIdentity.bytes -or $sha -cne $q.planFileIdentity.sha256){throw 'SH21 plan wire changed'}
$plan=[Text.UTF8Encoding]::new($false,$true).GetString($planBytes)|ConvertFrom-Json
$script:root=$root;$script:sourcePath=$binding.inputPath;$script:savedPath=Join-Path $root 'saved.pptx';$script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null;$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
$script:report=[ordered]@{schemaVersion=1;profile=$e.profile;requestSha256=$ExpectedRequestSha256;envelopeSha256=$ExpectedEnvelopeSha256;sourcePath=$script:sourcePath;sourceSha256=$script:hashes[$script:sourcePath];savedPath=$script:savedPath;savedSha256=$null;phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;error=$null;lastStage=$null;lastStatus=$null}
try{
    Assert-Sh21Plan $plan;Write-SevenStage 'worker.initialize' 'success'
    # EXACT no-process exception means zero; every other enumeration error fails.
    Assert-Sh21OfficeIdle
    $application=New-SevenApplication;Own-SevenApplication $application
    Open-SevenOwned $script:sourcePath 'original';$target=Get-Sh21Target $plan 'original.target';Read-Sh21Phase $target $plan 'original' $false
    Invoke-Sh21Edit $target $plan;Read-Sh21Phase $target $plan 'edited' $true
    Save-SevenCopy;Close-SevenOwned $script:sourcePath 'original'
    Open-SevenOwned $script:savedPath 'saved-reopened';$target=Get-Sh21Target $plan 'saved-reopened.target';Read-Sh21Phase $target $plan 'saved-reopened' $true;Close-SevenOwned $script:savedPath 'saved-reopened'
    Assert-SevenProbe ((Get-SevenHash $script:sourcePath) -ceq $plan.inputSha256) 'source.unchanged' $plan.inputSha256 (Get-SevenHash $script:sourcePath)
    $script:report.actions[0].status='success';Write-SevenReport
    Quit-SevenOwned
    & $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true|Out-Null
    if($LASTEXITCODE -ne 0){throw 'SH21 source/runtime/request changed after owned Quit'}
    Write-SevenStage 'worker.complete' 'success'
}catch{$script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;$script:report.error=$_.Exception.Message;Write-SevenStage 'worker.failed' 'error' $null $_.Exception.Message;throw}
# No finally COM cleanup, no Office/process query after any failed stage.
