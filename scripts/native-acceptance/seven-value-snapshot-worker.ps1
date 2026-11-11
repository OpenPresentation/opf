param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[Parameter(Mandatory=$true)][string]$ExpectedRequestSha256,[switch]$Worker)
$ErrorActionPreference='Stop'
if(-not $Worker){throw 'Snapshot worker requires the reviewed supervisor'}
# External envelope hash admits only the bound bootstrap, not an Office object.
if(-not [IO.Path]::IsPathRooted($ExecutionEnvelope) -or $ExecutionEnvelope.StartsWith('\') -or [IO.Path]::GetFullPath($ExecutionEnvelope) -cne $ExecutionEnvelope -or $ExecutionEnvelope -match '[\x00-\x1f]'){throw 'Canonical local snapshot envelope required'}
$cursor=$ExecutionEnvelope;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased snapshot envelope'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
if($ExpectedEnvelopeSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $ExecutionEnvelope).Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'Snapshot envelope identity differs'}
$profile=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8 | ConvertFrom-Json
$bootstrap=Join-Path $profile.controller.directory 'scripts/native-acceptance/seven-value-snapshot-bootstrap.ps1'
if(-not [IO.Path]::IsPathRooted($bootstrap) -or $bootstrap.StartsWith('\') -or [IO.Path]::GetFullPath($bootstrap) -cne $bootstrap -or $bootstrap -match '[\x00-\x1f]'){throw 'Canonical bound snapshot bootstrap required'}
$cursor=$bootstrap;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased snapshot bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
$records=@($profile.controller.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/seven-value-snapshot-bootstrap.ps1'})
if($records.Count -ne 1 -or (Get-Item -LiteralPath $bootstrap).Length -ne $records[0].bytes -or (Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant() -cne $records[0].sha256){throw 'Snapshot bootstrap bytes differ'}
. $bootstrap
$controller=Assert-SevenSnapshotBootstrap $profile $NodeExecutable;$root=Assert-SnapshotPath $OutputDirectory;$execution=Split-Path -Parent $root
if($root -cne (Join-Path $execution 'native') -or $ExecutionEnvelope -cne (Join-Path $execution 'execution-envelope.json') -or $PSCommandPath -cne (Join-Path $execution 'inputs/seven-value-snapshot-worker.ps1')){throw 'Exact owned snapshot worker paths required'}
$validator=Join-Path $controller 'scripts/native-acceptance/seven-value-snapshot-profile.mjs'
$verified=& $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
if($LASTEXITCODE -ne 0){throw 'Snapshot source/request refused before Office'};$binding=($verified | Out-String)|ConvertFrom-Json
if($binding.requestSha256 -cne $ExpectedRequestSha256){throw 'External snapshot request pin differs'}
$request=Get-Content -LiteralPath (Join-Path $execution 'execution-request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($request.timeoutSeconds -ne $TimeoutSeconds -or $request.nativeRoot -cne $root -or $request.workerPath -cne $PSCommandPath -or $request.profile -cne $profile.profile -or $request.runOfficeRequested -isnot [bool] -or -not $request.runOfficeRequested){throw 'Snapshot worker arguments differ'}
foreach($item in @(Get-ChildItem -LiteralPath $root -Force)){if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Name -cnotin @('worker.stdout.log','worker.stderr.log','worker.json')){throw 'Preserve existing native snapshot attempt'}}
Import-SnapshotDefinitions $controller 'scripts/native-acceptance/seven-chart-worker.ps1' @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation','New-SevenApplication','Read-SevenPresentations','Own-SevenApplication','Open-SevenOwned','Read-SevenPhase','Close-SevenOwned','Quit-SevenOwned')
Import-SnapshotDefinitions $controller 'scripts/native-acceptance/seven-value-worker.ps1' @('Assert-SevenValueOfficeIdle')
Import-SnapshotDefinitions $controller 'scripts/native-acceptance/seven-value-actions.ps1' @('Assert-SevenValueAction','Assert-SevenValueActionIdentity','Assert-SevenValueTargetOwnership','Get-SevenValueTarget')
Import-SnapshotDefinitions $controller 'scripts/native-acceptance/seven-value-snapshot-actions.ps1' @('Save-SevenNativeSnapshot','Set-SevenSnapshotNumericArray')
# One actual immutable wire buffer, never a reconstructed fake getter observation.
$actionBytes=[IO.File]::ReadAllBytes((Join-Path $execution 'inputs/action.json'));$algorithm=[Security.Cryptography.SHA256]::Create()
try{$wireHash=([BitConverter]::ToString($algorithm.ComputeHash($actionBytes))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
if($actionBytes.Length -ne $binding.actionFileIdentity.bytes -or $wireHash -cne $binding.actionFileIdentity.sha256){throw 'Snapshot setter action wire changed'}
$action=([Text.UTF8Encoding]::new($false,$true).GetString($actionBytes)) | ConvertFrom-Json
$script:root=$root;$script:sourcePath=$binding.inputPath;$script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null;$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
$source=$profile.sourceAdmission
$script:report=[ordered]@{schemaVersion=4;profile=$profile.profile;requestSha256=$ExpectedRequestSha256;envelopeSha256=$ExpectedEnvelopeSha256;generation=$source.base.generation;controllerRepository=$profile.controller;node=$source.base.node;sourcePath=$script:sourcePath;sourceSha256=$script:hashes[$script:sourcePath];workerPath=$PSCommandPath;workerSha256=(Get-SevenHash $PSCommandPath);snapshots=[ordered]@{};beforeAdmission=$null;phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;error=$null;lastStage=$null;lastStatus=$null}
try{
 Assert-SevenValueAction $action;Assert-SevenValueActionIdentity $binding.actionModelSha256 $binding.actionFileIdentity
 Write-SevenStage 'worker.initialize' 'success';Assert-SevenValueOfficeIdle;$application=New-SevenApplication;Own-SevenApplication $application
 Open-SevenOwned $script:sourcePath 'original';Read-SevenPhase 'original'
 Save-SevenNativeSnapshot 'before' (Join-Path $root 'before.pptx')
 Invoke-SevenCom 'archive.before.check' {
  $admitted=& $NodeExecutable $validator verify-before --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
  if($LASTEXITCODE -ne 0){Stop-SevenLifecycle 'Native-before fidelity refused; zero setters and no later Office operations'}
  $proof=($admitted | Out-String)|ConvertFrom-Json;$script:report.beforeAdmission=[ordered]@{path=$proof.path;bytes=$proof.bytes;sha256=$proof.sha256};Write-SevenReport;return $proof.sha256
 }
 Set-SevenSnapshotNumericArray $action $binding.actionModelSha256 $binding.actionFileIdentity
 Save-SevenNativeSnapshot 'edited' (Join-Path $root 'edited.pptx');Close-SevenOwned $script:sourcePath 'original'
 $edited=Join-Path $root 'edited.pptx';Open-SevenOwned $edited 'saved-reopened';Read-SevenPhase 'saved-reopened'
 Save-SevenNativeSnapshot 'reopened' (Join-Path $root 'reopened.pptx');Close-SevenOwned $edited 'saved-reopened'
 Assert-SevenProbe ((Get-SevenHash $script:sourcePath) -ceq $script:report.sourceSha256) 'source.unchanged' $script:report.sourceSha256 (Get-SevenHash $script:sourcePath)
 Quit-SevenOwned
 & $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Snapshot immutable source/request changed after owned Quit'}
 $script:report.actions[0].status='success';Write-SevenStage 'worker.complete' 'success'
}catch{$script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;$script:report.error=$_.Exception.Message;Write-SevenStage 'worker.failed' 'error' $null $_.Exception.Message;throw}
