param([string]$EvidenceDirectory = 'artifacts/native-code',[ValidateSet('','code-1280','code-540')][string]$Deck='',[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference = 'Stop'
function Get-FixtureSha256([string]$FixturePath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
. (Join-Path $PSScriptRoot 'native-deck.ps1')
if(-not (Initialize-OpfNativeDeck -ScriptPath $PSCommandPath -EvidenceDirectory $EvidenceDirectory -Deck $Deck -Worker $Worker.IsPresent -TimeoutSeconds $TimeoutSeconds)) { return }
$powerpoint = $null; $stage='connect'; $slides=@()
$presentation = $null
$reopened = $null
$reports = @()
try {
    Save-FixtureProgress 'connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    $selected=@($generation.decks | Where-Object {$_.id -eq $Deck})
    if($selected.Count -ne 1) { throw 'Selected fixture not found exactly once' }
    foreach ($record in $selected) {
        $id = $record.id
        if ($id -notmatch '^code-\d+$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        if ((Get-FixtureSha256 $sourcePath) -ne $record.pptxSha256) { throw 'Stale source fixture' }
        $presentation = Open-OwnedFixture $sourcePath
        if ($presentation.Slides.Count -ne $record.layouts.Count) { throw 'Native slide count mismatch' }
        $slides = @()
        $edits = @()
        foreach ($slide in $presentation.Slides) {
            Save-FixtureProgress "observe-slide-$($slide.SlideIndex)"
            $layout = $record.layouts[$slide.SlideIndex-1]
            $expected = @($layout.parts | ForEach-Object { $part = $_; $index = 0; $part.fit.sourceLines | ForEach-Object { @{part=$part; line=$_; index=$index}; $index++ } })
            $index = 0
            $observations = @()
            foreach ($shape in $slide.Shapes) {
                if ($shape.Name -notmatch '^OPF code \d+ (filename|language|body) line \d+$') { continue }
                $item = $expected[$index]
                $part = $item.part
                $line = $item.line
                $wanted = $part.text.Substring($line.start, $line.end - $line.start)
                $actual = $shape.TextFrame.TextRange.Text
                if ($actual -cne $wanted) { throw "Changed native text: $id slide $($slide.SlideIndex) line $index" }
                if ($shape.Tags.Count -lt 1) { throw 'Missing native code tags' }
                if ($actual -ne '' -and [Math]::Abs($shape.TextFrame.TextRange.Font.Size - $part.fit.fontSize * .75) -gt .02) { throw 'Native code font size differs' }
                $range = $shape.TextFrame2.TextRange
                $tabTargets = @()
                for ($segmentIndex=1; $segmentIndex -lt $line.segments.Count; $segmentIndex++) {
                    $segment = $line.segments[$segmentIndex]
                    if ($line.segments[$segmentIndex-1].kind -eq 'tab' -and $segment.kind -eq 'text') {
                        $segmentRange = $range.Characters($segment.start - $line.start + 1, $segment.end - $segment.start)
                        $errorPoints = [Math]::Abs($segmentRange.BoundLeft - $shape.Left - $segment.x*.75)
                        $tabTargets += @{sourceStart=$segment.start; errorPoints=$errorPoints; passed=($errorPoints -le .02)}
                    }
                }
                $glyphsInsideCell=$true
                if ($actual.Trim() -ne '') {
                    $cell = $layout.cell
                    $glyphsInsideCell=-not ($range.BoundLeft -lt $cell.x*.75-.1 -or $range.BoundTop -lt $cell.y*.75-.1 -or $range.BoundLeft+$range.BoundWidth -gt ($cell.x+$cell.width)*.75+.1 -or $range.BoundTop+$range.BoundHeight -gt ($cell.y+$cell.height)*.75+.1)
                }
                $observations += @{role=$part.role; text=$actual; font=$range.Font.Name; fontSize=$range.Font.Size; left=$range.BoundLeft; top=$range.BoundTop; width=$range.BoundWidth; height=$range.BoundHeight; tags=$shape.Tags.Count; tabTargets=$tabTargets; glyphsInsideCell=$glyphsInsideCell}
                if ($item.index -eq 0 -and $part.role -eq 'body') { $edits += @{shape=$shape; text="NATIVE $actual"} }
                if ($item.index -eq 0 -and $part.role -eq 'filename') { $edits += @{shape=$shape; text="Saved $actual"} }
                $index++
            }
            if ($index -ne $expected.Count) { throw 'Missing native accepted lines' }
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; lines=$observations; rasterSha256=(Get-FixtureSha256 $rasterPath); glyphsInsideCell=(@($observations | Where-Object {-not $_.glyphsInsideCell}).Count -eq 0)}
        }
        $savedPath = Join-Path $evidenceRoot "$id-saved.pptx"
        $presentation.SaveCopyAs($savedPath,24)
        foreach ($edit in $edits) { $edit.shape.TextFrame.TextRange.Text = $edit.text }
        $editedPath = Join-Path $evidenceRoot "$id-edited.pptx"
        $presentation.SaveAs($editedPath,24)
        $presentation.Close()
        $presentation = $null
        $reopened = Open-OwnedFixture $editedPath -1
        $editsReopened = 0
        foreach ($slide in $reopened.Slides) {
            foreach ($shape in $slide.Shapes) {
                if ($shape.Name -match '^OPF code \d+ (body|filename) line 1$') {
                    if ($shape.TextFrame.TextRange.Text -cnotmatch '^(NATIVE |Saved )') { throw 'Native edit did not survive reopen' }
                    if ($shape.Tags.Count -lt 1) { throw 'Native code tags did not survive reopen' }
                    $editsReopened++
                }
            }
        }
        if ($editsReopened -ne $edits.Count) { throw 'Native edit count mismatch' }
        $reopened.Close()
        $reopened = $null
        $reports += @{id=$id; slides=$slides; editsReopened=$editsReopened; savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath)}
        Write-Output "Native code verified $id"
    }
    $nativeExecutable = Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $nativeExecutable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $nativeExecutable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; generationSha256=(Get-FixtureSha256 $generationFile); decks=$reports} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'native.json') -Encoding UTF8
} catch {
    @{stage=$stage;error=$_.Exception.Message;decks=$reports;slides=$slides} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Preserve PowerPoint and every unrelated user presentation.
}
