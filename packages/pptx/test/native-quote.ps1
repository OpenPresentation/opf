param([string]$EvidenceDirectory = 'artifacts/native-quote',[ValidateSet('','quote-1280','quote-540')][string]$Deck='',[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference = 'Stop'
# Hash through .NET so a PowerShell 7 parent's PSModulePath cannot prevent
# Windows PowerShell from autoloading the Get-FileHash module in a child process.
function Get-FixtureSha256([string]$FixturePath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
. (Join-Path $PSScriptRoot 'native-deck.ps1')
if(-not (Initialize-OpfNativeDeck -ScriptPath $PSCommandPath -EvidenceDirectory $EvidenceDirectory -Deck $Deck -Worker $Worker.IsPresent -TimeoutSeconds $TimeoutSeconds)) { return }
$powerpoint = $null; $stage='connect'; $slides=@()
$reports = @()
$presentation = $null
$reopened = $null
try {
    Save-FixtureProgress 'connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    $selected=@($generation.decks | Where-Object {$_.id -eq $Deck})
    if($selected.Count -ne 1) { throw 'Selected fixture not found exactly once' }
    foreach ($record in $selected) {
        $id = $record.id
        if ($id -notmatch '^quote-\d+$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        $sourceHash = Get-FixtureSha256 $sourcePath
        if ($sourceHash -ne $record.hashes."$id.pptx") { throw "Changed fixture: $id" }
        $presentation = Open-OwnedFixture $sourcePath
        if ($presentation.Slides.Count -ne $record.slides) { throw 'Slide count mismatch' }
        if ([Math]::Abs($presentation.PageSetup.SlideWidth - $record.width * 0.75) -gt 0.01 -or [Math]::Abs($presentation.PageSetup.SlideHeight - $record.height * 0.75) -gt 0.01) { throw 'Actual PowerPoint slide dimensions do not match' }
        $slides = @()
        $titles = @()
        foreach ($slide in $presentation.Slides) {
            Save-FixtureProgress "observe-slide-$($slide.SlideIndex)"
            $layout = $record.layouts[$slide.SlideIndex - 1]
            $expectedLines = @($layout.parts | ForEach-Object { $part = $_; $part.fit.lines | ForEach-Object { if ($_ -ne '') { @{text=$_; role=$part.role; fontSize=$part.fit.fontSize} } } })
            $lineIndex = 0
            $footerTop = $null
            $bodyBottom = 0.0
            $bodyLines = 0
            $glyphsInsideCell=$true; $lineBounds=@()
            $titleShape = $null
            foreach ($shape in $slide.Shapes) {
                if ($shape.HasTextFrame -ne -1 -or $shape.TextFrame.HasText -ne -1) { continue }
                $text = $shape.TextFrame.TextRange.Text
                if ($text -eq 'A quote and its source') { $titleShape = $shape; continue }
                $range = $shape.TextFrame2.TextRange
                $expected = $expectedLines[$lineIndex]
                if ($null -eq $expected -or $text -cne $expected.text) { throw "Native quote line changed: $id slide $($slide.SlideIndex), line $lineIndex" }
                if ([Math]::Abs($shape.TextFrame.TextRange.Font.Size - $expected.fontSize * .75) -gt .02) { throw 'Native quote readability floor or accepted size changed' }
                $cell = $layout.cell
                $inside=-not ($range.BoundLeft -lt $cell.x * .75 - .1 -or $range.BoundTop -lt $cell.y * .75 - .1 -or $range.BoundLeft + $range.BoundWidth -gt ($cell.x + $cell.width) * .75 + .1 -or $range.BoundTop + $range.BoundHeight -gt ($cell.y + $cell.height) * .75 + .1)
                if(-not $inside) { $glyphsInsideCell=$false }
                $lineBounds+=@{role=$expected.role;text=$text;left=$range.BoundLeft;top=$range.BoundTop;width=$range.BoundWidth;height=$range.BoundHeight;glyphsInsideCell=$inside}
                if ($expected.role -eq 'footer') { if ($null -eq $footerTop) { $footerTop = [double]$range.BoundTop } else { $footerTop = [Math]::Min($footerTop, [double]$range.BoundTop) } }
                else { $bodyBottom = [Math]::Max($bodyBottom, [double]$range.BoundTop + [double]$range.BoundHeight); $bodyLines++ }
                $lineIndex++
            }
            if ($lineIndex -ne $expectedLines.Count -or $null -eq $titleShape -or $null -eq $footerTop -or $bodyLines -lt 1) { throw "Missing native quote content: $id slide $($slide.SlideIndex)" }
            $titles += $titleShape
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; bodyLines=$bodyLines; nativeLines=$lineIndex; glyphsInsideCell=$glyphsInsideCell; lineBounds=$lineBounds; bodyBottom=$bodyBottom; footerTop=$footerTop; units='points, PowerPoint TextRange2 bounds'; rasterSha256=(Get-FixtureSha256 $rasterPath)}
        }
        $savedPath = Join-Path $evidenceRoot "$id-native-saved.pptx"
        $presentation.SaveCopyAs($savedPath, 24)
        for ($index=1; $index -le $titles.Count; $index++) { $titles[$index-1].TextFrame.TextRange.Text = "Native edit $id slide $index" }
        $editedPath = Join-Path $evidenceRoot "$id-native-edited.pptx"
        $presentation.SaveAs($editedPath, 24)
        $presentation.Close()
        $presentation = $null
        $reopened = Open-OwnedFixture $editedPath -1
        $editsReopened = 0
        foreach ($slide in $reopened.Slides) {
            $expected = "Native edit $id slide $($slide.SlideIndex)"
            $found = $false
            foreach ($shape in $slide.Shapes) { if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -eq $expected) { $found = $true } }
            if (-not $found) { throw "Native edit did not survive: $expected" }
            $editsReopened++
        }
        $reopened.Close()
        $reopened = $null
        $reports += @{id=$id; sourceSha256=$sourceHash; slides=$slides; editsReopened=$editsReopened; savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath)}
        Write-Output "Native quote verified $id ($editsReopened slides)"
    }
    $nativeExecutable=Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $nativeExecutable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $nativeExecutable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; generationSha256=(Get-FixtureSha256 $generationFile); decks=$reports} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'native.json') -Encoding UTF8
} catch {
    @{stage=$stage;error=$_.Exception.Message;decks=$reports;slides=$slides} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Leave PowerPoint and user presentations open.
}
