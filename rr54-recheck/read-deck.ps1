# RR-54 re-check, C3: open ONE deck read-only in the running PowerPoint and read its charts. Never saves, quits or kills
# PowerPoint. Never reads Series.Formula (it crashes PowerPoint 16.0.20430, chart.dll 0xc0000005; opf#385).
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File read-deck.ps1 -Deck decks\c2-zeros-after.pptx -Out out
# Writes out\read-<name>.json (stage, slide count, per slide the chart type, series names and per-series data-label
# number format) and out\<name>-slideNN.png (1280 x 720).
param([Parameter(Mandatory=$true)][string]$Deck,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
if (-not (Test-Path -LiteralPath $Out)) { [void](New-Item -ItemType Directory -Path $Out) }
$outDir = (Resolve-Path -LiteralPath $Out).Path
$name = [IO.Path]::GetFileNameWithoutExtension($deckPath)
$report = [ordered]@{ deck = $name; sha256Before = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant(); startedAt = (Get-Date).ToUniversalTime().ToString('o'); stage = 'attach' }
function Save-Report { $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outDir "read-$name.json") -Encoding UTF8 }
function Try-Get([scriptblock]$Read) { try { return & $Read } catch { return "ERROR: $($_.Exception.Message)" } }
Save-Report
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
$report.powerpoint = [ordered]@{ version = $pp.Version; build = $pp.Build }
foreach ($open in $pp.Presentations) { if ($open.FullName -eq $deckPath) { throw 'The deck is already open in PowerPoint; close it and rerun this deck once.' } }
$report.stage = 'open'; Save-Report
# Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
$pres = $pp.Presentations.Open($deckPath, -1, 0, 0)
try {
  $report.stage = 'read'; Save-Report
  $slides = @()
  foreach ($slide in $pres.Slides) {
    $charts = @()
    foreach ($shape in $slide.Shapes) {
      if ((Try-Get { $shape.HasChart }) -eq -1) {
        $chart = $shape.Chart
        $collection = $chart.SeriesCollection()
        # One-based indexed access (the PowerShell COM enumerator can return null series). No Series.Formula.
        $series = @(for ($i = 1; $i -le $collection.Count; $i++) { $item = $collection.Item($i); [ordered]@{ name = (Try-Get { $item.Name }); labelFormat = (Try-Get { if ($item.HasDataLabels) { $item.DataLabels().NumberFormat } else { $null } }) } })
        $charts += [ordered]@{ shape = $shape.Name; chartType = (Try-Get { $chart.ChartType }); series = $series }
      }
    }
    $png = Join-Path $outDir ('{0}-slide{1:D2}.png' -f $name, $slide.SlideIndex)
    $slide.Export($png, 'PNG', 1280, 720)
    $slides += [ordered]@{ index = $slide.SlideIndex; charts = $charts; png = [IO.Path]::GetFileName($png) }
  }
  $report.slides = $slides
  $report.stage = 'done'
} catch {
  $report.error = $_.Exception.Message
  $report.stage = "failed during $($report.stage)"
  throw
} finally {
  $pres.Close()
  $report.sha256After = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-Report
}
