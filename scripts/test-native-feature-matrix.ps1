param([Parameter(Mandatory=$true)][string]$EvidenceDirectory)
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
        if ($id -notmatch '^[a-z0-9-]+$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($sourceHash -ne $record.hashes."$id.pptx") { throw "Changed fixture: $id" }
        $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
        if ($presentation.Slides.Count -ne $record.slides) { throw "Slide count mismatch: $id" }
        $slides = @()
        $editShapes = @()
        foreach ($slide in $presentation.Slides) {
            $index = $slide.SlideIndex
            $rasterPath = Join-Path $evidenceRoot "$id-native-$index.png"
            $slide.Export($rasterPath, 'PNG', 1280, 720)
            $shapes = @()
            $firstText = $null
            foreach ($shape in $slide.Shapes) {
                $shapeText = ''
                if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
                    $shapeText = $shape.TextFrame.TextRange.Text
                    if ($null -eq $firstText) { $firstText = $shape }
                }
                $shapes += @{type=[int]$shape.Type; text=$shapeText; left=[double]$shape.Left; top=[double]$shape.Top; width=[double]$shape.Width; height=[double]$shape.Height; table=($shape.HasTable -eq -1); chart=($shape.HasChart -eq -1)}
            }
            if ($null -eq $firstText) { throw "Missing native editable text: $id slide $index" }
            $editShapes += $firstText
            $slides += @{slide=$index; shapes=$shapes; rasterSha256=(Get-FileHash -LiteralPath $rasterPath -Algorithm SHA256).Hash.ToLowerInvariant()}
        }
        $savedPath = Join-Path $evidenceRoot "$id-native-saved.pptx"
        $presentation.SaveCopyAs($savedPath, 24)
        for ($index=1; $index -le $editShapes.Count; $index++) { $editShapes[$index-1].TextFrame.TextRange.Text = "Native edit $id slide $index" }
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
        Write-Output "Native PowerPoint verified $id ($editsReopened slides)"
    }
    @{powerPointVersion=$powerpoint.Version; decks=$reports} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Preserve PowerPoint and all presentations belonging to the user.
}
