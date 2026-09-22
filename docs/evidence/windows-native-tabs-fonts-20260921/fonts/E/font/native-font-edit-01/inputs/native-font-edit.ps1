param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$FontFixtureDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

function Get-FontEditSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Read-FontEditRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }
function New-FontEditInputCheck([string]$Path,[string]$Expected) {
    try { $actual=Get-FontEditSha256 $Path; return ,([ordered]@{path=$Path;expected=$Expected;actual=$actual;matched=($actual -ceq $Expected);error=$null}) }
    catch { return ,([ordered]@{path=$Path;expected=$Expected;actual=$null;matched=$false;error=$_.Exception.Message}) }
}
function Get-FontEditParentDecision($Result,$LastDurable,$WorkerReport) {
    $timedOut=($null -ne $Result -and [bool]$Result.timedOut)
    $officeLifecycleComplete=($null -ne $Result -and -not $timedOut -and [int]$Result.exitCode -eq 0 -and $null -ne $LastDurable -and $LastDurable.stage -ceq 'worker.complete' -and $LastDurable.status -ceq 'success' -and [bool]$LastDurable.cleanupConfirmed)
    $metricsGatePassed=($officeLifecycleComplete -and $null -ne $WorkerReport -and $null -ne $WorkerReport.metrics -and [bool]$WorkerReport.metrics.gatePassed)
    return ,([ordered]@{timedOut=$timedOut;officeLifecycleComplete=$officeLifecycleComplete;metricsGatePassed=$metricsGatePassed;officeCleanupConfirmed=($officeLifecycleComplete -and [bool]$LastDurable.cleanupConfirmed)})
}
function Assert-FontEditParentSuccess($Decision,$Result,$ParentFailure,[bool]$FontCleanupConfirmed,[bool]$InputsUnchanged) {
    if(-not [string]::IsNullOrEmpty([string]$ParentFailure) -or $null -eq $Result -or $Decision.timedOut -or $Result.exitCode -ne 0 -or -not $Decision.officeLifecycleComplete -or -not $FontCleanupConfirmed -or -not $InputsUnchanged) { throw 'Native font edit failed, timed out, or did not confirm the owned Office/font/input lifecycle; preserve the attempt and inspect its supervisor record. No retry was started.' }
    if(-not $Decision.metricsGatePassed) { throw 'Native font edit completed both owned closes, but the persisted post-close metrics gate failed; preserve the positive-control counterexample. No Office call or retry was started.' }
}

function Invoke-FontEditPureRegression {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
    foreach($functionName in @('Invoke-FontEditCom','Set-FontEditRange','Find-FontEditShape','Get-FontEditMetrics')) {
        $definition=@($definitions | Where-Object {$_.Name -ceq $functionName})
        if($definition.Count -ne 1) { throw "Expected exactly one $functionName definition, found $($definition.Count)" }
        Invoke-Expression $definition[0].Extent.Text
    }
    $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:pureStages=@()
    function Write-FontEditStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) { $script:pureStages+=@([ordered]@{stage=$StageName;status=$Status;error=$ErrorMessage}) }
    $wholeFont=[pscustomobject]@{Name=$null;Size=$null;Bold=$null;Italic=$null}
    $runRanges=[ordered]@{}
    foreach($spec in @(@(1,10),@(14,7),@(24,9),@(36,13))) { $runRanges["$($spec[0]):$($spec[1])"]=[pscustomobject]@{Font=[pscustomobject]@{Name=$null;Size=$null;Bold=$null;Italic=$null}} }
    $range=[pscustomobject]@{Text=$null;Font=$wholeFont;RunRanges=$runRanges}
    $range | Add-Member -MemberType ScriptMethod -Name Characters -Value { param($start,$length) $key="$start`:$length"; if(-not $this.RunRanges.Contains($key)){throw "Unexpected Characters span $key"}; return $this.RunRanges[$key] }
    $text='Regular 18 | Bold 20 | Italic 22 | BoldItalic 24'
    $runs=@(
        [pscustomobject]@{start=1;length=10;text='Regular 18';size=18;bold=$false;italic=$false},
        [pscustomobject]@{start=14;length=7;text='Bold 20';size=20;bold=$true;italic=$false},
        [pscustomobject]@{start=24;length=9;text='Italic 22';size=22;bold=$false;italic=$true},
        [pscustomobject]@{start=36;length=13;text='BoldItalic 24';size=24;bold=$true;italic=$true}
    )
    Set-FontEditRange $range $text 'Carlito' 18 $false $false $runs 'selftest.body'
    if($range.Text -cne $text -or $wholeFont.Name -cne 'Carlito' -or $wholeFont.Size -ne 18 -or $wholeFont.Bold -ne 0 -or $wholeFont.Italic -ne 0) { throw 'Whole-range text or default font was shadowed' }
    foreach($run in $runs) {
        $font=$runRanges["$($run.start):$($run.length)"].Font
        if($font.Name -cne 'Carlito' -or $font.Size -ne $run.size -or $font.Bold -ne $(if($run.bold){-1}else{0}) -or $font.Italic -ne $(if($run.italic){-1}else{0})) { throw "Mixed run $($run.text) was not applied exactly" }
    }
    function New-PureRange([string]$Text,[string]$Family,[double]$Size,[int]$Bold,[int]$Italic) { return ,([ordered]@{text=$Text;length=$Text.Length;bounds=[ordered]@{left=[double]10.100000381469727;top=[double]20.200000762939453;width=[double]30.299999237060547;height=[double]40.400001525878906};font=[ordered]@{name=$Family;size=$Size;bold=$Bold;italic=$Italic}}) }
    $geometry=[ordered]@{left=[double]1.100000023841858;top=[double]2.200000047683716;width=[double]3.299999952316284;height=[double]4.400000095367432}
    $expected=[ordered]@{slide=[ordered]@{width=960;height=540};original=[ordered]@{title='Plain control';body='Current content'};title=[ordered]@{text='Gate E - Carlito';family='Carlito';size=30;bold=$true;italic=$false};body=[ordered]@{text=$text;family='Carlito';defaultSize=18;runs=$runs};tolerancePoints=0.02}
    $original=[ordered]@{phase='original';slideWidth=[double]960;slideHeight=[double]540;shapes=@([ordered]@{role='title';geometry=$geometry;whole=(New-PureRange 'Plain control' 'Aptos Display' 40.5 -1 0);runs=@()},[ordered]@{role='body';geometry=$geometry;whole=(New-PureRange 'Current content' 'Aptos' 18.75 0 0);runs=@()})}
    $title=[ordered]@{role='title';geometry=$geometry;whole=(New-PureRange $expected.title.text 'Carlito' 30 -1 0);runs=@()}
    $bodyRuns=@(); foreach($run in $runs) {$bodyRuns+=@(New-PureRange $run.text 'Carlito' ([double]$run.size) $(if($run.bold){-1}else{0}) $(if($run.italic){-1}else{0}))}
    $body=[ordered]@{role='body';geometry=$geometry;whole=(New-PureRange $text 'Carlito' -2 -2 -2);runs=$bodyRuns}
    $reopenedBodyRuns=@(); foreach($run in $runs) {$reopenedBodyRuns+=@(New-PureRange $run.text 'Carlito' ([double]$run.size) $(if($run.bold){-1}else{0}) $(if($run.italic){-1}else{0}))}
    $reopenedTitle=[ordered]@{role='title';geometry=[ordered]@{left=$geometry.left;top=$geometry.top;width=$geometry.width;height=$geometry.height};whole=(New-PureRange $expected.title.text 'Carlito' 30 -1 0);runs=@()}
    $reopenedBody=[ordered]@{role='body';geometry=[ordered]@{left=$geometry.left;top=$geometry.top;width=$geometry.width;height=$geometry.height};whole=(New-PureRange $text 'Carlito' -2 -2 -2);runs=$reopenedBodyRuns}
    $edited=[ordered]@{phase='edited';slideWidth=[double]960;slideHeight=[double]540;shapes=@($title,$body)}; $reopened=[ordered]@{phase='reopened';slideWidth=[double]960;slideHeight=[double]540;shapes=@($reopenedTitle,$reopenedBody)}
    $metrics=Get-FontEditMetrics $original $edited $reopened $expected 0.02
    if(-not $metrics.contentAndStylePassed -or -not $metrics.persistence.gatePassed -or $metrics.persistence.maximumDeltaPoints -ne 0) { throw "Native-style OrderedDictionary metric regression failed: $($metrics | ConvertTo-Json -Depth 8 -Compress)" }
    $savedText=$body['runs'][0]['text']; $body['runs'][0]['text']='Wrong'; $negativeContent=Get-FontEditMetrics $original $edited $reopened $expected 0.02; $body['runs'][0]['text']=$savedText
    $savedFamily=$body['runs'][0]['font']['name']; $body['runs'][0]['font']['name']='Wrong'; $negativeStyle=Get-FontEditMetrics $original $edited $reopened $expected 0.02; $body['runs'][0]['font']['name']=$savedFamily
    $savedLeft=[double]$reopenedBody['runs'][0]['bounds']['left']; $reopenedBody['runs'][0]['bounds']['left']=$savedLeft+0.03; $negativePersistence=Get-FontEditMetrics $original $edited $reopened $expected 0.02; $reopenedBody['runs'][0]['bounds']['left']=$savedLeft
    if($negativeContent.contentAndStylePassed -or $negativeStyle.contentAndStylePassed -or $negativePersistence.persistence.gatePassed) { throw 'Metric function accepted a negative content, style, or persistence mutation' }
    $positiveDecision=Get-FontEditParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$true}})
    $negativeDecision=Get-FontEditParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$false}})
    $timeoutDecision=Get-FontEditParentDecision ([pscustomobject]@{timedOut=$true;exitCode=$null}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$true}})
    if(-not $positiveDecision.officeLifecycleComplete -or -not $positiveDecision.metricsGatePassed -or $negativeDecision.metricsGatePassed -or $timeoutDecision.officeLifecycleComplete -or $timeoutDecision.officeCleanupConfirmed) { throw 'Parent positive/negative/timeout decision regression failed' }
    Assert-FontEditParentSuccess $positiveDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) $null $true $true
    $negativeRejected=$false; try {Assert-FontEditParentSuccess $negativeDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) $null $true $true} catch {$negativeRejected=$_.Exception.Message -like 'Native font edit completed both owned closes*'}
    if(-not $negativeRejected) {throw 'Parent success assertion accepted a false post-close metrics gate'}
    [ordered]@{passed=$true;officeOrComCalls=0;text=$range.Text;runCount=$runs.Count;wrapperStages=$script:pureStages.Count;orderedDictionaryMetricsPassed=$true;negativeMutationsRejected=$true;parentGateLogicPassed=$true} | ConvertTo-Json -Depth 5
}

if($PureRegression) { Invoke-FontEditPureRegression; return }
foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation),@('FontFixtureDirectory',$FontFixtureDirectory))) { if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required unless -PureRegression is selected" } }

function Assert-FontEditHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Read-FontEditGeneration([string]$FixtureRoot,[string]$ExpectedSource) {
    $generationPath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'generation.json')).Path
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($null -eq $generation.source -or $generation.source.file -cne 'source.pptx') { throw 'generation.source.file must be source.pptx' }
    Assert-FontEditHash ([string]$generation.source.sha256) 'generation.source.sha256'
    if($null -eq $generation.license -or $generation.license.file -cne 'LICENSE_FONT') { throw 'generation.license.file must be LICENSE_FONT' }
    Assert-FontEditHash ([string]$generation.license.sha256) 'generation.license.sha256'
    $source=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'source.pptx')).Path
    if($source -ine $ExpectedSource) { throw 'InputPresentation must be the fixture source.pptx' }
    if((Get-FontEditSha256 $source) -cne $generation.source.sha256) { throw 'Fixture source.pptx hash differs from generation.json' }
    $license=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'LICENSE_FONT')).Path
    if((Get-FontEditSha256 $license) -cne $generation.license.sha256) { throw 'Fixture LICENSE_FONT hash differs from generation.json' }
    $allowed=@('fonts/Carlito-400-normal.ttf','fonts/Carlito-400-italic.ttf','fonts/Carlito-700-normal.ttf','fonts/Carlito-700-italic.ttf')
    $fonts=@($generation.fonts)
    if($fonts.Count -ne 4) { throw 'generation.fonts must contain exactly four Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        if($allowed -cnotcontains $font.file -or $seen.ContainsKey([string]$font.file)) { throw "Invalid or duplicate generation font path: $($font.file)" }
        Assert-FontEditHash ([string]$font.sha256) "generation font $($font.file) sha256"
        $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $font.file)).Path
        if((Get-FontEditSha256 $path) -cne $font.sha256) { throw "Fixture font hash differs from generation.json: $($font.file)" }
        $seen[[string]$font.file]=$true
    }
    foreach($file in $allowed) { if(-not $seen.ContainsKey($file)) { throw "Missing required fixture font: $file" } }
    if($generation.registration.flags -ne 0) { throw 'generation.registration.flags must be 0 for PowerPoint-visible session registration' }
    $expectedTitle='Gate E - Carlito'; $expectedBody='Regular 18 | Bold 20 | Italic 22 | BoldItalic 24'
    if($generation.edit.title -cne $expectedTitle -or $generation.edit.titleFont -cne 'Carlito' -or [double]$generation.edit.titleSizePoints -ne 30 -or -not [bool]$generation.edit.titleBold -or $generation.edit.body -cne $expectedBody) { throw 'generation.edit title/body contract changed' }
    $expectedSpans=@(@(1,10,18,$false,$false),@(14,7,20,$true,$false),@(24,9,22,$false,$true),@(36,13,24,$true,$true))
    $spans=@($generation.edit.spans); if($spans.Count -ne 4) { throw 'generation.edit.spans must contain exactly four entries' }
    for($index=0;$index -lt 4;$index++) { $span=$spans[$index]; $wanted=$expectedSpans[$index]; if([int]$span.start -ne $wanted[0] -or [int]$span.length -ne $wanted[1] -or [double]$span.size -ne $wanted[2] -or [bool]$span.bold -ne $wanted[3] -or [bool]$span.italic -ne $wanted[4] -or $expectedBody.Substring([int]$span.start-1,[int]$span.length).Length -ne [int]$span.length) { throw "generation.edit.spans[$index] changed" } }
    return ,([ordered]@{generation=$generation;generationPath=$generationPath;sourcePath=$source;licensePath=$license;fontFiles=$fonts})
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $fixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path
    $fixture=Read-FontEditGeneration $fixtureRoot $inputPath
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts'))
    $verifierSnapshot=Join-Path $snapshotRoot 'native-font-edit.ps1'
    $processOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path; $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $fontHelperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-text-fonts.ps1')).Path; $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'; $generationSnapshot=Join-Path $snapshotRoot 'generation.json'; $licenseSnapshot=Join-Path $snapshotRoot 'LICENSE_FONT'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot
    Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot
    Copy-Item -LiteralPath $fixture.generationPath -Destination $generationSnapshot
    Copy-Item -LiteralPath $fixture.licensePath -Destination $licenseSnapshot
    $fontInputs=@()
    foreach($font in $fixture.fontFiles) {
        $external=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot $font.file)).Path; $snapshot=Join-Path $snapshotRoot $font.file
        Copy-Item -LiteralPath $external -Destination $snapshot
        $fontInputs+=@([ordered]@{file=$font.file;path=$external;sha256=$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-FontEditSha256 $snapshot)})
    }
    $expectations=[ordered]@{
        slide=[ordered]@{width=960;height=540}
        original=[ordered]@{title='Plain control';body='Current content'}
        title=[ordered]@{text='Gate E - Carlito';family='Carlito';size=30;bold=$true;italic=$false}
        body=[ordered]@{
            text='Regular 18 | Bold 20 | Italic 22 | BoldItalic 24';family='Carlito';defaultSize=18
            runs=@(
                [ordered]@{start=1;length=10;text='Regular 18';size=18;bold=$false;italic=$false},
                [ordered]@{start=14;length=7;text='Bold 20';size=20;bold=$true;italic=$false},
                [ordered]@{start=24;length=9;text='Italic 22';size=22;bold=$false;italic=$true},
                [ordered]@{start=36;length=13;text='BoldItalic 24';size=24;bold=$true;italic=$true}
            )
        }
        tolerancePoints=0.02
    }
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=(Get-FontEditSha256 $inputPath);snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEditSha256 $sourceSnapshot)}
        fixture=[ordered]@{
            path=$fixtureRoot
            generation=[ordered]@{path=$fixture.generationPath;sha256=(Get-FontEditSha256 $fixture.generationPath);snapshotPath=$generationSnapshot;snapshotSha256=(Get-FontEditSha256 $generationSnapshot)}
            license=[ordered]@{path=$fixture.licensePath;sha256=(Get-FontEditSha256 $fixture.licensePath);snapshotPath=$licenseSnapshot;snapshotSha256=(Get-FontEditSha256 $licenseSnapshot)}
            fonts=$fontInputs
        }
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-FontEditSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-FontEditSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-FontEditSha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-FontEditSha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-FontEditSha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-FontEditSha256 $fontHelperSnapshot);registrationFlags=0}
        expectations=$expectations
    }
    $request | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=Get-Content -LiteralPath $generationSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json
    . $processSnapshot
    . $fontHelperSnapshot
    $script:fontEditWorkerResult=$null; $parentFailure=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {
            $script:fontEditWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @('-OutputDirectory',$outputRoot,'-InputPresentation',$sourceSnapshot,'-FontFixtureDirectory',$snapshotRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try {$lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json} catch {} }
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))) { foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)) { try {$lastDurable=$line | ConvertFrom-Json} catch {} } }
    $registrations=@(); $registrationPath=Join-Path $outputRoot 'font-registration.json'
    if(Test-Path -LiteralPath $registrationPath) { try {$registrations=Read-FontEditRegistrations $registrationPath} catch {$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"} }
    $fontCleanupConfirmed=($registrations.Count -eq 4 -and @($registrations | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
    $inputChecks=@(
        (New-FontEditInputCheck $inputPath $request.source.sha256),
        (New-FontEditInputCheck $sourceSnapshot $request.source.sha256),
        (New-FontEditInputCheck $fixture.generationPath $request.fixture.generation.sha256),
        (New-FontEditInputCheck $generationSnapshot $request.fixture.generation.sha256),
        (New-FontEditInputCheck $fixture.licensePath $request.fixture.license.sha256),
        (New-FontEditInputCheck $licenseSnapshot $request.fixture.license.sha256)
    )
    foreach($font in $request.fixture.fonts) { $inputChecks+=@((New-FontEditInputCheck $font.path $font.sha256),(New-FontEditInputCheck $font.snapshotPath $font.sha256)) }
    foreach($codeInput in @($request.verifier,$request.processHelper,$request.fontHelper)) {
        $inputChecks+=@((New-FontEditInputCheck $codeInput.path $codeInput.sha256),(New-FontEditInputCheck $codeInput.snapshotPath $codeInput.sha256))
    }
    $inputsUnchanged=(@($inputChecks | Where-Object {-not $_.matched}).Count -eq 0)
    $result=$script:fontEditWorkerResult; $workerReport=$null; $workerReportPath=Join-Path $outputRoot 'report.json'
    if(Test-Path -LiteralPath $workerReportPath) { try {$workerReport=Get-Content -LiteralPath $workerReportPath -Raw -Encoding UTF8 | ConvertFrom-Json} catch {$parentFailure="Unreadable worker report: $($_.Exception.Message)"} }
    $decision=Get-FontEditParentDecision $result $lastDurable $workerReport; $timedOut=[bool]$decision.timedOut
    if($timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) { try {Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json')} catch {$parentFailure="Could not preserve timeout report snapshot: $($_.Exception.Message)"} }
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=$timedOut;exitCode=$(if($null -eq $result){$null}else{$result.exitCode})
        officeLifecycleComplete=[bool]$decision.officeLifecycleComplete;metricsGatePassed=[bool]$decision.metricsGatePassed;officeCleanupConfirmed=[bool]$decision.officeCleanupConfirmed;fontCleanupConfirmed=$fontCleanupConfirmed;inputsUnchanged=$inputsUnchanged
        lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});lastDurableStatus=$(if($null -eq $lastDurable){$null}else{$lastDurable.status});parentError=$parentFailure;inputChecks=$inputChecks
    }
    $terminal | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_} }
    Assert-FontEditParentSuccess $decision $result $parentFailure $fontCleanupConfirmed $inputsUnchanged
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourcePath=$request.source.path; $sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path; $savedPath=Join-Path $root 'native-font-edit.pptx'
$stageFile=Join-Path $root 'stages.jsonl'; $progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'
$originalPng=Join-Path $root 'original.png'; $editedPng=Join-Path $root 'edited.png'; $reopenedPng=Join-Path $root 'reopened.png'
foreach($reserved in @($stageFile,$progressFile,$reportFile,$savedPath,$originalPng,$editedPng,$reopenedPng)) { if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' } }
if((Get-FontEditSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-FontEditSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
foreach($helper in @($request.processHelper,$request.fontHelper)) { if((Get-FontEditSha256 $helper.path) -cne $helper.sha256 -or (Get-FontEditSha256 $helper.snapshotPath) -cne $helper.sha256) { throw 'A helper or helper snapshot changed before the worker started' } }
if((Get-FontEditSha256 $sourceSnapshot) -cne $request.source.sha256) { throw 'Presentation snapshot hash differs from the validated source' }
if((Get-FontEditSha256 $request.fixture.generation.snapshotPath) -cne $request.fixture.generation.sha256 -or (Get-FontEditSha256 $request.fixture.license.snapshotPath) -cne $request.fixture.license.sha256) { throw 'Generation or license snapshot changed before the worker started' }
foreach($font in $request.fixture.fonts) { if((Get-FontEditSha256 $font.snapshotPath) -cne $font.sha256) { throw "Font snapshot changed before the worker started: $($font.file)" } }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1
    source=[ordered]@{path=$sourcePath;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEditSha256 $sourceSnapshot);unchanged=$null;snapshotUnchanged=$null}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    original=[ordered]@{observation=$null;raster=[ordered]@{path=$originalPng;sha256=$null}}
    edited=[ordered]@{observation=$null;raster=[ordered]@{path=$editedPng;sha256=$null}}
    reopened=[ordered]@{observation=$null;raster=[ordered]@{path=$reopenedPng;sha256=$null};sha256=$null}
    requested=$request.expectations
    metrics=$null
    inputs=[ordered]@{fixture=$request.fixture;verifier=$request.verifier;processHelper=$request.processHelper;fontHelper=$request.fontHelper}
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='One immutable one-slide/two-text-shape source snapshot edited to six bounded native range observations: two whole shapes plus four body spans. The control emits three full-slide PNGs and no PDF or embedded font. Font registration and removal belong only to the surviving parent.'
    limitations=@('Native font properties and rasters do not identify the physical file used for every glyph.','Fallback or synthetic styling may coexist with the reported family/style.','This editability control does not test font embedding or browser/native pixel equivalence.')
}
function Write-FontEditReport { $report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus; $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8 }
function Write-FontEditStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$StageName; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$StageName;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $progressFile -Encoding UTF8
}
function Invoke-FontEditCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-FontEditStage $StageName 'begin'
    try {$value=& $Operation; Write-FontEditStage $StageName 'success'; return ,$value}
    catch {$script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-FontEditStage $StageName 'error' $_.Exception.Message; throw}
}
function Assert-FontEditPresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-FontEditCom "$Prefix.presentations.get" {return ,$Application.Presentations}; $count=Invoke-FontEditCom "$Prefix.presentations.count.get" {$presentations.Count}
    for($index=1;$index -le $count;$index++) { $candidate=Invoke-FontEditCom "$Prefix.presentation-$index.get" {return ,$presentations.Item($index)}; $actual=Invoke-FontEditCom "$Prefix.presentation-$index.fullName.get" {$candidate.FullName}; if($actual -ieq $Path) {throw "Presentation is already open, so ownership cannot be established: $Path"} }
}
function Set-FontEditRange($Range,[string]$RequestedText,[string]$RequestedFamily,[double]$RequestedSize,[bool]$RequestedBold,[bool]$RequestedItalic,$RequestedRuns,[string]$Prefix) {
    Invoke-FontEditCom "$Prefix.text.set" {$Range.Text=$RequestedText}
    $wholeFont=Invoke-FontEditCom "$Prefix.font.get" {return ,$Range.Font}
    Invoke-FontEditCom "$Prefix.font.name.set" {$wholeFont.Name=$RequestedFamily}; Invoke-FontEditCom "$Prefix.font.size.set" {$wholeFont.Size=$RequestedSize}
    Invoke-FontEditCom "$Prefix.font.bold.set" {$wholeFont.Bold=$(if($RequestedBold){-1}else{0})}; Invoke-FontEditCom "$Prefix.font.italic.set" {$wholeFont.Italic=$(if($RequestedItalic){-1}else{0})}
    foreach($run in @($RequestedRuns)) {
        $runRange=Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).get" {return ,$Range.Characters([int]$run.start,[int]$run.length)}
        $runFont=Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).font.get" {return ,$runRange.Font}
        Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).font.name.set" {$runFont.Name=$RequestedFamily}; Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).font.size.set" {$runFont.Size=[double]$run.size}
        Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).font.bold.set" {$runFont.Bold=$(if($run.bold){-1}else{0})}; Invoke-FontEditCom "$Prefix.run-$($run.start)-$($run.length).font.italic.set" {$runFont.Italic=$(if($run.italic){-1}else{0})}
    }
}
function Read-FontEditRange($Range,[string]$Prefix) {
    $text=Invoke-FontEditCom "$Prefix.text.get" {$Range.Text}; $length=Invoke-FontEditCom "$Prefix.length.get" {$Range.Length}
    $left=[double](Invoke-FontEditCom "$Prefix.boundLeft.get" {$Range.BoundLeft}); $top=[double](Invoke-FontEditCom "$Prefix.boundTop.get" {$Range.BoundTop}); $width=[double](Invoke-FontEditCom "$Prefix.boundWidth.get" {$Range.BoundWidth}); $height=[double](Invoke-FontEditCom "$Prefix.boundHeight.get" {$Range.BoundHeight})
    $font=Invoke-FontEditCom "$Prefix.font.get" {return ,$Range.Font}; $name=Invoke-FontEditCom "$Prefix.font.name.get" {$font.Name}; $size=[double](Invoke-FontEditCom "$Prefix.font.size.get" {$font.Size}); $bold=Invoke-FontEditCom "$Prefix.font.bold.get" {$font.Bold}; $italic=Invoke-FontEditCom "$Prefix.font.italic.get" {$font.Italic}
    return [ordered]@{text=$text;length=$length;bounds=[ordered]@{left=$left;top=$top;width=$width;height=$height};font=[ordered]@{name=$name;size=$size;bold=$bold;italic=$italic}}
}
function Read-FontEditObservation($Presentation,[string]$Phase,[bool]$IncludeMixedRuns) {
    $slides=Invoke-FontEditCom "$Phase.slides.get" {return ,$Presentation.Slides}; $slideCount=Invoke-FontEditCom "$Phase.slides.count.get" {$slides.Count}; if($slideCount -ne 1) {throw "$Phase expected one slide; observed $slideCount"}
    $slide=Invoke-FontEditCom "$Phase.slide-1.get" {return ,$slides.Item(1)}; $shapes=Invoke-FontEditCom "$Phase.shapes.get" {return ,$slide.Shapes}; $shapeCount=Invoke-FontEditCom "$Phase.shapes.count.get" {$shapes.Count}; if($shapeCount -ne 2) {throw "$Phase expected two shapes; observed $shapeCount"}
    $found=[ordered]@{}
    for($index=1;$index -le $shapeCount;$index++) { $shape=Invoke-FontEditCom "$Phase.shape-$index.get" {return ,$shapes.Item($index)}; $name=Invoke-FontEditCom "$Phase.shape-$index.name.get" {$shape.Name}; $role=$(if($name -ceq 'OPF heading slides.0.title line 0'){'title'}elseif($name -ceq 'OPF text slides.0.text line 0'){'body'}else{$null}); if($null -eq $role -or $found.Contains($role)) {throw "$Phase contains an unexpected or duplicate exact shape name: $name"}; $found[$role]=$shape }
    $shapeRecords=@()
    foreach($role in @('title','body')) {
        if(-not $found.Contains($role)) {throw "$Phase is missing the $role shape"}; $shape=$found[$role]; $prefix="$Phase.$role"
        $name=Invoke-FontEditCom "$prefix.name.get" {$shape.Name}; $type=Invoke-FontEditCom "$prefix.type.get" {$shape.Type}; $left=[double](Invoke-FontEditCom "$prefix.left.get" {$shape.Left}); $top=[double](Invoke-FontEditCom "$prefix.top.get" {$shape.Top}); $width=[double](Invoke-FontEditCom "$prefix.width.get" {$shape.Width}); $height=[double](Invoke-FontEditCom "$prefix.height.get" {$shape.Height})
        $hasTextFrame=Invoke-FontEditCom "$prefix.hasTextFrame.get" {$shape.HasTextFrame}; if($hasTextFrame -ne -1) {throw "$prefix has no text frame"}; $frame=Invoke-FontEditCom "$prefix.textFrame2.get" {return ,$shape.TextFrame2}; $range=Invoke-FontEditCom "$prefix.textRange2.get" {return ,$frame.TextRange}
        $whole=Read-FontEditRange $range "$prefix.whole"; $runs=@()
        if($role -eq 'body' -and $IncludeMixedRuns) { foreach($run in @($request.expectations.body.runs)) { $runRange=Invoke-FontEditCom "$prefix.run-$($run.start)-$($run.length).get" {return ,$range.Characters([int]$run.start,[int]$run.length)}; $runs+=@(Read-FontEditRange $runRange "$prefix.run-$($run.start)-$($run.length)") } }
        $shapeRecords+=@([ordered]@{role=$role;name=$name;type=$type;geometry=[ordered]@{left=$left;top=$top;width=$width;height=$height};whole=$whole;runs=$runs})
    }
    $pageSetup=Invoke-FontEditCom "$Phase.pageSetup.get" {return ,$Presentation.PageSetup}; $slideWidth=[double](Invoke-FontEditCom "$Phase.slideWidth.get" {$pageSetup.SlideWidth}); $slideHeight=[double](Invoke-FontEditCom "$Phase.slideHeight.get" {$pageSetup.SlideHeight})
    return [ordered]@{phase=$Phase;slideCount=$slideCount;shapeCount=$shapeCount;slideWidth=$slideWidth;slideHeight=$slideHeight;shapes=$shapeRecords}
}
function Close-OwnedFontEdit([string]$Phase,[string]$ExpectedPath) { $actual=Invoke-FontEditCom "$Phase.fullName.get" {$script:presentation.FullName}; if($actual -ine $ExpectedPath){throw "Refusing to close a presentation whose exact saved path is not owned: $actual"}; Invoke-FontEditCom "$Phase.close" {$script:presentation.Close()}; $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; Write-FontEditStage "$Phase.cleanup" 'success' }
function Find-FontEditShape($Observation,[string]$Role) { foreach($shape in $Observation['shapes']) {if($shape['role'] -ceq $Role){return ,$shape}}; return $null }
function Get-FontEditMetrics($Original,$Edited,$Reopened,$Expected,[double]$Tolerance) {
    $failures=@(); $maximumPersistenceDelta=0.0
    $originalTitle=Find-FontEditShape $Original 'title'; $originalBody=Find-FontEditShape $Original 'body'
    if([Math]::Abs([double]$Original['slideWidth']-[double]$Expected.slide.width) -gt $Tolerance -or [Math]::Abs([double]$Original['slideHeight']-[double]$Expected.slide.height) -gt $Tolerance) {$failures+='original slide dimensions changed'}
    if($originalTitle['whole']['text'] -cne $Expected.original.title){$failures+='original title text changed'}; if($originalBody['whole']['text'] -cne $Expected.original.body){$failures+='original body text changed'}
    foreach($phase in @($Edited,$Reopened)) {
        if([Math]::Abs([double]$phase['slideWidth']-[double]$Expected.slide.width) -gt $Tolerance -or [Math]::Abs([double]$phase['slideHeight']-[double]$Expected.slide.height) -gt $Tolerance) {$failures+="$($phase['phase']) slide dimensions changed"}
        $title=Find-FontEditShape $phase 'title'; $body=Find-FontEditShape $phase 'body'
        if($title['whole']['text'] -cne $Expected.title.text -or $title['whole']['font']['name'] -cne $Expected.title.family -or [Math]::Abs([double]$title['whole']['font']['size']-[double]$Expected.title.size) -gt $Tolerance -or [int]$title['whole']['font']['bold'] -ne -1 -or [int]$title['whole']['font']['italic'] -ne 0) {$failures+="$($phase['phase']) title text/style mismatch"}
        if($body['whole']['text'] -cne $Expected.body.text -or $body['runs'].Count -ne 4) {$failures+="$($phase['phase']) body text/run-count mismatch"}
        for($index=0;$index -lt [Math]::Min(4,$body['runs'].Count);$index++) { $actual=$body['runs'][$index]; $wanted=$Expected.body.runs[$index]; if($actual['text'] -cne $wanted.text -or [int]$actual['length'] -ne [int]$wanted.length -or $actual['font']['name'] -cne $Expected.body.family -or [Math]::Abs([double]$actual['font']['size']-[double]$wanted.size) -gt $Tolerance -or [int]$actual['font']['bold'] -ne $(if($wanted.bold){-1}else{0}) -or [int]$actual['font']['italic'] -ne $(if($wanted.italic){-1}else{0})) {$failures+="$($phase['phase']) body run $index mismatch"} }
    }
    foreach($role in @('title','body')) {
        $a=Find-FontEditShape $Edited $role; $b=Find-FontEditShape $Reopened $role
        foreach($property in @('left','top','width','height')) {$delta=[Math]::Abs([double]$a['geometry'][$property]-[double]$b['geometry'][$property]); if($delta -gt $maximumPersistenceDelta){$maximumPersistenceDelta=$delta}}
        foreach($property in @('left','top','width','height')) {$delta=[Math]::Abs([double]$a['whole']['bounds'][$property]-[double]$b['whole']['bounds'][$property]); if($delta -gt $maximumPersistenceDelta){$maximumPersistenceDelta=$delta}}
        for($index=0;$index -lt $a['runs'].Count;$index++) {foreach($property in @('left','top','width','height')) {$delta=[Math]::Abs([double]$a['runs'][$index]['bounds'][$property]-[double]$b['runs'][$index]['bounds'][$property]); if($delta -gt $maximumPersistenceDelta){$maximumPersistenceDelta=$delta}}}
    }
    return [ordered]@{tolerancePoints=$Tolerance;contentAndStylePassed=($failures.Count -eq 0);failures=$failures;persistence=[ordered]@{gatePassed=($maximumPersistenceDelta -le $Tolerance);maximumDeltaPoints=$maximumPersistenceDelta}}
}

Write-FontEditReport; Write-FontEditStage 'worker.initialize' 'success'
try {
    $app=Invoke-FontEditCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}; $officeVersion=Invoke-FontEditCom 'application.version.get' {$app.Version}; $officeDirectory=Invoke-FontEditCom 'application.path.get' {$app.Path}; $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion; $report.environment.powerPointExecutable=$officeExecutable; $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion; $report.environment.powerPointExecutableSha256=Get-FontEditSha256 $officeExecutable; Write-FontEditReport
    Assert-FontEditPresentationNotOpen $app $sourceSnapshot 'input.preflight'; Assert-FontEditPresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-FontEditReport
    $presentations=Invoke-FontEditCom 'input.presentations.get' {return ,$app.Presentations}; $script:presentation=Invoke-FontEditCom 'input.presentation.open' {return ,$presentations.Open($sourceSnapshot,0,0,-1)}
    $report.original.observation=Read-FontEditObservation $script:presentation 'original' $false; Write-FontEditReport
    $slides=Invoke-FontEditCom 'original.export.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEditCom 'original.export.slide-1.get' {return ,$slides.Item(1)}; Invoke-FontEditCom 'original.export.png' {$slide.Export($originalPng,'PNG',1280,720)}; $report.original.raster.sha256=Get-FontEditSha256 $originalPng; Write-FontEditReport
    $slides=Invoke-FontEditCom 'edit.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEditCom 'edit.slide-1.get' {return ,$slides.Item(1)}; $shapes=Invoke-FontEditCom 'edit.shapes.get' {return ,$slide.Shapes}
    $titleShape=Invoke-FontEditCom 'edit.title.get' {return ,$shapes.Item('OPF heading slides.0.title line 0')}; $titleFrame=Invoke-FontEditCom 'edit.title.textFrame2.get' {return ,$titleShape.TextFrame2}; $titleRange=Invoke-FontEditCom 'edit.title.textRange2.get' {return ,$titleFrame.TextRange}
    Set-FontEditRange $titleRange $request.expectations.title.text $request.expectations.title.family ([double]$request.expectations.title.size) ([bool]$request.expectations.title.bold) ([bool]$request.expectations.title.italic) @() 'edit.title'
    $bodyShape=Invoke-FontEditCom 'edit.body.get' {return ,$shapes.Item('OPF text slides.0.text line 0')}; $bodyFrame=Invoke-FontEditCom 'edit.body.textFrame2.get' {return ,$bodyShape.TextFrame2}; $bodyRange=Invoke-FontEditCom 'edit.body.textRange2.get' {return ,$bodyFrame.TextRange}
    Set-FontEditRange $bodyRange $request.expectations.body.text $request.expectations.body.family ([double]$request.expectations.body.defaultSize) $false $false $request.expectations.body.runs 'edit.body'
    $report.edited.observation=Read-FontEditObservation $script:presentation 'edited' $true; Write-FontEditReport
    $slides=Invoke-FontEditCom 'edited.export.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEditCom 'edited.export.slide-1.get' {return ,$slides.Item(1)}; Invoke-FontEditCom 'edited.export.png' {$slide.Export($editedPng,'PNG',1280,720)}; $report.edited.raster.sha256=Get-FontEditSha256 $editedPng; Write-FontEditReport
    Invoke-FontEditCom 'edited.presentation.saveAs-owned-copy-no-font-embedding' {$script:presentation.SaveAs($savedPath,24,0)}; $script:ownedPresentationPath=$savedPath; Write-FontEditReport; Close-OwnedFontEdit 'edited.presentation' $savedPath; $report.saved.sha256=Get-FontEditSha256 $savedPath; Write-FontEditReport
    Assert-FontEditPresentationNotOpen $app $savedPath 'reopen.preflight'; $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$savedPath; Write-FontEditReport
    $presentations=Invoke-FontEditCom 'reopen.presentations.get' {return ,$app.Presentations}; $script:presentation=Invoke-FontEditCom 'reopen.presentation.open-readonly' {return ,$presentations.Open($savedPath,-1,0,-1)}; $reopenedFullName=Invoke-FontEditCom 'reopen.presentation.fullName.get' {$script:presentation.FullName}; if($reopenedFullName -ine $savedPath){throw "Reopened presentation path differs from exact saved path: $reopenedFullName"}
    $report.reopened.observation=Read-FontEditObservation $script:presentation 'reopened' $true; Write-FontEditReport
    $slides=Invoke-FontEditCom 'reopened.export.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEditCom 'reopened.export.slide-1.get' {return ,$slides.Item(1)}; Invoke-FontEditCom 'reopened.export.png' {$slide.Export($reopenedPng,'PNG',1280,720)}; $report.reopened.raster.sha256=Get-FontEditSha256 $reopenedPng; Write-FontEditReport
    Close-OwnedFontEdit 'reopened.presentation' $savedPath; $report.reopened.sha256=Get-FontEditSha256 $savedPath
    $report.source.unchanged=((Get-FontEditSha256 $sourcePath) -ceq $request.source.sha256); $report.source.snapshotUnchanged=((Get-FontEditSha256 $sourceSnapshot) -ceq $request.source.sha256)
    $inputsStable=$report.source.unchanged -and $report.source.snapshotUnchanged -and (Get-FontEditSha256 $request.fixture.generation.path) -ceq $request.fixture.generation.sha256 -and (Get-FontEditSha256 $request.fixture.generation.snapshotPath) -ceq $request.fixture.generation.sha256 -and (Get-FontEditSha256 $request.fixture.license.path) -ceq $request.fixture.license.sha256 -and (Get-FontEditSha256 $request.fixture.license.snapshotPath) -ceq $request.fixture.license.sha256
    foreach($font in $request.fixture.fonts) {$inputsStable=$inputsStable -and (Get-FontEditSha256 $font.path) -ceq $font.sha256 -and (Get-FontEditSha256 $font.snapshotPath) -ceq $font.sha256}
    $metrics=Get-FontEditMetrics $report.original.observation $report.edited.observation $report.reopened.observation $request.expectations ([double]$request.expectations.tolerancePoints)
    $metrics.rasterStable=($report.edited.raster.sha256 -ceq $report.reopened.raster.sha256); $metrics.savedStable=($report.saved.sha256 -ceq $report.reopened.sha256); $metrics.inputsStable=$inputsStable; $metrics.gatePassed=($metrics.contentAndStylePassed -and $metrics.persistence.gatePassed -and $metrics.rasterStable -and $metrics.savedStable -and $metrics.inputsStable); $report.metrics=$metrics
    Write-FontEditStage 'worker.complete' 'success'; Write-FontEditReport; Write-Output 'Native font edit completed; post-close gates are recorded in report.json.'
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation){$script:cleanupConfirmed=$false}; Write-FontEditStage 'worker.failure' 'error' $_.Exception.Message; Write-FontEditReport; throw
}
