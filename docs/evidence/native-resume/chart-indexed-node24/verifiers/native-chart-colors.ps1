param([string]$EvidenceDirectory='artifacts/native-chart-colors')
$ErrorActionPreference='Stop'
function Get-FixtureSha256([string]$FixturePath) { return (Get-FileHash -LiteralPath $FixturePath -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-ColorHex($Value) {
    if ($Value -is [System.__ComObject]) { $Value=$Value.RGB }
    $color=[long]$Value
    return '#{0:X2}{1:X2}{2:X2}' -f ($color -band 255),(($color -shr 8) -band 255),(($color -shr 16) -band 255)
}
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $evidenceRoot 'generation.json'
$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$sourcePath=Join-Path $evidenceRoot 'charts.pptx'
if ((Get-FixtureSha256 $sourcePath) -ne $generation.pptxSha256) { throw 'Stale chart fixture' }
function Read-FixtureCharts($Presentation,[string]$Phase) {
    if ($Presentation.Slides.Count -ne $generation.expected.Count) { throw 'Native slide count mismatch' }
    $results=@()
    foreach($slide in $Presentation.Slides) {
        $shapes=@($slide.Shapes | Where-Object { $_.HasChart -eq -1 })
        if ($shapes.Count -ne 1) { throw 'Expected one editable chart per slide' }
        $chart=$shapes[0].Chart
        $record=@{slide=$slide.SlideIndex; panelColor=(Get-ColorHex $chart.ChartArea.Format.Fill.ForeColor.RGB); panelTransparency=$chart.ChartArea.Format.Fill.Transparency; plotFillVisible=$chart.PlotArea.Format.Fill.Visible; series=$chart.SeriesCollection().Count}
        # PowerShell's COM enumerator can return null series even when Count and
        # Item are valid. Use Office's one-based indexed collections explicitly.
        $seriesCollection=$chart.SeriesCollection()
        $record.pointColors=@(for($seriesIndex=1; $seriesIndex -le $seriesCollection.Count; $seriesIndex++) {
            $series=$seriesCollection.Item($seriesIndex)
            $points=$series.Points()
            for($pointIndex=1; $pointIndex -le $points.Count; $pointIndex++) {
                Get-ColorHex $points.Item($pointIndex).Format.Fill.ForeColor.RGB
            }
        })
        if (!$chart.HasLegend) { throw 'Missing native category/series legend' }
        $record.legendColor=Get-ColorHex $chart.Legend.Font.Color
        if ($generation.expected[$slide.SlideIndex-1].type -eq 'column') {
            $record.categoryColor=Get-ColorHex $chart.Axes(1).TickLabels.Font.Color
            $record.valueColor=Get-ColorHex $chart.Axes(2).TickLabels.Font.Color
        }
        $png="$Phase-$($slide.SlideIndex).png"; $pngPath=Join-Path $evidenceRoot $png
        $slide.Export($pngPath,'PNG',1280,720)
        $record.png=$png; $record.pngSha256=Get-FixtureSha256 $pngPath
        $results+=$record
    }
    return $results
}
$powerpoint=$null; $presentation=$null; $workbook=$null; $stage='connect'; $original=@(); $reopened=@()
try {
    $powerpoint=New-Object -ComObject PowerPoint.Application
    $stage='open-original'
    $presentation=$powerpoint.Presentations.Open($sourcePath,0,0,0)
    $original=@(Read-FixtureCharts $presentation 'original')
    $savedPath=Join-Path $evidenceRoot 'charts-saved.pptx'
    $presentation.SaveAs($savedPath,24)
    $presentation.Close(); $presentation=$null
    $presentation=$powerpoint.Presentations.Open($savedPath,0,0,0)
    $reopened=@(Read-FixtureCharts $presentation 'reopened')
    foreach($slide in $presentation.Slides) {
        $stage="edit-slide-$($slide.SlideIndex)"
        Write-Output "Editing embedded workbook for generated slide $($slide.SlideIndex)."
        $shape=@($slide.Shapes | Where-Object { $_.HasChart -eq -1 })[0]
        $chart=$shape.Chart
        # Microsoft requires Activate before accessing the embedded Workbook:
        # https://learn.microsoft.com/en-us/office/vba/api/powerpoint.chartdata.activate
        $chart.ChartData.Activate()
        Write-Output 'Embedded workbook activated.'
        $workbook=$chart.ChartData.Workbook
        foreach($window in $workbook.Windows) { $window.Visible=$false }
        $sheet=$workbook.Worksheets.Item(1)
        if ($sheet.Cells.Item(1,1).Value2 -cne $generation.expected[$slide.SlideIndex-1].data.columns[0]) { throw 'Source heading changed in actual editable workbook' }
        $edited=$generation.expected[$slide.SlideIndex-1].edited
        $sheet.Cells.Item(1,1).Value2=$edited.columns[0]
        $sheet.Cells.Item(1,2).Value2=$edited.columns[1]
        $sheet.Cells.Item(2,1).Value2=$edited.rows[0][0]
        $sheet.Cells.Item(2,2).Value2=[double]$edited.rows[0][1]
        Write-Output 'Heading, series, category and numeric value changed.'
        $workbook.Close($true); $workbook=$null
        $chart.Refresh()
        Write-Output 'Embedded workbook saved and chart refreshed.'
    }
    $editedPath=Join-Path $evidenceRoot 'charts-edited.pptx'
    $stage='save-edited'
    $presentation.SaveAs($editedPath,24)
    $presentation.Close(); $presentation=$null
    $presentation=$powerpoint.Presentations.Open($editedPath,0,0,0)
    if($presentation.Slides.Count -ne 8) { throw 'Edited charts did not reopen' }
    $osVersion=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $executable=Join-Path $powerpoint.Path 'POWERPNT.EXE'
    @{generationSha256=(Get-FixtureSha256 $generationFile); savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath); powerPointVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion; windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; original=$original; reopened=$reopened} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} catch {
    @{passed=$false; stage=$stage; error=$_.Exception.Message; generationSha256=(Get-FixtureSha256 $generationFile); original=$original; reopened=$reopened} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if($null -ne $workbook) { $workbook.Close($false) }
    if($null -ne $presentation) { $presentation.Saved=-1; $presentation.Close() }
    # Close only our generated artifacts, never PowerPoint/Excel or user files.
}
