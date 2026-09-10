param([string]$EvidenceDirectory = 'artifacts/native-table-colors')
$ErrorActionPreference = 'Stop'
function Get-FixtureSha256([string]$FixturePath) {
    return (Get-FileHash -LiteralPath $FixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile = Join-Path $evidenceRoot 'generation.json'
$generation = Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$sourcePath = Join-Path $evidenceRoot 'table-colors.pptx'
if ((Get-FixtureSha256 $sourcePath) -ne $generation.pptxSha256) { throw 'Stale table fixture' }
function Read-FixtureTables($Presentation, [string]$Phase) {
    if ($Presentation.Slides.Count -ne $generation.expected.Count) { throw 'Unexpected slide count' }
    $observations = @()
    foreach ($slide in $Presentation.Slides) {
        $tables = @($slide.Shapes | Where-Object { $_.HasTable -eq -1 })
        if ($tables.Count -ne 1) { throw 'Expected one editable native table per slide' }
        $table = $tables[0].Table
        if ($table.Rows.Count -ne 2 -or $table.Columns.Count -ne 2) { throw 'Unexpected native table dimensions' }
        $cells = @()
        foreach ($cell in $generation.expected[$slide.SlideIndex-1].cells) {
            $range = $table.Cell($cell.row,$cell.column).Shape.TextFrame.TextRange
            $text = $range.Text
            $characters = @()
            for ($i=1; $i -le $text.Length; $i++) {
                $color = [long]$range.Characters($i,1).Font.Color.RGB
                $hex = '#{0:X2}{1:X2}{2:X2}' -f ($color -band 255),(($color -shr 8) -band 255),(($color -shr 16) -band 255)
                $characters += @{character=$text.Substring($i-1,1); color=$hex}
            }
            $cells += @{row=$cell.row; column=$cell.column; text=$text; characters=$characters}
        }
        $png = "$Phase-$($slide.SlideIndex).png"
        $pngPath = Join-Path $evidenceRoot $png
        $slide.Export($pngPath,'PNG',1280,720)
        $observations += @{slide=$slide.SlideIndex; cells=$cells; png=$png; pngSha256=(Get-FixtureSha256 $pngPath)}
    }
    return $observations
}
$powerpoint = New-Object -ComObject PowerPoint.Application
$presentation = $null
try {
    $presentation = $powerpoint.Presentations.Open($sourcePath,0,0,0)
    $original = @(Read-FixtureTables $presentation 'original')
    $savedPath = Join-Path $evidenceRoot 'table-colors-saved.pptx'
    $presentation.SaveAs($savedPath,24)
    $presentation.Close(); $presentation = $null
    $presentation = $powerpoint.Presentations.Open($savedPath,0,0,0)
    $reopened = @(Read-FixtureTables $presentation 'reopened')
    $executable = Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-FixtureSha256 $generationFile); savedSha256=(Get-FixtureSha256 $savedPath); powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $executable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; original=$original; reopened=$reopened} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} finally {
    if ($null -ne $presentation) { $presentation.Close() }
    # Do not quit PowerPoint or touch unrelated user presentations.
}
