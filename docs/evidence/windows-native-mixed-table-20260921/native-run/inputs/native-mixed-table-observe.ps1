param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$TableFixtureDirectory,
    [string]$FontFixtureDirectory,
    [string]$ProcessHelperPath,
    [string]$FontHelperPath,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

$ExpectedSourceSha256='f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51'
$ExpectedFontGenerationSha256='8ac9743832e6c63bab58a999802979dcdcb91139599f502e90bc697141cf5422'
$ExpectedProcessHelperSha256='2a49f620b77fd998b791b835dd17bc64487f9539fa20935cbbba50ea5b7dc015'
$ExpectedFontHelperSha256='853d51c68d123c354748e948dbcb8c31aaa923dc6319734dfb393010e8cb3ba6'

function Get-MixedTableSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Assert-MixedTableHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Read-MixedTableRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }
function New-MixedTableInputCheck([string]$Path,[string]$Expected) {
    try { $actual=Get-MixedTableSha256 $Path; return ,([ordered]@{path=$Path;expected=$Expected;actual=$actual;matched=($actual -ceq $Expected);error=$null}) }
    catch { return ,([ordered]@{path=$Path;expected=$Expected;actual=$null;matched=$false;error=$_.Exception.Message}) }
}
function Get-MixedTableParentDecision($Result,$LastDurable,$WorkerReport) {
    $timedOut=($null -ne $Result -and [bool]$Result.timedOut)
    $officeLifecycleComplete=($null -ne $Result -and -not $timedOut -and [int]$Result.exitCode -eq 0 -and $null -ne $LastDurable -and $LastDurable.stage -ceq 'worker.complete' -and $LastDurable.status -ceq 'success' -and [bool]$LastDurable.cleanupConfirmed)
    $metricsGatePassed=($officeLifecycleComplete -and $null -ne $WorkerReport -and $null -ne $WorkerReport.metrics -and [bool]$WorkerReport.metrics.gatePassed)
    return ,([ordered]@{timedOut=$timedOut;officeLifecycleComplete=$officeLifecycleComplete;metricsGatePassed=$metricsGatePassed;officeCleanupConfirmed=($officeLifecycleComplete -and [bool]$LastDurable.cleanupConfirmed)})
}
function Assert-MixedTableParentSuccess($Decision,$Result,$ParentFailure,[bool]$FontCleanupConfirmed,[bool]$InputsUnchanged) {
    if(-not [string]::IsNullOrEmpty([string]$ParentFailure) -or $null -eq $Result -or $Decision.timedOut -or $Result.exitCode -ne 0 -or -not $Decision.officeLifecycleComplete -or -not $FontCleanupConfirmed -or -not $InputsUnchanged) { throw 'Native mixed-table observation failed, timed out, or did not confirm the owned Office/font/input lifecycle; preserve the attempt and inspect its supervisor record. No retry was started.' }
    if(-not $Decision.metricsGatePassed) { throw 'Native mixed-table observation completed the exact owned close, but its persisted post-close content/style gate failed; preserve the counterexample. No Office call or retry was started.' }
}
function Test-MixedTableFontCleanup($Registrations) {
    $items=@($Registrations)
    return ($items.Count -eq 4 -and @($items | Where-Object {-not $_.removed -or [int]$_.added -lt 1}).Count -eq 0)
}

function Write-MixedTableStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$StageName; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$StageName;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Invoke-MixedTableCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-MixedTableStage $StageName 'begin'
    try { $value=& $Operation; Write-MixedTableStage $StageName 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-MixedTableStage $StageName 'error' $_.Exception.Message; throw }
}
function Assert-MixedTablePresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-MixedTableCom "$Prefix.presentations.get" {return ,$Application.Presentations}
    $count=Invoke-MixedTableCom "$Prefix.presentations.count.get" {$presentations.Count}
    for($index=1;$index -le $count;$index++) {
        $candidate=Invoke-MixedTableCom "$Prefix.presentation-$index.get" {return ,$presentations.Item($index)}
        $actual=Invoke-MixedTableCom "$Prefix.presentation-$index.fullName.get" {$candidate.FullName}
        if($actual -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}
function Read-MixedTableRange($Range,[string]$Prefix,[bool]$IncludeFont) {
    $text=Invoke-MixedTableCom "$Prefix.text.get" {$Range.Text}
    $length=Invoke-MixedTableCom "$Prefix.length.get" {$Range.Length}
    $start=Invoke-MixedTableCom "$Prefix.start.get" {$Range.Start}
    $left=[double](Invoke-MixedTableCom "$Prefix.boundLeft.get" {$Range.BoundLeft})
    $top=[double](Invoke-MixedTableCom "$Prefix.boundTop.get" {$Range.BoundTop})
    $width=[double](Invoke-MixedTableCom "$Prefix.boundWidth.get" {$Range.BoundWidth})
    $height=[double](Invoke-MixedTableCom "$Prefix.boundHeight.get" {$Range.BoundHeight})
    $fontRecord=$null
    if($IncludeFont) {
        $font=Invoke-MixedTableCom "$Prefix.font.get" {return ,$Range.Font}
        $fontRecord=[ordered]@{
            name=(Invoke-MixedTableCom "$Prefix.font.name.get" {$font.Name})
            size=[double](Invoke-MixedTableCom "$Prefix.font.size.get" {$font.Size})
            bold=(Invoke-MixedTableCom "$Prefix.font.bold.get" {$font.Bold})
            italic=(Invoke-MixedTableCom "$Prefix.font.italic.get" {$font.Italic})
        }
    }
    return ,([ordered]@{text=$text;start=$start;length=$length;bounds=[ordered]@{left=$left;top=$top;width=$width;height=$height};font=$fontRecord})
}
function Read-MixedTableObservation($Presentation,$Expected,[string]$Phase) {
    $readOnly=Invoke-MixedTableCom "$Phase.presentation.readOnly.get" {$Presentation.ReadOnly}
    $slides=Invoke-MixedTableCom "$Phase.slides.get" {return ,$Presentation.Slides}
    $slideCount=Invoke-MixedTableCom "$Phase.slides.count.get" {$slides.Count}
    $slide=Invoke-MixedTableCom "$Phase.slide-1.get" {return ,$slides.Item(1)}
    $shapes=Invoke-MixedTableCom "$Phase.shapes.get" {return ,$slide.Shapes}
    $shapeCount=Invoke-MixedTableCom "$Phase.shapes.count.get" {$shapes.Count}
    $shape=Invoke-MixedTableCom "$Phase.shape-1.get" {return ,$shapes.Item(1)}
    $shapeRecord=[ordered]@{
        name=(Invoke-MixedTableCom "$Phase.shape.name.get" {$shape.Name})
        type=(Invoke-MixedTableCom "$Phase.shape.type.get" {$shape.Type})
        hasTable=(Invoke-MixedTableCom "$Phase.shape.hasTable.get" {$shape.HasTable})
        geometry=[ordered]@{
            left=[double](Invoke-MixedTableCom "$Phase.shape.left.get" {$shape.Left})
            top=[double](Invoke-MixedTableCom "$Phase.shape.top.get" {$shape.Top})
            width=[double](Invoke-MixedTableCom "$Phase.shape.width.get" {$shape.Width})
            height=[double](Invoke-MixedTableCom "$Phase.shape.height.get" {$shape.Height})
        }
    }
    $table=Invoke-MixedTableCom "$Phase.table.get" {return ,$shape.Table}
    $rows=Invoke-MixedTableCom "$Phase.table.rows.get" {return ,$table.Rows}
    $rowCount=Invoke-MixedTableCom "$Phase.table.rows.count.get" {$rows.Count}
    $row=Invoke-MixedTableCom "$Phase.table.row-1.get" {return ,$rows.Item(1)}
    $rowHeight=[double](Invoke-MixedTableCom "$Phase.table.row-1.height.get" {$row.Height})
    $columns=Invoke-MixedTableCom "$Phase.table.columns.get" {return ,$table.Columns}
    $columnCount=Invoke-MixedTableCom "$Phase.table.columns.count.get" {$columns.Count}
    $column=Invoke-MixedTableCom "$Phase.table.column-1.get" {return ,$columns.Item(1)}
    $columnWidth=[double](Invoke-MixedTableCom "$Phase.table.column-1.width.get" {$column.Width})
    $cell=Invoke-MixedTableCom "$Phase.table.cell-1-1.get" {return ,$table.Cell(1,1)}
    $cellShape=Invoke-MixedTableCom "$Phase.table.cell-1-1.shape.get" {return ,$cell.Shape}
    $cellGeometry=[ordered]@{
        left=[double](Invoke-MixedTableCom "$Phase.cell.shape.left.get" {$cellShape.Left})
        top=[double](Invoke-MixedTableCom "$Phase.cell.shape.top.get" {$cellShape.Top})
        width=[double](Invoke-MixedTableCom "$Phase.cell.shape.width.get" {$cellShape.Width})
        height=[double](Invoke-MixedTableCom "$Phase.cell.shape.height.get" {$cellShape.Height})
    }
    $frame=Invoke-MixedTableCom "$Phase.cell.textFrame2.get" {return ,$cellShape.TextFrame2}
    $frameRecord=[ordered]@{
        marginLeft=[double](Invoke-MixedTableCom "$Phase.cell.textFrame2.marginLeft.get" {$frame.MarginLeft})
        marginRight=[double](Invoke-MixedTableCom "$Phase.cell.textFrame2.marginRight.get" {$frame.MarginRight})
        marginTop=[double](Invoke-MixedTableCom "$Phase.cell.textFrame2.marginTop.get" {$frame.MarginTop})
        marginBottom=[double](Invoke-MixedTableCom "$Phase.cell.textFrame2.marginBottom.get" {$frame.MarginBottom})
        wordWrap=(Invoke-MixedTableCom "$Phase.cell.textFrame2.wordWrap.get" {$frame.WordWrap})
        autoSize=(Invoke-MixedTableCom "$Phase.cell.textFrame2.autoSize.get" {$frame.AutoSize})
        verticalAnchor=(Invoke-MixedTableCom "$Phase.cell.textFrame2.verticalAnchor.get" {$frame.VerticalAnchor})
    }
    $range=Invoke-MixedTableCom "$Phase.cell.textRange2.get" {return ,$frame.TextRange}
    $whole=Read-MixedTableRange $range "$Phase.cell.whole" $true
    $runs=@()
    foreach($run in @($Expected.runs)) {
        $runRange=Invoke-MixedTableCom "$Phase.cell.run-$($run.start)-$($run.length).get" {return ,$range.Characters([int]$run.start,[int]$run.length)}
        $runs+=@(Read-MixedTableRange $runRange "$Phase.cell.run-$($run.start)-$($run.length)" $true)
    }
    $characters=@()
    foreach($probe in @($Expected.characterProbes)) {
        $characterRange=Invoke-MixedTableCom "$Phase.cell.character-$($probe.position).get" {return ,$range.Characters([int]$probe.position,1)}
        $record=Read-MixedTableRange $characterRange "$Phase.cell.character-$($probe.position)" $true
        $record['position']=[int]$probe.position
        $record['purpose']=$probe.purpose
        $characters+=@($record)
    }
    $paragraphRanges=Invoke-MixedTableCom "$Phase.cell.paragraphs.get" {return ,$range.Paragraphs()}
    $paragraphCount=Invoke-MixedTableCom "$Phase.cell.paragraphs.count.get" {$paragraphRanges.Count}
    $paragraphFormat=Invoke-MixedTableCom "$Phase.cell.paragraphFormat.get" {return ,$range.ParagraphFormat}
    $spaceWithin=[double](Invoke-MixedTableCom "$Phase.cell.paragraphFormat.spaceWithin.get" {$paragraphFormat.SpaceWithin})
    $lineRuleWithin=Invoke-MixedTableCom "$Phase.cell.paragraphFormat.lineRuleWithin.get" {$paragraphFormat.LineRuleWithin}
    $spaceBefore=[double](Invoke-MixedTableCom "$Phase.cell.paragraphFormat.spaceBefore.get" {$paragraphFormat.SpaceBefore})
    $spaceAfter=[double](Invoke-MixedTableCom "$Phase.cell.paragraphFormat.spaceAfter.get" {$paragraphFormat.SpaceAfter})
    $legacyFrame=Invoke-MixedTableCom "$Phase.cell.textFrame.get" {return ,$cellShape.TextFrame}
    $ruler=Invoke-MixedTableCom "$Phase.cell.textFrame.ruler.get" {return ,$legacyFrame.Ruler}
    $tabStops=Invoke-MixedTableCom "$Phase.cell.textFrame.ruler.tabStops.get" {return ,$ruler.TabStops}
    $tabStopCount=Invoke-MixedTableCom "$Phase.cell.textFrame.ruler.tabStops.count.get" {$tabStops.Count}
    $defaultSpacing=[double](Invoke-MixedTableCom "$Phase.cell.textFrame.ruler.tabStops.defaultSpacing.get" {$tabStops.DefaultSpacing})
    $lineRanges=Invoke-MixedTableCom "$Phase.cell.lines.get" {return ,$range.Lines()}
    $lineCount=Invoke-MixedTableCom "$Phase.cell.lines.count.get" {$lineRanges.Count}
    $lineRecords=@()
    $boundedLineCount=[Math]::Min([int]$lineCount,8)
    for($lineIndex=1;$lineIndex -le $boundedLineCount;$lineIndex++) {
        $lineRange=Invoke-MixedTableCom "$Phase.cell.line-$lineIndex.get" {return ,$range.Lines($lineIndex,1)}
        $lineRecord=Read-MixedTableRange $lineRange "$Phase.cell.line-$lineIndex" $false
        $lineRecord['index']=$lineIndex
        $lineRecords+=@($lineRecord)
    }
    $pageSetup=Invoke-MixedTableCom "$Phase.pageSetup.get" {return ,$Presentation.PageSetup}
    $slideWidth=[double](Invoke-MixedTableCom "$Phase.slideWidth.get" {$pageSetup.SlideWidth})
    $slideHeight=[double](Invoke-MixedTableCom "$Phase.slideHeight.get" {$pageSetup.SlideHeight})
    return ,([ordered]@{
        phase=$Phase;readOnly=$readOnly;slideCount=$slideCount;shapeCount=$shapeCount;slideWidth=$slideWidth;slideHeight=$slideHeight
        shape=$shapeRecord;table=[ordered]@{rowCount=$rowCount;columnCount=$columnCount;rowHeight=$rowHeight;columnWidth=$columnWidth}
        cell=[ordered]@{geometry=$cellGeometry;frame=$frameRecord;whole=$whole;runs=$runs;characters=$characters;paragraph=[ordered]@{count=$paragraphCount;lineRuleWithin=$lineRuleWithin;spaceWithin=$spaceWithin;spaceBefore=$spaceBefore;spaceAfter=$spaceAfter;explicitTabStopCount=$tabStopCount;defaultTabSpacing=$defaultSpacing};lines=[ordered]@{count=$lineCount;capturedCount=$boundedLineCount;records=$lineRecords}}
    })
}
function Close-OwnedMixedTable([string]$ExpectedPath) {
    $actual=Invoke-MixedTableCom 'observation.presentation.fullName.get-before-close' {$script:presentation.FullName}
    if($actual -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact read-only snapshot path is not owned: $actual" }
    Invoke-MixedTableCom 'observation.presentation.close' {$script:presentation.Close()}
    $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true
    Write-MixedTableStage 'observation.presentation.cleanup' 'success'
}
function Get-MixedTableMetrics($Observation,$Expected) {
    $contentStyleFailures=@(); $geometryFailures=@(); $softWrapFailures=@()
    if([int]$Observation.slideCount -ne 1){$contentStyleFailures+='slide count is not one'}
    if([int]$Observation.shapeCount -ne 1){$contentStyleFailures+='shape count is not one'}
    if([int]$Observation.shape.hasTable -ne -1){$contentStyleFailures+='the only shape does not report HasTable=msoTrue'}
    if([int]$Observation.table.rowCount -ne 1 -or [int]$Observation.table.columnCount -ne 1){$contentStyleFailures+='table is not one row by one column'}
    if([int]$Observation.readOnly -ne -1){$contentStyleFailures+='presentation did not report read-only state'}
    if($Observation.cell.whole.text -cne $Expected.text -or [int]$Observation.cell.whole.start -ne 1 -or [int]$Observation.cell.whole.length -ne [int]$Expected.length){$contentStyleFailures+='whole cell text, start, or length changed'}
    $tabCount=@($Observation.cell.whole.text.ToCharArray() | Where-Object {[int][char]$_ -eq 9}).Count
    $hardBreakCount=@($Observation.cell.whole.text.ToCharArray() | Where-Object {[int][char]$_ -eq 10 -or [int][char]$_ -eq 13}).Count
    if($tabCount -ne 1){$contentStyleFailures+='whole cell text does not contain exactly one U+0009'}
    if($hardBreakCount -ne 0){$contentStyleFailures+='whole cell text contains an authored hard break'}
    if($Observation.cell.runs.Count -ne $Expected.runs.Count){$contentStyleFailures+='run count changed'}
    for($index=0;$index -lt [Math]::Min($Observation.cell.runs.Count,$Expected.runs.Count);$index++) {
        $actual=$Observation.cell.runs[$index]; $wanted=$Expected.runs[$index]
        if($actual.text -cne $wanted.text -or [int]$actual.start -ne [int]$wanted.start -or [int]$actual.length -ne [int]$wanted.length -or $actual.font.name -cne 'Carlito' -or [Math]::Abs([double]$actual.font.size-[double]$wanted.size) -gt 0.02 -or [int]$actual.font.bold -ne $(if($wanted.bold){-1}else{0}) -or [int]$actual.font.italic -ne 0) {$contentStyleFailures+="run $index content/start/style mismatch"}
    }
    if($Observation.cell.characters.Count -ne $Expected.characterProbes.Count){$contentStyleFailures+='bounded character probe count changed'}
    for($index=0;$index -lt [Math]::Min($Observation.cell.characters.Count,$Expected.characterProbes.Count);$index++) { if($Observation.cell.characters[$index].text -cne $Expected.characterProbes[$index].text -or [int]$Observation.cell.characters[$index].start -ne [int]$Expected.characterProbes[$index].position -or [int]$Observation.cell.characters[$index].length -ne 1) {$contentStyleFailures+="character probe $index text/start mismatch"} }
    if([int]$Observation.cell.paragraph.count -ne 1){$contentStyleFailures+='paragraph count is not one'}
    if([int]$Observation.cell.paragraph.explicitTabStopCount -ne 0){$contentStyleFailures+='explicit tab stop count is not zero'}
    $softWrapObserved=([int]$Observation.cell.lines.count -ge 2)
    if(-not $softWrapObserved){$softWrapFailures+='native TextRange2 did not report two or more soft-wrapped lines'}
    if([Math]::Abs([double]$Observation.slideWidth-960) -gt 0.02 -or [Math]::Abs([double]$Observation.slideHeight-540) -gt 0.02){$geometryFailures+='slide dimensions changed'}
    if([Math]::Abs([double]$Observation.table.rowHeight-118.8) -gt 0.02 -or [Math]::Abs([double]$Observation.table.columnWidth-873.6) -gt 0.02){$geometryFailures+='row height or column width changed'}
    $allFailures=@($contentStyleFailures)+@($geometryFailures)+@($softWrapFailures)
    return ,([ordered]@{contentAndStylePassed=($contentStyleFailures.Count -eq 0);contentAndStyleFailures=$contentStyleFailures;geometryPassed=($geometryFailures.Count -eq 0);geometryFailures=$geometryFailures;softWrapPassed=($softWrapFailures.Count -eq 0);softWrapFailures=$softWrapFailures;failures=$allFailures;tabCount=$tabCount;hardBreakCount=$hardBreakCount;softWrapObserved=$softWrapObserved;nativeLineCount=[int]$Observation.cell.lines.count;estimatedTraceProbePositions=@(78,79,172,173);gatePassed=($allFailures.Count -eq 0)})
}

function Invoke-MixedTablePureRegression {
    $tokens=$null; $parseErrors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    $script:sequence=0; $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:ownedPresentationPath=$null; $script:pureStages=@()
    function Write-MixedTableStage([string]$StageName,[string]$Status,[string]$ErrorMessage=$null) { $script:pureStages+=@([ordered]@{stage=$StageName;status=$Status;error=$ErrorMessage}) }
    $fake=[pscustomobject]@{Value=17;Reads=0}
    $value=Invoke-MixedTableCom 'selftest.value.get' {$fake.Reads++; $fake.Value}
    if($value -ne 17 -or $fake.Reads -ne 1 -or $script:pureStages[0].stage -cne 'selftest.value.get' -or $script:pureStages[1].status -cne 'success') { throw 'Actual COM wrapper pure success path changed' }
    $failed=$false; try { Invoke-MixedTableCom 'selftest.failure' {throw 'deliberate wrapper failure'} } catch {$failed=$true}
    $blocked=$false; try { Invoke-MixedTableCom 'selftest.blocked' {$fake.Reads++} } catch {$blocked=$_.Exception.Message -ceq 'Office operations already stopped after a COM failure'}
    if(-not $failed -or -not $blocked -or $fake.Reads -ne 1 -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'Actual COM wrapper did not latch and reject the post-failure operation' }
    $text="Lead`tLarge evidence phrase continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. Second large phrase finishes the control with exact source runs."
    $runs=@(
        [ordered]@{start=1;length=5;text="Lead`t";size=18;bold=$false;italic=$false},
        [ordered]@{start=6;length=22;text='Large evidence phrase ';size=30;bold=$true;italic=$false},
        [ordered]@{start=28;length=154;text='continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ';size=18;bold=$false;italic=$false},
        [ordered]@{start=182;length=20;text='Second large phrase ';size=30;bold=$false;italic=$false},
        [ordered]@{start=202;length=44;text='finishes the control with exact source runs.';size=18;bold=$false;italic=$false}
    )
    $probes=@(
        [ordered]@{position=4;text='d';purpose='before-tab'},[ordered]@{position=5;text="`t";purpose='tab'},[ordered]@{position=6;text='L';purpose='after-tab'},
        [ordered]@{position=78;text=' ';purpose='estimated-line-1-end'},[ordered]@{position=79;text='t';purpose='estimated-line-2-start'},
        [ordered]@{position=172;text=' ';purpose='estimated-line-2-end'},[ordered]@{position=173;text='o';purpose='estimated-line-3-start'}
    )
    function New-PureRange($Spec) { return ,([ordered]@{text=$Spec.text;start=$Spec.start;length=$Spec.length;bounds=[ordered]@{left=[double]10.100000381469727;top=[double]20.200000762939453;width=[double]30.299999237060547;height=[double]40.400001525878906};font=[ordered]@{name='Carlito';size=[double]$Spec.size;bold=$(if($Spec.bold){-1}else{0});italic=0}}) }
    $runRecords=@(); foreach($run in $runs){$runRecords+=@(New-PureRange $run)}
    $characterRecords=@(); foreach($probe in $probes){$characterRecords+=@([ordered]@{position=$probe.position;purpose=$probe.purpose;text=$probe.text;start=$probe.position;length=1;bounds=[ordered]@{left=[double]1;top=[double]2;width=[double]3;height=[double]4};font=[ordered]@{name='Carlito';size=[double]18;bold=0;italic=0}})}
    $observation=[ordered]@{readOnly=-1;slideCount=1;shapeCount=1;slideWidth=[double]960;slideHeight=[double]540;shape=[ordered]@{hasTable=-1};table=[ordered]@{rowCount=1;columnCount=1;rowHeight=[double]118.80000305175781;columnWidth=[double]873.5999755859375};cell=[ordered]@{whole=[ordered]@{text=$text;start=1;length=245};runs=$runRecords;characters=$characterRecords;paragraph=[ordered]@{count=1;explicitTabStopCount=0};lines=[ordered]@{count=3}}}
    $expected=[ordered]@{text=$text;length=245;runs=$runs;characterProbes=$probes}
    $positive=Get-MixedTableMetrics $observation $expected
    if(-not $positive.gatePassed -or -not $positive.softWrapObserved -or $positive.tabCount -ne 1 -or $positive.hardBreakCount -ne 0) { throw "Native-style OrderedDictionary positive metrics failed: $($positive | ConvertTo-Json -Depth 8 -Compress)" }
    $savedText=$observation.cell.whole.text; $observation.cell.whole.text=$savedText.Replace("`t",' '); $negativeTab=Get-MixedTableMetrics $observation $expected; $observation.cell.whole.text=$savedText
    $savedSize=$observation.cell.runs[1].font.size; $observation.cell.runs[1].font.size=18; $negativeStyle=Get-MixedTableMetrics $observation $expected; $observation.cell.runs[1].font.size=$savedSize
    $savedRunStart=$observation.cell.runs[1].start; $observation.cell.runs[1].start=7; $negativeRunStart=Get-MixedTableMetrics $observation $expected; $observation.cell.runs[1].start=$savedRunStart
    $savedCharacterStart=$observation.cell.characters[3].start; $observation.cell.characters[3].start=77; $negativeCharacterStart=Get-MixedTableMetrics $observation $expected; $observation.cell.characters[3].start=$savedCharacterStart
    $savedLines=$observation.cell.lines.count; $observation.cell.lines.count=1; $negativeWrap=Get-MixedTableMetrics $observation $expected; $observation.cell.lines.count=$savedLines
    if($negativeTab.gatePassed -or $negativeStyle.gatePassed -or $negativeRunStart.gatePassed -or $negativeCharacterStart.gatePassed -or $negativeWrap.gatePassed) { throw 'Metrics accepted a tab, style, run-start, character-start, or soft-wrap negative mutation' }
    $positiveDecision=Get-MixedTableParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$true}})
    $negativeDecision=Get-MixedTableParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$false}})
    $timeoutDecision=Get-MixedTableParentDecision ([pscustomobject]@{timedOut=$true;exitCode=$null}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{metrics=[pscustomobject]@{gatePassed=$true}})
    if(-not $positiveDecision.officeLifecycleComplete -or -not $positiveDecision.metricsGatePassed -or $negativeDecision.metricsGatePassed -or $timeoutDecision.officeLifecycleComplete -or $timeoutDecision.officeCleanupConfirmed) { throw 'Parent positive/negative/timeout decision regression failed' }
    Assert-MixedTableParentSuccess $positiveDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) $null $true $true
    $negativeRejected=$false; try {Assert-MixedTableParentSuccess $negativeDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) $null $true $true} catch {$negativeRejected=$_.Exception.Message -like 'Native mixed-table observation completed*'}
    $registrationRows=@(); foreach($index in 0..3){$registrationRows+=@([pscustomobject]@{added=1;removed=$true;index=$index})}
    if(-not (Test-MixedTableFontCleanup $registrationRows)) { throw 'Four successful owned font removals were not accepted' }
    $registrationRows[2].removed=$false
    if(Test-MixedTableFontCleanup $registrationRows) { throw 'Incomplete owned font removal was accepted' }
    $fontCleanupRejected=$false; try {Assert-MixedTableParentSuccess $positiveDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) $null $false $true} catch {$fontCleanupRejected=$_.Exception.Message -like 'Native mixed-table observation failed*'}
    if(-not $negativeRejected -or -not $fontCleanupRejected) { throw 'Parent success assertion accepted a false post-close metrics or font-cleanup gate' }
    [ordered]@{passed=$true;officeOrComCalls=0;wrapperSuccessPathPassed=$true;wrapperLatchPassed=$true;orderedDictionaryMetricsPassed=$true;negativeMutationsRejected=$true;parentGateLogicPassed=$true;fontCleanupLogicPassed=$true;expectedLength=$text.Length;runCount=$runs.Count;characterProbeCount=$probes.Count} | ConvertTo-Json -Depth 8
}

function Read-MixedTableFontFixture([string]$FixtureRoot) {
    $generationPath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'generation.json')).Path
    if((Get-MixedTableSha256 $generationPath) -cne $ExpectedFontGenerationSha256) { throw 'Font fixture generation.json is not the reviewed Carlito fixture' }
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($null -eq $generation.license -or $generation.license.file -cne 'LICENSE_FONT') { throw 'Font generation license contract changed' }
    Assert-MixedTableHash ([string]$generation.license.sha256) 'font generation license sha256'
    $licensePath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'LICENSE_FONT')).Path
    if((Get-MixedTableSha256 $licensePath) -cne $generation.license.sha256) { throw 'Font fixture license hash differs from generation.json' }
    $allowed=@('fonts/Carlito-400-normal.ttf','fonts/Carlito-400-italic.ttf','fonts/Carlito-700-normal.ttf','fonts/Carlito-700-italic.ttf')
    $fonts=@($generation.fonts); if($fonts.Count -ne 4) { throw 'Font generation must contain exactly four Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        if($allowed -cnotcontains $font.file -or $seen.ContainsKey([string]$font.file)){throw "Invalid or duplicate font fixture path: $($font.file)"}
        Assert-MixedTableHash ([string]$font.sha256) "font $($font.file) sha256"
        $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $font.file)).Path
        if((Get-MixedTableSha256 $path) -cne $font.sha256){throw "Font fixture hash differs from generation.json: $($font.file)"}
        $seen[[string]$font.file]=$true
    }
    foreach($file in $allowed){if(-not $seen.ContainsKey($file)){throw "Missing required font fixture: $file"}}
    if([int]$generation.registration.flags -ne 0){throw 'Font generation registration.flags must be 0 for external PowerPoint session visibility'}
    return ,([ordered]@{generation=$generation;generationPath=$generationPath;licensePath=$licensePath;fontFiles=$fonts})
}
function Read-MixedTableTableFixture([string]$FixtureRoot,[string]$ExpectedInput) {
    $files=[ordered]@{
        'source.pptx'='f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51'
        'source.json'='31488a3d51dd66d01b3a6ec3b5b79535d2681b3f41e5fbbb15a15b77f8a3fbe2'
        'inspection.json'='24b2c7ff107a664d06b9dedc0f46af5485e633e8a5a73d2a2e429e36bcf6baa5'
        'generation.json'='bdf456ca92722ed4981cefc7cc1c739c3df0f1776a8a5539c33b54ecf57f7fe6'
        'generate.mjs'='b403c37b0725c75ef5cbdd222b29a4f8c384e5069586f5f43c195d31a49703c1'
        'reimport.json'='abbd7cb0f46c12e98465c731246f8dfcc9f256e930a9eff36bd1d501a14889da'
        'report.md'='08b51ec794ee4e15ee1f8883a5851657999b3ae10307378043c0e471d338ed74'
    }
    $records=@()
    foreach($name in $files.Keys) { $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $name)).Path; if((Get-MixedTableSha256 $path) -cne $files[$name]){throw "Reviewed table fixture file changed: $name"}; $records+=@([ordered]@{file=$name;path=$path;sha256=$files[$name]}) }
    $sourcePath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'source.pptx')).Path
    if($sourcePath -ine $ExpectedInput){throw 'InputPresentation must be the reviewed mixed-table fixture source.pptx'}
    $source=Get-Content -LiteralPath (Join-Path $FixtureRoot 'source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $sourceRuns=@($source.slides[0].table.rows[0][0]); if($source.slides.Count -ne 1 -or $sourceRuns.Count -ne 5){throw 'Table source contract changed'}
    $text=[string]::Concat(@($sourceRuns | ForEach-Object {[string]$_.text}))
    if($text.Length -ne 245 -or @($text.ToCharArray() | Where-Object {[int][char]$_ -eq 9}).Count -ne 1 -or @($text.ToCharArray() | Where-Object {[int][char]$_ -eq 10 -or [int][char]$_ -eq 13}).Count -ne 0){throw 'Table source text length/tab/hard-break contract changed'}
    $inspection=Get-Content -LiteralPath (Join-Path $FixtureRoot 'inspection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not [bool]$inspection.validation.valid -or $inspection.pptx.nativeText -cne $text -or [int]$inspection.pptx.paragraphCount -ne 1 -or [int]$inspection.pptx.tabStopCount -ne 0){throw 'Reviewed table fixture inspection contract changed'}
    return ,([ordered]@{sourcePath=$sourcePath;files=$records;text=$text;sourceRuns=$sourceRuns;inspection=$inspection})
}

if($PureRegression) { Invoke-MixedTablePureRegression; return }
if([string]::IsNullOrWhiteSpace($OutputDirectory)){throw 'OutputDirectory is required'}

if(-not $Worker) {
    foreach($required in @(@('InputPresentation',$InputPresentation),@('TableFixtureDirectory',$TableFixtureDirectory),@('FontFixtureDirectory',$FontFixtureDirectory))) {if([string]::IsNullOrWhiteSpace([string]$required[1])){throw "$($required[0]) is required"}}
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path; if([IO.Path]::GetExtension($inputPath) -ine '.pptx'){throw 'InputPresentation must select one existing .pptx file'}
    $tableFixtureRoot=(Resolve-Path -LiteralPath $TableFixtureDirectory).Path; $tableFixture=Read-MixedTableTableFixture $tableFixtureRoot $inputPath
    $fontFixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path; $fontFixture=Read-MixedTableFontFixture $fontFixtureRoot
    if([string]::IsNullOrWhiteSpace($ProcessHelperPath)){$ProcessHelperPath=Join-Path (Split-Path -Parent $PSScriptRoot) 'sources\opf-pptx\test\native-process.ps1'}
    if([string]::IsNullOrWhiteSpace($FontHelperPath)){$FontHelperPath=Join-Path (Split-Path -Parent $PSScriptRoot) 'sources\opf-pptx\test\native-text-fonts.ps1'}
    $processOriginal=(Resolve-Path -LiteralPath $ProcessHelperPath).Path; $fontHelperOriginal=(Resolve-Path -LiteralPath $FontHelperPath).Path
    if((Get-MixedTableSha256 $processOriginal) -cne $ExpectedProcessHelperSha256){throw 'native-process.ps1 does not match the reviewed helper hash'}
    if((Get-MixedTableSha256 $fontHelperOriginal) -cne $ExpectedFontHelperSha256){throw 'native-text-fonts.ps1 does not match the reviewed helper hash'}
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory); if(Test-Path -LiteralPath $outputRoot){throw 'Preserve the prior attempt and select a fresh output directory'}
    [void](New-Item -ItemType Directory -Path $outputRoot); $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts')); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'table-fixture'))
    $verifierSnapshot=Join-Path $snapshotRoot 'native-mixed-table-observe.ps1'; $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'; $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot; Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot; Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    $tableInputs=@(); foreach($file in $tableFixture.files){$snapshot=Join-Path (Join-Path $snapshotRoot 'table-fixture') $file.file; Copy-Item -LiteralPath $file.path -Destination $snapshot; $tableInputs+=@([ordered]@{file=$file.file;path=$file.path;sha256=$file.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-MixedTableSha256 $snapshot)})}
    $sourceSnapshot=($tableInputs | Where-Object {$_.file -ceq 'source.pptx'}).snapshotPath
    $generationSnapshot=Join-Path $snapshotRoot 'generation.json'; $licenseSnapshot=Join-Path $snapshotRoot 'LICENSE_FONT'; Copy-Item -LiteralPath $fontFixture.generationPath -Destination $generationSnapshot; Copy-Item -LiteralPath $fontFixture.licensePath -Destination $licenseSnapshot
    $fontInputs=@(); foreach($font in $fontFixture.fontFiles){$external=(Resolve-Path -LiteralPath (Join-Path $fontFixtureRoot $font.file)).Path; $snapshot=Join-Path $snapshotRoot $font.file; Copy-Item -LiteralPath $external -Destination $snapshot; $fontInputs+=@([ordered]@{file=$font.file;path=$external;sha256=$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-MixedTableSha256 $snapshot)})}
    $runs=@(
        [ordered]@{start=1;length=5;text="Lead`t";size=18;bold=$false;italic=$false},[ordered]@{start=6;length=22;text='Large evidence phrase ';size=30;bold=$true;italic=$false},
        [ordered]@{start=28;length=154;text='continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ';size=18;bold=$false;italic=$false},
        [ordered]@{start=182;length=20;text='Second large phrase ';size=30;bold=$false;italic=$false},[ordered]@{start=202;length=44;text='finishes the control with exact source runs.';size=18;bold=$false;italic=$false}
    )
    $probes=@([ordered]@{position=4;text='d';purpose='before-tab'},[ordered]@{position=5;text="`t";purpose='tab'},[ordered]@{position=6;text='L';purpose='after-tab'},[ordered]@{position=78;text=' ';purpose='estimated-line-1-end-probe-only'},[ordered]@{position=79;text='t';purpose='estimated-line-2-start-probe-only'},[ordered]@{position=172;text=' ';purpose='estimated-line-2-end-probe-only'},[ordered]@{position=173;text='o';purpose='estimated-line-3-start-probe-only'})
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=$ExpectedSourceSha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-MixedTableSha256 $sourceSnapshot);fixturePath=$tableFixtureRoot;files=$tableInputs}
        fontFixture=[ordered]@{path=$fontFixtureRoot;generation=[ordered]@{path=$fontFixture.generationPath;sha256=(Get-MixedTableSha256 $fontFixture.generationPath);snapshotPath=$generationSnapshot;snapshotSha256=(Get-MixedTableSha256 $generationSnapshot)};license=[ordered]@{path=$fontFixture.licensePath;sha256=(Get-MixedTableSha256 $fontFixture.licensePath);snapshotPath=$licenseSnapshot;snapshotSha256=(Get-MixedTableSha256 $licenseSnapshot)};fonts=$fontInputs}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-MixedTableSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-MixedTableSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-MixedTableSha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-MixedTableSha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-MixedTableSha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-MixedTableSha256 $fontHelperSnapshot);registrationFlags=0}
        expectations=[ordered]@{text=$tableFixture.text;length=245;runs=$runs;characterProbes=$probes;estimatedLayoutTrace=[ordered]@{source='offline estimated trace; probe positions are not asserted native line boundaries';boundaries=@(78,172)}}
    }
    $request | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=Get-Content -LiteralPath $generationSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json; . $processSnapshot; . $fontHelperSnapshot
    $script:mixedTableWorkerResult=$null; $parentFailure=$null
    try { Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {$script:mixedTableWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @('-OutputDirectory',$outputRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds} } catch {$parentFailure=$_.Exception.Message}
    $lastDurable=$null; if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')){try{$lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json}catch{}}
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))){foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)){try{$lastDurable=$line | ConvertFrom-Json}catch{}}}
    $registrations=@(); $registrationPath=Join-Path $outputRoot 'font-registration.json'; if(Test-Path -LiteralPath $registrationPath){try{$registrations=Read-MixedTableRegistrations $registrationPath}catch{$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"}}
    $fontCleanupConfirmed=Test-MixedTableFontCleanup $registrations
    $inputChecks=@(); foreach($item in @($request.source.files)+@($request.fontFixture.fonts)+@($request.source,$request.fontFixture.generation,$request.fontFixture.license,$request.verifier,$request.processHelper,$request.fontHelper)){if($null -ne $item.path -and $null -ne $item.sha256){$inputChecks+=@((New-MixedTableInputCheck $item.path $item.sha256))}; if($null -ne $item.snapshotPath -and $null -ne $item.sha256){$inputChecks+=@((New-MixedTableInputCheck $item.snapshotPath $item.sha256))}}
    $inputsUnchanged=(@($inputChecks | Where-Object {-not $_.matched}).Count -eq 0)
    $result=$script:mixedTableWorkerResult; $workerReport=$null; $workerReportPath=Join-Path $outputRoot 'report.json'; if(Test-Path -LiteralPath $workerReportPath){try{$workerReport=Get-Content -LiteralPath $workerReportPath -Raw -Encoding UTF8 | ConvertFrom-Json}catch{$parentFailure="Unreadable worker report: $($_.Exception.Message)"}}
    $decision=Get-MixedTableParentDecision $result $lastDurable $workerReport; if($decision.timedOut -and (Test-Path -LiteralPath $workerReportPath)){try{Copy-Item -LiteralPath $workerReportPath -Destination (Join-Path $outputRoot 'report.worker.json')}catch{$parentFailure="Could not preserve timeout report snapshot: $($_.Exception.Message)"}}
    [ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=[bool]$decision.timedOut;exitCode=$(if($null -eq $result){$null}else{$result.exitCode});officeLifecycleComplete=[bool]$decision.officeLifecycleComplete;metricsGatePassed=[bool]$decision.metricsGatePassed;officeCleanupConfirmed=[bool]$decision.officeCleanupConfirmed;fontCleanupConfirmed=$fontCleanupConfirmed;inputsUnchanged=$inputsUnchanged;lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});lastDurableStatus=$(if($null -eq $lastDurable){$null}else{$lastDurable.status});parentError=$parentFailure;inputChecks=$inputChecks} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')){Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_}}
    Assert-MixedTableParentSuccess $decision $result $parentFailure $fontCleanupConfirmed $inputsUnchanged
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path; $request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path; $script:stageFile=Join-Path $root 'stages.jsonl'; $script:progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'; $pngPath=Join-Path $root 'native-observation.png'
foreach($reserved in @($script:stageFile,$script:progressFile,$reportFile,$pngPath)){if(Test-Path -LiteralPath $reserved){throw 'Worker evidence already exists; preserve this attempt and do not retry in it'}}
if((Get-MixedTableSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-MixedTableSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256){throw 'Verifier snapshot does not match the executing verifier'}
foreach($helper in @($request.processHelper,$request.fontHelper)){if((Get-MixedTableSha256 $helper.path) -cne $helper.sha256 -or (Get-MixedTableSha256 $helper.snapshotPath) -cne $helper.sha256){throw 'A helper or helper snapshot changed before the worker started'}}
if((Get-MixedTableSha256 $sourceSnapshot) -cne $ExpectedSourceSha256){throw 'Presentation snapshot hash differs from the reviewed source'}
foreach($item in @($request.source.files)+@($request.fontFixture.fonts)+@($request.fontFixture.generation,$request.fontFixture.license)){if((Get-MixedTableSha256 $item.path) -cne $item.sha256 -or (Get-MixedTableSha256 $item.snapshotPath) -cne $item.sha256){throw "Input or snapshot changed before worker start: $($item.path)"}}
$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{schemaVersion=1;source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-MixedTableSha256 $sourceSnapshot);unchanged=$null;snapshotUnchanged=$null};observation=$null;raster=[ordered]@{path=$pngPath;sha256=$null;width=1280;height=720};requested=$request.expectations;metrics=$null;inputs=[ordered]@{tableFixtureFiles=$request.source.files;fontFixture=$request.fontFixture;verifier=$request.verifier;processHelper=$request.processHelper;fontHelper=$request.fontHelper};environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null};cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null;scope='Read-only observation of one reviewed one-slide/one-table/one-row/one-cell source snapshot. No edit, save, reopen, PDF, or embedded-font output. Seven individual character probes are bounded around the tab and estimated offline wrap boundaries.';limitations=@('Reported font family/style properties and the native raster do not prove which physical font file supplied each glyph.','The offline estimated boundaries at source offsets 78 and 172 are probe locations only; native wrap positions are observed independently and are not forced to match them.','This read-only control does not test edit/save/reopen persistence, font embedding, or browser/native pixel equivalence.')}
function Write-MixedTableReport {$report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus; $report | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $reportFile -Encoding UTF8}
Write-MixedTableReport; Write-MixedTableStage 'worker.initialize' 'success'
try {
    $app=Invoke-MixedTableCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}
    $officeVersion=Invoke-MixedTableCom 'application.version.get' {$app.Version}; $officeDirectory=Invoke-MixedTableCom 'application.path.get' {$app.Path}; $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion; $report.environment.powerPointExecutable=$officeExecutable; $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion; $report.environment.powerPointExecutableSha256=Get-MixedTableSha256 $officeExecutable; Write-MixedTableReport
    Assert-MixedTablePresentationNotOpen $app $sourceSnapshot 'input.preflight'
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-MixedTableReport
    $presentations=Invoke-MixedTableCom 'input.presentations.get' {return ,$app.Presentations}; $script:presentation=Invoke-MixedTableCom 'input.presentation.open-readonly' {return ,$presentations.Open($sourceSnapshot,-1,0,-1)}
    $openedFullName=Invoke-MixedTableCom 'input.presentation.fullName.get' {$script:presentation.FullName}; if($openedFullName -ine $sourceSnapshot){throw "Opened presentation path differs from exact owned snapshot: $openedFullName"}
    $report.observation=Read-MixedTableObservation $script:presentation $request.expectations 'observation'; Write-MixedTableReport
    $slides=Invoke-MixedTableCom 'observation.export.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-MixedTableCom 'observation.export.slide-1.get' {return ,$slides.Item(1)}; Invoke-MixedTableCom 'observation.export.png' {$slide.Export($pngPath,'PNG',1280,720)}; $report.raster.sha256=Get-MixedTableSha256 $pngPath; Write-MixedTableReport
    Close-OwnedMixedTable $sourceSnapshot
    $report.source.unchanged=((Get-MixedTableSha256 $request.source.path) -ceq $request.source.sha256); $report.source.snapshotUnchanged=((Get-MixedTableSha256 $sourceSnapshot) -ceq $request.source.sha256)
    $inputsStable=$report.source.unchanged -and $report.source.snapshotUnchanged
    foreach($item in @($request.source.files)+@($request.fontFixture.fonts)+@($request.fontFixture.generation,$request.fontFixture.license,$request.verifier,$request.processHelper,$request.fontHelper)){$inputsStable=$inputsStable -and (Get-MixedTableSha256 $item.path) -ceq $item.sha256 -and (Get-MixedTableSha256 $item.snapshotPath) -ceq $item.sha256}
    $metrics=Get-MixedTableMetrics $report.observation $request.expectations; $metrics.inputsStable=$inputsStable; $metrics.rasterPresent=(Test-Path -LiteralPath $pngPath) -and -not [string]::IsNullOrWhiteSpace([string]$report.raster.sha256); $metrics.gatePassed=($metrics.contentAndStylePassed -and $metrics.geometryPassed -and $metrics.softWrapPassed -and $metrics.inputsStable -and $metrics.rasterPresent); $report.metrics=$metrics
    Write-MixedTableStage 'worker.complete' 'success'; Write-MixedTableReport; Write-Output 'Native mixed-table read-only observation completed; post-close gates are recorded in report.json.'
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation){$script:cleanupConfirmed=$false}; Write-MixedTableStage 'worker.failure' 'error' $_.Exception.Message; Write-MixedTableReport; throw
}
