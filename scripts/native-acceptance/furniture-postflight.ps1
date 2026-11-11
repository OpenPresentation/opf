# Closed literal-name guard for the one reference-bearing source; no caller target or cap override.
function Test-ReferenceNameActionReady($Request,$Report){
    try{
        if($Request.caseId -cne 'reference-native-lines' -or $Request.captureTextFonts -isnot [bool] -or $Request.captureTextFonts -or $Request.readOnlySurvey -isnot [bool] -or $Request.readOnlySurvey -or $Request.slideCount -ne 3 -or $Request.actionPlan.actions.Count -ne 1){return $false}
        $a=$Request.actionPlan.actions[0]
        if(-not(Test-OwnedPostflightKeys $a @('op','slideIndex','chartName','seriesIndex','expectedName','newName')) -or -not(Test-OwnedPostflightInteger $a.slideIndex) -or $a.slideIndex -ne 1 -or -not(Test-OwnedPostflightInteger $a.seriesIndex) -or $a.seriesIndex -ne 1 -or $a.op -cne 'set-chart-series-name' -or $a.chartName -cne 'OPF chart 1' -or $a.expectedName -cne 'Actual' -or $a.newName -cne 'Actual edited'){return $false}
        if($Report.actionPlan.chartSeriesEdits.Count -ne 1){return $false}
        foreach($phase in @('original','edited','reopened')){
            $state=$Report.phases.$phase;$expected=if($phase -ceq 'original'){'Actual'}else{'Actual edited'}
            if($state.slideCount -ne 3 -or $state.chartSeriesNames.Count -ne 1){return $false};$n=$state.chartSeriesNames[0]
            if($n.phase -cne $phase -or $n.slideIndex -ne 1 -or $n.chartName -cne 'OPF chart 1' -or $n.seriesIndex -ne 1 -or $n.expectedName -cne $expected -or $n.observedName -cne $expected -or $n.observedType -cne 'System.String' -or $n.observedRawValue -cne $expected -or $n.status -cne 'success'){return $false}
        }
        return $true
    }catch{return $false}
}
# Definitions only. Two closed furniture schemas; shared Seven/table guards stay closed.
function Get-FurnitureProfileMode([string]$Profile) {
    if($Profile -ceq 'full59-ordinary-furniture-lifecycle-v1'){return $false}
    if($Profile -ceq 'full59-dense-events-furniture-lifecycle-v1'){return $true}
    if($Profile -ceq 'reference-line-one-series-name-edit-v1'){return $false}
    throw 'Unknown closed furniture profile'
}
function Test-FurniturePostflightReady($Terminal,$Evidence,[string]$Profile='full59-ordinary-furniture-lifecycle-v1') {
    try {
        $dense=Get-FurnitureProfileMode $Profile;$reference=$Profile -ceq 'reference-line-one-series-name-edit-v1';$policy=if($reference){'reference-name-exact-one-global-zero-after-completed-owned-quit-v1'}elseif($dense){'dense-events-exact50-global-zero-after-completed-owned-quit-v1'}else{'ordinary-furniture-bounded-global-zero-after-completed-owned-quit-v1'}
        $r=$Evidence.report;$q=$Evidence.request;$a=$Evidence.admission;$stages=$Evidence.stages
        if($a.profile -cne $Profile -or $q.profile -cne $a.profile -or $a.schemaVersion -ne 1 -or $q.schemaVersion -ne 1 -or $a.nativeAcceptance -isnot [bool] -or $a.nativeAcceptance -or $a.registryAcceptance -isnot [bool] -or $a.registryAcceptance){return $false}
        if($q.nativeAcceptance -isnot [bool] -or $q.nativeAcceptance -or $q.registryAcceptance -isnot [bool] -or $q.registryAcceptance -or -not(Test-OwnedPostflightInteger $q.timeoutSeconds) -or $q.timeoutSeconds -lt 5 -or $q.timeoutSeconds -gt 60){return $false}
        $k=$Evidence.kernel;if($k.timedOut -isnot [bool] -or $k.timedOut -or -not(Test-OwnedPostflightInteger $k.exitCode) -or $k.exitCode -ne 0 -or $k.timeoutSeconds -ne $q.timeoutSeconds){return $false}
        foreach($name in @('startedAt','finishedAt')){if($k.$name -isnot [string] -or $k.$name -cnotmatch 'Z$'){return $false};[void][DateTimeOffset]::Parse($k.$name,[Globalization.CultureInfo]::InvariantCulture)}
        if([DateTimeOffset]::Parse($k.finishedAt) -lt [DateTimeOffset]::Parse($k.startedAt)){return $false}
        if($q.runOfficeRequested -isnot [bool] -or -not $q.runOfficeRequested -or $q.readOnlySurvey -isnot [bool] -or $q.readOnlySurvey -cne $dense -or $q.captureTextFonts -isnot [bool]){return $false}
        if(-not(Test-OwnedPostflightKeys $a.policy @('policy','observationPolicy','budgetMilliseconds','intervalMilliseconds','maximumQueries','observerSource','observerSourceSha256'))){return $false}
        $p=$a.policy
        if($p.policy -cne $policy -or $p.observationPolicy -cne 'global-zero-after-completed-owned-quit-v1' -or $p.observerSource -cne 'scripts/native-acceptance/run-reference-chart-profile.ps1' -or $p.observerSourceSha256 -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3'){return $false}
        foreach($pair in @(@('budgetMilliseconds',5000),@('intervalMilliseconds',100),@('maximumQueries',51))){if(-not(Test-OwnedPostflightInteger $p.($pair[0])) -or $p.($pair[0]) -ne $pair[1]){return $false}}
        if(($q.policy | ConvertTo-Json -Compress -Depth 12) -cne ($p | ConvertTo-Json -Compress -Depth 12)){return $false}
        if($Terminal.timedOut -isnot [bool] -or $Terminal.timedOut -or -not(Test-OwnedPostflightInteger $Terminal.exitCode) -or $Terminal.exitCode -ne 0 -or $Terminal.cleanupConfirmed -isnot [bool] -or -not $Terminal.cleanupConfirmed -or $Terminal.lastDurableStage -cne 'worker.complete' -or $Terminal.lastDurableStatus -cne 'success'){return $false}
        if($r.schemaVersion -ne 1 -or $r.error -ne $null -or $r.PSObject.Properties.Name -cnotcontains 'error' -or $r.officeOperationsStopped -isnot [bool] -or $r.officeOperationsStopped -or $r.cleanupConfirmed -isnot [bool] -or -not $r.cleanupConfirmed -or $r.lastStage -cne 'worker.complete' -or $r.lastStatus -cne 'success' -or $r.readOnlySurvey -isnot [bool] -or $r.readOnlySurvey -cne $dense -or $r.captureTextFonts -cne $q.captureTextFonts){return $false}
        if(-not(Test-OwnedPostflightKeys $r.globalPreflight @('policy','count')) -or $r.globalPreflight.policy -cne 'strict-name-query-v1' -or -not(Test-OwnedPostflightInteger $r.globalPreflight.count) -or $r.globalPreflight.count -ne 0){return $false}
        if($q.actionPlan.actions -isnot [array] -or $q.actionPlan.actions.Count -gt 20 -or $r.actionPlan.actions -isnot [array] -or $r.actionPlan.completed -isnot [array] -or $r.actionPlan.completed.Count -ne $q.actionPlan.actions.Count){return $false}
        if((ConvertTo-Json -InputObject $r.actionPlan.actions -Compress -Depth 30) -cne (ConvertTo-Json -InputObject $q.actionPlan.actions -Compress -Depth 30)){return $false}
        for($i=0;$i -lt $q.actionPlan.actions.Count;$i++){$row=$r.actionPlan.completed[$i];if(-not(Test-OwnedPostflightKeys $row @('index','op','status')) -or -not(Test-OwnedPostflightInteger $row.index) -or $row.index -ne ($i+1) -or $row.op -cne $q.actionPlan.actions[$i].op -or $row.status -cne 'success'){return $false}}
        if($reference -and -not(Test-ReferenceNameActionReady $q $r)){return $false}
        $ordinary=@('layout-title-auto','layout-media-regions','layout-empty-custom','table-save','furniture-inherited','furniture-flags','list-description-native-edit','list-description-native-save','layout-bleed-card','picture-control','furniture-layouts','chart-treemap-category','chart-histogram-single','chart-histogram-category','chart-pareto-multi','chart-box-multi','chart-waterfall-single','chart-funnel-category','chart-world-category','feature-catalog-timeline','feature-custom-roadmap','feature-long-labels','feature-metrics','feature-quote','feature-list','feature-table')
        if($dense){if($q.caseId -cne 'feature-dense-events' -or $q.slideCount -ne 1 -or $q.captureTextFonts -or $q.actionPlan.actions.Count -ne 0 -or $r.actionPlan.completed.Count -ne 0){return $false}}
        elseif(-not $reference -and $q.caseId -cnotin $ordinary -and $q.caseId -cnotmatch '^chart-mode-(treemap-category|histogram-single|histogram-category|pareto-multi|box-multi|waterfall-single|funnel-category|world-category|pareto-single)-(fallback|auto|native)$'){return $false}
        if($dense){foreach($name in @('styleEdits','chartPoints','chartSeriesEdits')){if($r.actionPlan.$name -isnot [array] -or $r.actionPlan.$name.Count -ne 0){return $false}}}
        foreach($phase in @('original','edited','reopened')){$state=$r.phases.$phase;if($state.slides -isnot [array] -or $state.slides.Count -lt 1 -or $state.slides.Count -gt $(if($dense){1}else{3}) -or $state.slideCount -ne $q.slideCount -or $state.slides.Count -ne $q.slideCount -or $state.rasters.Count -ne $state.slides.Count){return $false};foreach($slide in $state.slides){if($slide.shapes -isnot [array]){return $false};if($dense){if($slide.shapes.Count -ne 50 -or $slide.shapeCount -ne 50){return $false}}elseif($slide.shapes.Count -gt 30){return $false}}}
        $ready=$a.ready
        if(-not(Test-OwnedPostflightKeys $ready @('workerCleanupConfirmed','stageCount','lifecycle','caseId','actionCount')) -or $ready.workerCleanupConfirmed -isnot [bool] -or -not $ready.workerCleanupConfirmed -or $ready.caseId -cne $q.caseId -or $ready.actionCount -ne $q.actionPlan.actions.Count){return $false}
        if($stages -isnot [array] -or $stages.Count -lt 1 -or $stages.Count -ge $(if($dense){8193}else{5000}) -or $ready.stageCount -ne $stages.Count){return $false}
        $original=$r.source.openedPath;$saved=$r.saved.path
        if($original -isnot [string] -or $saved -isnot [string]){return $false}
        Assert-OwnedPostflightPath $original;Assert-OwnedPostflightPath $saved
        $native=Join-Path $q.output 'native'
        if($original -cne (Join-Path (Join-Path $native 'inputs') 'input.pptx') -or $saved -cne (Join-Path $native 'native-furniture-control.pptx')){return $false}
        $previousStamp=[DateTimeOffset]::MinValue
        for($i=0;$i -lt $stages.Count;$i++){
            $s=$stages[$i]
            if(-not(Test-OwnedPostflightKeys $s @('sequence','timestamp','stage','status','error','cleanupConfirmed','officeOperationsStopped','ownedPresentationPath')) -or -not(Test-OwnedPostflightInteger $s.sequence) -or $s.sequence -ne ($i+1) -or $s.status -cnotin @('begin','success') -or ($null -ne $s.error -and ($s.error -isnot [string] -or $s.error -cne '')) -or $s.officeOperationsStopped -isnot [bool] -or $s.officeOperationsStopped -or $s.cleanupConfirmed -isnot [bool]){return $false}
            if($null -ne $s.ownedPresentationPath -and ($s.ownedPresentationPath -isnot [string] -or ($s.ownedPresentationPath -cne $original -and $s.ownedPresentationPath -cne $saved))){return $false}
            if($s.timestamp -isnot [string] -or $s.timestamp -cnotmatch 'Z$'){return $false};$stamp=[DateTimeOffset]::Parse($s.timestamp,[Globalization.CultureInfo]::InvariantCulture);if($stamp -lt $previousStamp){return $false};$previousStamp=$stamp
        }
        $names=@('worker.initialize','preflight.globalIdle','application.create','application.ownership.presentations.count.get','input.presentation.open','input.presentation.fullName.get','input.presentation.readOnly.get','edited.presentation.saveCopyAs','edited.presentation.close','edited.presentation.cleanup','reopen.presentation.open','reopen.presentation.fullName.get','reopen.presentation.readOnly.get','reopened.presentation.close','reopened.presentation.cleanup','application.cleanup.presentations.count.get','application.cleanup.quit','worker.complete')
        if($ready.lifecycle -isnot [array] -or $ready.lifecycle.Count -ne $names.Count){return $false};$previous=0
        for($i=0;$i -lt $names.Count;$i++){
            $hits=@($stages | Where-Object {$_.stage -ceq $names[$i] -and $_.status -ceq 'success'})
            if($hits.Count -ne 1 -or $hits[0].sequence -le $previous -or $ready.lifecycle[$i].stage -cne $names[$i] -or $ready.lifecycle[$i].sequence -ne $hits[0].sequence){return $false}
            $operations=@($stages | Where-Object {$_.stage -ceq $names[$i]})
            if($names[$i].StartsWith('worker.') -or $names[$i].EndsWith('.cleanup')){if($operations.Count -ne 1){return $false}}
            else{$begins=@($operations | Where-Object {$_.status -ceq 'begin'});if($operations.Count -ne 2 -or $begins.Count -ne 1 -or $begins[0].sequence -le $previous -or $begins[0].sequence -ge $hits[0].sequence){return $false}}
            $previous=$hits[0].sequence;$actual=$hits[0]
            if($names[$i] -cin @('worker.initialize','preflight.globalIdle','application.create','application.ownership.presentations.count.get','application.cleanup.presentations.count.get')){if($null -ne $actual.ownedPresentationPath -or -not $actual.cleanupConfirmed){return $false}}
            if($names[$i] -cin @('input.presentation.open','input.presentation.fullName.get','input.presentation.readOnly.get','edited.presentation.saveCopyAs','edited.presentation.close')){if($actual.ownedPresentationPath -cne $original -or $actual.cleanupConfirmed){return $false}}
            if($names[$i] -cin @('reopen.presentation.open','reopen.presentation.fullName.get','reopen.presentation.readOnly.get','reopened.presentation.close')){if($actual.ownedPresentationPath -cne $saved -or $actual.cleanupConfirmed){return $false}}
            if($names[$i].EndsWith('.cleanup') -or $names[$i] -in @('application.cleanup.quit','worker.complete')){if(-not $hits[0].cleanupConfirmed -or $null -ne $hits[0].ownedPresentationPath){return $false}}
        }
        return ($stages[-1].stage -ceq 'worker.complete' -and $stages[-1].status -ceq 'success')
    } catch {return $false}
}
function Read-FurniturePostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$Profile='full59-ordinary-furniture-lifecycle-v1') {
    $null=Get-FurnitureProfileMode $Profile
    Assert-OwnedPostflightPath $AdmissionFile
    if($ExpectedSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-OwnedPostflightHash $AdmissionFile) -cne $ExpectedSha256 -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304){throw 'Furniture admission identity differs'}
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not(Test-OwnedPostflightKeys $a @('schemaVersion','profile','policy','requestSha256','ready','files','nativeAcceptance','registryAcceptance')) -or $a.files -isnot [array] -or $a.files.Count -lt 1 -or $a.files.Count -gt 2000){throw 'Furniture admission shape refused'}
    if($a.profile -cne $Profile){throw 'Furniture admission profile differs'}
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach($record in $a.files){
        if(-not(Test-OwnedPostflightKeys $record @('file','bytes','sha256'))){throw 'Furniture identity keys differ'};Assert-OwnedPostflightPath $record.file
        if(-not $seen.Add($record.file) -or -not(Test-OwnedPostflightInteger $record.bytes) -or $record.bytes -lt 0 -or $record.sha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $record.file).Length -ne $record.bytes -or (Get-OwnedPostflightHash $record.file) -cne $record.sha256){throw 'Furniture bound artifact changed'}
    }
    $output=Split-Path -Parent $AdmissionFile;if((Split-Path -Leaf $AdmissionFile) -cne 'postflight-admission.json'){throw 'Furniture admission name differs'}
    function Read-FurnitureBoundJson([string]$File){if(-not $seen.Contains($File) -or (Get-Item -LiteralPath $File).Length -gt 4194304){throw 'Required furniture record is unbound/oversized'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json}
    $q=Read-FurnitureBoundJson (Join-Path $output 'execution-request.json')
    if($q.output -cne $output -or $a.requestSha256 -cne (Get-OwnedPostflightHash (Join-Path $output 'execution-request.json'))){throw 'Furniture request binding differs'}
    $native=Join-Path $output 'native';$stageFile=Join-Path $native 'stages.jsonl';if(-not $seen.Contains($stageFile) -or (Get-Item -LiteralPath $stageFile).Length -gt 4194304){throw 'Furniture journal is unbound/oversized'}
    $stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})
    $e=[ordered]@{admission=$a;request=$q;terminal=(Read-FurnitureBoundJson (Join-Path $native 'supervisor.json'));kernel=(Read-FurnitureBoundJson (Join-Path $native 'worker.json'));report=(Read-FurnitureBoundJson (Join-Path $native 'report.json'));stages=$stages}
    foreach($file in @((Join-Path $q.controller.directory 'scripts/native-acceptance/furniture-postflight.ps1'),(Join-Path $q.controller.directory 'scripts/native-acceptance/owned-postflight.ps1'),(Join-Path $q.controller.directory $a.policy.observerSource))){if(-not $seen.Contains($file)){throw 'Furniture observer/bridge source unbound'}}
    return $e
}
function Invoke-FurniturePostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append,[string]$Profile='full59-ordinary-furniture-lifecycle-v1')
    $evidence=Read-FurniturePostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $Profile
    # Local private bridge only; never override the old global readiness function.
    function Test-ReferenceWitnessPostflightReady($Terminal,$Evidence){return Test-FurniturePostflightReady $Terminal $Evidence $Profile}
    foreach($definition in @(Import-OwnedPostflightObserver (Join-Path $evidence.request.controller.directory $evidence.admission.policy.observerSource))){Invoke-Expression $definition}
    if(-not(Test-FurniturePostflightReady $evidence.terminal $evidence $Profile)){throw 'Furniture completion refused; zero observer IO'}
    $postflightPath=Join-Path $evidence.request.output 'postflight.jsonl';if(Test-Path -LiteralPath $postflightPath){throw 'Preserve furniture postflight journal'}
    foreach($record in $evidence.admission.files){if((Get-Item -LiteralPath $record.file).Length -ne $record.bytes -or (Get-OwnedPostflightHash $record.file) -cne $record.sha256){throw 'Furniture source/artifact drift before observer'}}
    $rows=[Collections.Generic.List[object]]::new();$watch=[Diagnostics.Stopwatch]::StartNew()
    if($null -eq $ReadProcesses){$ReadProcesses={try{return @(Get-Process -Name POWERPNT -ErrorAction Stop | ForEach-Object {$_.Id})}catch{if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return @()};throw}}}
    if($null -eq $Clock){$Clock={$watch.Elapsed.TotalMilliseconds}};if($null -eq $Utc){$Utc={[DateTime]::UtcNow.ToString('o')}};if($null -eq $Delay){$Delay={param($ms) Start-Sleep -Milliseconds $ms}}
    $furnitureCapturedRows=$rows;$furnitureJournalPath=$postflightPath;$furnitureAppendDelegate=$Append
    if($null -eq $furnitureAppendDelegate){$furnitureAppendDelegate={param($row)
        $bytes=[Text.Encoding]::UTF8.GetBytes(($row | ConvertTo-Json -Compress -Depth 8)+[Environment]::NewLine);$mode=if($furnitureCapturedRows.Count -eq 0){[IO.FileMode]::CreateNew}else{[IO.FileMode]::Append}
        $stream=[IO.File]::Open($furnitureJournalPath,$mode,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush()}finally{$stream.Dispose()}
    }.GetNewClosure()}
    $capturedAppend={param($row) $null=& $furnitureAppendDelegate $row;$furnitureCapturedRows.Add($row)}.GetNewClosure()
    $result=$null;$failure=$null
    try{$result=Invoke-ReferenceWitnessPostflight $evidence.terminal $evidence $ReadProcesses $Clock $Utc $Delay $capturedAppend}catch{$failure=$_.Exception.Message}finally{$watch.Stop()}
    $observed=@($rows | Where-Object {$_.status -ceq 'observed'});$initial=$null;$final=$null
    if($observed.Count){$initial=@($observed[0].processIds).Count;$final=@($observed[-1].processIds).Count}
    $identity=$null;if(Test-Path -LiteralPath $postflightPath){$identity=[ordered]@{path='postflight.jsonl';bytes=(Get-Item -LiteralPath $postflightPath).Length;sha256=(Get-OwnedPostflightHash $postflightPath)}}
    return [ordered]@{schemaVersion=1;policy=$evidence.admission.policy;workerCleanupConfirmed=$true;initialCount=$initial;finalCount=$final;identity=$identity;result=$result;error=$failure}
}
function Invoke-FurnitureTypedRunner {
    param([string]$Envelope,[string]$Sha256,[string]$RequestSha256,[string]$Node,[string]$Suite,[string]$WorkerRoot,[string]$CaseId,[string]$Output,[int]$Seconds,[bool]$Office,[bool]$Fonts,[switch]$DenseEvents,[switch]$ReferenceNameEdit)
    if($DenseEvents -and $ReferenceNameEdit){throw 'Choose one closed furniture route'}
    $profile=if($ReferenceNameEdit){'reference-line-one-series-name-edit-v1'}elseif($DenseEvents){'full59-dense-events-furniture-lifecycle-v1'}else{'full59-ordinary-furniture-lifecycle-v1'}
    $validator=Join-Path $PSScriptRoot $(if($ReferenceNameEdit){'reference-name-profile.mjs'}elseif($DenseEvents){'dense-furniture-profile.mjs'}else{'furniture-profile.mjs'});$required=$Office.ToString().ToLowerInvariant()
    function Assert-FurnitureTypedBinding {
        $result=& $Node $validator verify-execution --envelope $Envelope --sha256 $Sha256 --output $Output --require-office $required
        if($LASTEXITCODE -ne 0){throw 'Typed furniture source/request refused before native operations'}
        $binding=($result | Out-String) | ConvertFrom-Json;if($binding.requestSha256 -cne $RequestSha256){throw 'External furniture request identity differs'}
    }
    Assert-FurnitureTypedBinding
    $e=Get-Content -LiteralPath $Envelope -Raw -Encoding UTF8 | ConvertFrom-Json
    $q=Get-Content -LiteralPath (Join-Path $Output 'execution-request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($Suite -cne $e.generation.suiteDirectory -or $CaseId -cne $q.caseId -or $WorkerRoot -cne (Join-Path $q.controller.directory 'packages/pptx') -or $Seconds -ne $q.timeoutSeconds -or $Fonts -ne $q.captureTextFonts){throw 'Typed furniture command arguments differ'}
    $shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe';$worker=$q.worker.path
    Import-NativePlanValidation $worker ([bool]$DenseEvents);Assert-NativeFontCaptureSupport $worker $Fonts
    $inputFile=Join-Path $Output 'inputs/case.pptx';$plan=Join-Path $Output 'inputs/action-plan.json';$actions=Read-AndValidateActionPlan $plan
    if($DenseEvents){Assert-FurnitureSurvey $true $actions $inputFile}
    $receipt=[ordered]@{schemaVersion=1;profile=$q.profile;caseId=$CaseId;requestSha256=$RequestSha256;runOfficeRequested=$Office;status='pure-checks-pending';nativeAcceptance=$false;registryAcceptance=$false}
    $receiptPath=Join-Path $Output 'runner.json';if(Test-Path -LiteralPath $receiptPath){throw 'Preserve prior typed furniture attempt'}
    function Write-FurnitureTypedReceipt {$receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $receiptPath -Encoding UTF8}
    try {
        Write-FurnitureTypedReceipt
        Invoke-NativeChild $shell (Join-Path $WorkerRoot 'test/native-process-check.ps1') @('-OutputDirectory',(Join-Path $Output 'harness/process')) (Join-Path $Output 'process-check.log')
        Invoke-NativeChild $shell (Join-Path $WorkerRoot 'test/native-furniture-harness-check.ps1') @('-ScriptPath',$worker,'-ReportPath',(Join-Path $Output 'harness/furniture.json')) (Join-Path $Output 'furniture-harness.log')
        Assert-FurnitureTypedBinding
        if(-not $Office){$receipt.status='pure-checks-completed; native-not-run';Write-FurnitureTypedReceipt;return}
        $receipt.status='native-worker-pending';Write-FurnitureTypedReceipt
        $arguments=@('-InputPresentation',$inputFile,'-ActionPlan',$plan,'-OutputDirectory',(Join-Path $Output 'native'),'-TimeoutSeconds',([string]$Seconds)) + @(Get-NativeFontCaptureArguments $Fonts)
        if($DenseEvents){$arguments+='-ReadOnlySurvey'}
        Invoke-NativeChild $shell $worker $arguments (Join-Path $Output 'native-worker.log')
        $admissionJson=& $Node $validator verify-postflight --envelope $Envelope --sha256 $Sha256 --output $Output --require-office true
        if($LASTEXITCODE -ne 0){throw 'Furniture lifecycle completion refused; zero observer IO'}
        $admission=($admissionJson | Out-String) | ConvertFrom-Json
        $postflight=Invoke-FurniturePostflight -AdmissionFile $admission.path -ExpectedAdmissionSha256 $admission.sha256 -Profile $profile
        $postflight | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Output 'postflight-result.json') -Encoding UTF8
        if($null -ne $postflight.error -or $null -eq $postflight.result -or $postflight.result.observedZero -cne $true){throw 'Furniture postflight failed; no retry or cleanup'}
        & $Node $validator observe --envelope $Envelope --sha256 $Sha256 --output $Output --require-office true
        if($LASTEXITCODE -ne 0){throw 'Furniture final bindings refused'}
        $receipt.status='lifecycle-observed; semantic-and-visual-review-required';Write-FurnitureTypedReceipt
    } catch {$receipt.status='failed; no-retry';$receipt.error=$_.Exception.Message;Write-FurnitureTypedReceipt;throw}
}
