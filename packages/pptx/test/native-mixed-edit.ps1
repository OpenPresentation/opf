# Owned presentation only. This script never calls Application.Quit.
# A timeout may terminate only the owned helper inside native-process.ps1.
# EmbedFonts is explicitly disabled: SaveAs is SaveAs($savedPath,24,0).
param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$FontFixtureDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

$script:MixedEditSourceSha256='f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51'
$script:MixedEditLicenseSha256='58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00'
$script:MixedEditFontSha256=@{
    'fonts/Carlito-400-normal.ttf'='ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89'
    'fonts/Carlito-400-italic.ttf'='074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5'
    'fonts/Carlito-700-normal.ttf'='51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0'
    'fonts/Carlito-700-italic.ttf'='25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691'
}

function Get-MixedEditSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Read-MixedEditRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }

function Test-MixedEditSaveAsPathArgument($Argument) {
    return ($Argument -is [System.Management.Automation.Language.VariableExpressionAst]) -and ($Argument.VariablePath.UserPath -ceq 'savedPath')
}
function Get-MixedEditNumericLiteralValue($Argument) {
    while($Argument -is [System.Management.Automation.Language.ParenExpressionAst]) {
        $elements=@($Argument.Pipeline.PipelineElements)
        if($elements.Count -ne 1) { return $null }
        $Argument=$elements[0].Expression
    }
    if($Argument -is [System.Management.Automation.Language.ConstantExpressionAst]) { return [int]$Argument.Value }
    if($Argument -is [System.Management.Automation.Language.UnaryExpressionAst]) {
        if($Argument.TokenKind -ne [System.Management.Automation.Language.TokenKind]::Minus) { return $null }
        $child=$Argument.Child
        if($child -is [System.Management.Automation.Language.ConstantExpressionAst]) { return -([int]$child.Value) }
    }
    return $null
}
function Test-MixedEditSaveAsNumericArgument($Argument,[int]$Expected) {
    $value=Get-MixedEditNumericLiteralValue $Argument
    return ($null -ne $value) -and ($value -eq $Expected)
}
function Get-MixedEditOwnedSaveAs($Invoke) {
    if(-not ($Invoke.Member -is [System.Management.Automation.Language.StringConstantExpressionAst]) -or $Invoke.Member.Value -cne 'SaveAs') { return $null }
    $arguments=@($Invoke.Arguments)
    if($arguments.Count -lt 2) { return $null }
    if(-not (Test-MixedEditSaveAsPathArgument $arguments[0])) { return $null }
    if(-not (Test-MixedEditSaveAsNumericArgument $arguments[1] 24)) { return $null }
    $embed=$null
    if($arguments.Count -ge 3) { $embed=Get-MixedEditNumericLiteralValue $arguments[2] }
    return [pscustomobject]@{argumentCount=$arguments.Count; embed=$embed}
}
function Assert-MixedEditVerifierAst([string]$Path) {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    foreach($command in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]},$true)) {
        $name=$command.GetCommandName()
        if($name -ieq 'Stop-Process' -or $name -ieq 'taskkill') { throw 'Mixed-size edit harness must not kill Office or any other process' }
    }
    $ownedSaves=@()
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        $member=$invoke.Member
        if($member -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $member.Value -ceq 'Quit') { throw 'Mixed-size edit harness must not call Application.Quit or $app.Quit()' }
        if($member -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $member.Value -ceq 'Kill') { throw 'Mixed-size edit harness must not kill Office or any other process' }
        $save=Get-MixedEditOwnedSaveAs $invoke
        if($null -eq $save) { continue }
        if($save.argumentCount -ne 3 -or $save.embed -ne 0) { throw 'SaveAs on $savedPath must be exactly SaveAs($savedPath,24,0)' }
        $ownedSaves+=$save
    }
    if($ownedSaves.Count -ne 1) { throw 'Mixed-size edit harness must call SaveAs($savedPath,24,0) exactly once' }
    return $ast
}
function Invoke-MixedEditPureRegression {
    $ast=Assert-MixedEditVerifierAst $PSCommandPath
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
    $stageDefinition=@($definitions | Where-Object {$_.Name -ceq 'Write-MixedEditStage'})
    $comDefinition=@($definitions | Where-Object {$_.Name -ceq 'Invoke-MixedEditCom'})
    if($stageDefinition.Count -ne 1) { throw 'Expected exactly one Write-MixedEditStage definition' }
    if($comDefinition.Count -ne 1) { throw 'Expected exactly one Invoke-MixedEditCom definition' }
    $pureRoot=Join-Path ([IO.Path]::GetTempPath()) ('opf-mixed-edit-pure-' + [Guid]::NewGuid().ToString('n'))
    [void](New-Item -ItemType Directory -Path $pureRoot)
    try {
        $script:stageFile=Join-Path $pureRoot 'stages.jsonl'
        $script:progressFile=Join-Path $pureRoot 'progress.json'
        $script:sequence=0
        $script:ownedPresentationPath=$null
        Invoke-Expression $stageDefinition[0].Extent.Text
        Invoke-Expression $comDefinition[0].Extent.Text
        $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
        $failureCaught=$false
        try { Invoke-MixedEditCom 'pure.failure' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
        if(-not $failureCaught -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'COM failure latch did not engage' }
        $script:unexpectedCall=$false
        try { Invoke-MixedEditCom 'pure.forbidden-followup' { $script:unexpectedCall=$true } } catch { }
        if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }
        [ordered]@{passed=$true;officeOrComCalls=0;embedFontsArgument=0;tolerancePoints=0.02;saveAsArgumentCount=3} | ConvertTo-Json -Depth 4
    } finally {
        if(Test-Path -LiteralPath $pureRoot) {
            $resolvedPureRoot=(Resolve-Path -LiteralPath $pureRoot).Path
            $resolvedTempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
            if(-not $resolvedPureRoot.StartsWith($resolvedTempRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($resolvedPureRoot)).StartsWith('opf-mixed-edit-pure-',[StringComparison]::Ordinal)) { throw 'Refusing to remove an unexpected pure-regression path' }
            Remove-Item -LiteralPath $resolvedPureRoot -Recurse -Force
        }
    }
}

if($PureRegression) { Invoke-MixedEditPureRegression; return }
foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation),@('FontFixtureDirectory',$FontFixtureDirectory))) {
    if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required unless -PureRegression is selected" }
}

function Get-MixedEditExpectations {
    $continuation='continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. '
    $originalRuns=@(
        [ordered]@{start=1;length=5;text="Lead`t";size=18;bold=$false;italic=$false},
        [ordered]@{start=6;length=22;text='Large evidence phrase ';size=30;bold=$true;italic=$false},
        [ordered]@{start=28;length=154;text=$continuation;size=18;bold=$false;italic=$false},
        [ordered]@{start=182;length=20;text='Second large phrase ';size=30;bold=$false;italic=$false},
        [ordered]@{start=202;length=44;text='finishes the control with exact source runs.';size=18;bold=$false;italic=$false}
    )
    $editedRuns=@($originalRuns | ForEach-Object { $copy=[ordered]@{}; foreach($key in $_.Keys) { $copy[$key]=$_[$key] }; $copy })
    $editedRuns[4].text='finishes the control with saved source runs.'
    $probes=@(
        [ordered]@{position=4;text='d';purpose='before-tab'},
        [ordered]@{position=5;text="`t";purpose='tab'},
        [ordered]@{position=6;text='L';purpose='after-tab'},
        [ordered]@{position=78;text=' ';purpose='estimated-line-1-end-probe-only'},
        [ordered]@{position=79;text='t';purpose='estimated-line-2-start-probe-only'},
        [ordered]@{position=172;text=' ';purpose='estimated-line-2-end-probe-only'},
        [ordered]@{position=173;text='o';purpose='estimated-line-3-start-probe-only'}
    )
    $originalText=-join @($originalRuns | ForEach-Object { $_.text })
    $editedText=-join @($editedRuns | ForEach-Object { $_.text })
    return [ordered]@{
        tolerancePoints=0.02
        outerGeometryPt=[ordered]@{slideWidth=960;slideHeight=540;left=43.2;top=43.2;width=873.6;height=118.8;rowHeight=118.8;columnWidth=873.6}
        previewLineBreakLimit=[ordered]@{
            failsHarness=$false
            knownReadOnlyNativeIntervals=@(@(0,92),@(92,194),@(194,245))
            estimatedPreviewIntervals=@(@(0,78),@(78,172),@(172,245))
        }
        original=[ordered]@{text=$originalText;length=245;runs=$originalRuns;characterProbes=$probes}
        edited=[ordered]@{text=$editedText;length=245;runs=$editedRuns;characterProbes=$probes}
    }
}
function Read-MixedEditFontFixture([string]$FixtureRoot) {
    $generationPath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'generation.json')).Path
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not ($generation.registration.flags -is [int]) -or $generation.registration.flags -ne 0) { throw 'generation.registration.flags must be the JSON integer 0' }
    $licensePath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'LICENSE_FONT')).Path
    if((Get-MixedEditSha256 $licensePath) -cne $script:MixedEditLicenseSha256) { throw 'Font fixture LICENSE_FONT is not the reviewed Carlito license' }
    $fonts=@($generation.fonts)
    if($fonts.Count -ne 4) { throw 'generation.fonts must contain exactly four Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        $allowed=$script:MixedEditFontSha256.ContainsKey([string]$font.file)
        if(-not $allowed -or $seen.ContainsKey([string]$font.file)) { throw "Invalid or duplicate font fixture path: $($font.file)" }
        if(([string]$font.sha256) -cne $script:MixedEditFontSha256[[string]$font.file]) { throw "Font fixture hash is not pinned: $($font.file)" }
        $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $font.file)).Path
        if((Get-MixedEditSha256 $path) -cne $script:MixedEditFontSha256[[string]$font.file]) { throw "Font file hash differs from the pinned Carlito face: $($font.file)" }
        $seen[[string]$font.file]=$true
    }
    foreach($file in @($script:MixedEditFontSha256.Keys)) { if(-not $seen.ContainsKey($file)) { throw "Missing required font fixture: $file" } }
    return [ordered]@{generation=$generation;generationPath=$generationPath;licensePath=$licensePath;fontFiles=$fonts}
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    if((Get-MixedEditSha256 $inputPath) -cne $script:MixedEditSourceSha256) { throw 'InputPresentation is not the reviewed mixed-size source.pptx' }
    $fixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path
    $fixture=Read-MixedEditFontFixture $fixtureRoot
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'
    [void](New-Item -ItemType Directory -Path $snapshotRoot)
    [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts'))
    $verifierSnapshot=Join-Path $snapshotRoot 'native-mixed-edit.ps1'
    $processOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $fontHelperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-text-fonts.ps1')).Path
    $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot
    Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot
    Copy-Item -LiteralPath $fixture.generationPath -Destination (Join-Path $snapshotRoot 'generation.json')
    Copy-Item -LiteralPath $fixture.licensePath -Destination (Join-Path $snapshotRoot 'LICENSE_FONT')
    foreach($font in $fixture.fontFiles) {
        Copy-Item -LiteralPath (Join-Path $fixtureRoot $font.file) -Destination (Join-Path $snapshotRoot $font.file)
    }
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=$script:MixedEditSourceSha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-MixedEditSha256 $sourceSnapshot)}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-MixedEditSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-MixedEditSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-MixedEditSha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-MixedEditSha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-MixedEditSha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-MixedEditSha256 $fontHelperSnapshot);registrationFlags=0}
        expectations=(Get-MixedEditExpectations)
    }
    $request | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=Get-Content -LiteralPath (Join-Path $snapshotRoot 'generation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    . $processSnapshot
    . $fontHelperSnapshot
    $script:mixedEditWorkerResult=$null
    $parentFailure=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {
            $script:mixedEditWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @('-OutputDirectory',$outputRoot,'-InputPresentation',$sourceSnapshot,'-FontFixtureDirectory',$snapshotRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try { $lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { } }
    $registrations=@()
    $registrationPath=Join-Path $outputRoot 'font-registration.json'
    if(Test-Path -LiteralPath $registrationPath) { try { $registrations=Read-MixedEditRegistrations $registrationPath } catch { $parentFailure="Unreadable font-registration.json: $($_.Exception.Message)" } }
    $fontCleanupConfirmed=($registrations.Count -eq 4 -and @($registrations | Where-Object { -not $_.removed -or $_.added -lt 1 }).Count -eq 0)
    $result=$script:mixedEditWorkerResult
    $timedOut=($null -ne $result -and [bool]$result.timedOut)
    if($timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) {
        try { Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json') } catch { $parentFailure="Could not preserve timeout report snapshot: $($_.Exception.Message)" }
    }
    $officeLifecycleComplete=($null -ne $result -and -not $timedOut -and [int]$result.exitCode -eq 0 -and $null -ne $lastDurable -and $lastDurable.stage -ceq 'worker.complete' -and $lastDurable.status -ceq 'success' -and [bool]$lastDurable.cleanupConfirmed)
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        timedOut=$timedOut
        exitCode=$(if($null -eq $result){$null}else{$result.exitCode})
        officeLifecycleComplete=$officeLifecycleComplete
        officeCleanupConfirmed=$(if($timedOut){$false}elseif($null -ne $lastDurable){[bool]$lastDurable.cleanupConfirmed}else{$false})
        fontCleanupConfirmed=$fontCleanupConfirmed
        metricsGatePassed=$null
        metricsOwnedBy='test/native-mixed-edit-audit.mjs'
        tolerancePoints=0.02
        lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage})
        parentError=$parentFailure
    }
    $terminal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ } }
    if(-not [string]::IsNullOrEmpty([string]$parentFailure) -or $null -eq $result -or $timedOut -or $result.exitCode -ne 0 -or -not $officeLifecycleComplete -or -not $fontCleanupConfirmed) {
        throw 'Native mixed-size edit failed, timed out, or did not confirm the owned Office and font lifecycle. Preserve the attempt and inspect supervisor.json. No retry was started.'
    }
    Write-Output 'Native mixed-size edit lifecycle completed. Run: node test/native-mixed-edit-audit.mjs <OutputDirectory>'
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$savedPath=Join-Path $root 'native-mixed-edit.pptx'
$script:stageFile=Join-Path $root 'stages.jsonl'
$script:progressFile=Join-Path $root 'progress.json'
$reportFile=Join-Path $root 'report.json'
$originalPng=Join-Path $root 'original.png'
$editedPng=Join-Path $root 'edited.png'
$reopenedPng=Join-Path $root 'reopened.png'
foreach($reserved in @($script:stageFile,$script:progressFile,$reportFile,$savedPath,$originalPng,$editedPng,$reopenedPng)) {
    if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
}
if((Get-MixedEditSha256 $sourceSnapshot) -cne $script:MixedEditSourceSha256) { throw 'Presentation snapshot hash differs from the reviewed mixed-size source' }
if((Get-MixedEditSha256 $PSCommandPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }

$script:sequence=0
$script:lastStage='worker.initialize'
$script:lastStatus='begin'
$script:cleanupConfirmed=$true
$script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null
$script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1
    kind='native-mixed-edit'
    source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-MixedEditSha256 $sourceSnapshot);unchanged=$null;snapshotUnchanged=$null}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    original=[ordered]@{observation=$null;raster=[ordered]@{path=$originalPng;sha256=$null}}
    edited=[ordered]@{observation=$null;raster=[ordered]@{path=$editedPng;sha256=$null}}
    reopened=[ordered]@{sha256=$null;observation=$null;raster=[ordered]@{path=$reopenedPng;sha256=$null}}
    requested=$request.expectations
    metrics=[ordered]@{evaluatedBy='test/native-mixed-edit-audit.mjs';gatePassed=$null;tolerancePoints=0.02;previewLineBreakLimitFailsHarness=$false}
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null}
    cleanupConfirmed=$script:cleanupConfirmed
    officeOperationsStopped=$script:officeOperationsStopped
    lastStage=$script:lastStage
    lastStatus=$script:lastStatus
    error=$null
    scope='Open one owned mixed-size table snapshot, replace the final run exact->saved at the same length, save with EmbedFonts explicitly false, reopen that exact path read-only, and record content, style, outer geometry, and native line intervals.'
    limitations=@(
        'The known read-only preview intervals [0,78), [78,172), [172,245) are a recorded limit. They are not a content or 0.02pt geometry failure.',
        'Native font properties do not identify which physical TTF drew each glyph.',
        'Embedded-font fidelity is out of scope. SaveAs passes msoFalse explicitly and does not request font embedding.'
    )
}
function Write-MixedEditReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed
    $report.officeOperationsStopped=$script:officeOperationsStopped
    $report.lastStage=$script:lastStage
    $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}
function Write-MixedEditStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++
    $script:lastStage=$StageName
    $script:lastStatus=$Status
    $record=[ordered]@{
        sequence=$script:sequence
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        stage=$StageName
        status=$Status
        error=$ErrorMessage
        cleanupConfirmed=$script:cleanupConfirmed
        officeOperationsStopped=$script:officeOperationsStopped
        ownedPresentationPath=$script:ownedPresentationPath
    }
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Invoke-MixedEditCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-MixedEditStage $StageName 'begin'
    try { $value=& $Operation; Write-MixedEditStage $StageName 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-MixedEditStage $StageName 'error' $_.Exception.Message; throw }
}
function Assert-MixedEditPresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-MixedEditCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-MixedEditCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1; $index -le $count; $index++) {
        $candidate=Invoke-MixedEditCom "$Prefix.presentation-$index.get" { return ,$presentations.Item($index) }
        $actual=Invoke-MixedEditCom "$Prefix.presentation-$index.fullName.get" { $candidate.FullName }
        if($actual -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}
function Read-MixedEditRange($Range,[string]$Prefix,[bool]$IncludeFont) {
    $text=Invoke-MixedEditCom "$Prefix.text.get" { $Range.Text }
    $length=Invoke-MixedEditCom "$Prefix.length.get" { $Range.Length }
    $start=Invoke-MixedEditCom "$Prefix.start.get" { $Range.Start }
    $left=[double](Invoke-MixedEditCom "$Prefix.boundLeft.get" { $Range.BoundLeft })
    $top=[double](Invoke-MixedEditCom "$Prefix.boundTop.get" { $Range.BoundTop })
    $width=[double](Invoke-MixedEditCom "$Prefix.boundWidth.get" { $Range.BoundWidth })
    $height=[double](Invoke-MixedEditCom "$Prefix.boundHeight.get" { $Range.BoundHeight })
    $fontRecord=$null
    if($IncludeFont) {
        $font=Invoke-MixedEditCom "$Prefix.font.get" { return ,$Range.Font }
        $fontRecord=[ordered]@{
            name=(Invoke-MixedEditCom "$Prefix.font.name.get" { $font.Name })
            size=[double](Invoke-MixedEditCom "$Prefix.font.size.get" { $font.Size })
            bold=(Invoke-MixedEditCom "$Prefix.font.bold.get" { $font.Bold })
            italic=(Invoke-MixedEditCom "$Prefix.font.italic.get" { $font.Italic })
        }
    }
    return [ordered]@{text=$text;start=$start;length=$length;bounds=[ordered]@{left=$left;top=$top;width=$width;height=$height};font=$fontRecord}
}
function Read-MixedEditObservation($Presentation,$Expected,[string]$Phase) {
    $readOnly=Invoke-MixedEditCom "$Phase.presentation.readOnly.get" { $Presentation.ReadOnly }
    $slides=Invoke-MixedEditCom "$Phase.slides.get" { return ,$Presentation.Slides }
    $slideCount=Invoke-MixedEditCom "$Phase.slides.count.get" { $slides.Count }
    if([int]$slideCount -ne 1) { throw "$Phase expected one slide; observed $slideCount" }
    $slide=Invoke-MixedEditCom "$Phase.slide-1.get" { return ,$slides.Item(1) }
    $shapes=Invoke-MixedEditCom "$Phase.shapes.get" { return ,$slide.Shapes }
    $shapeCount=Invoke-MixedEditCom "$Phase.shapes.count.get" { $shapes.Count }
    if([int]$shapeCount -ne 1) { throw "$Phase expected one shape; observed $shapeCount" }
    $shape=Invoke-MixedEditCom "$Phase.shape-1.get" { return ,$shapes.Item(1) }
    $shapeName=Invoke-MixedEditCom "$Phase.shape.name.get" { $shape.Name }
    if($shapeName -cne 'OPF table 1') { throw "$Phase shape name is not OPF table 1: $shapeName" }
    $shapeRecord=[ordered]@{
        name=$shapeName
        type=(Invoke-MixedEditCom "$Phase.shape.type.get" { $shape.Type })
        hasTable=(Invoke-MixedEditCom "$Phase.shape.hasTable.get" { $shape.HasTable })
        geometry=[ordered]@{
            left=[double](Invoke-MixedEditCom "$Phase.shape.left.get" { $shape.Left })
            top=[double](Invoke-MixedEditCom "$Phase.shape.top.get" { $shape.Top })
            width=[double](Invoke-MixedEditCom "$Phase.shape.width.get" { $shape.Width })
            height=[double](Invoke-MixedEditCom "$Phase.shape.height.get" { $shape.Height })
        }
    }
    $table=Invoke-MixedEditCom "$Phase.table.get" { return ,$shape.Table }
    $rows=Invoke-MixedEditCom "$Phase.table.rows.get" { return ,$table.Rows }
    $row=Invoke-MixedEditCom "$Phase.table.row-1.get" { return ,$rows.Item(1) }
    $columns=Invoke-MixedEditCom "$Phase.table.columns.get" { return ,$table.Columns }
    $column=Invoke-MixedEditCom "$Phase.table.column-1.get" { return ,$columns.Item(1) }
    $cell=Invoke-MixedEditCom "$Phase.table.cell-1-1.get" { return ,$table.Cell(1,1) }
    $cellShape=Invoke-MixedEditCom "$Phase.cell.shape.get" { return ,$cell.Shape }
    $frame=Invoke-MixedEditCom "$Phase.cell.textFrame2.get" { return ,$cellShape.TextFrame2 }
    $range=Invoke-MixedEditCom "$Phase.cell.textRange2.get" { return ,$frame.TextRange }
    $whole=Read-MixedEditRange $range "$Phase.cell.whole" $true
    $runRecords=@()
    foreach($run in @($Expected.runs)) {
        $runRange=Invoke-MixedEditCom "$Phase.cell.run-$($run.start)-$($run.length).get" { return ,$range.Characters([int]$run.start,[int]$run.length) }
        $runRecords+=@(Read-MixedEditRange $runRange "$Phase.cell.run-$($run.start)-$($run.length)" $true)
    }
    $characters=@()
    foreach($probe in @($Expected.characterProbes)) {
        $characterRange=Invoke-MixedEditCom "$Phase.cell.character-$($probe.position).get" { return ,$range.Characters([int]$probe.position,1) }
        $record=Read-MixedEditRange $characterRange "$Phase.cell.character-$($probe.position)" $true
        $record.position=[int]$probe.position
        $record.purpose=[string]$probe.purpose
        $characters+=@($record)
    }
    $paragraphRanges=Invoke-MixedEditCom "$Phase.cell.paragraphs.get" { return ,$range.Paragraphs() }
    $paragraphCount=Invoke-MixedEditCom "$Phase.cell.paragraphs.count.get" { $paragraphRanges.Count }
    $legacyFrame=Invoke-MixedEditCom "$Phase.cell.textFrame.get" { return ,$cellShape.TextFrame }
    $ruler=Invoke-MixedEditCom "$Phase.cell.ruler.get" { return ,$legacyFrame.Ruler }
    $tabStops=Invoke-MixedEditCom "$Phase.cell.tabStops.get" { return ,$ruler.TabStops }
    $tabStopCount=Invoke-MixedEditCom "$Phase.cell.tabStops.count.get" { $tabStops.Count }
    $lineRanges=Invoke-MixedEditCom "$Phase.cell.lines.get" { return ,$range.Lines() }
    $lineCount=Invoke-MixedEditCom "$Phase.cell.lines.count.get" { $lineRanges.Count }
    $lineRecords=@()
    $boundedLineCount=[Math]::Min([int]$lineCount,8)
    for($lineIndex=1; $lineIndex -le $boundedLineCount; $lineIndex++) {
        $lineRange=Invoke-MixedEditCom "$Phase.cell.line-$lineIndex.get" { return ,$range.Lines($lineIndex,1) }
        $lineRecord=Read-MixedEditRange $lineRange "$Phase.cell.line-$lineIndex" $false
        $lineRecord.index=$lineIndex
        $lineRecords+=@($lineRecord)
    }
    $pageSetup=Invoke-MixedEditCom "$Phase.pageSetup.get" { return ,$Presentation.PageSetup }
    return [ordered]@{
        phase=$Phase
        readOnly=$readOnly
        slideCount=$slideCount
        shapeCount=$shapeCount
        slideWidth=[double](Invoke-MixedEditCom "$Phase.slideWidth.get" { $pageSetup.SlideWidth })
        slideHeight=[double](Invoke-MixedEditCom "$Phase.slideHeight.get" { $pageSetup.SlideHeight })
        shape=$shapeRecord
        table=[ordered]@{
            rowCount=(Invoke-MixedEditCom "$Phase.table.rows.count.get" { $rows.Count })
            columnCount=(Invoke-MixedEditCom "$Phase.table.columns.count.get" { $columns.Count })
            rowHeight=[double](Invoke-MixedEditCom "$Phase.table.rowHeight.get" { $row.Height })
            columnWidth=[double](Invoke-MixedEditCom "$Phase.table.columnWidth.get" { $column.Width })
        }
        cell=[ordered]@{
            geometry=[ordered]@{
                left=[double](Invoke-MixedEditCom "$Phase.cell.left.get" { $cellShape.Left })
                top=[double](Invoke-MixedEditCom "$Phase.cell.top.get" { $cellShape.Top })
                width=[double](Invoke-MixedEditCom "$Phase.cell.width.get" { $cellShape.Width })
                height=[double](Invoke-MixedEditCom "$Phase.cell.height.get" { $cellShape.Height })
            }
            whole=$whole
            runs=$runRecords
            characters=$characters
            paragraph=[ordered]@{count=$paragraphCount;explicitTabStopCount=$tabStopCount}
            lines=[ordered]@{count=$lineCount;capturedCount=$boundedLineCount;records=$lineRecords}
        }
    }
}
function Close-OwnedMixedEdit([string]$Phase,[string]$ExpectedPath) {
    $actual=Invoke-MixedEditCom "$Phase.fullName.get" { $script:presentation.FullName }
    if($actual -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact saved path is not owned: $actual" }
    Invoke-MixedEditCom "$Phase.close" { $script:presentation.Close() }
    $script:presentation=$null
    $script:ownedPresentationPath=$null
    $script:cleanupConfirmed=$true
    Write-MixedEditStage "$Phase.cleanup" 'success'
}

Write-MixedEditReport
Write-MixedEditStage 'worker.initialize' 'success'
try {
    $app=Invoke-MixedEditCom 'application.create' { return ,(New-Object -ComObject PowerPoint.Application) }
    $officeVersion=Invoke-MixedEditCom 'application.version.get' { $app.Version }
    $officeDirectory=Invoke-MixedEditCom 'application.path.get' { $app.Path }
    $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion
    $report.environment.powerPointExecutable=$officeExecutable
    $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion
    $report.environment.powerPointExecutableSha256=Get-MixedEditSha256 $officeExecutable
    Write-MixedEditReport
    Assert-MixedEditPresentationNotOpen $app $sourceSnapshot 'input.preflight'
    Assert-MixedEditPresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$sourceSnapshot
    Write-MixedEditReport
    $presentations=Invoke-MixedEditCom 'input.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-MixedEditCom 'input.presentation.open' { return ,$presentations.Open($sourceSnapshot,0,0,(-1)) }
    $report.original.observation=Read-MixedEditObservation $script:presentation $request.expectations.original 'original'
    Write-MixedEditReport
    $slides=Invoke-MixedEditCom 'original.export.slides.get' { return ,$script:presentation.Slides }
    $slide=Invoke-MixedEditCom 'original.export.slide-1.get' { return ,$slides.Item(1) }
    Invoke-MixedEditCom 'original.export.png' { $slide.Export($originalPng,'PNG',1280,720) }
    $report.original.raster.sha256=Get-MixedEditSha256 $originalPng
    Write-MixedEditReport
    $slides=Invoke-MixedEditCom 'edit.slides.get' { return ,$script:presentation.Slides }
    $slide=Invoke-MixedEditCom 'edit.slide-1.get' { return ,$slides.Item(1) }
    $shapes=Invoke-MixedEditCom 'edit.shapes.get' { return ,$slide.Shapes }
    $shape=Invoke-MixedEditCom 'edit.shape-1.get' { return ,$shapes.Item(1) }
    $table=Invoke-MixedEditCom 'edit.table.get' { return ,$shape.Table }
    $cell=Invoke-MixedEditCom 'edit.cell.get' { return ,$table.Cell(1,1) }
    $cellShape=Invoke-MixedEditCom 'edit.cell.shape.get' { return ,$cell.Shape }
    $frame=Invoke-MixedEditCom 'edit.cell.textFrame2.get' { return ,$cellShape.TextFrame2 }
    $range=Invoke-MixedEditCom 'edit.cell.textRange2.get' { return ,$frame.TextRange }
    $runRange=Invoke-MixedEditCom 'edit.run-202-44.get' { return ,$range.Characters(202,44) }
    Invoke-MixedEditCom 'edit.run-202-44.text.set' { $runRange.Text='finishes the control with saved source runs.' }
    $runFont=Invoke-MixedEditCom 'edit.run-202-44.font.get' { return ,$runRange.Font }
    Invoke-MixedEditCom 'edit.run-202-44.font.name.set' { $runFont.Name='Carlito' }
    Invoke-MixedEditCom 'edit.run-202-44.font.size.set' { $runFont.Size=18 }
    Invoke-MixedEditCom 'edit.run-202-44.font.bold.set' { $runFont.Bold=0 }
    Invoke-MixedEditCom 'edit.run-202-44.font.italic.set' { $runFont.Italic=0 }
    $report.edited.observation=Read-MixedEditObservation $script:presentation $request.expectations.edited 'edited'
    Write-MixedEditReport
    $slides=Invoke-MixedEditCom 'edited.export.slides.get' { return ,$script:presentation.Slides }
    $slide=Invoke-MixedEditCom 'edited.export.slide-1.get' { return ,$slides.Item(1) }
    Invoke-MixedEditCom 'edited.export.png' { $slide.Export($editedPng,'PNG',1280,720) }
    $report.edited.raster.sha256=Get-MixedEditSha256 $editedPng
    Write-MixedEditReport
    Invoke-MixedEditCom 'edited.presentation.saveAs-owned-copy' { $script:presentation.SaveAs($savedPath,24,0) }
    $script:ownedPresentationPath=$savedPath
    Write-MixedEditReport
    Close-OwnedMixedEdit 'edited.presentation' $savedPath
    $report.saved.sha256=Get-MixedEditSha256 $savedPath
    Write-MixedEditReport
    Assert-MixedEditPresentationNotOpen $app $savedPath 'reopen.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$savedPath
    Write-MixedEditReport
    $presentations=Invoke-MixedEditCom 'reopen.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-MixedEditCom 'reopen.presentation.open-readonly' { return ,$presentations.Open($savedPath,(-1),0,(-1)) }
    $reopenedFullName=Invoke-MixedEditCom 'reopen.presentation.fullName.get' { $script:presentation.FullName }
    if($reopenedFullName -ine $savedPath) { throw "Reopened presentation path differs from exact saved path: $reopenedFullName" }
    $report.reopened.observation=Read-MixedEditObservation $script:presentation $request.expectations.edited 'reopened'
    Write-MixedEditReport
    $slides=Invoke-MixedEditCom 'reopened.export.slides.get' { return ,$script:presentation.Slides }
    $slide=Invoke-MixedEditCom 'reopened.export.slide-1.get' { return ,$slides.Item(1) }
    Invoke-MixedEditCom 'reopened.export.png' { $slide.Export($reopenedPng,'PNG',1280,720) }
    $report.reopened.raster.sha256=Get-MixedEditSha256 $reopenedPng
    Write-MixedEditReport
    Close-OwnedMixedEdit 'reopened.presentation' $savedPath
    $report.reopened.sha256=Get-MixedEditSha256 $savedPath
    $report.source.unchanged=((Get-MixedEditSha256 $request.source.path) -ceq $script:MixedEditSourceSha256)
    $report.source.snapshotUnchanged=((Get-MixedEditSha256 $sourceSnapshot) -ceq $script:MixedEditSourceSha256)
    Write-MixedEditStage 'worker.complete' 'success'
    Write-MixedEditReport
    Write-Output 'Native mixed-size edit completed; post-close content and 0.02pt gates belong to native-mixed-edit-audit.mjs.'
} catch {
    $report.error=$_.Exception.Message
    if($script:officeOperationsStopped -or $null -ne $script:presentation) { $script:cleanupConfirmed=$false }
    Write-MixedEditStage 'worker.failure' 'error' $_.Exception.Message
    Write-MixedEditReport
    throw
}
