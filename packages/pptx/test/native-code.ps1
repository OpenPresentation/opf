param([string]$EvidenceDirectory = 'artifacts/native-code')
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
        if ($id -notmatch '^code-\d+$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        if ((Get-FixtureSha256 $sourcePath) -ne $record.pptxSha256) { throw 'Stale source fixture' }
        $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
        if ($presentation.Slides.Count -ne $record.layouts.Count) { throw 'Native slide count mismatch' }
        $slides = @()
        $edits = @()
        foreach ($slide in $presentation.Slides) {
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
                        if ($errorPoints -gt .02) { throw 'Native text after a tab misses the accepted stop' }
                        $tabTargets += @{sourceStart=$segment.start; errorPoints=$errorPoints}
                    }
                }
                if ($actual.Trim() -ne '') {
                    $cell = $layout.cell
                    if ($range.BoundLeft -lt $cell.x*.75-.1 -or $range.BoundTop -lt $cell.y*.75-.1 -or $range.BoundLeft+$range.BoundWidth -gt ($cell.x+$cell.width)*.75+.1 -or $range.BoundTop+$range.BoundHeight -gt ($cell.y+$cell.height)*.75+.1) { throw 'Native code glyphs leave the accepted cell' }
                }
                $observations += @{role=$part.role; text=$actual; font=$range.Font.Name; fontSize=$range.Font.Size; left=$range.BoundLeft; top=$range.BoundTop; width=$range.BoundWidth; height=$range.BoundHeight; tags=$shape.Tags.Count; tabTargets=$tabTargets}
                if ($item.index -eq 0 -and $part.role -eq 'body') { $edits += @{shape=$shape; text="NATIVE $actual"} }
                if ($item.index -eq 0 -and $part.role -eq 'filename') { $edits += @{shape=$shape; text="Saved $actual"} }
                $index++
            }
            if ($index -ne $expected.Count) { throw 'Missing native accepted lines' }
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            $slides += @{slide=$slide.SlideIndex; lines=$observations; rasterSha256=(Get-FixtureSha256 $rasterPath); glyphsInsideCell=$true}
        }
        $savedPath = Join-Path $evidenceRoot "$id-saved.pptx"
        $presentation.SaveCopyAs($savedPath,24)
        foreach ($edit in $edits) { $edit.shape.TextFrame.TextRange.Text = $edit.text }
        $editedPath = Join-Path $evidenceRoot "$id-edited.pptx"
        $presentation.SaveAs($editedPath,24)
        $presentation.Close()
        $presentation = $null
        $reopened = $powerpoint.Presentations.Open($editedPath,-1,0,0)
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
    @{powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $nativeExecutable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $nativeExecutable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; generationSha256=(Get-FixtureSha256 $generationFile); decks=$reports} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Preserve PowerPoint and every unrelated user presentation.
}
