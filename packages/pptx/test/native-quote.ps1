param([string]$EvidenceDirectory = 'artifacts/native-quote')
$ErrorActionPreference = 'Stop'
# Hash through .NET so a PowerShell 7 parent's PSModulePath cannot prevent
# Windows PowerShell from autoloading the Get-FileHash module in a child process.
function Get-FixtureSha256([string]$FixturePath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generation = Get-Content -LiteralPath (Join-Path $evidenceRoot 'generation.json') -Raw | ConvertFrom-Json
$powerpoint = New-Object -ComObject PowerPoint.Application
$reports = @()
$presentation = $null
$reopened = $null
try {
    foreach ($record in $generation.decks) {
        $id = $record.id
        if ($id -notmatch '^quote-\d+$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        $sourceHash = Get-FixtureSha256 $sourcePath
        if ($sourceHash -ne $record.hashes."$id.pptx") { throw "Changed fixture: $id" }
        $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
        if ($presentation.Slides.Count -ne $record.slides) { throw 'Slide count mismatch' }
        if ([Math]::Abs($presentation.PageSetup.SlideWidth - $record.width * 0.75) -gt 0.01 -or [Math]::Abs($presentation.PageSetup.SlideHeight - $record.height * 0.75) -gt 0.01) { throw 'Actual PowerPoint slide dimensions do not match' }
        $slides = @()
        $titles = @()
        foreach ($slide in $presentation.Slides) {
            $layout = $record.layouts[$slide.SlideIndex - 1]
            $expectedLines = @($layout.parts | ForEach-Object { $part = $_; $part.fit.lines | ForEach-Object { if ($_ -ne '') { @{text=$_; role=$part.role; fontSize=$part.fit.fontSize} } } })
            $lineIndex = 0
            $footerTop = $null
            $bodyBottom = 0.0
            $bodyLines = 0
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
                if ($range.BoundLeft -lt $cell.x * .75 - .1 -or $range.BoundTop -lt $cell.y * .75 - .1 -or $range.BoundLeft + $range.BoundWidth -gt ($cell.x + $cell.width) * .75 + .1 -or $range.BoundTop + $range.BoundHeight -gt ($cell.y + $cell.height) * .75 + .1) { throw "Native glyphs leave the quote cell: $id slide $($slide.SlideIndex)" }
                if ($expected.role -eq 'footer') { if ($null -eq $footerTop) { $footerTop = [double]$range.BoundTop } else { $footerTop = [Math]::Min($footerTop, [double]$range.BoundTop) } }
                else { $bodyBottom = [Math]::Max($bodyBottom, [double]$range.BoundTop + [double]$range.BoundHeight); $bodyLines++ }
                $lineIndex++
            }
            if ($lineIndex -ne $expectedLines.Count -or $null -eq $titleShape -or $null -eq $footerTop -or $bodyLines -lt 1 -or $bodyBottom -gt $footerTop) { throw "Native quote glyph overlap or missing content: $id slide $($slide.SlideIndex)" }
            $titles += $titleShape
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; bodyLines=$bodyLines; nativeLines=$lineIndex; glyphsInsideCell=$true; bodyBottom=$bodyBottom; footerTop=$footerTop; units='points, PowerPoint TextRange2 bounds'; rasterSha256=(Get-FixtureSha256 $rasterPath)}
        }
        $savedPath = Join-Path $evidenceRoot "$id-native-saved.pptx"
        $presentation.SaveCopyAs($savedPath, 24)
        for ($index=1; $index -le $titles.Count; $index++) { $titles[$index-1].TextFrame.TextRange.Text = "Native edit $id slide $index" }
        $editedPath = Join-Path $evidenceRoot "$id-native-edited.pptx"
        $presentation.SaveAs($editedPath, 24)
        $presentation.Close()
        $presentation = $null
        $reopened = $powerpoint.Presentations.Open($editedPath, -1, 0, 0)
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
    @{powerPointVersion=$powerpoint.Version; decks=$reports} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Leave PowerPoint and user presentations open.
}
