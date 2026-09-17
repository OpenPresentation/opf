param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
function Sha([string]$File) { return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
if(-not $Worker) {
    if(Test-Path -LiteralPath (Join-Path $root 'worker.json')) { throw 'Preserve this control attempt; select a fresh directory' }
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds $TimeoutSeconds
    Get-Content -LiteralPath (Join-Path $root 'worker.stdout.log')
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native control failed or timed out; preserve logs and inspect Office. No retry was started.' }
    return
}
$presentation=$null; $stage='connect'; $observations=@()
$targets=@(16.25,16.26,16.27,16.27734375,16.28,16.29,16.30,16.31,77.3173828125)
function Progress([string]$Value) {
    $script:stage=$Value
    @{stage=$Value;observations=$observations} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $root 'progress.json') -Encoding UTF8
}
function Add-Text($Slide,[string]$Name,[string]$Text,[double]$Left,[double]$Top) {
    $shape=$Slide.Shapes.AddTextbox(1,$Left,$Top,500,20); $shape.Name=$Name
    $frame=$shape.TextFrame; $frame.MarginLeft=0; $frame.MarginRight=0; $frame.MarginTop=0; $frame.MarginBottom=0
    $frame.WordWrap=0; $frame.AutoSize=0
    $frame.TextRange.Text=$Text; $frame.TextRange.Font.Name='Calibri'; $frame.TextRange.Font.Size=13.5
    $frame.TextRange.Font.Bold=0; $frame.TextRange.Font.Italic=0; $frame.TextRange.Font.Color.RGB=16777215
    $frame.TextRange.ParagraphFormat.Alignment=1; $frame.TextRange.ParagraphFormat.Bullet.Visible=0
    $frame.Ruler.Levels.Item(1).FirstMargin=0; $frame.Ruler.Levels.Item(1).LeftMargin=0
    return $shape
}
function Read-Control($Presentation,[string]$Phase) {
    if($Presentation.Slides.Count -ne 1) { throw 'Control must contain one slide' }
    $slide=$Presentation.Slides.Item(1); $records=@()
    for($index=0;$index -lt $targets.Count;$index++) {
        $tab=$slide.Shapes.Item("tab-$index"); $literal=$slide.Shapes.Item("literal-$index")
        $range=$tab.TextFrame2.TextRange; $text=$range.Characters(2,6); $literalRange=$literal.TextFrame2.TextRange.Characters(1,6)
        $records+=@{targetPoints=$targets[$index];tabStopPoints=$tab.TextFrame.Ruler.TabStops.Item(1).Position;tabShapeLeft=$tab.Left;literalShapeLeft=$literal.Left;leadingTabBoundLeft=$range.Characters(1,1).BoundLeft;tabTextBoundLeft=$text.BoundLeft;literalTextBoundLeft=$literalRange.BoundLeft;tabTextWidth=$text.BoundWidth;literalTextWidth=$literalRange.BoundWidth;tabTextTop=$text.BoundTop;literalTextTop=$literalRange.BoundTop;actualTabText=$range.Text;literalText=$literalRange.Text;font=$range.Font.Name;fontSize=$range.Font.Size}
    }
    $png=Join-Path $root "$Phase.png"; $slide.Export($png,'PNG',1280,720)
    return @{phase=$Phase;records=$records;pngSha256=(Sha $png)}
}
try {
    Progress 'connect'; $app=New-Object -ComObject PowerPoint.Application
    $source=Join-Path $root 'native-created-tabs.pptx'
    if(Test-Path -LiteralPath $source) { throw 'Control output already exists' }
    Progress 'create-owned'; $presentation=$app.Presentations.Add(0)
    $presentation.PageSetup.SlideWidth=960; $presentation.PageSetup.SlideHeight=540
    $presentation.SaveAs((Join-Path $root 'empty-owned.pptx'),24)
    $slide=$presentation.Slides.Add(1,12); $slide.FollowMasterBackground=0; $slide.Background.Fill.Solid(); $slide.Background.Fill.ForeColor.RGB=0
    for($index=0;$index -lt $targets.Count;$index++) {
        Progress "create-pair-$index"
        $tab=Add-Text $slide "tab-$index" "`tBefore" 32.4 (20+52*$index)
        # PowerPoint creates the tab and all text. No OPF input is involved.
        # https://learn.microsoft.com/en-us/office/vba/api/powerpoint.ruler.tabstops
        $tabs=$tab.TextFrame.Ruler.TabStops
        for($i=$tabs.Count;$i -gt 0;$i--) { $tabs.Item($i).Clear() }
        [void]$tabs.Add(1,[single]$targets[$index])
        [void](Add-Text $slide "literal-$index" 'Before' (32.4+$targets[$index]) (41+52*$index))
    }
    Progress 'observe-created'; $observations+=Read-Control $presentation 'created'
    Progress 'save-owned'; $presentation.SaveAs($source,24)
    $presentation.Close(); $presentation=$null
    Progress 'reopen-owned'
    for($i=1;$i -le $app.Presentations.Count;$i++) { if($app.Presentations.Item($i).FullName -eq $source) { throw 'Control already open; ownership is not established' } }
    $presentation=$app.Presentations.Open($source,-1,0,0)
    Progress 'observe-reopened'; $observations+=Read-Control $presentation 'reopened'
    Progress 'export-private-proof'
    $pdf=Join-Path $root 'private-native-proof.pdf'
    # Inspect native PDF text coordinates independently of COM. This temporary
    # file can contain font subsets and must never enter the portable bundle.
    $presentation.ExportAsFixedFormat($pdf,2,1,0,1,1,0,$null,1,'',$false,$false,$true,$true,$false)
    $exe=Join-Path $app.Path 'POWERPNT.EXE'; $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{observations=$observations;powerPointBuild=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;executableSha256=(Sha $exe);windowsBuild="$($os.CurrentBuild).$($os.UBR)";hostVersion=$PSVersionTable.PSVersion.ToString();verifierSha256=(Sha $PSCommandPath);workerVerifierSha256=(Sha (Join-Path $PSScriptRoot 'native-process.ps1'));fontSha256=(Sha (Join-Path $env:WINDIR 'Fonts/calibri.ttf'));pptxSha256=(Sha $source);privatePdfSha256=(Sha $pdf);scope='Native-created tab stops and literal text at the same requested offsets. TextRange2 bounds and native raster observations; private PDF permits independent coordinate inspection but its font subsets must not be redistributed. No OPF input and no adjusted tolerance.'} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $root 'control.json') -Encoding UTF8
    Write-Output 'Native-created tab/literal control saved and observed.'
} catch {
    @{stage=$stage;error=$_.Exception.Message;observations=$observations} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8
    throw
} finally {
    if($null -ne $presentation) { $presentation.Saved=-1; $presentation.Close() }
    # Only this owned control presentation is closed, never Office or user work.
}
