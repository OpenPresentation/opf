param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$FontFixtureDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

function Get-FontEmbedSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Read-FontEmbedRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }

function Test-FontEmbedSaveAsPathArgument($Argument) {
    return ($Argument -is [System.Management.Automation.Language.VariableExpressionAst]) -and ($Argument.VariablePath.UserPath -ceq 'savedPath')
}
function Get-FontEmbedNumericLiteralValue($Argument) {
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
function Test-FontEmbedSaveAsNumericArgument($Argument,[int]$Expected) {
    $value=Get-FontEmbedNumericLiteralValue $Argument
    return ($null -ne $value) -and ($value -eq $Expected)
}
function Get-FontEmbedOwnedSaveAsEmbedArgument($Invoke) {
    if(-not ($Invoke.Member -is [System.Management.Automation.Language.StringConstantExpressionAst]) -or $Invoke.Member.Value -cne 'SaveAs') { return $null }
    $arguments=@($Invoke.Arguments)
    if($arguments.Count -ne 3) { return $null }
    if(-not (Test-FontEmbedSaveAsPathArgument $arguments[0])) { return $null }
    if(-not (Test-FontEmbedSaveAsNumericArgument $arguments[1] 24)) { return $null }
    $embed=Get-FontEmbedNumericLiteralValue $arguments[2]
    if($null -eq $embed -or ($embed -ne 0 -and $embed -ne (-1))) { return $null }
    return $embed
}
function Assert-FontEmbedVerifierAst([string]$Path) {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        $member=$invoke.Member
        if($member -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $member.Value -ceq 'Quit') { throw 'Embed harness must not invoke .Quit() on an Office application' }
    }
    $embedOn=0; $embedOff=0
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        $embedArgument=Get-FontEmbedOwnedSaveAsEmbedArgument $invoke
        if($null -eq $embedArgument) { continue }
        if($embedArgument -eq (-1)) { $embedOn++ } elseif($embedArgument -eq 0) { $embedOff++ }
    }
    if($embedOff -gt 0) { throw 'Embed harness must not call SaveAs with EmbedFonts 0' }
    if($embedOn -ne 1) { throw 'Embed harness must call SaveAs with EmbedFonts -1 (msoTrue) exactly once on $savedPath' }
    return $ast
}
function Invoke-FontEmbedPureRegression {
    $ast=Assert-FontEmbedVerifierAst $PSCommandPath
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
    $stageDefinition=@($definitions | Where-Object {$_.Name -ceq 'Write-FontEmbedStage'})
    $comDefinition=@($definitions | Where-Object {$_.Name -ceq 'Invoke-FontEmbedCom'})
    if($stageDefinition.Count -ne 1) { throw 'Expected exactly one Write-FontEmbedStage definition' }
    if($comDefinition.Count -ne 1) { throw 'Expected exactly one Invoke-FontEmbedCom definition' }
    $pureRoot=Join-Path ([IO.Path]::GetTempPath()) ('opf-font-embed-pure-' + [Guid]::NewGuid().ToString('n'))
    [void](New-Item -ItemType Directory -Path $pureRoot)
    try {
        $script:stageFile=Join-Path $pureRoot 'stages.jsonl'
        $script:progressFile=Join-Path $pureRoot 'progress.json'
        $script:sequence=0
        Invoke-Expression $stageDefinition[0].Extent.Text
        Invoke-Expression $comDefinition[0].Extent.Text
        $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
        $failureCaught=$false
        try { Invoke-FontEmbedCom 'pure.failure' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
        if(-not $failureCaught -or -not $script:officeOperationsStopped) { throw 'COM failure latch did not engage' }
        $script:unexpectedCall=$false
        try { Invoke-FontEmbedCom 'pure.forbidden-followup' { $script:unexpectedCall=$true } } catch { }
        if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }
        [ordered]@{passed=$true;officeOrComCalls=0;embedSaveArgument=(-1);noEmbedFontsZero=$true} | ConvertTo-Json -Depth 4
    } finally {
        if(Test-Path -LiteralPath $pureRoot) { Remove-Item -LiteralPath $pureRoot -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

if($PureRegression) { Invoke-FontEmbedPureRegression; return }
foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation),@('FontFixtureDirectory',$FontFixtureDirectory))) {
    if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required unless -PureRegression is selected" }
}

function Assert-FontEmbedHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Read-FontEmbedGeneration([string]$FixtureRoot,[string]$ExpectedSource) {
    $generationPath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'generation.json')).Path
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($generation.kind -cne 'native-font-edit-fixture') { throw 'generation.kind must be native-font-edit-fixture' }
    if($null -eq $generation.source -or $generation.source.file -cne 'source.pptx') { throw 'generation.source.file must be source.pptx' }
    Assert-FontEmbedHash ([string]$generation.source.sha256) 'generation.source.sha256'
    $source=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'source.pptx')).Path
    if($source -ine $ExpectedSource) { throw 'InputPresentation must be the fixture source.pptx' }
    if((Get-FontEmbedSha256 $source) -cne $generation.source.sha256) { throw 'Fixture source.pptx hash differs from generation.json' }
    $allowed=@('fonts/Carlito-400-normal.ttf','fonts/Carlito-400-italic.ttf','fonts/Carlito-700-normal.ttf','fonts/Carlito-700-italic.ttf')
    $fonts=@($generation.fonts); if($fonts.Count -ne 4) { throw 'generation.fonts must contain exactly four Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        if($allowed -cnotcontains $font.file -or $seen.ContainsKey([string]$font.file)) { throw "Invalid or duplicate generation font path: $($font.file)" }
        Assert-FontEmbedHash ([string]$font.sha256) "generation font $($font.file) sha256"
        $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $font.file)).Path
        if((Get-FontEmbedSha256 $path) -cne $font.sha256) { throw "Fixture font hash differs from generation.json: $($font.file)" }
        $seen[[string]$font.file]=$true
    }
    foreach($file in $allowed) { if(-not $seen.ContainsKey($file)) { throw "Missing required fixture font: $file" } }
    if($generation.registration.flags -ne 0) { throw 'generation.registration.flags must be 0' }
    return ,([ordered]@{generation=$generation;generationPath=$generationPath;sourcePath=$source;fontFiles=$fonts})
}

function Set-FontEmbedRange($Range,[string]$RequestedText,[string]$RequestedFamily,[double]$RequestedSize,[bool]$RequestedBold,[bool]$RequestedItalic,$RequestedRuns,[string]$Prefix) {
    Invoke-FontEmbedCom "$Prefix.text.set" {$Range.Text=$RequestedText}
    $wholeFont=Invoke-FontEmbedCom "$Prefix.font.get" {return ,$Range.Font}
    Invoke-FontEmbedCom "$Prefix.font.name.set" {$wholeFont.Name=$RequestedFamily}; Invoke-FontEmbedCom "$Prefix.font.size.set" {$wholeFont.Size=$RequestedSize}
    Invoke-FontEmbedCom "$Prefix.font.bold.set" {$wholeFont.Bold=$(if($RequestedBold){-1}else{0})}; Invoke-FontEmbedCom "$Prefix.font.italic.set" {$wholeFont.Italic=$(if($RequestedItalic){-1}else{0})}
    foreach($run in @($RequestedRuns)) {
        $runRange=Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).get" {return ,$Range.Characters([int]$run.start,[int]$run.length)}
        $runFont=Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.get" {return ,$runRange.Font}
        Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.name.set" {$runFont.Name=$RequestedFamily}; Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.size.set" {$runFont.Size=[double]$run.size}
        Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.bold.set" {$runFont.Bold=$(if($run.bold){-1}else{0})}; Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.italic.set" {$runFont.Italic=$(if($run.italic){-1}else{0})}
    }
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $fixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path
    $fixture=Read-FontEmbedGeneration $fixtureRoot $inputPath
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts'))
    $verifierSnapshot=Join-Path $snapshotRoot 'native-font-embed.ps1'
    $processOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path; $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $fontHelperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-text-fonts.ps1')).Path; $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'; $generationSnapshot=Join-Path $snapshotRoot 'generation.json'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot
    Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot
    Copy-Item -LiteralPath $fixture.generationPath -Destination $generationSnapshot
    Copy-Item -LiteralPath (Join-Path $fixtureRoot 'LICENSE_FONT') -Destination (Join-Path $snapshotRoot 'LICENSE_FONT')
    $fontInputs=@()
    foreach($font in $fixture.fontFiles) {
        $external=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot $font.file)).Path; $snapshot=Join-Path $snapshotRoot $font.file
        Copy-Item -LiteralPath $external -Destination $snapshot
        $fontInputs+=@([ordered]@{file=$font.file;path=$external;sha256=$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-FontEmbedSha256 $snapshot)})
    }
    $expectations=[ordered]@{
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
        embedFonts=[ordered]@{saveFormat=24;saveArgument=(-1);meaning='Presentation.SaveAs third argument -1 (msoTrue) on the owned presentation only'}
    }
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=(Get-FontEmbedSha256 $inputPath);snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEmbedSha256 $sourceSnapshot)}
        fixture=[ordered]@{path=$fixtureRoot;generation=[ordered]@{path=$fixture.generationPath;sha256=(Get-FontEmbedSha256 $fixture.generationPath);snapshotPath=$generationSnapshot;snapshotSha256=(Get-FontEmbedSha256 $generationSnapshot)};fonts=$fontInputs}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-FontEmbedSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-FontEmbedSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-FontEmbedSha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-FontEmbedSha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-FontEmbedSha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-FontEmbedSha256 $fontHelperSnapshot);registrationFlags=0}
        expectations=$expectations
    }
    $request | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=Get-Content -LiteralPath $generationSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json
    . $processSnapshot; . $fontHelperSnapshot
    $script:fontEmbedWorkerResult=$null; $parentFailure=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {
            $script:fontEmbedWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @('-OutputDirectory',$outputRoot,'-InputPresentation',$sourceSnapshot,'-FontFixtureDirectory',$snapshotRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try {$lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json} catch {} }
    $registrations=@(); $registrationPath=Join-Path $outputRoot 'font-registration.json'
    if(Test-Path -LiteralPath $registrationPath) { try {$registrations=Read-FontEmbedRegistrations $registrationPath} catch {$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"} }
    $fontCleanupConfirmed=($registrations.Count -eq 4 -and @($registrations | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
    $result=$script:fontEmbedWorkerResult; $workerReport=$null; $workerReportPath=Join-Path $outputRoot 'report.json'
    if(Test-Path -LiteralPath $workerReportPath) { try {$workerReport=Get-Content -LiteralPath $workerReportPath -Raw -Encoding UTF8 | ConvertFrom-Json} catch {$parentFailure="Unreadable worker report: $($_.Exception.Message)"} }
    $timedOut=($null -ne $result -and [bool]$result.timedOut)
    $officeLifecycleComplete=($null -ne $result -and -not $timedOut -and [int]$result.exitCode -eq 0 -and $null -ne $lastDurable -and $lastDurable.stage -ceq 'worker.complete' -and $lastDurable.status -ceq 'success' -and [bool]$lastDurable.cleanupConfirmed)
    $embedSaveRecorded=($null -ne $workerReport -and $null -ne $workerReport.embedFonts -and [int]$workerReport.embedFonts.saveArgument -eq (-1))
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=$timedOut;exitCode=$(if($null -eq $result){$null}else{$result.exitCode})
        officeLifecycleComplete=$officeLifecycleComplete;embedSaveRecorded=$embedSaveRecorded;fontCleanupConfirmed=$fontCleanupConfirmed
        lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});parentError=$parentFailure
    }
    $terminal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_} }
    if(-not [string]::IsNullOrEmpty([string]$parentFailure) -or $null -eq $result -or $timedOut -or $result.exitCode -ne 0 -or -not $officeLifecycleComplete -or -not $fontCleanupConfirmed -or -not $embedSaveRecorded) {
        throw 'Native font embed failed, timed out, or did not confirm the owned Office/font lifecycle and embed save argument; preserve the attempt and inspect supervisor.json. No retry was started.'
    }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$savedPath=Join-Path $root 'native-font-embed.pptx'
$script:stageFile=Join-Path $root 'stages.jsonl'; $script:progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'
if(Test-Path -LiteralPath $savedPath) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
if((Get-FontEmbedSha256 $PSCommandPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1;kind='native-font-embed'
    source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEmbedSha256 $sourceSnapshot)}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    embedFonts=[ordered]@{saveFormat=24;saveArgument=-1;stage='edited.presentation.saveAs-owned-copy-embed-fonts';completed=$false}
    opcFontParts=$null
    requested=$request.expectations
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='Open one owned Gate E fixture snapshot, apply the same Carlito edit spans, save with EmbedFonts -1 on that presentation only, and record filesystem evidence for offline OPC font-part audit. COM Font.Name does not prove which TTF drew each glyph.'
    limitations=@('Native font properties do not identify the physical file used for every glyph.','This control does not replace Gate E geometry persistence or browser/native pixel checks.','Offline audit hashes ppt/fonts package parts; obfuscated bytes may not match fixture TTF SHA-256.')
}
function Write-FontEmbedReport { $report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus; $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportFile -Encoding UTF8 }
function Write-FontEmbedStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$StageName; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$StageName;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Invoke-FontEmbedCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-FontEmbedStage $StageName 'begin'
    try {$value=& $Operation; Write-FontEmbedStage $StageName 'success'; return ,$value}
    catch {$script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-FontEmbedStage $StageName 'error' $_.Exception.Message; throw}
}
function Assert-FontEmbedPresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-FontEmbedCom "$Prefix.presentations.get" {return ,$Application.Presentations}; $count=Invoke-FontEmbedCom "$Prefix.presentations.count.get" {$presentations.Count}
    for($index=1;$index -le $count;$index++) { $candidate=Invoke-FontEmbedCom "$Prefix.presentation-$index.get" {return ,$presentations.Item($index)}; $actual=Invoke-FontEmbedCom "$Prefix.presentation-$index.fullName.get" {$candidate.FullName}; if($actual -ieq $Path) {throw "Presentation is already open, so ownership cannot be established: $Path"} }
}
function Close-OwnedFontEmbed([string]$Phase,[string]$ExpectedPath) {
    $actual=Invoke-FontEmbedCom "$Phase.fullName.get" {$script:presentation.FullName}
    if($actual -ine $ExpectedPath){throw "Refusing to close a presentation whose exact saved path is not owned: $actual"}
    Invoke-FontEmbedCom "$Phase.close" {$script:presentation.Close()}; $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; Write-FontEmbedStage "$Phase.cleanup" 'success'
}

Write-FontEmbedReport; Write-FontEmbedStage 'worker.initialize' 'success'
try {
    $app=Invoke-FontEmbedCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}
    $report.environment.powerPointVersion=Invoke-FontEmbedCom 'application.version.get' {$app.Version}; Write-FontEmbedReport
    Assert-FontEmbedPresentationNotOpen $app $sourceSnapshot 'input.preflight'; Assert-FontEmbedPresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-FontEmbedReport
    $presentations=Invoke-FontEmbedCom 'input.presentations.get' {return ,$app.Presentations}
    $script:presentation=Invoke-FontEmbedCom 'input.presentation.open' {return ,$presentations.Open($sourceSnapshot,0,0,(-1))}
    $slides=Invoke-FontEmbedCom 'edit.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEmbedCom 'edit.slide-1.get' {return ,$slides.Item(1)}; $shapes=Invoke-FontEmbedCom 'edit.shapes.get' {return ,$slide.Shapes}
    $titleShape=Invoke-FontEmbedCom 'edit.title.get' {return ,$shapes.Item('OPF heading slides.0.title line 0')}; $titleRange=Invoke-FontEmbedCom 'edit.title.textRange2.get' {return ,$titleShape.TextFrame2.TextRange}
    Set-FontEmbedRange $titleRange $request.expectations.title.text $request.expectations.title.family ([double]$request.expectations.title.size) ([bool]$request.expectations.title.bold) ([bool]$request.expectations.title.italic) @() 'edit.title'
    $bodyShape=Invoke-FontEmbedCom 'edit.body.get' {return ,$shapes.Item('OPF text slides.0.text line 0')}; $bodyRange=Invoke-FontEmbedCom 'edit.body.textRange2.get' {return ,$bodyShape.TextFrame2.TextRange}
    Set-FontEmbedRange $bodyRange $request.expectations.body.text $request.expectations.body.family ([double]$request.expectations.body.defaultSize) $false $false $request.expectations.body.runs 'edit.body'
    Invoke-FontEmbedCom 'edited.presentation.saveAs-owned-copy-embed-fonts' {$script:presentation.SaveAs($savedPath,24,(-1))}; $script:ownedPresentationPath=$savedPath; $report.embedFonts.completed=$true; Write-FontEmbedReport
    Close-OwnedFontEmbed 'edited.presentation' $savedPath; $report.saved.sha256=Get-FontEmbedSha256 $savedPath; Write-FontEmbedReport
    Write-FontEmbedStage 'worker.complete' 'success'; Write-FontEmbedReport
    Write-Output 'Native font embed completed; run native-font-embed-audit.mjs on this directory for OPC font-part hashes.'
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation){$script:cleanupConfirmed=$false}; Write-FontEmbedStage 'worker.failure' 'error' $_.Exception.Message; Write-FontEmbedReport; throw
}
