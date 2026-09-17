param([string]$EvidenceDirectory='artifacts/native-chart-colors',[ValidateRange(0,8)][int]$EditSlide=0,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference='Stop'
if($EditSlide -eq 0) { throw 'Select exactly one embedded workbook with -EditSlide 1 through 8. Never automatically retry a blocked Office activation.' }
. (Join-Path $PSScriptRoot 'native-process.ps1')
if(-not $Worker) {
    $root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-EditSlide',[string]$EditSlide,'-Worker') -OutputDirectory $root -TimeoutSeconds $TimeoutSeconds
    Get-Content -LiteralPath (Join-Path $root 'worker.stdout.log')
    if($result.timedOut) { throw 'Native chart worker timed out. No retry was started. Resolve any Office dialog before another invocation; generated-file cleanup may be incomplete.' }
    if($result.exitCode -ne 0) { Get-Content -LiteralPath (Join-Path $root 'worker.stderr.log'); throw "Native chart worker failed with exit code $($result.exitCode). No retry was started." }
    return
}
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
        $record.seriesData=@(for($seriesIndex=1; $seriesIndex -le $seriesCollection.Count; $seriesIndex++) {
            $series=$seriesCollection.Item($seriesIndex)
            @{name=$series.Name;categories=@($series.XValues);values=@($series.Values)}
        })
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
function Save-FixtureProgress([string]$Stage) {
    $script:stage=$Stage
    @{stage=$Stage;editSlide=$EditSlide;generationSha256=(Get-FixtureSha256 $generationFile);original=$original;reopened=$reopened} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'progress.json') -Encoding UTF8
}
try {
    Save-FixtureProgress 'connect'
    $powerpoint=New-Object -ComObject PowerPoint.Application
    Save-FixtureProgress 'open-original'
    $presentation=$powerpoint.Presentations.Open($sourcePath,0,0,0)
    $original=@(Read-FixtureCharts $presentation 'original')
    Save-FixtureProgress 'save-original'
    $savedPath=Join-Path $evidenceRoot 'charts-saved.pptx'
    $presentation.SaveAs($savedPath,24)
    $presentation.Close(); $presentation=$null
    $presentation=$powerpoint.Presentations.Open($savedPath,0,0,0)
    $reopened=@(Read-FixtureCharts $presentation 'reopened')
    # One activation per invocation prevents cascading prompts when Excel is in
    # a modal/editing state. Run separate fresh fixtures to cover other slides.
    foreach($slide in @($presentation.Slides.Item($EditSlide))) {
        Save-FixtureProgress "activate-slide-$($slide.SlideIndex)"
        Write-Output "Editing embedded workbook for generated slide $($slide.SlideIndex)."
        $shape=@($slide.Shapes | Where-Object { $_.HasChart -eq -1 })[0]
        $chart=$shape.Chart
        # Microsoft requires Activate before accessing the embedded Workbook:
        # https://learn.microsoft.com/en-us/office/vba/api/powerpoint.chartdata.activate
        $chart.ChartData.Activate()
        Save-FixtureProgress "edit-slide-$($slide.SlideIndex)"
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
        # Refresh redraws the chart; explicitly rebind its existing source range
        # so the native chart incorporates the edited embedded worksheet cells.
        Save-FixtureProgress "set-source-slide-$($slide.SlideIndex)"
        $lastColumn=[char](64+$edited.columns.Count)
        $lastRow=$edited.rows.Count+1
        $sourceRange="='"+$sheet.Name.Replace("'","''")+"'!"+'$A$1:$'+$lastColumn+'$'+$lastRow
        $chart.SetSourceData($sourceRange,2)
        Save-FixtureProgress "close-workbook-slide-$($slide.SlideIndex)"
        $workbook.Close($true); $workbook=$null
        $chart.Refresh()
        Write-Output 'Embedded workbook saved and chart refreshed.'
    }
    $editedPath=Join-Path $evidenceRoot 'charts-edited.pptx'
    Save-FixtureProgress 'save-edited'
    $presentation.SaveAs($editedPath,24)
    $presentation.Close(); $presentation=$null
    $presentation=$powerpoint.Presentations.Open($editedPath,0,0,0)
    if($presentation.Slides.Count -ne 8) { throw 'Edited charts did not reopen' }
    Save-FixtureProgress 'read-edited'
    $editedCharts=@(Read-FixtureCharts $presentation 'edited')
    $osVersion=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $executable=Join-Path $powerpoint.Path 'POWERPNT.EXE'
    @{generationSha256=(Get-FixtureSha256 $generationFile); editedSlides=@($EditSlide); savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath); powerPointVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $executable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; original=$original; reopened=$reopened; edited=$editedCharts} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} catch {
    @{passed=$false; stage=$stage; error=$_.Exception.Message; generationSha256=(Get-FixtureSha256 $generationFile); original=$original; reopened=$reopened} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if($null -ne $workbook) { $workbook.Close($false) }
    if($null -ne $presentation) { $presentation.Saved=-1; $presentation.Close() }
    # Close only our generated artifacts, never PowerPoint/Excel or user files.
}
