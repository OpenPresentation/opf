# New typed admission only. Polling is exclusively the unchanged hash-pinned
# maintained Invoke-ReferenceWitnessPostflight function, loaded locally below.
function Get-SevenValuePostflightOperations($Report,$Action) {
    $names=[Collections.Generic.List[string]]::new()
    foreach($name in @(Get-SevenPostflightOperations $Report)) {
        if($name -ceq 'application.create'){$names.Add('preflight.globalIdle')}
        $phase=if($name -ceq 'copy.fullName'){'original'}elseif($name -ceq 'saved-reopened.slides'){'saved-reopened'}else{$null}
        if($null -ne $phase) {
            $prefix="value.$phase.target";$count=$Report.phases.$phase.slides[$Action.slideIndex-1].shapeCount
            foreach($suffix in @('fullName','readOnly','slides','slides.count','slide.get','shapes','shapes.count')){$names.Add("$prefix.$suffix")}
            for($i=1;$i -le $count;$i++){foreach($suffix in @('get','id','name')){$names.Add("$prefix.shape.$i.$suffix")}}
            foreach($suffix in @('hasChart','chart','chart.type','series','series.count','series.item','series.name')){$names.Add("$prefix.$suffix")}
            foreach($suffix in @('fullName','readOnly')){$names.Add("value.$phase.read.$suffix")};$names.Add("value.$phase.values.get")
            if($phase -ceq 'original') {
                foreach($suffix in @('fullName','readOnly')){$names.Add("value.setter.$suffix")};$names.Add('value.series.values.set')
                foreach($suffix in @('fullName','readOnly')){$names.Add("value.edited.read.$suffix")};$names.Add('value.edited.values.get')
            }
        }
        $names.Add($name)
    }
    return $names.ToArray()
}
function Get-SevenValueCriticalProbes($Report,$Action) {
    $records=[Collections.Generic.List[object]]::new()
    function Add-ValueProof([string]$Stage,$Expected,$Actual){$records.Add([ordered]@{stage=$Stage;expected=$Expected;actual=$Actual;matched=$true})}
    function Add-ValueOwner([string]$Prefix){Add-ValueProof "$Prefix.ownership" 'same verified owned application/presentation references' $true}
    function Add-ValueGuard([string]$Prefix,[string]$File){
        Add-ValueOwner $Prefix
        foreach($suffix in @('capturedRefs','fullName.refs')){Add-ValueProof "$Prefix.$suffix" 'same captured owned references/path' $true}
        Add-ValueProof "$Prefix.fullName" $File $File
        Add-ValueProof "$Prefix.readOnly.refs" 'same captured owned references/path' $true
        Add-ValueProof "$Prefix.readOnly" (-1) (-1)
    }
    function Add-ValueTarget([string]$Prefix,[string]$Phase,[string]$File){
        Add-ValueOwner $Prefix;Add-ValueProof "$Prefix.fullName" $File $File;Add-ValueProof "$Prefix.readOnly" (-1) (-1);Add-ValueProof "$Prefix.slides.count" 7 7
        Add-ValueProof "$Prefix.shapes.count" '1..3' $Report.phases.$Phase.slides[$Action.slideIndex-1].shapeCount
        Add-ValueProof "$Prefix.exactTarget" 1 1;Add-ValueProof "$Prefix.hasChart" (-1) (-1);Add-ValueProof "$Prefix.chart.type" $Action.comChartType $Action.comChartType
        Add-ValueProof "$Prefix.series.count" "1..$($Action.maxSeriesCount)" 1;Add-ValueProof "$Prefix.series.name" $Action.seriesName $Action.seriesName
    }
    function Add-ValueReadback([string]$Phase,$Values){for($i=0;$i -lt $Values.Count;$i++){Add-ValueProof "value.$Phase.expected.$i" $Values[$i] ([double]$Values[$i])}}
    Add-ValueProof 'preflight.globalIdle' 0 0
    Add-ValueTarget 'value.original.target' 'original' $Report.sourcePath;Add-ValueGuard 'value.original.read' $Report.sourcePath;Add-ValueReadback 'original' $Action.expectedValues
    Add-ValueGuard 'value.setter' $Report.sourcePath;Add-ValueGuard 'value.edited.read' $Report.sourcePath;Add-ValueReadback 'edited' $Action.newValues
    Add-ValueTarget 'value.saved-reopened.target' 'saved-reopened' $Report.savedPath;Add-ValueGuard 'value.saved-reopened.read' $Report.savedPath;Add-ValueReadback 'saved-reopened' $Action.newValues
    return $records.ToArray()
}
function Test-SevenValuePostflightReady($Terminal,$Evidence) {
    try {
        if(-not (Test-OwnedPostflightCommonReady $Terminal $Evidence 'seven-chart-treemap-single-value-edit-v1' 'seven-treemap-value-bounded-global-zero-after-completed-owned-quit-v1' 2 1 2 1)){return $false}
        $r=$Evidence.report;$q=$Evidence.request;$s=$Evidence.stages;$action=$q.selectedCase.action
        if($r.schemaVersion -ne 3 -or $r.actions -isnot [array] -or $r.actions.Count -ne 1 -or $r.closes -ne 2 -or $r.saveCopies -ne 1 -or $r.quits -ne 1 -or $r.opens.Count -ne 2){return $false}
        if($action.sourceType -cne 'treemap' -or $action.slideIndex -ne 1 -or $action.branch -cne 'choice' -or $action.comChartType -ne 117 -or $q.selectedCase.representation -cne 'native-treemap-choice'){return $false}
        if(-not (Test-OwnedPostflightOperations $s @(Get-SevenValuePostflightOperations $r $action))){return $false}
        $probe=$r.actions[0]
        if($probe.status -cne 'success' -or -not (Test-OwnedPostflightInteger $probe.setterAttempts) -or $probe.setterAttempts -ne 1 -or $probe.actionModelSha256 -cne $q.selectedCase.actionModelSha256 -or $probe.actionFileIdentity.bytes -ne $q.selectedCase.actionFileIdentity.bytes -or $probe.actionFileIdentity.sha256 -cne $q.selectedCase.actionFileIdentity.sha256 -or $probe.observedKind -cne 'System.Array' -or $probe.observedRank -ne 1 -or $probe.observedLength -ne 4){return $false}
        foreach($pair in @(@('before','expectedValues'),@('after','newValues'),@('reopened','newValues'),@('observedValues','newValues'))) {
            $actual=$probe.($pair[0]);$expected=$action.($pair[1]);if($actual -isnot [array] -or $actual.Count -ne 4 -or $expected.Count -ne 4){return $false}
            for($i=0;$i -lt 4;$i++){if($actual[$i] -is [bool] -or $actual[$i] -is [string] -or $actual[$i] -isnot [ValueType] -or [double]::IsNaN([double]$actual[$i]) -or [double]::IsInfinity([double]$actual[$i]) -or $actual[$i] -ne $expected[$i]){return $false}}
        }
        if($r.probes -isnot [array] -or $r.probes.Count -eq 0){return $false};foreach($probe in $r.probes){if($probe.matched -isnot [bool] -or -not $probe.matched){return $false}}
        $critical=@($r.probes | Where-Object {$_.stage -is [string] -and ($_.stage.StartsWith('value.') -or $_.stage.StartsWith('preflight.'))})
        $expected=@(Get-SevenValueCriticalProbes $r $action)
        if($critical.Count -ne $expected.Count){return $false}
        for($i=0;$i -lt $expected.Count;$i++){
            if(-not (Test-OwnedPostflightKeys $critical[$i] @('stage','expected','actual','matched'))){return $false}
            foreach($field in @('stage','expected','actual','matched')){if(($critical[$i].$field | ConvertTo-Json -Compress -Depth 8) -cne ($expected[$i].$field | ConvertTo-Json -Compress -Depth 8)){return $false}}
        }
        foreach($name in @('preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count')){if((Get-OwnedPostflightSuccess $s $name).value -ne 0){return $false}}
        $paths=@((Join-Path $q.output 'inputs/case.pptx'),(Join-Path $q.nativeRoot 'saved.pptx'));$phases=@('original','saved-reopened')
        for($p=0;$p -lt 2;$p++) {
            $phase=$phases[$p];$open=$r.opens[$p];$observed=$r.phases.$phase
            if($open.phase -cne $phase -or $open.path -cne $paths[$p] -or $open.readOnly -ne -1 -or $observed.slideCount -ne 7 -or $observed.slides.Count -ne 7 -or $observed.rasters.Count -ne 7){return $false}
            foreach($suffix in @('fullName','close.fullName')){if((Get-OwnedPostflightSuccess $s "$phase.$suffix").value -cne $paths[$p]){return $false}}
            if((Get-OwnedPostflightSuccess $s "$phase.readOnly").value -ne -1){return $false}
            for($i=1;$i -le 7;$i++) {
                if($observed.slides[$i-1].shapeCount -ne 2 -or $observed.slides[$i-1].shapes.Count -ne 2){return $false}
                for($j=1;$j -le 2;$j++) {
                    $shape=$observed.slides[$i-1].shapes[$j-1]
                    foreach($field in @('id','name','type','left','top','width','height','rotation','hasTextFrame','alternativeText')){if((Get-OwnedPostflightSuccess $s "$phase.slide.$i.shape.$j.$field").value -cne $shape.$field){return $false}}
                    if($shape.hasTextFrame -eq -1 -and (Get-OwnedPostflightSuccess $s "$phase.slide.$i.shape.$j.text").value -cne $shape.text){return $false}
                }
            }
        }
        foreach($prefix in @('value.original.target','value.original.read','value.setter','value.edited.read','value.saved-reopened.target','value.saved-reopened.read')) {
            $expectedPath=if($prefix.Contains('saved-reopened')){$paths[1]}else{$paths[0]}
            if((Get-OwnedPostflightSuccess $s "$prefix.fullName").value -cne $expectedPath -or (Get-OwnedPostflightSuccess $s "$prefix.readOnly").value -ne -1){return $false}
        }
        foreach($phase in @('original','edited','saved-reopened')){if((Get-OwnedPostflightSuccess $s "value.$phase.values.get").value -cne '[unsupported non-primitive value]'){return $false}}
        return $s[-1].cleanupConfirmed -ceq $true
    }catch{return $false}
}
function Read-SevenValuePostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$ControllerRoot) {
    Assert-OwnedPostflightPath $AdmissionFile
    if((Split-Path -Leaf $AdmissionFile) -cne 'postflight-admission.json' -or $ExpectedSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-OwnedPostflightHash $AdmissionFile) -cne $ExpectedSha256){throw 'Externally pinned value admission differs'}
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if($a.profile -cne 'seven-chart-treemap-single-value-edit-v1' -or $a.files -isnot [array] -or $a.files.Count -lt 1 -or $a.files.Count -gt 2000){throw 'Closed value admission required'}
    $seen=@{}
    foreach($record in $a.files){
        if(-not (Test-OwnedPostflightKeys $record @('file','bytes','sha256'))){throw 'Unknown value file identity'};Assert-OwnedPostflightPath $record.file
        if($seen.ContainsKey($record.file) -or -not (Test-OwnedPostflightInteger $record.bytes) -or $record.bytes -lt 0 -or $record.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid/duplicate value evidence'}
        $item=Get-Item -LiteralPath $record.file -Force;if($item.PSIsContainer -or $item.Length -ne $record.bytes -or (Get-OwnedPostflightHash $record.file) -cne $record.sha256){throw 'Value evidence changed'};$seen[$record.file]=$true
    }
    $output=Split-Path -Parent $AdmissionFile
    function Read-ValueBoundJson([string]$File){if(-not $seen.ContainsKey($File) -or (Get-Item -LiteralPath $File).Length -gt 4194304){throw 'Unbound/oversized value JSON'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json}
    $requestFile=Join-Path $output 'execution-request.json';$q=Read-ValueBoundJson $requestFile
    if($q.output -cne $output -or $q.nativeRoot -cne (Join-Path $output 'native') -or $q.controller.directory -cne $ControllerRoot -or $a.requestSha256 -cne (Get-OwnedPostflightHash $requestFile)){throw 'Foreign value request/output'}
    foreach($snapshot in $q.snapshots){$file=Join-Path $output $snapshot.path;if($snapshot.path -match '[\\:]|(^|/)\.\.(/|$)' -or -not $seen.ContainsKey($file)){throw 'Unbound value snapshot'};$records=@($a.files | Where-Object {$_.file -ceq $file -and $_.bytes -eq $snapshot.bytes -and $_.sha256 -ceq $snapshot.sha256});if($records.Count -ne 1){throw 'Changed value snapshot identity'}}
    $stageFile=Join-Path $q.nativeRoot 'stages.jsonl';if(-not $seen.ContainsKey($stageFile) -or (Get-Item -LiteralPath $stageFile).Length -gt 4194304){throw 'Unbound value raw stages'}
    $e=[ordered]@{admission=$a;request=$q;report=(Read-ValueBoundJson (Join-Path $q.nativeRoot 'report.json'));terminal=(Read-ValueBoundJson (Join-Path $q.nativeRoot 'worker.json'));stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})}
    # Recompute full source/target/persisted/public-import/style admission through
    # its bound Node controller. This is pure verification, before any observer IO.
    if(-not $seen.ContainsKey($q.node.path)){throw 'Unbound value Node'}
    & $q.node.path (Join-Path $ControllerRoot 'scripts/native-acceptance/seven-value-profile.mjs') verify-admission --envelope (Join-Path $output 'execution-envelope.json') --sha256 $q.envelopeSha256 --output $output --require-office true | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Full value typed admission recomputation refused'}
    return $e
}
function Invoke-SevenValuePostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot,[scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append)
    $evidence=Read-SevenValuePostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $ControllerRoot
    return Invoke-SevenValueBoundPostflight -Evidence $evidence -ControllerRoot $ControllerRoot -AdmissionFile $AdmissionFile -ExpectedAdmissionSha256 $ExpectedAdmissionSha256 -ReadProcesses $ReadProcesses -Clock $Clock -Utc $Utc -Delay $Delay -Append $Append
}
function Invoke-SevenValueBoundPostflight {
    param($Evidence,[string]$ControllerRoot,[string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append)
    # Private bound-evidence phase for managed injected-IO tests. The actual entry
    # above always runs the complete source/file/Node reader first.
    $evidence=$Evidence
    # Definitions are local. The shared dispatcher and all old guards stay intact.
    $tokens=$null;$parseFailures=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $ControllerRoot 'scripts/native-acceptance/seven-postflight.ps1'),[ref]$tokens,[ref]$parseFailures)
    if($parseFailures.Count -ne 0){throw 'Bound Seven operation definition parse failure'}
    $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Get-SevenPostflightOperations'},$true));if($found.Count -ne 1){throw 'Missing exact Seven operations definition'};Invoke-Expression $found[0].Extent.Text
    foreach($definition in @(Import-OwnedPostflightObserver (Join-Path $ControllerRoot 'scripts/native-acceptance/run-reference-chart-profile.ps1'))){Invoke-Expression $definition}
    function Test-ReferenceWitnessPostflightReady($Terminal,$Evidence){return Test-SevenValuePostflightReady $Terminal $Evidence}
    if(-not (Test-ReferenceWitnessPostflightReady $evidence.terminal $evidence)){throw 'Value typed completion refused; zero observer IO'}
    foreach($record in $evidence.admission.files){if((Get-Item -LiteralPath $record.file).Length -ne $record.bytes -or (Get-OwnedPostflightHash $record.file) -cne $record.sha256){throw 'Value identity drift before observer'}}
    $postflightPath=Join-Path (Split-Path -Parent $AdmissionFile) 'postflight.jsonl';if(Test-Path -LiteralPath $postflightPath){throw 'Preserve existing value postflight journal'}
    $rows=[Collections.Generic.List[object]]::new();$watch=[Diagnostics.Stopwatch]::StartNew()
    if($null -eq $ReadProcesses){$ReadProcesses={try{return @(Get-Process -Name POWERPNT -ErrorAction Stop | ForEach-Object {$_.Id})}catch{if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return @()};throw}}}
    if($null -eq $Clock){$Clock={return $watch.Elapsed.TotalMilliseconds}};if($null -eq $Utc){$Utc={return [DateTime]::UtcNow.ToString('o')}};if($null -eq $Delay){$Delay={param($Milliseconds) Start-Sleep -Milliseconds $Milliseconds}}
    # Capture AFTER successful delegation for BOTH production journal and injected
    # delegates. Unique captured names avoid the observer's own $Append parameter.
    $valueCapturedRows=$rows;$valueJournalPath=$postflightPath
    $valueAppendDelegate=$Append
    if($null -eq $valueAppendDelegate){$valueAppendDelegate={param($Row) $bytes=[Text.Encoding]::UTF8.GetBytes(($Row | ConvertTo-Json -Compress -Depth 8)+[Environment]::NewLine);$mode=if($valueCapturedRows.Count -eq 0){[IO.FileMode]::CreateNew}else{[IO.FileMode]::Append};$stream=[IO.File]::Open($valueJournalPath,$mode,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush()}finally{$stream.Dispose()}}.GetNewClosure()}
    $valueCaptureAppend={param($Row) $null=& $valueAppendDelegate $Row;$valueCapturedRows.Add($Row)}.GetNewClosure()
    $result=$null;$failure=$null;try{$result=Invoke-ReferenceWitnessPostflight $evidence.terminal $evidence $ReadProcesses $Clock $Utc $Delay $valueCaptureAppend}catch{$failure=$_.Exception.Message}
    $observed=@($rows | Where-Object {$_.status -ceq 'observed'});$initial=$null;$final=$null;if($observed.Count -gt 0){$initial=@($observed[0].processIds).Count;$final=@($observed[-1].processIds).Count}
    $identity=$null;if(Test-Path -LiteralPath $postflightPath){$identity=[ordered]@{path='postflight.jsonl';bytes=(Get-Item -LiteralPath $postflightPath).Length;sha256=(Get-OwnedPostflightHash $postflightPath)}}
    return [ordered]@{schemaVersion=1;policy=$evidence.admission.policy;workerCleanupConfirmed=$true;admission=[ordered]@{path=$AdmissionFile;bytes=(Get-Item -LiteralPath $AdmissionFile).Length;sha256=$ExpectedAdmissionSha256};identity=$identity;initialCount=$initial;finalCount=$final;result=$result;error=$failure}
}
