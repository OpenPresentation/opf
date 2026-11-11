# Definitions only. Full Node source/data/raw/import admission precedes the unchanged observer.
function Get-SevenSnapshotPostflightOperations($Report,$Action,[switch]$HistogramClassic){
    $out=[Collections.Generic.List[string]]::new()
    function Add-SnapshotGuard([string]$Prefix){$out.Add($Prefix+'.fullName');$out.Add($Prefix+'.readOnly')}
    function Add-SnapshotCopy([string]$Phase){Add-SnapshotGuard ('archive.'+$Phase);$out.Add('archive.'+$Phase+'.saveCopyAs');Add-SnapshotGuard ('archive.'+$Phase+'.after')}
    foreach($name in @(Get-SevenPostflightOperations $Report)){
        if($name -ceq 'application.create'){$out.Add('preflight.globalIdle')}
        if($name -ceq 'copy.fullName'){
            Add-SnapshotCopy 'before';$out.Add('archive.before.check');$p='snapshot.target'
            foreach($suffix in @('fullName','readOnly','slides','slides.count','slide.get','shapes','shapes.count')){$out.Add($p+'.'+$suffix)}
            $count=$Report.phases.original.slides[$Action.slideIndex-1].shapeCount
            for($i=1;$i -le $count;$i++){foreach($suffix in @('get','id','name')){$out.Add($p+'.shape.'+$i+'.'+$suffix)}}
            foreach($suffix in @('hasChart','chart','chart.type','series','series.count','series.item','series.name')){$out.Add($p+'.'+$suffix)}
            if($HistogramClassic){$out.Add($p+'.series.type')}
            Add-SnapshotGuard 'snapshot.setter';$out.Add('snapshot.series.values.set');Add-SnapshotCopy 'edited';continue
        }
        if($name -cin @('copy.saveCopyAs','copy.afterName')){continue}
        if($name -ceq 'saved-reopened.close.fullName'){Add-SnapshotCopy 'reopened'}
        $out.Add($name)
    };return $out.ToArray()
}
function Test-SevenSnapshotPostflightReady($Terminal,$Evidence,[switch]$HistogramClassic){
    $expectedProfile=if($HistogramClassic){'seven-histogram-classic-setter-native-archives-v1'}else{'seven-treemap-setter-native-archives-v1'}
    $expectedPolicy=if($HistogramClassic){'seven-histogram-classic-snapshots-bounded-global-zero-v1'}else{'seven-treemap-snapshots-bounded-global-zero-v1'}
    try{
        if(-not(Test-OwnedPostflightCommonReady $Terminal $Evidence $expectedProfile $expectedPolicy 2 3 2 1)){return $false}
        $r=$Evidence.report;$q=$Evidence.request;$s=$Evidence.stages;$a=$q.selectedCase.action
        if($HistogramClassic){
            foreach($key in @('slideIndex','shapeId','comChartType','seriesIndex','maxSeriesCount','pointIndex')){if(-not(Test-OwnedPostflightInteger $a.$key)){return $false}}
            if($q.selectedCase.nativeTypeQualified -isnot [bool] -or $q.selectedCase.nativeTypeQualified -or $a.op -cne 'set-seven-classic-histogram-values' -or $a.sourceType -cne 'histogram' -or $a.slideIndex -ne 2 -or $a.shapeId -ne 3 -or $a.shapeName -cne 'OPF chart 2' -or $a.branch -cne 'direct' -or $a.chartFamily -cne 'classic' -or $a.comChartType -ne 51 -or $a.seriesIndex -ne 1 -or $a.maxSeriesCount -ne 1 -or $a.seriesName -cne 'Value' -or $a.pointIndex -ne 1){return $false}
            if((Get-OwnedPostflightSuccess $s 'snapshot.target.chart.type').value -ne 51 -or (Get-OwnedPostflightSuccess $s 'snapshot.target.series.type').value -ne 51 -or (Get-OwnedPostflightSuccess $s 'snapshot.target.series.count').value -ne 1){return $false}
        }elseif($a.sourceType -cne 'treemap' -or $a.slideIndex -ne 1 -or $a.branch -cne 'choice' -or $a.comChartType -ne 117){return $false}
        if($r.schemaVersion -ne 4 -or $r.opens.Count -ne 2 -or $r.saveCopies -ne 3 -or $r.closes -ne 2 -or $r.quits -ne 1 -or $r.actions.Count -ne 1){return $false}
        if(-not(Test-OwnedPostflightOperations $s @(Get-SevenSnapshotPostflightOperations $r $a -HistogramClassic:$HistogramClassic))){return $false}
        $probe=$r.actions[0];if(-not(Test-OwnedPostflightKeys $probe @('op','actionModelSha256','actionFileIdentity','status','setterAttempts')) -or $probe.status -cne 'success' -or -not(Test-OwnedPostflightInteger $probe.setterAttempts) -or $probe.setterAttempts -ne 1 -or $probe.actionModelSha256 -cne $q.selectedCase.actionModelSha256 -or $probe.actionFileIdentity.bytes -ne $q.selectedCase.actionFileIdentity.bytes -or $probe.actionFileIdentity.sha256 -cne $q.selectedCase.actionFileIdentity.sha256){return $false}
        foreach($row in $r.probes){if($row.matched -isnot [bool] -or -not $row.matched){return $false}}
        foreach($phase in @('before','edited','reopened')){if($r.snapshots.$phase.path -cne (Join-Path $q.nativeRoot ($phase+'.pptx')) -or $r.snapshots.$phase.sha256 -cnotmatch '^[a-f0-9]{64}$'){return $false}}
        foreach($name in @('preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count')){if((Get-OwnedPostflightSuccess $s $name).value -ne 0){return $false}}
        return $s[-1].cleanupConfirmed -ceq $true
    }catch{return $false}
}
function Read-SevenSnapshotPostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$ControllerRoot,[switch]$HistogramClassic){
    $expectedProfile=if($HistogramClassic){'seven-histogram-classic-setter-native-archives-v1'}else{'seven-treemap-setter-native-archives-v1'}
    Assert-OwnedPostflightPath $AdmissionFile
    if((Split-Path -Leaf $AdmissionFile) -cne 'postflight-admission.json' -or $ExpectedSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-OwnedPostflightHash $AdmissionFile) -cne $ExpectedSha256){throw 'Externally pinned snapshot admission differs'}
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if($a.profile -cne $expectedProfile -or $a.files -isnot [array] -or $a.files.Count -lt 1 -or $a.files.Count -gt 2000){throw 'Closed bounded snapshot admission required'}
    $seen=@{};foreach($row in $a.files){if(-not(Test-OwnedPostflightKeys $row @('file','bytes','sha256'))){throw 'Snapshot identity fields differ'};Assert-OwnedPostflightPath $row.file;if($seen.ContainsKey($row.file) -or -not(Test-OwnedPostflightInteger $row.bytes) -or $row.bytes -lt 0 -or $row.sha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $row.file).Length -ne $row.bytes -or (Get-OwnedPostflightHash $row.file) -cne $row.sha256){throw 'Bound snapshot source/artifact changed'};$seen[$row.file]=$true}
    $output=Split-Path -Parent $AdmissionFile
    function Read-SnapshotJson([string]$File){if(-not $seen.ContainsKey($File) -or (Get-Item -LiteralPath $File).Length -gt 4194304){throw 'Unbound snapshot JSON'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json}
    $requestFile=Join-Path $output 'execution-request.json';$q=Read-SnapshotJson $requestFile
    if($q.output -cne $output -or $q.nativeRoot -cne (Join-Path $output 'native') -or $q.controller.directory -cne $ControllerRoot -or $a.requestSha256 -cne (Get-OwnedPostflightHash $requestFile) -or -not $seen.ContainsKey($q.node.path)){throw 'Foreign snapshot request/controller'}
    $stageFile=Join-Path $q.nativeRoot 'stages.jsonl';if(-not $seen.ContainsKey($stageFile) -or (Get-Item -LiteralPath $stageFile).Length -gt 4194304){throw 'Unbound snapshot stage journal'}
    foreach($snapshot in $q.snapshots){$file=Join-Path $output $snapshot.path;if($snapshot.path -match '[\\:]|(^|/)\.\.(/|$)' -or -not $seen.ContainsKey($file)){throw 'Unbound immutable snapshot'};$matches=@($a.files | Where-Object {$_.file -ceq $file -and $_.bytes -eq $snapshot.bytes -and $_.sha256 -ceq $snapshot.sha256});if($matches.Count -ne 1){throw 'Snapshot input hash differs'}}
    & $q.node.path (Join-Path $ControllerRoot $(if($HistogramClassic){'scripts/native-acceptance/seven-histogram-snapshot.mjs'}else{'scripts/native-acceptance/seven-value-snapshot-profile.mjs'})) verify-admission --envelope (Join-Path $output 'execution-envelope.json') --sha256 $q.envelopeSha256 --output $output --require-office true | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Complete snapshot source/data/style/public-import admission refused; zero observer IO'}
    return [ordered]@{admission=$a;request=$q;report=(Read-SnapshotJson (Join-Path $q.nativeRoot 'report.json'));terminal=(Read-SnapshotJson (Join-Path $q.nativeRoot 'worker.json'));stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})}
}
function Invoke-SevenSnapshotPostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot)
    $evidence=Read-SevenSnapshotPostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $ControllerRoot
    # Private new-profile adapter only. The shared v1 dispatcher/guard is not replaced.
    function Test-SevenValuePostflightReady($Terminal,$Evidence){return Test-SevenSnapshotPostflightReady $Terminal $Evidence}
    return Invoke-SevenValueBoundPostflight -Evidence $evidence -ControllerRoot $ControllerRoot -AdmissionFile $AdmissionFile -ExpectedAdmissionSha256 $ExpectedAdmissionSha256
}

function Invoke-SevenHistogramSnapshotPostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot)
    $evidence=Read-SevenSnapshotPostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $ControllerRoot -HistogramClassic
    function Test-SevenValuePostflightReady($Terminal,$Evidence){return Test-SevenSnapshotPostflightReady $Terminal $Evidence -HistogramClassic}
    return Invoke-SevenValueBoundPostflight -Evidence $evidence -ControllerRoot $ControllerRoot -AdmissionFile $AdmissionFile -ExpectedAdmissionSha256 $ExpectedAdmissionSha256
}
