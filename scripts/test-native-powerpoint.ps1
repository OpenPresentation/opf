param([Parameter(Mandatory=$true)][string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$sourcePath = Join-Path $evidenceRoot 'source.pptx'
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw 'Generate source.pptx first.' }
$sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
# Use the Office object model; close only presentations opened by this test.
# Do not quit PowerPoint or alter the user's other presentations/settings.
$powerpoint = New-Object -ComObject PowerPoint.Application
$presentation = $null
$reopened = $null
try {
    $presentation = $powerpoint.Presentations.Open($sourcePath, 0, 0, 0)
    $tableCount = 0
    $tableDetails = @()
    $editCell = $null
    for ($slideIndex = 1; $slideIndex -le $presentation.Slides.Count; $slideIndex++) {
        $slide = $presentation.Slides.Item($slideIndex)
        $slide.Export((Join-Path $evidenceRoot "native-$slideIndex.png"), 'PNG', 1280, 720)
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTable -eq -1) {
                $tableCount++
                $tableDetails += @{slide=$slideIndex; rows=$shape.Table.Rows.Count; columns=$shape.Table.Columns.Count}
                for ($row=1; $row -le $shape.Table.Rows.Count; $row++) {
                    for ($column=1; $column -le $shape.Table.Columns.Count; $column++) {
                        $cell = $shape.Table.Cell($row,$column)
                        if ($cell.Shape.TextFrame.TextRange.Text -eq 'Editable cell') { $editCell = $cell }
                    }
                }
            }
        }
    }
    if ($tableCount -ne 2) { throw "Expected two editable native tables, got $tableCount" }
    if ($null -eq $editCell) { throw 'Editable native cell not found' }
    $presentation.SaveCopyAs((Join-Path $evidenceRoot 'native-saved.pptx'),24)
    $editCell.Shape.TextFrame.TextRange.Text = 'Edited in native PowerPoint'
    $editedPath = Join-Path $evidenceRoot 'native-edited.pptx'
    $presentation.SaveAs($editedPath,24)
    $slideCount = $presentation.Slides.Count
    $presentation.Close()
    $presentation = $null
    $reopened = $powerpoint.Presentations.Open($editedPath,-1,0,0)
    $found = $false
    foreach ($slide in $reopened.Slides) {
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTable -eq -1) {
                for ($row=1; $row -le $shape.Table.Rows.Count; $row++) {
                    for ($column=1; $column -le $shape.Table.Columns.Count; $column++) {
                        if ($shape.Table.Cell($row,$column).Shape.TextFrame.TextRange.Text -eq 'Edited in native PowerPoint') { $found = $true }
                    }
                }
            }
        }
    }
    if (-not $found) { throw 'Native cell edit did not survive save/reopen' }
    $report = @{sourcePptxSha256=$sourceHash; powerPointVersion=$powerpoint.Version; slides=$slideCount; tableCount=$tableCount; tables=$tableDetails; editReopened=$found; rasterWidth=1280; rasterHeight=720}
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
    $report | ConvertTo-Json -Depth 8
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
}
