param([Parameter(Mandatory=$true)][string]$FixtureRoot,[switch]$DenseEvents)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
$profile=if($DenseEvents){'full59-dense-events-furniture-lifecycle-v1'}else{'full59-ordinary-furniture-lifecycle-v1'}
$context=Get-Content -LiteralPath (Join-Path $FixtureRoot 'context.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($context.synthetic -isnot [bool] -or -not $context.synthetic -or $context.nativeAcceptance -cne $false){throw 'Synthetic fixture context required'}
if($DenseEvents -and $context.profile -cne $profile){throw 'Exact synthetic dense profile required'}
. (Join-Path $context.controllerRoot 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $context.controllerRoot 'scripts/native-acceptance/furniture-postflight.ps1')
function Write-ControlJson([string]$File,$Value){[IO.File]::WriteAllText($File,($Value | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))}
function Rebind-Control([string]$Root,$Evidence) {
    Write-ControlJson (Join-Path $Root 'execution-request.json') $Evidence.request
    Write-ControlJson (Join-Path $Root 'native/report.json') $Evidence.report
    Write-ControlJson (Join-Path $Root 'native/supervisor.json') $Evidence.terminal
    Write-ControlJson (Join-Path $Root 'native/worker.json') $Evidence.kernel
    [IO.File]::WriteAllText((Join-Path $Root 'native/stages.jsonl'),(($Evidence.stages | ForEach-Object {$_ | ConvertTo-Json -Compress -Depth 12}) -join [Environment]::NewLine)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    $Evidence.admission.requestSha256=Get-OwnedPostflightHash (Join-Path $Root 'execution-request.json')
    $names=@($Evidence.admission.ready.lifecycle | ForEach-Object {$_.stage})
    $Evidence.admission.ready.stageCount=$Evidence.stages.Count
    $Evidence.admission.ready.lifecycle=@($Evidence.stages | Where-Object {$_.status -ceq 'success' -and $_.stage -cin $names} | ForEach-Object {[pscustomobject][ordered]@{stage=$_.stage;sequence=$_.sequence}})
    foreach($record in $Evidence.admission.files){$record.bytes=(Get-Item -LiteralPath $record.file).Length;$record.sha256=Get-OwnedPostflightHash $record.file}
    Write-ControlJson (Join-Path $Root 'postflight-admission.json') $Evidence.admission
}
function Add-ControlInspection($Evidence) {
    $position=0;for($i=0;$i -lt $Evidence.stages.Count;$i++){if($Evidence.stages[$i].stage -ceq 'edited.presentation.saveCopyAs' -and $Evidence.stages[$i].status -ceq 'begin'){$position=$i;break}}
    $rows=@(foreach($status in @('begin','success')){[pscustomobject][ordered]@{sequence=0;timestamp='2026-11-11T12:00:00.000Z';stage='original.slide-1.get';status=$status;error='';cleanupConfirmed=$false;officeOperationsStopped=$false;ownedPresentationPath=$Evidence.report.source.openedPath}})
    $Evidence.stages=@($Evidence.stages[0..($position-1)])+$rows+@($Evidence.stages[$position..($Evidence.stages.Count-1)])
}
function Move-ControlOperations($Evidence,[string]$Stage,[bool]$BeginOnly,[string]$BeforeStatus) {
    $selected=@($Evidence.stages | Where-Object {$_.stage -ceq $Stage -and (-not $BeginOnly -or $_.status -ceq 'begin')})
    $rest=@($Evidence.stages | Where-Object {-not ($_.stage -ceq $Stage -and (-not $BeginOnly -or $_.status -ceq 'begin'))})
    $rows=[Collections.Generic.List[object]]::new()
    foreach($row in $rest){if($row.stage -ceq 'preflight.globalIdle' -and $row.status -ceq $BeforeStatus){foreach($item in $selected){$rows.Add($item)}};$rows.Add($row)}
    $Evidence.stages=$rows.ToArray()
}
$oldProcess=Get-Item -LiteralPath 'Function:\global:Get-Process' -ErrorAction SilentlyContinue
$oldReady=Get-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -ErrorAction SilentlyContinue
$script:foreignReadyCalls=0
function global:Test-ReferenceWitnessPostflightReady {$script:foreignReadyCalls++;throw 'Foreign readiness must not run'}
function global:Get-Process {
    [CmdletBinding()]param([string]$Name)
    if($Name -cne 'POWERPNT'){throw 'Unexpected process query'};$script:queries++
    if($script:mode -cin @('zero','dense-stages-8192')){return @()}
    if($script:mode -ceq 'busy'){return [pscustomobject]@{Id=11}}
    if($script:mode -ceq 'drain'){if($script:queries -eq 1){return [pscustomobject]@{Id=11}};return @()}
    if($script:mode -ceq 'new-pid'){return [pscustomobject]@{Id=if($script:queries -eq 1){11}else{22}}}
    if($script:mode -ceq 'append-fault'){return @()}
    $id=if($script:mode -ceq 'absent'){'NoProcessFoundForGivenName'}elseif($script:mode -ceq 'query-prefix'){'NoProcessFoundForGivenNameForeign'}else{'AccessDenied'}
    $record=[Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('Synthetic query outcome'),$id,[Management.Automation.ErrorCategory]::ObjectNotFound,$Name)
    $PSCmdlet.ThrowTerminatingError($record)
}
$passed=0
try {
    foreach($mode in $context.cases){
        $root=Join-Path $FixtureRoot $mode;$file=Join-Path $root 'postflight-admission.json'
        $e=Read-FurniturePostflightEvidence $file (Get-OwnedPostflightHash $file) $profile
        if($mode -ceq 'timeout'){$e.terminal.timedOut=$true}
        if($mode -ceq 'kernel-timeout'){$e.kernel.timedOut=$true}
        if($mode -ceq 'worker-budget'){$e.request.timeoutSeconds=61}
        if($mode -ceq 'pending'){$e.terminal.lastDurableStatus='begin'}
        if($mode -ceq 'fault'){$e.report.officeOperationsStopped=$true}
        if($mode -ceq 'missing-quit'){$e.stages=@($e.stages | Where-Object {$_.stage -cne 'application.cleanup.quit'});for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}}
        if($mode -ceq 'wrong-owner'){($e.stages | Where-Object {$_.stage -ceq 'reopen.presentation.open' -and $_.status -ceq 'success'}).ownedPresentationPath='C:\foreign.pptx'}
        if($mode -ceq 'begin-object-owner'){($e.stages | Where-Object {$_.stage -ceq 'input.presentation.open' -and $_.status -ceq 'begin'}).ownedPresentationPath=[pscustomobject]@{foreign=$true}}
        if($mode -ceq 'begin-foreign-owner'){($e.stages | Where-Object {$_.stage -ceq 'input.presentation.open' -and $_.status -ceq 'begin'}).ownedPresentationPath='C:\foreign.pptx'}
        if($mode -ceq 'ordinary-object-owner'){Add-ControlInspection $e;($e.stages | Where-Object {$_.stage -ceq 'original.slide-1.get' -and $_.status -ceq 'begin'}).ownedPresentationPath=[pscustomobject]@{foreign=$true}}
        if($mode -ceq 'ordinary-foreign-owner'){Add-ControlInspection $e;($e.stages | Where-Object {$_.stage -ceq 'original.slide-1.get' -and $_.status -ceq 'success'}).ownedPresentationPath='C:\foreign.pptx'}
        if($mode -ceq 'original-owner-object'){$e.report.source.openedPath=[pscustomobject]@{foreign=$true}}
        if($mode -ceq 'saved-owner-object'){$e.report.saved.path=[pscustomobject]@{foreign=$true}}
        if($mode -cin @('crossed-open-begin','crossed-create-begin')){
            $before=@($e.stages | Where-Object {$_.status -ceq 'success'} | ForEach-Object {$_.stage})
            Move-ControlOperations $e $(if($mode -ceq 'crossed-open-begin'){'input.presentation.open'}else{'application.create'}) $true 'success'
            $after=@($e.stages | Where-Object {$_.status -ceq 'success'} | ForEach-Object {$_.stage})
            if(($before -join '|') -cne ($after -join '|')){throw 'Crossed-begin mutant changed critical success order'}
        }
        if($mode -ceq 'missing-create'){$e.stages=@($e.stages | Where-Object {$_.stage -cne 'application.create'})}
        if($mode -ceq 'duplicate-create'){$copies=@($e.stages | Where-Object {$_.stage -ceq 'application.create'} | ForEach-Object {$_ | ConvertTo-Json -Compress | ConvertFrom-Json});$position=1;$e.stages=@($e.stages[0])+$copies+@($e.stages[1..($e.stages.Count-1)])}
        if($mode -ceq 'create-before-preflight'){Move-ControlOperations $e 'application.create' $false 'begin'}
        for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}
        if($mode -ceq 'case-id'){$e.request.caseId='unreviewed-case';$e.admission.ready.caseId='unreviewed-case'}
        if($mode -ceq 'unfinished-action'){$e.request.actionPlan.actions=@([pscustomobject]@{op='set-text';slideIndex=1;shapeName='Synthetic';text='Changed'});$e.admission.ready.actionCount=1}
        if($mode -match '^shapes-(original|edited|reopened)-(49|51)$'){
            if(-not $DenseEvents){throw 'Dense-only control'};$phase=$Matches[1];$count=[int]$Matches[2];$slide=$e.report.phases.$phase.slides[0]
            if($count -eq 49){$slide.shapes=@($slide.shapes[0..48])}else{$slide.shapes+=@($slide.shapes[0])};$slide.shapeCount=$count
        }
        if($mode -ceq 'dense-two-slides'){$e.report.phases.original.slides+=@($e.report.phases.original.slides[0]);$e.report.phases.original.slideCount=2}
        if($mode -ceq 'dense-survey-false'){$e.request.readOnlySurvey=$false;$e.report.readOnlySurvey=$false}
        if($mode -ceq 'dense-fonts'){$e.request.captureTextFonts=$true;$e.report.captureTextFonts=$true}
        if($mode -ceq 'dense-completed'){$e.report.actionPlan.completed=@([pscustomobject]@{index=1;op='set-text';status='success'})}
        if($mode -ceq 'dense-ordinary-profile'){$e.request.profile='full59-ordinary-furniture-lifecycle-v1';$e.admission.profile=$e.request.profile}
        if($mode -ceq 'dense-ordinary-policy'){$e.request.policy.policy='ordinary-furniture-bounded-global-zero-after-completed-owned-quit-v1';$e.admission.policy.policy=$e.request.policy.policy}
        if($mode -cin @('dense-stages-8192','dense-stages-8193')){
            $target=if($mode -ceq 'dense-stages-8192'){8192}else{8193};$extra=[Collections.Generic.List[object]]::new()
            $template=$e.stages | Where-Object {$_.stage -ceq 'input.presentation.readOnly.get' -and $_.status -ceq 'success'}
            for($i=0;$i -lt ($target-$e.stages.Count);$i++){$extra.Add([pscustomobject][ordered]@{sequence=0;timestamp=$template.timestamp;stage=('original.bound-inspection-'+$i);status='success';error='';cleanupConfirmed=$false;officeOperationsStopped=$false;ownedPresentationPath=$e.report.source.openedPath})}
            $position=0;for($i=0;$i -lt $e.stages.Count;$i++){if($e.stages[$i].stage -ceq 'edited.presentation.saveCopyAs' -and $e.stages[$i].status -ceq 'begin'){$position=$i;break}}
            $e.stages=@($e.stages[0..($position-1)])+$extra.ToArray()+@($e.stages[$position..($e.stages.Count-1)])
            for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}
        }
        Rebind-Control $root $e
        if($mode -ceq 'artifact-drift'){[IO.File]::AppendAllText((Join-Path $root 'native/report.json'),' ')}
        $script:mode=$mode;$script:queries=0;$script:clocks=0;$script:delays=0;$result=$null;$caught=$false
        $clock={$script:clocks++;if($script:mode -ceq 'deadline' -and $script:clocks -gt 1){return 5000};return 0}
        $utc={'2026-11-11T12:00:00.000Z'};$delay={param($ms) if($ms -ne 100){throw 'Interval changed'};$script:delays++}
        $append=$null;if($mode -ceq 'append-fault'){$append={param($row) throw 'Synthetic append failure'}}
        # OMIT ReadProcesses: the actual default delegate must hit the global mock.
        try{$result=Invoke-FurniturePostflight -AdmissionFile $file -ExpectedAdmissionSha256 (Get-OwnedPostflightHash $file) -Clock $clock -Utc $utc -Delay $delay -Append $append -Profile $profile}catch{$caught=$true}
        $preObserver=$mode -cin @('timeout','kernel-timeout','worker-budget','pending','fault','missing-quit','wrong-owner','begin-object-owner','begin-foreign-owner','ordinary-object-owner','ordinary-foreign-owner','original-owner-object','saved-owner-object','crossed-open-begin','crossed-create-begin','missing-create','duplicate-create','create-before-preflight','case-id','unfinished-action','artifact-drift')
        if($DenseEvents -and ($mode -match '^shapes-' -or ($mode -match '^dense-' -and $mode -cne 'dense-stages-8192'))){$preObserver=$true}
        if($preObserver){if(-not $caught -or $script:queries -ne 0 -or $script:clocks -ne 0 -or $script:delays -ne 0){throw "Completion refusal leaked observer IO: $mode"}}
        elseif($mode -cin @('zero','absent','drain','dense-stages-8192')){
            $expected=if($mode -ceq 'drain'){2}else{1}
            if($caught -or $null -ne $result.error -or -not $result.result.observedZero -or $script:queries -ne $expected -or $result.finalCount -ne 0){throw "Valid complete synthetic lifecycle refused: $mode"}
            if($result.initialCount -ne $(if($mode -ceq 'drain'){1}else{0})){throw 'Initial sample was not retained'}
        } else {
            $expected=if($mode -ceq 'deadline'){0}elseif($mode -ceq 'busy'){51}elseif($mode -ceq 'new-pid'){2}else{1}
            if($caught -or $null -eq $result.error -or $script:queries -ne $expected){throw "Observer refusal/query bound differs: $mode"}
        }
        if($script:foreignReadyCalls -ne 0){throw 'Global readiness was used'};$passed++
    }
    [ordered]@{controls=$passed;failed=0;realProcessQueries=0;officeActions=0;scope='Managed synthetic records/default process delegate mocks only'} | ConvertTo-Json -Compress
} finally {
    if($null -ne $oldProcess){Set-Item Function:\global:Get-Process $oldProcess.ScriptBlock}else{Remove-Item Function:\global:Get-Process -ErrorAction SilentlyContinue}
    if($null -ne $oldReady){Set-Item Function:\global:Test-ReferenceWitnessPostflightReady $oldReady.ScriptBlock}else{Remove-Item Function:\global:Test-ReferenceWitnessPostflightReady -ErrorAction SilentlyContinue}
}
