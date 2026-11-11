param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$ActionFile,[Parameter(Mandatory=$true)][string]$ActionModelSha256,[Parameter(Mandatory=$true)][string]$ActionFileSha256,[Parameter(Mandatory=$true)][int]$ActionFileBytes,[Parameter(Mandatory=$true)][string]$Output,[Parameter(Mandatory=$true)][string]$FixtureFile)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
$snapshotControllerRoot=$Root
if(Test-Path -LiteralPath $Output){throw 'Preserve existing snapshot managed attempt'};[void](New-Item -ItemType Directory -Path $Output)
function Import-SnapshotTest([string]$File,[string[]]$Names){$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $snapshotControllerRoot $File),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Bound test AST parse failure'};foreach($name in $Names){$found=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate managed definition'};Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')};return ,$ast}
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-chart-worker.ps1' @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-value-actions.ps1' @('Assert-SevenValueAction','Assert-SevenValueActionIdentity','Assert-SevenValueTargetOwnership','Get-SevenValueTarget')
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-value-snapshot-actions.ps1' @('Save-SevenNativeSnapshot','Set-SevenSnapshotNumericArray')
$old=Import-SnapshotTest 'scripts/native-acceptance/seven-value-actions-self-test.ps1' @('Initialize-ValueTest')
# Reuse the maintained real CLR target fixture, not its executable entrypoint.
$types=@($old.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst] -and $n.GetCommandName() -ceq 'Add-Type'},$true));if($types.Count -ne 1){throw 'One maintained CLR fixture definition required'}
Add-Type -TypeDefinition ($types[0].CommandElements[2].SafeGetValue())
function global:Get-Process {throw 'Snapshot managed test forbids process queries'}
function global:Start-Process {throw 'Snapshot managed test forbids child processes'}
function global:Stop-Process {throw 'Snapshot managed test forbids termination'}
function global:New-Object {param([string]$TypeName,[object[]]$ArgumentList,[string]$ComObject) if($ComObject){throw 'Snapshot managed test forbids COM'};return Microsoft.PowerShell.Utility\New-Object @PSBoundParameters}
$wire=[IO.File]::ReadAllBytes($ActionFile);if($wire.Length -ne $ActionFileBytes -or (Get-SevenHash $ActionFile) -cne $ActionFileSha256){throw 'Exact managed wire differs'}
$action=[Text.UTF8Encoding]::new($false,$true).GetString($wire)|ConvertFrom-Json;$actionFileIdentity=[pscustomobject]@{bytes=$wire.Length;sha256=$ActionFileSha256};$actionModelSha256=$ActionModelSha256
$results=@()
function Initialize-SnapshotTest([string]$Name,[string]$Mutant='',[string]$Fault=''){
 Initialize-ValueTest $Name $Fault $Mutant
 $script:report['requestSha256']='a'*64;$script:report['sourceSha256']='b'*64;$script:report['snapshots']=[ordered]@{before=[ordered]@{sha256=('c'*64)}}
 $proof=Join-Path $script:root 'before-check.json';[ordered]@{profile='seven-treemap-setter-native-archives-v1';requestSha256=$script:report.requestSha256;sourceSha256=$script:report.sourceSha256;beforeSha256=$script:report.snapshots.before.sha256;sourceFidelityVerified=$true}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $proof -Encoding UTF8
 $script:report['beforeAdmission']=[ordered]@{path=$proof;sha256=(Get-SevenHash $proof)}
}
Initialize-SnapshotTest 'null-getter-success' 'null'
Set-SevenSnapshotNumericArray $action $actionModelSha256 $actionFileIdentity
if($script:stopped -or [SevenValueFake]::Gets -ne 0 -or [SevenValueFake]::Sets -ne 1 -or $script:report.actions[0].status -cne 'setter-success'){throw 'Actual setter must work without invoking the null getter'}
$baseline=@([SevenValueFake]::Calls);$results+=@([ordered]@{name='null getter never read; exact setter once';getterCalls=0;setterCalls=1})
for($i=0;$i -lt $baseline.Count;$i++){
 Initialize-SnapshotTest ('fault-'+$i) 'null';[SevenValueFake]::FaultCallIndex=$i+1
 $caught=$false;try{Set-SevenSnapshotNumericArray $action $actionModelSha256 $actionFileIdentity}catch{$caught=$true};$count=[SevenValueFake]::Calls.Count
 try{Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN')}}catch{}
 if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $count -or $count -ne $i+1 -or [SevenValueFake]::Gets -ne 0){throw 'Setter fault latch allowed later managed work'}
 $results+=@([ordered]@{name=('fault-'+$i);getterCalls=0;setterCalls=[SevenValueFake]::Sets;laterCalls=0})
}
foreach($mode in @('foreignPath','writable','slideCount','shapeCount','duplicateTarget','hasChart','wrongType','zeroSeries','extraSeries','seriesName','foreignApplication','foreignPresentation','missingProof','proofHash','proofRequest','proofFalse','stopped','secondSetter','wire')){
 Initialize-SnapshotTest $mode $mode
 if($mode -ceq 'foreignApplication'){$script:ownedApp=[object]::new()};if($mode -ceq 'foreignPresentation'){$script:ownedPresentation=[object]::new()}
 if($mode -ceq 'missingProof'){$script:report.beforeAdmission=$null};if($mode -ceq 'proofHash'){$script:report.beforeAdmission.sha256='0'*64}
 if($mode -cin @('proofRequest','proofFalse')){$p=$script:report.beforeAdmission.path;$proof=Get-Content -LiteralPath $p -Raw|ConvertFrom-Json;if($mode -ceq 'proofRequest'){$proof.requestSha256='0'*64}else{$proof.sourceFidelityVerified=$false};$proof|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $p -Encoding UTF8;$script:report.beforeAdmission.sha256=Get-SevenHash $p}
 if($mode -ceq 'stopped'){$script:stopped=$true};if($mode -ceq 'secondSetter'){Set-SevenSnapshotNumericArray $action $actionModelSha256 $actionFileIdentity}
 $identity=$actionFileIdentity;if($mode -ceq 'wire'){$identity=[pscustomobject]@{bytes=0;sha256=$ActionFileSha256}}
 $sets=[SevenValueFake]::Sets;$caught=$false;try{Set-SevenSnapshotNumericArray $action $actionModelSha256 $identity}catch{$caught=$true};$count=[SevenValueFake]::Calls.Count
 try{Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN')}}catch{}
 if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Sets -ne $sets -or [SevenValueFake]::Gets -ne 0 -or [SevenValueFake]::Calls.Count -ne $count){throw ('Managed setter refusal failed: '+$mode)}
 $results+=@([ordered]@{name=$mode;getterCalls=0;setterCalls=$sets;laterCalls=0})
}
# Actual save helper, actual temporary file bytes, no PowerPoint object.
Add-Type -TypeDefinition @"
using System; using System.IO;
public sealed class SevenSnapshotSavingPresentation {
 public string FullName {get {SevenValueFake.Hit("snapshot.fullName");return SevenValueFake.Mutant=="afterSaveForeignPath"&&SevenValueFake.Calls.Contains("snapshot.save")?"foreign-owned-file":"managed-owned-only";}}
 public int ReadOnly {get {SevenValueFake.Hit("snapshot.readOnly");return -1;}}
 public void SaveCopyAs(string path,int format){SevenValueFake.Hit("snapshot.save");if(format!=24)throw new Exception("Wrong native save format");File.WriteAllText(path,"ACTUAL_MANAGED_SAVE_NOT_NATIVE:"+Path.GetFileName(path));}
}
"@
function Initialize-SnapshotSave([string]$Name,[string]$Mutant=''){
 Initialize-SnapshotTest $Name $Mutant
 $script:presentation=[SevenSnapshotSavingPresentation]::new();$script:ownedPresentation=$script:presentation;$script:report.snapshots=[ordered]@{};$script:report['saveCopies']=0;$script:hashes=@{}
}
Initialize-SnapshotSave 'three-managed-copies'
foreach($phase in @('before','edited','reopened')){Save-SevenNativeSnapshot $phase (Join-Path $script:root ($phase+'.pptx'));if($script:report.snapshots[$phase].sha256 -cne (Get-SevenHash (Join-Path $script:root ($phase+'.pptx')))){throw 'Actual managed saved bytes differ'}}
if($script:report.saveCopies -ne 3){throw 'Exact three copy count differs'};$saveCalls=@([SevenValueFake]::Calls)
$results+=@([ordered]@{name='three real managed-file SaveCopyAs calls';getterCalls=0;setterCalls=0;saveCalls=3})
for($i=0;$i -lt $saveCalls.Count;$i++){
 Initialize-SnapshotSave ('save-fault-'+$i);[SevenValueFake]::FaultCallIndex=$i+1;$caught=$false
 try{foreach($phase in @('before','edited','reopened')){Save-SevenNativeSnapshot $phase (Join-Path $script:root ($phase+'.pptx'))}}catch{$caught=$true}
 $count=[SevenValueFake]::Calls.Count;try{Save-SevenNativeSnapshot 'reopened' (Join-Path $script:root 'reopened.pptx')}catch{}
 if(-not $caught -or -not $script:stopped -or $count -ne $i+1 -or [SevenValueFake]::Calls.Count -ne $count){throw 'Save guard/fault allowed later managed operation'}
 $results+=@([ordered]@{name=('save-fault-'+$i);getterCalls=0;setterCalls=0;laterCalls=0})
}
foreach($mode in @('duplicate','foreignPath','wrongPhase','wrongDestination','ownedSwap')){
 Initialize-SnapshotSave ('save-'+$mode) $(if($mode -ceq 'foreignPath'){'afterSaveForeignPath'}else{''})
 if($mode -ceq 'duplicate'){Save-SevenNativeSnapshot 'before' (Join-Path $script:root 'before.pptx')};if($mode -ceq 'ownedSwap'){$script:ownedPresentation=[SevenSnapshotSavingPresentation]::new()}
 $phase=if($mode -ceq 'wrongPhase'){'unknown'}else{'before'};$file=if($mode -ceq 'wrongDestination'){Join-Path $script:root 'other.pptx'}else{Join-Path $script:root 'before.pptx'}
 $caught=$false;try{Save-SevenNativeSnapshot $phase $file}catch{$caught=$true};$count=[SevenValueFake]::Calls.Count
 try{Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN')}}catch{}
 if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $count){throw ('Save refusal failed: '+$mode)}
 $results+=@([ordered]@{name=('save-'+$mode);getterCalls=0;setterCalls=0;laterCalls=0})
}
# Actual new snapshot adapter + exact old kernel, using explicit synthetic bound
# evidence AFTER the external Node/public-import reader. Never claim that reader
# accepted this inert fixture. Reader-specific failures below execute its real body.
$fixture=Get-Content -LiteralPath $FixtureFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($fixture.synthetic -isnot [bool] -or -not $fixture.synthetic -or $fixture.nativeAcceptance -cne $false -or $fixture.controllerRoot -cne $snapshotControllerRoot){throw 'Explicit local synthetic snapshot fixture required'}
. (Join-Path $snapshotControllerRoot 'scripts/native-acceptance/owned-postflight.ps1')
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-value-postflight.ps1' @('Invoke-SevenValueBoundPostflight')
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-postflight.ps1' @('Get-SevenPostflightOperations')
$null=Import-SnapshotTest 'scripts/native-acceptance/seven-value-snapshot-postflight.ps1' @('Get-SevenSnapshotPostflightOperations','Test-SevenSnapshotPostflightReady','Read-SevenSnapshotPostflightEvidence','Invoke-SevenSnapshotPostflight')
$script:actualSnapshotReader=(Get-Command Read-SevenSnapshotPostflightEvidence).ScriptBlock
function Test-SevenValuePostflightReady {throw 'Old v1 readiness must never be used for snapshot completion'}
function Write-SnapshotSyntheticJson([string]$File,$Value){[IO.File]::WriteAllText($File,($Value|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))}
function Read-SevenSnapshotPostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$ControllerRoot){
 $script:readerCalls++
 if($script:readerMode -ceq 'real'){return & $script:actualSnapshotReader $AdmissionFile $ExpectedSha256 $ControllerRoot}
 if($ControllerRoot -cne $snapshotControllerRoot){throw 'Foreign synthetic controller'}
 return $script:bridgeEvidence
}
$script:mockProcessQueries=0
function global:Get-Process {
 [CmdletBinding()]param([string]$Name)
 if($Name -cne 'POWERPNT'){throw 'Unexpected synthetic process-name query'}
 $script:mockProcessQueries++;return @()
}
function global:Start-Sleep {throw 'First-zero synthetic observer must not delay'}
$bridgeRows=@()
$bridgeModes=@('complete-first-zero','foreign-profile','foreign-request-profile','foreign-policy','failed-worker','timed-out','pending-worker','cleanup-false','stopped','missing-stage','duplicate-stage','reordered-stage','stage-gap','stage-error','nonzero-preflight','wrong-model','wrong-wire','second-setter','missing-snapshot','foreign-snapshot','snapshot-hash','identity-bytes','identity-hash','reader-wire-pin','reader-file-identity')
foreach($mode in $bridgeModes){
 $e=(Get-Content -LiteralPath $FixtureFile -Raw -Encoding UTF8|ConvertFrom-Json).evidence
 $directory=Join-Path $fixture.root ('adapter-'+$mode);[void](New-Item -ItemType Directory -Path $directory);$native=Join-Path $directory 'native';[void](New-Item -ItemType Directory -Path $native)
 $e.request.output=$directory;$e.request.nativeRoot=$native
 foreach($phase in @('before','edited','reopened')){$e.report.snapshots.$phase.path=Join-Path $native ($phase+'.pptx')}
 $admissionFile=Join-Path $directory 'postflight-admission.json';$postflightFile=Join-Path $directory 'postflight.jsonl'
 $identityFile=Join-Path $directory 'synthetic-identity.txt';[IO.File]::WriteAllText($identityFile,'SYNTHETIC INERT IDENTITY; NOT NATIVE')
 $e.admission.files=@([pscustomobject]@{file=$identityFile;bytes=(Get-Item -LiteralPath $identityFile).Length;sha256=(Get-OwnedPostflightHash $identityFile)})
 if($mode -ceq 'foreign-profile'){$e.admission.profile='seven-chart-treemap-single-value-edit-v1'}
 if($mode -ceq 'foreign-request-profile'){$e.request.profile='foreign'}
 if($mode -ceq 'foreign-policy'){$e.admission.policy.maximumQueries=52;$e.request.policy.maximumQueries=52}
 if($mode -ceq 'failed-worker'){$e.terminal.exitCode=1};if($mode -ceq 'timed-out'){$e.terminal.timedOut=$true}
 if($mode -ceq 'pending-worker'){$e.report.lastStage='archive.reopened.saveCopyAs';$e.report.lastStatus='begin'}
 if($mode -ceq 'cleanup-false'){$e.report.cleanupConfirmed=$false};if($mode -ceq 'stopped'){$e.report.officeOperationsStopped=$true}
 if($mode -ceq 'missing-stage'){$e.stages=@($e.stages|Where-Object {$_.stage -cne 'archive.before.check'})}
 if($mode -ceq 'duplicate-stage'){$e.stages=@($e.stages[0])+$e.stages}
 if($mode -ceq 'reordered-stage'){$swap=$e.stages[1];$e.stages[1]=$e.stages[3];$e.stages[3]=$swap}
 if($mode -cin @('missing-stage','duplicate-stage','reordered-stage')){for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}}
 if($mode -ceq 'stage-gap'){$e.stages[0].sequence=2};if($mode -ceq 'stage-error'){$e.stages[0].error='managed fault'}
 if($mode -ceq 'nonzero-preflight'){($e.stages|Where-Object {$_.stage -ceq 'preflight.globalIdle' -and $_.status -ceq 'success'}).value=1}
 if($mode -ceq 'wrong-model'){$e.report.actions[0].actionModelSha256='0'*64}
 if($mode -ceq 'wrong-wire'){$e.report.actions[0].actionFileIdentity.sha256='0'*64}
 if($mode -ceq 'second-setter'){$e.report.actions[0].setterAttempts=2}
 if($mode -ceq 'missing-snapshot'){$e.report.snapshots.PSObject.Properties.Remove('before')}
 if($mode -ceq 'foreign-snapshot'){$e.report.snapshots.before.path=Join-Path $native 'foreign.pptx'}
 if($mode -ceq 'snapshot-hash'){$e.report.snapshots.before.sha256='not-a-hash'}
 $e.admission.ready.stageCount=$e.stages.Count
 $e.admission.ready.lifecycle=@($e.stages|Where-Object {$_.status -ceq 'success'}|ForEach-Object {[pscustomobject][ordered]@{stage=$_.stage;sequence=$_.sequence}})
 if($mode -ceq 'identity-bytes'){$e.admission.files[0].bytes++}
 if($mode -cin @('identity-hash','reader-file-identity')){$e.admission.files[0].sha256='0'*64}
 Write-SnapshotSyntheticJson $admissionFile $e.admission
 $script:bridgeEvidence=$e;$script:readerMode=if($mode.StartsWith('reader-')){'real'}else{'synthetic'};$script:readerCalls=0;$script:mockProcessQueries=0
 $pin=if($mode -ceq 'reader-wire-pin'){'0'*64}else{Get-OwnedPostflightHash $admissionFile}
 $ready=Test-SevenSnapshotPostflightReady $e.terminal $e
 $identityMode=$mode.StartsWith('identity-') -or $mode.StartsWith('reader-')
 if(($mode -ceq 'complete-first-zero' -or $identityMode) -and -not $ready){throw ('Positive typed snapshot fixture refused: '+$mode)}
 if($mode -cne 'complete-first-zero' -and -not $identityMode -and $ready){throw ('Malformed snapshot completion admitted: '+$mode)}
 $failure=$null;$result=$null
 try{$result=Invoke-SevenSnapshotPostflight -AdmissionFile $admissionFile -ExpectedAdmissionSha256 $pin -ControllerRoot $snapshotControllerRoot}catch{$failure=$_.Exception.Message}
 $observed=@();if(Test-Path -LiteralPath $postflightFile){$observed=@(Get-Content -LiteralPath $postflightFile|ForEach-Object {$_|ConvertFrom-Json})}
 if($script:readerCalls -ne 1){throw 'Actual snapshot entry must invoke its evidence-reader boundary once'}
 if($mode -ceq 'complete-first-zero'){
  if($null -ne $failure -or $null -ne $result.error -or $result.result.observedZero -cne $true -or $result.initialCount -ne 0 -or $result.finalCount -ne 0 -or $result.result.sampleCount -ne 1 -or $script:mockProcessQueries -ne 1 -or $observed.Count -ne 1 -or $observed[0].status -cne 'observed' -or $observed[0].processIds.Count -ne 0){throw ('Actual snapshot adapter/kernel positive failed: '+$failure)}
 }else{
  if($null -eq $failure -or $script:mockProcessQueries -ne 0 -or $observed.Count -ne 0 -or (Test-Path -LiteralPath $postflightFile)){throw ('Snapshot refusal allowed observer IO: '+$mode)}
  $expectedFailure=if($mode -ceq 'reader-wire-pin'){'Externally pinned snapshot admission differs'}elseif($mode -ceq 'reader-file-identity'){'Bound snapshot source/artifact changed'}elseif($mode.StartsWith('identity-')){'Value identity drift before observer'}else{'Value typed completion refused; zero observer IO'}
  if($failure -cne $expectedFailure){throw ('Unexpected snapshot refusal cause for '+$mode+': '+$failure)}
 }
 $bridgeRows+=@([ordered]@{name=$mode;passed=$true;mockProcessQueries=$script:mockProcessQueries;observedRows=$observed.Count;realProcessQueries=0;officeActions=0})
}

[ordered]@{schemaVersion=1;scope='ACTUAL_MANAGED_CLR_AND_HELPER_NOT_NATIVE';officeInvoked=$false;realProcessQueries=0;officeActions=0;rows=$results;bridge=$bridgeRows}|ConvertTo-Json -Depth 15|Set-Content -LiteralPath (Join-Path $Output 'result.json') -Encoding UTF8
