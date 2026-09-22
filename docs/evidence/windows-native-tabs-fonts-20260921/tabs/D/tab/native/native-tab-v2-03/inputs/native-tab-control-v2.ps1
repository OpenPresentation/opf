param(
    [string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression,
    [string]$ReplayMetricsReport,
    [string]$RecoveredMetricsPath
)
$ErrorActionPreference='Stop'

function Get-ControlSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-TabHelperPureRegression {
    $tokens=$null
    $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    $functionDefinitions=@($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] },$true))
    foreach($functionName in @('Invoke-ControlCom','Add-ControlTextBox','Get-PhaseMetrics','Get-PersistenceMetrics','Get-ContentChecks')) {
        $definition=@($functionDefinitions | Where-Object { $_.Name -ceq $functionName })
        if($definition.Count -ne 1) { throw "Expected exactly one $functionName definition, found $($definition.Count)" }
        Invoke-Expression $definition[0].Extent.Text
    }

    $script:officeOperationsStopped=$false
    $script:cleanupConfirmed=$true
    $script:selfTestStages=@()
    function Write-ControlStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) {
        $script:selfTestStages+=@([ordered]@{stage=$StageName;status=$Status;error=$ErrorMessage})
    }

    $color=[pscustomobject]@{RGB=$null}
    $font=[pscustomobject]@{Name=$null;Size=$null;Bold=$null;Italic=$null;Color=$color}
    $bullet=[pscustomobject]@{Visible=$null}
    $paragraph=[pscustomobject]@{Alignment=$null;Bullet=$bullet}
    $range=[pscustomobject]@{Text=$null;Font=$font;ParagraphFormat=$paragraph}
    $level=[pscustomobject]@{FirstMargin=$null;LeftMargin=$null}
    $levels=[pscustomobject]@{Level=$level}
    $levels | Add-Member -MemberType ScriptMethod -Name Item -Value { param($index) if($index -ne 1){throw 'Unexpected level index'}; return $this.Level }
    $ruler=[pscustomobject]@{Levels=$levels}
    $frame=[pscustomobject]@{MarginLeft=$null;MarginRight=$null;MarginTop=$null;MarginBottom=$null;WordWrap=$null;AutoSize=$null;TextRange=$range;Ruler=$ruler}
    $shape=[pscustomobject]@{Name=$null;TextFrame=$frame}
    $shapes=[pscustomobject]@{Shape=$shape}
    $shapes | Add-Member -MemberType ScriptMethod -Name AddTextbox -Value { param($orientation,$left,$top,$width,$height) return $this.Shape }

    $expectedName='selftest-shape-name'
    $expectedText=([string][char]9+'Before')
    $created=Add-ControlTextBox $shapes $expectedName $expectedText 12.5 34.5 'selftest.textbox'
    if($shape.Name -cne $expectedName) { throw "Shape name was shadowed: expected '$expectedName', observed '$($shape.Name)'" }
    if($range.Text -cne $expectedText) { throw 'Textbox text was shadowed or normalized' }
    if(-not [object]::ReferenceEquals($created,$shape)) { throw 'Add-ControlTextBox did not return the fake collection shape' }
    if($script:selfTestStages.Count -eq 0 -or $script:selfTestStages[0].stage -cne 'selftest.textbox.addTextbox') { throw 'The actual COM wrapper did not receive the expected stage name' }

    $request=[ordered]@{
        literals=[ordered]@{tabText=$expectedText;beforeText='Before'}
        font=[ordered]@{name='Calibri';size=24.0}
    }
    function New-PureMetricRecord([string]$Representation,[int]$Index) {
        $value=[ordered]@{
            index=$Index;targetPoints=16.25;tabStopPoints=16.25
            tabShapeName="tab-$Index";literalShapeName="literal-$Index"
            actualTabText=$expectedText;literalText='Before';tabStopCount=1
            tabShapeLeft=200.0;tabShapeTop=10.0;literalShapeLeft=300.0;literalShapeTop=10.0
            leadingTabBoundLeft=100.0;leadingTabBoundTop=20.0;leadingTabBoundWidth=0.0;leadingTabBoundHeight=24.0
            tabTextBoundLeft=116.25;tabTextBoundTop=20.0;tabTextBoundWidth=60.0;tabTextBoundHeight=24.0
            literalTextBoundLeft=216.25;literalTextBoundTop=20.0;literalTextBoundWidth=60.0;literalTextBoundHeight=24.0
            leadingTabFontName='Calibri';leadingTabFontSize=24.0
            tabTextFontName='Calibri';tabTextFontSize=24.0
            literalTextFontName='Calibri';literalTextFontSize=24.0
        }
        if($Representation -ceq 'PSCustomObject') { return [pscustomobject]$value }
        return ,$value
    }
    function New-PureMetricObservation([string]$Representation,[string]$Phase) {
        $records=@()
        for($index=0;$index -lt 9;$index++) { $records+=@(New-PureMetricRecord $Representation $index) }
        $value=[ordered]@{phase=$Phase;slideCount=1;shapeCount=18;records=$records}
        if($Representation -ceq 'PSCustomObject') { return [pscustomobject]$value }
        return ,$value
    }
    function Set-PureMetricValue($Record,[string]$Name,$Value) {
        if($Record -is [System.Collections.IDictionary]) { $Record[$Name]=$Value }
        else { $Record.$Name=$Value }
    }

    $metricsRegression=@()
    foreach($representation in @('PSCustomObject','OrderedDictionary')) {
        $exactOriginal=New-PureMetricObservation $representation 'original'
        $exactReopened=New-PureMetricObservation $representation 'reopened'
        $expectedRecordType=$(if($representation -ceq 'PSCustomObject'){'System.Management.Automation.PSCustomObject'}else{'System.Collections.Specialized.OrderedDictionary'})
        if($exactOriginal.records[0].GetType().FullName -cne $expectedRecordType) { throw "$representation record representation changed" }

        $exactPhase=Get-PhaseMetrics $exactOriginal 0.02
        if(-not $exactPhase.tabGatePassed -or -not $exactPhase.literalGatePassed -or -not $exactPhase.pairAgreementGatePassed -or $exactPhase.maximumTabErrorPoints -ne 0 -or $exactPhase.maximumLiteralErrorPoints -ne 0 -or $exactPhase.maximumPairDeltaPoints -ne 0) { throw "$representation exact target offsets did not pass the .02 point phase gates" }
        if($exactPhase.records[0].actualTabOffsetPoints -ne 16.25 -or $exactPhase.records[0].actualLiteralOffsetPoints -ne 16.25) { throw "$representation exact target offsets changed" }

        $phaseFailure=New-PureMetricObservation $representation 'phase-failure'
        Set-PureMetricValue $phaseFailure.records[0] 'tabTextBoundLeft' 116.28
        $failedPhase=Get-PhaseMetrics $phaseFailure 0.02
        if($failedPhase.tabGatePassed -or -not $failedPhase.literalGatePassed -or $failedPhase.pairAgreementGatePassed -or [Math]::Abs($failedPhase.maximumTabErrorPoints-0.03) -gt 0.000001 -or [Math]::Abs($failedPhase.maximumPairDeltaPoints-0.03) -gt 0.000001) { throw "$representation did not reject the hand-specified .03 point phase error" }

        $persistencePassObservation=New-PureMetricObservation $representation 'reopened-pass'
        Set-PureMetricValue $persistencePassObservation.records[0] 'tabShapeLeft' 200.01
        $persistencePass=Get-PersistenceMetrics $exactOriginal $persistencePassObservation 0.02
        if(-not $persistencePass.gatePassed -or [Math]::Abs($persistencePass.maximumDeltaPoints-0.01) -gt 0.000001) { throw "$representation did not accept the hand-specified .01 point persistence drift" }

        $persistenceFailObservation=New-PureMetricObservation $representation 'reopened-fail'
        Set-PureMetricValue $persistenceFailObservation.records[0] 'tabShapeLeft' 200.03
        $persistenceFail=Get-PersistenceMetrics $exactOriginal $persistenceFailObservation 0.02
        if($persistenceFail.gatePassed -or [Math]::Abs($persistenceFail.maximumDeltaPoints-0.03) -gt 0.000001) { throw "$representation did not reject the hand-specified .03 point persistence drift" }

        $contentPass=Get-ContentChecks $exactOriginal $exactReopened
        if(-not $contentPass.passed -or $contentPass.failures.Count -ne 0) { throw "$representation valid content failed" }
        $textFailureObservation=New-PureMetricObservation $representation 'reopened-text-failure'
        Set-PureMetricValue $textFailureObservation.records[0] 'actualTabText' 'Changed'
        $contentFail=Get-ContentChecks $exactOriginal $textFailureObservation
        if($contentFail.passed -or @($contentFail.failures | Where-Object { $_ -like '*pair 0: literal text changed' }).Count -ne 1) { throw "$representation did not reject changed current text" }

        $metricsRegression+=@([ordered]@{
            representation=$representation;recordType=$expectedRecordType
            exactTargetGatePassed=$true;phaseError03Rejected=$true
            persistenceDrift01Accepted=$true;persistenceDrift03Rejected=$true
            validContentAccepted=$true;changedTextRejected=$true
        })
    }
    [ordered]@{
        passed=$true
        officeOrComCalls=0
        requestedName=$expectedName
        observedName=$shape.Name
        requestedTextCodePoints=@($expectedText.ToCharArray() | ForEach-Object { [int][char]$_ })
        observedTextCodePoints=@($range.Text.ToCharArray() | ForEach-Object { [int][char]$_ })
        wrapperStages=$script:selfTestStages.Count
        metricsTolerancePoints=0.02
        metricsRegression=$metricsRegression
    } | ConvertTo-Json -Depth 5
}

function ConvertTo-NativeOrderedValue($Value) {
    if($null -eq $Value -or $Value -is [string] -or $Value.GetType().IsValueType) { return $Value }
    if($Value -is [System.Collections.IDictionary]) {
        $dictionary=[ordered]@{}
        foreach($key in $Value.Keys) { $dictionary[[string]$key]=ConvertTo-NativeOrderedValue $Value[$key] }
        return ,$dictionary
    }
    if($Value -is [System.Collections.IEnumerable]) {
        $items=@()
        foreach($item in $Value) { $items+=@(ConvertTo-NativeOrderedValue $item) }
        return ,$items
    }
    $dictionary=[ordered]@{}
    foreach($property in $Value.PSObject.Properties) { $dictionary[$property.Name]=ConvertTo-NativeOrderedValue $property.Value }
    return ,$dictionary
}

function Invoke-TabMetricsReplayRegression([string]$ReportPath,[string]$OutputPath) {
    $sourcePath=(Resolve-Path -LiteralPath $ReportPath).Path
    $sourceHashBefore=Get-ControlSha256 $sourcePath
    $tokens=$null
    $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    $functionDefinitions=@($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] },$true))
    foreach($functionName in @('Get-PhaseMetrics','Get-PersistenceMetrics','Get-ContentChecks')) {
        $definition=@($functionDefinitions | Where-Object { $_.Name -ceq $functionName })
        if($definition.Count -ne 1) { throw "Expected exactly one $functionName definition, found $($definition.Count)" }
        Invoke-Expression $definition[0].Extent.Text
    }

    $sourceReport=Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($null -eq $sourceReport.original.observation -or $null -eq $sourceReport.reopened.observation) { throw 'Replay report must contain both native observations' }
    if($sourceReport.original.observation.records.Count -ne 9 -or $sourceReport.reopened.observation.records.Count -ne 9) { throw 'Replay report must contain exactly nine records in both observations' }
    $request=$sourceReport.requested
    $tolerance=[double]$request.tolerancePoints

    $exactOriginal=Get-PhaseMetrics $sourceReport.original.observation $tolerance
    $exactReopened=Get-PhaseMetrics $sourceReport.reopened.observation $tolerance
    $exactPersistence=Get-PersistenceMetrics $sourceReport.original.observation $sourceReport.reopened.observation $tolerance
    $exactContent=Get-ContentChecks $sourceReport.original.observation $sourceReport.reopened.observation
    $exactMetrics=[ordered]@{
        tolerancePoints=$tolerance
        original=$exactOriginal
        reopened=$exactReopened
        persistence=$exactPersistence
        content=$exactContent
        rasterStable=($sourceReport.original.raster.sha256 -ceq $sourceReport.reopened.raster.sha256)
        sourceStable=($sourceReport.source.sha256 -ceq $sourceReport.source.reopenedSha256)
    }

    $orderedOriginal=ConvertTo-NativeOrderedValue $sourceReport.original.observation
    $orderedReopened=ConvertTo-NativeOrderedValue $sourceReport.reopened.observation
    if($orderedOriginal.GetType().FullName -cne 'System.Collections.Specialized.OrderedDictionary' -or $orderedOriginal['records'][0].GetType().FullName -cne 'System.Collections.Specialized.OrderedDictionary') { throw 'Native-style replay records are not OrderedDictionary instances' }
    $orderedMetrics=[ordered]@{
        tolerancePoints=$tolerance
        original=(Get-PhaseMetrics $orderedOriginal $tolerance)
        reopened=(Get-PhaseMetrics $orderedReopened $tolerance)
        persistence=(Get-PersistenceMetrics $orderedOriginal $orderedReopened $tolerance)
        content=(Get-ContentChecks $orderedOriginal $orderedReopened)
        rasterStable=($sourceReport.original.raster.sha256 -ceq $sourceReport.reopened.raster.sha256)
        sourceStable=($sourceReport.source.sha256 -ceq $sourceReport.source.reopenedSha256)
    }
    $exactJson=$exactMetrics | ConvertTo-Json -Depth 30 -Compress
    $orderedJson=$orderedMetrics | ConvertTo-Json -Depth 30 -Compress
    if($exactJson -cne $orderedJson) { throw 'Exact report replay and native-style OrderedDictionary replay produced different metrics' }

    if([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath=Join-Path (Split-Path -Parent $sourcePath) 'metrics.recovered.json' }
    $outputFullPath=[IO.Path]::GetFullPath($OutputPath)
    if($outputFullPath -ieq $sourcePath) { throw 'Recovered metrics must not overwrite the source report' }
    if(Test-Path -LiteralPath $outputFullPath) { throw 'Recovered metrics path already exists; preserve it and select a new path' }
    $snapshotPath=[string]$sourceReport.inputs.verifier.snapshotPath
    $recovery=[ordered]@{
        schemaVersion=1
        kind='native-tab-control-v2-offline-metrics-recovery'
        sourceReport=[ordered]@{path=$sourcePath;sha256=$sourceHashBefore;metricsWasNull=($null -eq $sourceReport.metrics);error=$sourceReport.error}
        nativeLifecycle=[ordered]@{cleanupConfirmed=[bool]$sourceReport.cleanupConfirmed;officeOperationsStopped=[bool]$sourceReport.officeOperationsStopped;lastStage=$sourceReport.lastStage;lastStatus=$sourceReport.lastStatus}
        evidence=[ordered]@{
            presentation=[ordered]@{path=$sourceReport.source.path;sha256=(Get-ControlSha256 $sourceReport.source.path);matchesReport=((Get-ControlSha256 $sourceReport.source.path) -ceq $sourceReport.source.sha256)}
            originalRaster=[ordered]@{path=$sourceReport.original.raster.path;sha256=(Get-ControlSha256 $sourceReport.original.raster.path);matchesReport=((Get-ControlSha256 $sourceReport.original.raster.path) -ceq $sourceReport.original.raster.sha256)}
            reopenedRaster=[ordered]@{path=$sourceReport.reopened.raster.path;sha256=(Get-ControlSha256 $sourceReport.reopened.raster.path);matchesReport=((Get-ControlSha256 $sourceReport.reopened.raster.path) -ceq $sourceReport.reopened.raster.sha256)}
            verifierSnapshot=[ordered]@{path=$snapshotPath;sha256=(Get-ControlSha256 $snapshotPath);matchesReport=((Get-ControlSha256 $snapshotPath) -ceq $sourceReport.inputs.verifier.snapshotSha256)}
        }
        regression=[ordered]@{
            officeOrComCalls=0
            exactReportObservationType=$sourceReport.original.observation.GetType().FullName
            nativeStyleObservationType=$orderedOriginal.GetType().FullName
            nativeStyleRecordType=$orderedOriginal['records'][0].GetType().FullName
            exactAndNativeStyleMetricsIdentical=$true
        }
        metrics=$exactMetrics
        limitations='Recovered offline from already-recorded native observations after both owned presentations closed. This does not alter or relabel the failed worker report and makes no additional Office observation.'
    }
    foreach($item in $recovery.evidence.Values) { if(-not $item.matchesReport) { throw "Evidence hash no longer matches the failed report: $($item.path)" } }
    if(-not $recovery.nativeLifecycle.cleanupConfirmed -or $recovery.nativeLifecycle.officeOperationsStopped) { throw 'Replay report does not record a clean native lifecycle' }
    if((Get-ControlSha256 $sourcePath) -cne $sourceHashBefore) { throw 'Source report changed during offline replay' }
    $recovery | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $outputFullPath -Encoding UTF8
    [void](Get-Content -LiteralPath $outputFullPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if((Get-ControlSha256 $sourcePath) -cne $sourceHashBefore) { throw 'Source report changed while writing recovered metrics' }
    [ordered]@{passed=$true;officeOrComCalls=0;sourceReportSha256=$sourceHashBefore;outputPath=$outputFullPath;outputSha256=(Get-ControlSha256 $outputFullPath);metrics=$exactMetrics} | ConvertTo-Json -Depth 30
}

if($PureRegression) {
    Invoke-TabHelperPureRegression
    return
}
if(-not [string]::IsNullOrWhiteSpace($ReplayMetricsReport)) {
    Invoke-TabMetricsReplayRegression $ReplayMetricsReport $RecoveredMetricsPath
    return
}
if(-not [string]::IsNullOrWhiteSpace($RecoveredMetricsPath)) { throw 'RecoveredMetricsPath requires ReplayMetricsReport' }
if([string]::IsNullOrWhiteSpace($OutputDirectory)) { throw 'OutputDirectory is required unless a pure regression or metrics replay is selected' }

if(-not $Worker) {
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    $helperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $fontOriginal=(Resolve-Path -LiteralPath (Join-Path $env:WINDIR 'Fonts/calibri.ttf')).Path
    $hostExecutable=(Get-Process -Id $PID).Path
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'
    [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-tab-control-v2.ps1'
    $helperSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $helperOriginal -Destination $helperSnapshot
    $request=[ordered]@{
        targets=@(16.25,16.26,16.27,16.27734375,16.28,16.29,16.30,16.31,77.3173828125)
        literals=[ordered]@{tabText=([string][char]9+'Before');leadingCodePoint=9;beforeText='Before'}
        font=[ordered]@{name='Calibri';size=13.5;path=$fontOriginal;sha256=(Get-ControlSha256 $fontOriginal)}
        tolerancePoints=0.02
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-ControlSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-ControlSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$helperOriginal;sha256=(Get-ControlSha256 $helperOriginal);snapshotPath=$helperSnapshot;snapshotSha256=(Get-ControlSha256 $helperSnapshot)}
        host=[ordered]@{path=$hostExecutable;sha256=(Get-ControlSha256 $hostExecutable)}
    }
    $request | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-OutputDirectory',$outputRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) {
        try { $lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $lastDurable=$null }
    }
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))) {
        foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)) {
            try { $lastDurable=$line | ConvertFrom-Json } catch { }
        }
    }
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        timedOut=$result.timedOut
        exitCode=$result.exitCode
        cleanupConfirmed=$(if($result.timedOut){$false}elseif($null -ne $lastDurable){[bool]$lastDurable.cleanupConfirmed}else{$false})
        lastDurableStage=$(if($null -ne $lastDurable){$lastDurable.stage}else{$null})
        lastDurableStatus=$(if($null -ne $lastDurable){$lastDurable.status}else{$null})
    }
    $terminal | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if($result.timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) {
        try {
            Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json')
            $timedOutReport=Get-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $timedOutReport.cleanupConfirmed=$false
            $timedOutReport.officeOperationsStopped=$true
            $timedOutReport.lastStage=$terminal.lastDurableStage
            $timedOutReport.lastStatus=$terminal.lastDurableStatus
            $timedOutReport.error='Owned native worker timed out; Office cleanup is unconfirmed and no retry was started.'
            $timedOutReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
        } catch { }
    }
    Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ }
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native tab control v2 failed or timed out; preserve the entire attempt and inspect Office. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$stageFile=Join-Path $root 'stages.jsonl'
$progressFile=Join-Path $root 'progress.json'
$reportFile=Join-Path $root 'report.json'
$savedPath=Join-Path $root 'native-tab-control-v2.pptx'
$originalPng=Join-Path $root 'original.png'
$reopenedPng=Join-Path $root 'reopened.png'
foreach($reserved in @($stageFile,$progressFile,$reportFile,$savedPath,$originalPng,$reopenedPng)) {
    if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
}

$script:sequence=0
$script:lastStage='worker.initialize'
$script:lastStatus='begin'
$script:cleanupConfirmed=$true
$script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null
$script:presentation=$null
$requestFile=(Resolve-Path -LiteralPath (Join-Path $root 'request.json')).Path
$request=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$targets=@($request.targets)
if($targets.Count -ne 9) { throw 'Snapshot request must contain exactly nine tab targets' }
$helperPath=(Resolve-Path -LiteralPath $request.processHelper.path).Path
$fontPath=(Resolve-Path -LiteralPath $request.font.path).Path
$hostExecutable=(Get-Process -Id $PID).Path
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
if((Get-ControlSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-ControlSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
if((Get-ControlSha256 $helperPath) -cne $request.processHelper.sha256 -or (Get-ControlSha256 $request.processHelper.snapshotPath) -cne $request.processHelper.sha256) { throw 'Process-helper snapshot does not match the recorded helper' }
if($hostExecutable -ine $request.host.path -or (Get-ControlSha256 $hostExecutable) -cne $request.host.sha256) { throw 'Worker host does not match the recorded parent host' }
if((Get-ControlSha256 $fontPath) -cne $request.font.sha256) { throw 'Calibri font file changed before the native control started' }

$report=[ordered]@{
    schemaVersion=2
    source=[ordered]@{path=$savedPath;sha256=$null;reopenedSha256=$null}
    requested=[ordered]@{
        targets=$targets
        literals=$request.literals
        font=[ordered]@{name=$request.font.name;size=$request.font.size}
        tolerancePoints=$request.tolerancePoints
        slide=[ordered]@{width=960;height=540;layout=12}
    }
    original=[ordered]@{observation=$null;raster=[ordered]@{path=$originalPng;sha256=$null}}
    reopened=[ordered]@{observation=$null;raster=[ordered]@{path=$reopenedPng;sha256=$null}}
    metrics=$null
    inputs=[ordered]@{
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-ControlSha256 $PSCommandPath);snapshotPath=$request.verifier.snapshotPath;snapshotSha256=(Get-ControlSha256 $request.verifier.snapshotPath);unchanged=$null;snapshotUnchanged=$null}
        processHelper=[ordered]@{path=$helperPath;sha256=(Get-ControlSha256 $helperPath);snapshotPath=$request.processHelper.snapshotPath;snapshotSha256=(Get-ControlSha256 $request.processHelper.snapshotPath);unchanged=$null;snapshotUnchanged=$null}
    }
    environment=[ordered]@{
        hostVersion=$PSVersionTable.PSVersion.ToString()
        hostExecutable=$hostExecutable
        hostExecutableSha256=(Get-ControlSha256 $hostExecutable)
        windowsProductName=$os.ProductName
        windowsDisplayVersion=$os.DisplayVersion
        windowsBuild="$($os.CurrentBuild).$($os.UBR)"
        calibriPath=$fontPath
        calibriSha256=(Get-ControlSha256 $fontPath)
        calibriUnchanged=$null
        powerPointVersion=$null
        powerPointExecutable=$null
        powerPointBuild=$null
        powerPointExecutableSha256=$null
    }
    cleanupConfirmed=$script:cleanupConfirmed
    officeOperationsStopped=$script:officeOperationsStopped
    lastStage=$script:lastStage
    lastStatus=$script:lastStatus
    error=$null
    scope='One native-created 960 x 540 PowerPoint slide with nine tab/literal pairs. The control records native TextRange2 bounds and PNGs only; it creates no PDF or embedded-font output, never quits or kills Office, changes fonts or security, retries, or closes unrelated presentations.'
}

function Write-ControlReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed
    $report.officeOperationsStopped=$script:officeOperationsStopped
    $report.lastStage=$script:lastStage
    $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}

function Write-ControlStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++
    $script:lastStage=$Name
    $script:lastStatus=$Status
    $record=[ordered]@{
        sequence=$script:sequence
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        stage=$Name
        status=$Status
        error=$ErrorMessage
        cleanupConfirmed=$script:cleanupConfirmed
        officeOperationsStopped=$script:officeOperationsStopped
        ownedPresentationPath=$script:ownedPresentationPath
    }
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $progressFile -Encoding UTF8
}

function Invoke-ControlCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-ControlStage $StageName 'begin'
    try {
        $value=& $Operation
        Write-ControlStage $StageName 'success'
        return ,$value
    } catch {
        $script:officeOperationsStopped=$true
        $script:cleanupConfirmed=$false
        Write-ControlStage $StageName 'error' $_.Exception.Message
        throw
    }
}

function Assert-PresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-ControlCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-ControlCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1;$index -le $count;$index++) {
        $candidate=Invoke-ControlCom "$Prefix.presentations.item-$index.get" { return ,$presentations.Item($index) }
        $candidatePath=Invoke-ControlCom "$Prefix.presentations.item-$index.fullName.get" { $candidate.FullName }
        if($candidatePath -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}

function Add-ControlTextBox($Shapes,[string]$RequestedShapeName,[string]$RequestedText,[double]$Left,[double]$Top,[string]$Prefix) {
    $shape=Invoke-ControlCom "$Prefix.addTextbox" { return ,$Shapes.AddTextbox(1,$Left,$Top,500,20) }
    Invoke-ControlCom "$Prefix.name.set" { $shape.Name=$RequestedShapeName }
    $frame=Invoke-ControlCom "$Prefix.textFrame.get" { return ,$shape.TextFrame }
    Invoke-ControlCom "$Prefix.marginLeft.set" { $frame.MarginLeft=0 }
    Invoke-ControlCom "$Prefix.marginRight.set" { $frame.MarginRight=0 }
    Invoke-ControlCom "$Prefix.marginTop.set" { $frame.MarginTop=0 }
    Invoke-ControlCom "$Prefix.marginBottom.set" { $frame.MarginBottom=0 }
    Invoke-ControlCom "$Prefix.wordWrap.set" { $frame.WordWrap=0 }
    Invoke-ControlCom "$Prefix.autoSize.set" { $frame.AutoSize=0 }
    $range=Invoke-ControlCom "$Prefix.textRange.get" { return ,$frame.TextRange }
    Invoke-ControlCom "$Prefix.text.set" { $range.Text=$RequestedText }
    $font=Invoke-ControlCom "$Prefix.font.get" { return ,$range.Font }
    Invoke-ControlCom "$Prefix.font.name.set" { $font.Name='Calibri' }
    Invoke-ControlCom "$Prefix.font.size.set" { $font.Size=13.5 }
    Invoke-ControlCom "$Prefix.font.bold.set" { $font.Bold=0 }
    Invoke-ControlCom "$Prefix.font.italic.set" { $font.Italic=0 }
    $color=Invoke-ControlCom "$Prefix.font.color.get" { return ,$font.Color }
    Invoke-ControlCom "$Prefix.font.color.rgb.set" { $color.RGB=16777215 }
    $paragraph=Invoke-ControlCom "$Prefix.paragraphFormat.get" { return ,$range.ParagraphFormat }
    Invoke-ControlCom "$Prefix.paragraph.alignment.set" { $paragraph.Alignment=1 }
    $bullet=Invoke-ControlCom "$Prefix.paragraph.bullet.get" { return ,$paragraph.Bullet }
    Invoke-ControlCom "$Prefix.paragraph.bullet.visible.set" { $bullet.Visible=0 }
    $ruler=Invoke-ControlCom "$Prefix.ruler.get" { return ,$frame.Ruler }
    $levels=Invoke-ControlCom "$Prefix.ruler.levels.get" { return ,$ruler.Levels }
    $level=Invoke-ControlCom "$Prefix.ruler.level-1.get" { return ,$levels.Item(1) }
    Invoke-ControlCom "$Prefix.ruler.level-1.firstMargin.set" { $level.FirstMargin=0 }
    Invoke-ControlCom "$Prefix.ruler.level-1.leftMargin.set" { $level.LeftMargin=0 }
    return ,$shape
}

function Read-RangeBounds($Range,[string]$Prefix) {
    $left=Invoke-ControlCom "$Prefix.boundLeft.get" { $Range.BoundLeft }
    $top=Invoke-ControlCom "$Prefix.boundTop.get" { $Range.BoundTop }
    $width=Invoke-ControlCom "$Prefix.boundWidth.get" { $Range.BoundWidth }
    $height=Invoke-ControlCom "$Prefix.boundHeight.get" { $Range.BoundHeight }
    return [ordered]@{left=$left;top=$top;width=$width;height=$height}
}

function Read-RangeFont($Range,[string]$Prefix) {
    $font=Invoke-ControlCom "$Prefix.font.get" { return ,$Range.Font }
    $name=Invoke-ControlCom "$Prefix.font.name.get" { $font.Name }
    $size=Invoke-ControlCom "$Prefix.font.size.get" { $font.Size }
    return [ordered]@{name=$name;size=$size}
}

function Read-ControlObservation($Presentation,[string]$Phase) {
    $slides=Invoke-ControlCom "$Phase.slides.get" { return ,$Presentation.Slides }
    $slideCount=Invoke-ControlCom "$Phase.slides.count.get" { $slides.Count }
    $slide=Invoke-ControlCom "$Phase.slide-1.get" { return ,$slides.Item(1) }
    $shapes=Invoke-ControlCom "$Phase.slide-1.shapes.get" { return ,$slide.Shapes }
    $shapeCount=Invoke-ControlCom "$Phase.slide-1.shapes.count.get" { $shapes.Count }
    $records=@()
    for($index=0;$index -lt $targets.Count;$index++) {
        $prefix="$Phase.pair-$index"
        $tab=Invoke-ControlCom "$prefix.tab.get" { return ,$shapes.Item("tab-$index") }
        $literal=Invoke-ControlCom "$prefix.literal.get" { return ,$shapes.Item("literal-$index") }
        $tabName=Invoke-ControlCom "$prefix.tab.name.get" { $tab.Name }
        $literalName=Invoke-ControlCom "$prefix.literal.name.get" { $literal.Name }
        $tabLeft=Invoke-ControlCom "$prefix.tab.left.get" { $tab.Left }
        $tabTop=Invoke-ControlCom "$prefix.tab.top.get" { $tab.Top }
        $literalLeft=Invoke-ControlCom "$prefix.literal.left.get" { $literal.Left }
        $literalTop=Invoke-ControlCom "$prefix.literal.top.get" { $literal.Top }
        $tabFrame2=Invoke-ControlCom "$prefix.tab.textFrame2.get" { return ,$tab.TextFrame2 }
        $tabRange=Invoke-ControlCom "$prefix.tab.textRange2.get" { return ,$tabFrame2.TextRange }
        $leadingTab=Invoke-ControlCom "$prefix.tab.leading.characters.get" { return ,$tabRange.Characters(1,1) }
        $tabBefore=Invoke-ControlCom "$prefix.tab.before.characters.get" { return ,$tabRange.Characters(2,6) }
        $literalFrame2=Invoke-ControlCom "$prefix.literal.textFrame2.get" { return ,$literal.TextFrame2 }
        $literalFullRange=Invoke-ControlCom "$prefix.literal.textRange2.get" { return ,$literalFrame2.TextRange }
        $literalBefore=Invoke-ControlCom "$prefix.literal.before.characters.get" { return ,$literalFullRange.Characters(1,6) }
        $actualTabText=Invoke-ControlCom "$prefix.tab.text.get" { $tabRange.Text }
        $literalText=Invoke-ControlCom "$prefix.literal.text.get" { $literalFullRange.Text }
        $leadingBounds=Read-RangeBounds $leadingTab "$prefix.tab.leading"
        $tabBounds=Read-RangeBounds $tabBefore "$prefix.tab.before"
        $literalBounds=Read-RangeBounds $literalBefore "$prefix.literal.before"
        $leadingFont=Read-RangeFont $leadingTab "$prefix.tab.leading"
        $tabFont=Read-RangeFont $tabBefore "$prefix.tab.before"
        $literalFont=Read-RangeFont $literalBefore "$prefix.literal.before"
        $tabFrame=Invoke-ControlCom "$prefix.tab.textFrame.get" { return ,$tab.TextFrame }
        $ruler=Invoke-ControlCom "$prefix.tab.ruler.get" { return ,$tabFrame.Ruler }
        $tabStops=Invoke-ControlCom "$prefix.tab.tabStops.get" { return ,$ruler.TabStops }
        $tabStopCount=Invoke-ControlCom "$prefix.tab.tabStops.count.get" { $tabStops.Count }
        $tabStop=Invoke-ControlCom "$prefix.tab.tabStops.item-1.get" { return ,$tabStops.Item(1) }
        $tabStopPosition=Invoke-ControlCom "$prefix.tab.tabStop-1.position.get" { $tabStop.Position }
        $records+=@([ordered]@{
            index=$index
            targetPoints=$targets[$index]
            tabStopCount=$tabStopCount
            tabStopPoints=$tabStopPosition
            tabShapeName=$tabName
            literalShapeName=$literalName
            tabShapeLeft=$tabLeft
            tabShapeTop=$tabTop
            literalShapeLeft=$literalLeft
            literalShapeTop=$literalTop
            actualTabText=$actualTabText
            literalText=$literalText
            leadingTabBoundLeft=$leadingBounds.left
            leadingTabBoundTop=$leadingBounds.top
            leadingTabBoundWidth=$leadingBounds.width
            leadingTabBoundHeight=$leadingBounds.height
            tabTextBoundLeft=$tabBounds.left
            tabTextBoundTop=$tabBounds.top
            tabTextBoundWidth=$tabBounds.width
            tabTextBoundHeight=$tabBounds.height
            literalTextBoundLeft=$literalBounds.left
            literalTextBoundTop=$literalBounds.top
            literalTextBoundWidth=$literalBounds.width
            literalTextBoundHeight=$literalBounds.height
            leadingTabFontName=$leadingFont.name
            leadingTabFontSize=$leadingFont.size
            tabTextFontName=$tabFont.name
            tabTextFontSize=$tabFont.size
            literalTextFontName=$literalFont.name
            literalTextFontSize=$literalFont.size
        })
    }
    $pageSetup=Invoke-ControlCom "$Phase.pageSetup.get" { return ,$Presentation.PageSetup }
    $slideWidth=Invoke-ControlCom "$Phase.slideWidth.get" { $pageSetup.SlideWidth }
    $slideHeight=Invoke-ControlCom "$Phase.slideHeight.get" { $pageSetup.SlideHeight }
    return [ordered]@{phase=$Phase;slideCount=$slideCount;shapeCount=$shapeCount;slideWidth=$slideWidth;slideHeight=$slideHeight;records=$records}
}

function Close-OwnedPresentation([string]$Phase,[string]$ExpectedPath) {
    $actualPath=Invoke-ControlCom "$Phase.fullName.get" { $script:presentation.FullName }
    if($actualPath -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact saved path is not owned: $actualPath" }
    Invoke-ControlCom "$Phase.close" { $script:presentation.Close() }
    $script:presentation=$null
    $script:ownedPresentationPath=$null
    $script:cleanupConfirmed=$true
    Write-ControlStage "$Phase.cleanup" 'success'
}

function Get-PhaseMetrics($Observation,[double]$Tolerance) {
    $records=@()
    $maximumTabError=0.0
    $maximumLiteralError=0.0
    $maximumPairDelta=0.0
    $tabGatePassed=$true
    $literalGatePassed=$true
    $pairAgreementGatePassed=$true
    foreach($record in $Observation.records) {
        $tabOffset=[double]$record.tabTextBoundLeft-[double]$record.leadingTabBoundLeft
        $literalOffset=[double]$record.literalTextBoundLeft-[double]$record.tabShapeLeft
        $tabError=[Math]::Abs($tabOffset-[double]$record.targetPoints)
        $literalError=[Math]::Abs($literalOffset-[double]$record.targetPoints)
        $pairDelta=[Math]::Abs($tabOffset-$literalOffset)
        if($tabError -gt $maximumTabError) { $maximumTabError=$tabError }
        if($literalError -gt $maximumLiteralError) { $maximumLiteralError=$literalError }
        if($pairDelta -gt $maximumPairDelta) { $maximumPairDelta=$pairDelta }
        if($tabError -gt $Tolerance) { $tabGatePassed=$false }
        if($literalError -gt $Tolerance) { $literalGatePassed=$false }
        if($pairDelta -gt $Tolerance) { $pairAgreementGatePassed=$false }
        $records+=@([ordered]@{
            index=$record.index
            targetPoints=$record.targetPoints
            actualTabOffsetPoints=$tabOffset
            actualLiteralOffsetPoints=$literalOffset
            tabErrorPoints=$tabError
            literalErrorPoints=$literalError
            tabMinusLiteralPoints=$tabOffset-$literalOffset
            tabGatePassed=($tabError -le $Tolerance)
            literalGatePassed=($literalError -le $Tolerance)
            pairAgreementGatePassed=($pairDelta -le $Tolerance)
        })
    }
    return [ordered]@{
        phase=$Observation.phase
        tolerancePoints=$Tolerance
        tabGatePassed=$tabGatePassed
        literalGatePassed=$literalGatePassed
        pairAgreementGatePassed=$pairAgreementGatePassed
        maximumTabErrorPoints=$maximumTabError
        maximumLiteralErrorPoints=$maximumLiteralError
        maximumPairDeltaPoints=$maximumPairDelta
        records=$records
    }
}

function Get-PersistenceMetrics($Original,$Reopened,[double]$Tolerance) {
    $properties=@('tabStopPoints','tabShapeLeft','tabShapeTop','literalShapeLeft','literalShapeTop','leadingTabBoundLeft','leadingTabBoundTop','leadingTabBoundWidth','leadingTabBoundHeight','tabTextBoundLeft','tabTextBoundTop','tabTextBoundWidth','tabTextBoundHeight','literalTextBoundLeft','literalTextBoundTop','literalTextBoundWidth','literalTextBoundHeight','leadingTabFontSize','tabTextFontSize','literalTextFontSize')
    $maximumDelta=0.0
    $records=@()
    for($index=0;$index -lt $Original.records.Count;$index++) {
        $deltas=[ordered]@{}
        $recordMaximumDelta=0.0
        foreach($property in $properties) {
            $delta=[Math]::Abs(([double]$Original.records[$index].$property)-([double]$Reopened.records[$index].$property))
            $deltas[$property]=$delta
            if($delta -gt $maximumDelta) { $maximumDelta=$delta }
            if($delta -gt $recordMaximumDelta) { $recordMaximumDelta=$delta }
        }
        $records+=@([ordered]@{index=$index;maximumDeltaPoints=$recordMaximumDelta;deltas=$deltas})
    }
    return [ordered]@{tolerancePoints=$Tolerance;gatePassed=($maximumDelta -le $Tolerance);maximumDeltaPoints=$maximumDelta;records=$records}
}

function Get-ContentChecks($Original,$Reopened) {
    $failures=@()
    foreach($observation in @($Original,$Reopened)) {
        if($observation.slideCount -ne 1) { $failures+="$($observation.phase): slideCount=$($observation.slideCount)" }
        if($observation.shapeCount -ne 18) { $failures+="$($observation.phase): shapeCount=$($observation.shapeCount)" }
        if($observation.records.Count -ne 9) { $failures+="$($observation.phase): recordCount=$($observation.records.Count)" }
        foreach($record in $observation.records) {
            if($record.tabShapeName -cne "tab-$($record.index)" -or $record.literalShapeName -cne "literal-$($record.index)") { $failures+="$($observation.phase) pair $($record.index): shape names changed" }
            if($record.actualTabText -cne $request.literals.tabText -or $record.literalText -cne $request.literals.beforeText) { $failures+="$($observation.phase) pair $($record.index): literal text changed" }
            if($record.tabStopCount -ne 1) { $failures+="$($observation.phase) pair $($record.index): tabStopCount=$($record.tabStopCount)" }
            foreach($fontName in @($record.leadingTabFontName,$record.tabTextFontName,$record.literalTextFontName)) { if($fontName -ine $request.font.name) { $failures+="$($observation.phase) pair $($record.index): font=$fontName" } }
            foreach($fontSize in @($record.leadingTabFontSize,$record.tabTextFontSize,$record.literalTextFontSize)) { if([Math]::Abs(([double]$fontSize)-([double]$request.font.size)) -gt 0.02) { $failures+="$($observation.phase) pair $($record.index): fontSize=$fontSize" } }
        }
    }
    return [ordered]@{passed=($failures.Count -eq 0);failures=$failures}
}

Write-ControlReport
Write-ControlStage 'worker.initialize' 'success'
try {
    $app=Invoke-ControlCom 'application.create' { return ,(New-Object -ComObject PowerPoint.Application) }
    $officeVersion=Invoke-ControlCom 'application.version.get' { $app.Version }
    $officeDirectory=Invoke-ControlCom 'application.path.get' { $app.Path }
    $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion
    $report.environment.powerPointExecutable=$officeExecutable
    $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion
    $report.environment.powerPointExecutableSha256=Get-ControlSha256 $officeExecutable
    Write-ControlReport

    Assert-PresentationNotOpen $app $savedPath 'create.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$savedPath
    Write-ControlReport
    $presentations=Invoke-ControlCom 'create.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-ControlCom 'create.presentation.add' { return ,$presentations.Add(-1) }
    $pageSetup=Invoke-ControlCom 'create.pageSetup.get' { return ,$script:presentation.PageSetup }
    Invoke-ControlCom 'create.slideWidth.set' { $pageSetup.SlideWidth=960 }
    Invoke-ControlCom 'create.slideHeight.set' { $pageSetup.SlideHeight=540 }
    $slides=Invoke-ControlCom 'create.slides.get' { return ,$script:presentation.Slides }
    $slide=Invoke-ControlCom 'create.blankSlide.add' { return ,$slides.Add(1,12) }
    Invoke-ControlCom 'create.blankSlide.followMasterBackground.set' { $slide.FollowMasterBackground=0 }
    $background=Invoke-ControlCom 'create.blankSlide.background.get' { return ,$slide.Background }
    $backgroundFill=Invoke-ControlCom 'create.blankSlide.background.fill.get' { return ,$background.Fill }
    Invoke-ControlCom 'create.blankSlide.background.fill.solid' { $backgroundFill.Solid() }
    $backgroundColor=Invoke-ControlCom 'create.blankSlide.background.fill.foreColor.get' { return ,$backgroundFill.ForeColor }
    Invoke-ControlCom 'create.blankSlide.background.fill.foreColor.rgb.set' { $backgroundColor.RGB=0 }
    $shapes=Invoke-ControlCom 'create.blankSlide.shapes.get' { return ,$slide.Shapes }

    for($index=0;$index -lt $targets.Count;$index++) {
        $target=[double]$targets[$index]
        $tab=Add-ControlTextBox $shapes "tab-$index" $request.literals.tabText 32.4 (20+52*$index) "create.pair-$index.tab"
        $tabFrame=Invoke-ControlCom "create.pair-$index.tab.textFrame-for-tabs.get" { return ,$tab.TextFrame }
        $tabRuler=Invoke-ControlCom "create.pair-$index.tab.ruler-for-tabs.get" { return ,$tabFrame.Ruler }
        $tabStops=Invoke-ControlCom "create.pair-$index.tab.tabStops.get" { return ,$tabRuler.TabStops }
        $tabStopCount=Invoke-ControlCom "create.pair-$index.tab.tabStops.count.get" { $tabStops.Count }
        for($tabIndex=$tabStopCount;$tabIndex -gt 0;$tabIndex--) {
            $existingTab=Invoke-ControlCom "create.pair-$index.tab.tabStop-$tabIndex.get" { return ,$tabStops.Item($tabIndex) }
            Invoke-ControlCom "create.pair-$index.tab.tabStop-$tabIndex.clear" { $existingTab.Clear() }
        }
        $createdTab=Invoke-ControlCom "create.pair-$index.tab.tabStop.add" { return ,$tabStops.Add(1,[single]$target) }
        $literalLeft=32.4+$target
        [void](Add-ControlTextBox $shapes "literal-$index" $request.literals.beforeText $literalLeft (41+52*$index) "create.pair-$index.literal")
    }

    Invoke-ControlCom 'create.presentation.saveAs' { $script:presentation.SaveAs($savedPath,24) }
    $originalObservation=Read-ControlObservation $script:presentation 'original'
    $report.original.observation=$originalObservation
    Write-ControlReport
    $originalSlides=Invoke-ControlCom 'original.export.slides.get' { return ,$script:presentation.Slides }
    $originalSlide=Invoke-ControlCom 'original.export.slide-1.get' { return ,$originalSlides.Item(1) }
    Invoke-ControlCom 'original.export.png' { $originalSlide.Export($originalPng,'PNG',1280,720) }
    $report.original.raster.sha256=Get-ControlSha256 $originalPng
    Write-ControlReport
    Close-OwnedPresentation 'original.presentation' $savedPath
    $report.source.sha256=Get-ControlSha256 $savedPath
    Write-ControlReport

    Assert-PresentationNotOpen $app $savedPath 'reopen.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$savedPath
    Write-ControlReport
    $presentations=Invoke-ControlCom 'reopen.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-ControlCom 'reopen.presentation.open-readonly' { return ,$presentations.Open($savedPath,-1,0,-1) }
    $reopenedFullName=Invoke-ControlCom 'reopen.presentation.fullName.get' { $script:presentation.FullName }
    if($reopenedFullName -ine $savedPath) { throw "Reopened presentation path does not match the exact saved path: $reopenedFullName" }
    $reopenedObservation=Read-ControlObservation $script:presentation 'reopened'
    $report.reopened.observation=$reopenedObservation
    Write-ControlReport
    $reopenedSlides=Invoke-ControlCom 'reopened.export.slides.get' { return ,$script:presentation.Slides }
    $reopenedSlide=Invoke-ControlCom 'reopened.export.slide-1.get' { return ,$reopenedSlides.Item(1) }
    Invoke-ControlCom 'reopened.export.png' { $reopenedSlide.Export($reopenedPng,'PNG',1280,720) }
    $report.reopened.raster.sha256=Get-ControlSha256 $reopenedPng
    Write-ControlReport
    Close-OwnedPresentation 'reopened.presentation' $savedPath

    $report.source.reopenedSha256=Get-ControlSha256 $savedPath
    $originalMetrics=Get-PhaseMetrics $originalObservation ([double]$request.tolerancePoints)
    $reopenedMetrics=Get-PhaseMetrics $reopenedObservation ([double]$request.tolerancePoints)
    $persistenceMetrics=Get-PersistenceMetrics $originalObservation $reopenedObservation ([double]$request.tolerancePoints)
    $contentChecks=Get-ContentChecks $originalObservation $reopenedObservation
    $report.metrics=[ordered]@{
        tolerancePoints=$request.tolerancePoints
        original=$originalMetrics
        reopened=$reopenedMetrics
        persistence=$persistenceMetrics
        content=$contentChecks
        rasterStable=($report.original.raster.sha256 -ceq $report.reopened.raster.sha256)
        sourceStable=($report.source.sha256 -ceq $report.source.reopenedSha256)
    }
    $report.inputs.verifier.unchanged=((Get-ControlSha256 $request.verifier.path) -ceq $request.verifier.sha256)
    $report.inputs.verifier.snapshotUnchanged=((Get-ControlSha256 $request.verifier.snapshotPath) -ceq $request.verifier.sha256)
    $report.inputs.processHelper.unchanged=((Get-ControlSha256 $request.processHelper.path) -ceq $request.processHelper.sha256)
    $report.inputs.processHelper.snapshotUnchanged=((Get-ControlSha256 $request.processHelper.snapshotPath) -ceq $request.processHelper.sha256)
    $report.environment.calibriUnchanged=((Get-ControlSha256 $fontPath) -ceq $request.font.sha256)
    if(-not $report.inputs.verifier.unchanged -or -not $report.inputs.verifier.snapshotUnchanged -or -not $report.inputs.processHelper.unchanged -or -not $report.inputs.processHelper.snapshotUnchanged -or -not $report.environment.calibriUnchanged) { throw 'A verifier, helper, snapshot, or Calibri input changed during the native control run' }
    Write-ControlStage 'worker.complete' 'success'
    Write-ControlReport
    Write-Output 'Native tab control v2 completed; metric gates are recorded in report.json.'
} catch {
    $report.error=$_.Exception.Message
    if($script:officeOperationsStopped) { $script:cleanupConfirmed=$false }
    Write-ControlStage 'worker.failure' 'error' $_.Exception.Message
    Write-ControlReport
    throw
}
