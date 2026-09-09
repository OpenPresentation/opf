param([string]$EvidenceDirectory = 'artifacts/native-quote')
$ErrorActionPreference = 'Stop'
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
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($sourceHash -ne $record.hashes."$id.pptx") { throw "Changed fixture: $id" }
        $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
        if ($presentation.Slides.Count -ne $record.slides) { throw 'Slide count mismatch' }
        if ([Math]::Abs($presentation.PageSetup.SlideWidth - $record.width * 0.75) -gt 0.01 -or [Math]::Abs($presentation.PageSetup.SlideHeight - $record.height * 0.75) -gt 0.01) { throw 'Actual PowerPoint slide dimensions do not match' }
        $slides = @()
        $titles = @()
        foreach ($slide in $presentation.Slides) {
            $footerTop = $null
            $bodyBottom = 0.0
            $bodyLines = 0
            $titleShape = $null
            foreach ($shape in $slide.Shapes) {
                if ($shape.HasTextFrame -ne -1 -or $shape.TextFrame.HasText -ne -1) { continue }
                $text = $shape.TextFrame.TextRange.Text
                if ($text -eq 'A quote and its source') { $titleShape = $shape; continue }
                $range = $shape.TextFrame2.TextRange
                if ($text -eq $generation.footer) { $footerTop = [double]$range.BoundTop }
                else { $bodyBottom = [Math]::Max($bodyBottom, [double]$range.BoundTop + [double]$range.BoundHeight); $bodyLines++ }
            }
            if ($null -eq $titleShape -or $null -eq $footerTop -or $bodyLines -lt 2 -or $bodyBottom -gt $footerTop) { throw "Native quote glyph overlap or missing content: $id slide $($slide.SlideIndex)" }
            $titles += $titleShape
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; bodyLines=$bodyLines; bodyBottom=$bodyBottom; footerTop=$footerTop; units='points, PowerPoint TextRange2 bounds'; rasterSha256=(Get-FileHash -LiteralPath $rasterPath -Algorithm SHA256).Hash.ToLowerInvariant()}
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
        $reports += @{id=$id; sourceSha256=$sourceHash; slides=$slides; editsReopened=$editsReopened; savedSha256=(Get-FileHash -LiteralPath $savedPath -Algorithm SHA256).Hash.ToLowerInvariant(); editedSha256=(Get-FileHash -LiteralPath $editedPath -Algorithm SHA256).Hash.ToLowerInvariant()}
        Write-Output "Native quote verified $id ($editsReopened slides)"
    }
    @{powerPointVersion=$powerpoint.Version; decks=$reports} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Leave PowerPoint and user presentations open.
}
