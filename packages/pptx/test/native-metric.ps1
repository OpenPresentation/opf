param([string]$EvidenceDirectory = 'artifacts/native-metric')
$ErrorActionPreference = 'Stop'
function Get-FixtureSha256([string]$FixturePath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile = Join-Path $evidenceRoot 'generation.json'
$generation = Get-Content -LiteralPath $generationFile -Raw | ConvertFrom-Json
$powerpoint = New-Object -ComObject PowerPoint.Application
$presentation = $null
$reopened = $null
$reports = @()
try {
    foreach ($record in $generation.decks) {
        $id = $record.id
        if ($id -notmatch '^metric-\d+-(left|center|right)$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        if ((Get-FixtureSha256 $sourcePath) -ne $record.pptxSha256) { throw 'Stale source fixture' }
        $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
        if ($presentation.Slides.Count -ne $record.layouts.Count) { throw 'Native slide count mismatch' }
        $slides = @()
        $edits = @()
        foreach ($slide in $presentation.Slides) {
            $layout = $record.layouts[$slide.SlideIndex-1]
            $expected = @($layout.parts | Where-Object { $_.visible } | ForEach-Object { $part = $_; $index = 0; $part.fit.sourceLines | ForEach-Object { @{part=$part; line=$_; index=$index}; $index++ } })
            $index = 0
            $observations = @()
            foreach ($shape in $slide.Shapes) {
                if ($shape.Name -notmatch '^OPF metric \d+ (value|unit|label|description|delta|trend) line \d+$') { throw 'Unexpected native metric shape' }
                if ($index -ge $expected.Count) { throw 'Unexpected duplicate native metric line' }
                $item = $expected[$index]
                $part = $item.part
                $line = $item.line
                $origin = $part.linePositions[$item.index]
                $wanted = $part.text.Substring($line.start, $line.end - $line.start)
                $actual = $shape.TextFrame.TextRange.Text
                if ($actual -cne $wanted) { throw "Changed native text: $id slide $($slide.SlideIndex) line $index" }
                if ($shape.Tags.Count -lt 1) { throw 'Missing native metric tags' }
                if ($actual -ne '' -and [Math]::Abs($shape.TextFrame.TextRange.Font.Size - $part.fit.fontSize * .75) -gt .02) { throw 'Native metric font size differs' }
                $expectedX = $origin.x
                $expectedWidth = $line.width
                if ($line.width -eq 0) { $expectedX = $part.box.x; $expectedWidth = $part.box.width }
                if ([Math]::Abs($shape.Left - $expectedX*.75) -gt .02 -or [Math]::Abs($shape.Top - ($origin.baseline-$part.fit.fontSize)*.75) -gt .02 -or [Math]::Abs($shape.Width - $expectedWidth*.75) -gt .02) { throw 'Native metric shape differs from accepted geometry' }
                $range = $shape.TextFrame2.TextRange
                $tabTargets = @()
                for ($segmentIndex=1; $segmentIndex -lt $line.segments.Count; $segmentIndex++) {
                    $segment = $line.segments[$segmentIndex]
                    if ($line.segments[$segmentIndex-1].kind -eq 'tab' -and $segment.kind -eq 'text') {
                        $segmentRange = $range.Characters($segment.start - $line.start + 1, $segment.end - $segment.start)
                        $errorPoints = [Math]::Abs($segmentRange.BoundLeft - $shape.Left - $segment.x*.75)
                        if ($errorPoints -gt .02) { throw "Native metric text after tab misses the accepted stop: $errorPoints" }
                        $tabTargets += @{sourceStart=$segment.start; errorPoints=$errorPoints}
                    }
                }
                # The full paragraph range includes an invisible terminator advance.
                # Bound only the actual source characters when testing visible content.
                $characters = $range
                if ($actual.Length -gt 0) { $characters = $range.Characters(1,$actual.Length) }
                $insideCell = $true
                if ($actual.Trim() -ne '') {
                    $cell = $layout.cell
                    $insideCell = $characters.BoundLeft -ge $cell.x*.75-.1 -and $characters.BoundTop -ge $cell.y*.75-.1 -and $characters.BoundLeft+$characters.BoundWidth -le ($cell.x+$cell.width)*.75+.1 -and $characters.BoundTop+$characters.BoundHeight -le ($cell.y+$cell.height)*.75+.1
                    # Record native advance differences, including trailing whitespace.
                    # The separate PNG comparison tests actual visible ink containment.
                }
                $observations += @{role=$part.role; text=$actual; font=$range.Font.Name; fontSize=$range.Font.Size; left=$characters.BoundLeft; top=$characters.BoundTop; width=$characters.BoundWidth; height=$characters.BoundHeight; paragraphWidth=$range.BoundWidth; tags=$shape.Tags.Count; tabTargets=$tabTargets; characterBoundsInsideCell=$insideCell}
                if ($item.index -eq 0) {
                    $editText = $null
                    switch ($part.role) {
                        'value' { if ($part.sources[0].value -isnot [string]) { $editText = '7' } else { $editText = "NATIVE $actual" } }
                        'unit' { $editText = "Native $actual" }
                        'label' { $editText = "Saved $actual" }
                        'description' { $editText = "Edited $actual" }
                        'delta' { if ($part.sources[0].value -isnot [string]) { $editText = '1' } else { $editText = "Delta $actual" } }
                        'trend' { $editText = 'down' }
                    }
                    if ($null -ne $editText) { $edits += @{shape=$shape; name=$shape.Name; slide=$slide.SlideIndex; text=$editText} }
                }
                $index++
            }
            if ($index -ne $expected.Count) { throw 'Missing native accepted lines' }
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; lines=$observations; rasterSha256=(Get-FixtureSha256 $rasterPath)}
        }
        $savedPath = Join-Path $evidenceRoot "$id-saved.pptx"
        $presentation.SaveCopyAs($savedPath,24)
        foreach ($edit in $edits) { $edit.shape.TextFrame.TextRange.Text = $edit.text }
        $editedPath = Join-Path $evidenceRoot "$id-edited.pptx"
        $presentation.SaveAs($editedPath,24)
        $presentation.Close(); $presentation = $null
        $reopened = $powerpoint.Presentations.Open($editedPath,-1,0,0)
        foreach ($edit in $edits) {
            $shape = $reopened.Slides.Item($edit.slide).Shapes.Item($edit.name)
            if ($shape.TextFrame.TextRange.Text -cne $edit.text) { throw 'Native metric edit did not survive reopen' }
            if ($shape.Tags.Count -lt 1) { throw 'Native metric tags did not survive reopen' }
        }
        $reopened.Close(); $reopened = $null
        $reports += @{id=$id; slides=$slides; editsReopened=$edits.Count; savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath)}
        Write-Output "Native metric source, shape geometry and save/reopen verified $id"
    }
    $nativeExecutable = Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $nativeExecutable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $nativeExecutable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; generationSha256=(Get-FixtureSha256 $generationFile); decks=$reports} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Preserve PowerPoint and every unrelated user presentation.
}
