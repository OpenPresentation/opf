param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$Fixture,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
if(Test-Path -LiteralPath $Output){throw 'Preserve Name snapshot controls'};[void](New-Item -ItemType Directory -Path $Output)
$worker=Join-Path $Root 'packages/pptx/test/native-furniture-control.ps1';$before=(Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Worker parse failed'}
foreach($name in @('Invoke-FurnitureCom','Stop-FurnitureLifecycle','Get-FurnitureSha256','Save-OwnedReferenceNameSnapshot')){
    $nodes=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($nodes.Count -ne 1){throw 'Exact bounded Save helper dependency required'};Invoke-Expression $nodes[0].Extent.Text
}
$script:events=[Collections.Generic.List[string]]::new();function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null){$script:events.Add($Name+':'+$Status)};function Write-FurnitureReport{}
function global:Get-Process {throw 'Managed Name controls forbid real process queries'}
function global:New-Object {throw 'Managed Name controls forbid Office/factory construction'}
$definitions=@(foreach($name in @('Test-Integer','Assert-FurnitureReferenceNameAction','Assert-FurnitureReferenceNameMode')){$nodes=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($nodes.Count -ne 1){throw 'Exact pure startup definition required'};$nodes[0].Extent.Text})
$statements=@($ast.EndBlock.Statements);$startupStatements=@()
foreach($state in @('referenceNameModeEnabled','referenceNameSnapshotsModeEnabled')){$found=@(for($i=0;$i -lt $statements.Count-1;$i++){if($statements[$i] -is [Management.Automation.Language.AssignmentStatementAst] -and $statements[$i].Left.Extent.Text -ceq ('$script:'+$state)){$i}});if($found.Count -ne 1 -or $statements[$found[0]+1] -isnot [Management.Automation.Language.IfStatementAst]){throw 'Exact adjacent real initializer/handshake required'};$startupStatements+=@($statements[$found[0]].Extent.Text,$statements[$found[0]+1].Extent.Text)}
$early=@($statements|Where-Object {$_.Extent.Text.StartsWith('if($ReferenceNameSnapshots -and -not $ReferenceNameEdit)',[StringComparison]::Ordinal)});if($early.Count -ne 1){throw 'Exact early switch coupling guard required'}
$startupFile=Join-Path $Output 'actual-startup.ps1';$startupInput=Join-Path $Output 'synthetic-length.pptx';[IO.File]::WriteAllBytes($startupInput,[Array]::CreateInstance([byte],129025))
$setup=@'
$ErrorActionPreference='Stop'
$control=Get-Content -LiteralPath (Join-Path $OutputDirectory 'startup-control.json') -Raw|ConvertFrom-Json
$request=$control.request;$sourceHash=$control.declaredSourceHash;$sourceSnapshot=$InputPresentation;$actions=@($control.actions)
'@
$result='[pscustomobject]@{referenceSwitch=[bool]$ReferenceNameEdit;snapshotSwitch=[bool]$ReferenceNameSnapshots;referenceEnabled=$script:referenceNameModeEnabled;snapshotsEnabled=$script:referenceNameSnapshotsModeEnabled}'
[IO.File]::WriteAllText($startupFile,(@($ast.ParamBlock.Extent.Text,$early[0].Extent.Text,($definitions -join "`n"),$setup,($startupStatements -join "`n"),$result)-join "`n"),[Text.UTF8Encoding]::new($false))
$startup=@()
foreach($mode in @('enabled','old-name-only','disabled','missing-new-switch','missing-new-request','false-new-request','new-without-reference','wrong-source')){
    $control=[ordered]@{request=[ordered]@{};declaredSourceHash='06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83';actions=@([ordered]@{op='set-chart-series-name';slideIndex=1;chartName='OPF chart 1';seriesIndex=1;expectedName='Actual';newName='Actual edited'})};$startupArguments=@{OutputDirectory=$Output;InputPresentation=$startupInput;Worker=$true}
    if($mode -cnotin @('disabled','new-without-reference')){$control.request.referenceNameEdit=$true;$startupArguments.ReferenceNameEdit=$true}
    if($mode -cnotin @('disabled','old-name-only','missing-new-request')){$control.request.referenceNameSnapshots=$true}
    if($mode -cnotin @('disabled','old-name-only','missing-new-switch')){$startupArguments.ReferenceNameSnapshots=$true}
    if($mode -ceq 'false-new-request'){$control.request.referenceNameSnapshots=$false};if($mode -ceq 'wrong-source'){$control.declaredSourceHash='0'*64}
    $control|ConvertTo-Json -Depth 15|Set-Content -LiteralPath (Join-Path $Output 'startup-control.json') -Encoding UTF8
    $failure=$null;$value=$null;try{$value=& $startupFile @startupArguments}catch{$failure=$_.Exception.Message}
    if($mode -cin @('enabled','old-name-only','disabled')){if($null -ne $failure -or $value.referenceEnabled -cne ($mode -cne 'disabled') -or $value.referenceSwitch -cne ($mode -cne 'disabled') -or $value.snapshotsEnabled -cne ($mode -ceq 'enabled') -or $value.snapshotSwitch -cne ($mode -ceq 'enabled')){throw ('Real main startup coupling failed: '+$mode)}}elseif($null -eq $failure){throw ('Invalid main snapshot mode was admitted: '+$mode)}
    $startup+=@([ordered]@{scenario=$mode;passed=$true;failure=$failure})
}
$saves=@()
foreach($mode in @('before','reopened','no-mode','no-reference','foreign-phase','foreign-path','same-input','existing-copy','foreign-owner','wrong-before-name','wrong-after-name','getter-fault','save-fault')){
    $outputRoot=Join-Path $Output $mode;[void](New-Item -ItemType Directory -Path $outputRoot)
    $input=Join-Path $outputRoot 'owned-input.pptx';[IO.File]::WriteAllText($input,'SYNTHETIC INERT INPUT');$hash=(Get-FileHash -LiteralPath $input -Algorithm SHA256).Hash
    $phase=if($mode -ceq 'reopened'){'reopened'}else{'before'};$copy=Join-Path $outputRoot ('reference-name-'+$phase+'.pptx')
    $script:referenceNameModeEnabled=$true;$script:referenceNameSnapshotsModeEnabled=$true;$script:officeOperationsStopped=$false;$script:cleanupConfirmed=$false;$script:ownedPresentationPath=$input;$script:saveCount=0;$script:fixtureMode=$mode;$script:events.Clear();$script:report=[ordered]@{referenceNameSnapshots=@()}
    $script:presentation=[pscustomobject]@{CurrentPath=$input}
    $script:presentation|Add-Member -MemberType ScriptProperty -Name FullName -Value {if($script:fixtureMode -ceq 'getter-fault'){throw 'Actual fake FullName fault'};return $this.CurrentPath}
    $script:presentation|Add-Member -MemberType ScriptMethod -Name SaveCopyAs -Value {param($path,$format)$script:saveCount++;if($format -ne 24){throw 'Exact native format required'};if($script:fixtureMode -ceq 'save-fault'){throw 'Actual fake SaveCopyAs fault'};[IO.File]::WriteAllText($path,'SYNTHETIC INERT COPY');if($script:fixtureMode -ceq 'wrong-after-name'){$this.CurrentPath+='-foreign'}}
    if($mode -ceq 'no-mode'){$script:referenceNameSnapshotsModeEnabled=$false};if($mode -ceq 'no-reference'){$script:referenceNameModeEnabled=$false};if($mode -ceq 'foreign-phase'){$phase='edited'};if($mode -ceq 'foreign-path'){$copy=Join-Path $outputRoot 'foreign.pptx'};if($mode -ceq 'same-input'){$copy=$input};if($mode -ceq 'existing-copy'){[IO.File]::WriteAllText($copy,'OLD COPY')};if($mode -ceq 'foreign-owner'){$script:ownedPresentationPath+='-foreign'};if($mode -ceq 'wrong-before-name'){$script:presentation.CurrentPath+='-foreign'}
    $failure=$null;try{Save-OwnedReferenceNameSnapshot $input $copy $phase}catch{$failure=$_.Exception.Message}
    if($mode -cin @('before','reopened')){
        if($null -ne $failure -or $script:saveCount -ne 1 -or $script:report.referenceNameSnapshots.Count -ne 1 -or $script:report.referenceNameSnapshots[0].path -cne $copy -or $script:report.referenceNameSnapshots[0].sha256 -cne (Get-FurnitureSha256 $copy)){throw ('Owned copy positive failed: '+$mode)}
    }else{
        if($null -eq $failure -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed){throw ('Expected bounded copy refusal: '+$mode)}
        if($mode -cnotin @('wrong-after-name','save-fault') -and $script:saveCount -ne 0){throw 'Refused precondition reached SaveCopyAs'}
        $count=$script:events.Count;try{Save-OwnedReferenceNameSnapshot $input $copy 'before'}catch{};if($script:events.Count -ne $count){throw 'Fault latch allowed later Office operations'}
    }
    if((Get-FileHash -LiteralPath $input -Algorithm SHA256).Hash -cne $hash){throw 'Owned input bytes changed'};$saves+=@([ordered]@{scenario=$mode;passed=$true;saves=$script:saveCount;failure=$failure})
}
. (Join-Path $Root 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $Root 'scripts/native-acceptance/furniture-postflight.ps1')
$original=Get-Content -LiteralPath $Fixture -Raw -Encoding UTF8|ConvertFrom-Json;$adapter=@()
# Six separate actual-definition cardinality controls; the original32 scenarios remain unchanged.
$cardinality=@()
foreach($phase in @('before','reopened')){
    foreach($count in @(0,1,2)){
        $e=Get-Content -LiteralPath $Fixture -Raw -Encoding UTF8|ConvertFrom-Json
        $stage=if($phase -ceq 'before'){'action-1-set-chart-series-name.series.name.set'}else{'reopened.presentation.close'}
        $endpoint=@($e.stages|Where-Object {$_.stage -ceq $stage -and $_.status -ceq 'success'})
        if($endpoint.Count -ne 1){throw 'Cardinality fixture requires one actual endpoint'}
        if($count -eq 0){$e.stages=@($e.stages|Where-Object {-not($_.stage -ceq $stage -and $_.status -ceq 'success')})}
        if($count -eq 2){$e.stages+=@($endpoint[0].PSObject.Copy())}
        $actual=@($e.stages|Where-Object {$_.stage -ceq $stage -and $_.status -ceq 'success'}).Count
        $ready=Test-ReferenceNameSnapshotsReady $e.request $e.report $e.stages;$expected=$count -eq 1
        if($actual -ne $count -or $ready -isnot [bool] -or $ready -cne $expected){throw ('Actual snapshot endpoint cardinality failed: '+$phase+'-'+$count)}
        $cardinality+=@([ordered]@{scenario=($phase+'-'+$count);phase=$phase;endRows=$actual;expectedReady=$expected;ready=$ready;passed=$true})
    }
}
foreach($mode in @('positive','missing-before','missing-reopened','crossed-copy-order','copy-after-setter','wrong-owner','extra-copy','wrong-type','missing-mode','wrong-input','pending')){
    $e=Get-Content -LiteralPath $Fixture -Raw -Encoding UTF8|ConvertFrom-Json
    $dir=Join-Path $Output ('adapter-'+$mode);[void](New-Item -ItemType Directory -Path $dir);[void](New-Item -ItemType Directory -Path (Join-Path $dir 'native'))
    $old=$e.request.output;$e.request.output=$dir
    $text=$e|ConvertTo-Json -Depth 60;$text=$text.Replace($old.Replace('\','\\'),$dir.Replace('\','\\'));$e=$text|ConvertFrom-Json
    if($mode -ceq 'missing-before'){$e.report.referenceNameSnapshots=@($e.report.referenceNameSnapshots[1])};if($mode -ceq 'missing-reopened'){$e.report.referenceNameSnapshots=@($e.report.referenceNameSnapshots[0])};if($mode -ceq 'crossed-copy-order'){$e.report.referenceNameSnapshots=@($e.report.referenceNameSnapshots[1],$e.report.referenceNameSnapshots[0])}
    if($mode -ceq 'copy-after-setter'){$rows=@($e.stages|Where-Object {$_.stage.StartsWith('reference-before.')});$e.stages=@($e.stages|Where-Object {-not $_.stage.StartsWith('reference-before.')});$target=@($e.stages|Where-Object {$_.stage -ceq 'edited.presentation.saveCopyAs'})[0];$list=[Collections.Generic.List[object]]::new();foreach($row in $e.stages){if([object]::ReferenceEquals($row,$target)){foreach($extra in $rows){$list.Add($extra)}};$list.Add($row)};$e.stages=$list.ToArray();for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}}
    if($mode -ceq 'wrong-owner'){@($e.stages|Where-Object {$_.stage -ceq 'reference-before.presentation.saveCopyAs'})[0].ownedPresentationPath=$e.report.saved.path};if($mode -ceq 'extra-copy'){$list=[Collections.Generic.List[object]]::new();foreach($row in $e.stages){if($row.stage -ceq 'worker.complete'){foreach($status in @('begin','success')){$extra=$row.PSObject.Copy();$extra.stage='foreign.presentation.saveCopyAs';$extra.status=$status;$extra.ownedPresentationPath=$e.report.saved.path;$extra.cleanupConfirmed=$false;$list.Add($extra)}};$list.Add($row)};$e.stages=$list.ToArray();for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1};$e.admission.ready.stageCount=$e.stages.Count}
    if($mode -ceq 'wrong-type'){$e.report.phases.edited.chartSeriesNames[0].referenceTypeEvidence.series[1].typeObservation.numericValue=51};if($mode -ceq 'missing-mode'){$e.request.referenceNameSnapshots=$false};if($mode -ceq 'wrong-input'){$e.request.input.sha256='0'*64};if($mode -ceq 'pending'){$e.terminal.lastDurableStatus='begin'}
    foreach($pair in @(@('execution-request.json',$e.request),@('native/report.json',$e.report),@('native/supervisor.json',$e.terminal),@('native/worker.json',$e.kernel))){ConvertTo-Json -InputObject $pair[1] -Depth 60|Set-Content -LiteralPath (Join-Path $dir $pair[0]) -Encoding UTF8}
    $stage=Join-Path $dir 'native/stages.jsonl';foreach($row in $e.stages){$row|ConvertTo-Json -Compress -Depth 20|Add-Content -LiteralPath $stage -Encoding UTF8}
    $files=@('execution-request.json','native/report.json','native/supervisor.json','native/worker.json','native/stages.jsonl')|ForEach-Object {Join-Path $dir $_};$files+=@('furniture-postflight.ps1','owned-postflight.ps1','run-reference-chart-profile.ps1')|ForEach-Object {Join-Path (Join-Path $Root 'scripts/native-acceptance') $_}
    $e.admission.files=@(foreach($file in $files){[ordered]@{file=$file;bytes=(Get-Item -LiteralPath $file).Length;sha256=(Get-OwnedPostflightHash $file)}});$e.admission.requestSha256=Get-OwnedPostflightHash (Join-Path $dir 'execution-request.json');$admission=Join-Path $dir 'postflight-admission.json';$e.admission|ConvertTo-Json -Depth 60|Set-Content -LiteralPath $admission -Encoding UTF8
    $script:mockQueries=0;$failure=$null;$result=$null
    try{$result=Invoke-FurniturePostflight -AdmissionFile $admission -ExpectedAdmissionSha256 (Get-OwnedPostflightHash $admission) -Profile 'reference-line-one-name-three-native-archives-v1' -ReadProcesses {$script:mockQueries++;return @()} -Clock {return 0} -Utc {return '2026-11-11T00:00:00.000Z'} -Delay {throw 'Empty observation must not delay'} -Append {param($row)}}catch{$failure=$_.Exception.Message}
    if($mode -ceq 'positive'){if($null -ne $failure -or $result.result.observedZero -cne $true -or $script:mockQueries -ne 1){throw ('Real private observer adapter positive failed: '+$failure)}}elseif($null -eq $failure -or $script:mockQueries -ne 0){throw ('Refused completion reached observer: '+$mode)}
    $adapter+=@([ordered]@{scenario=$mode;passed=$true;mockQueries=$script:mockQueries;failure=$failure})
}
if((Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash -cne $before){throw 'Worker changed during managed controls'}
[ordered]@{schemaVersion=1;officeInvoked=$false;realProcessQueries=0;genuineStartupArchive=$false;earlierSourceBootstrapExercised=$false;startup=$startup;saves=$saves;adapter=$adapter;cardinality=$cardinality}|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $Output 'result.json') -Encoding UTF8
