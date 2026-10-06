# RR-54 re-check, C2: open ONE deck read-only (with a window, which ChartData needs), activate the embedded workbook of
# the chart on ONE slide and read its value cells. One chart per process: a second ChartData.Activate in the same child
# hung behind an Excel dialog in opf#385. Never saves the deck, never quits PowerPoint or Excel, never reads
# Series.Formula (it crashes PowerPoint 16.0.20430, chart.dll 0xc0000005; opf#385).
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File editdata-chart.ps1 -Deck decks\c2-zeros-after.pptx -Slide 1 -Cells B2,B3 -Out out   (-Cells is one comma-separated string)
# Writes out\editdata-<name>-slideNN.json: per cell Value2 (null for a blank cell), Text and NumberFormat, and the used range.
param([Parameter(Mandatory=$true)][string]$Deck,[Parameter(Mandatory=$true)][int]$Slide,[Parameter(Mandatory=$true)][string]$Cells,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
if (-not (Test-Path -LiteralPath $Out)) { [void](New-Item -ItemType Directory -Path $Out) }
$outDir = (Resolve-Path -LiteralPath $Out).Path
$name = [IO.Path]::GetFileNameWithoutExtension($deckPath)
$file = Join-Path $outDir ('editdata-{0}-slide{1:D2}.json' -f $name, $Slide)
$report = [ordered]@{ deck = $name; slide = $Slide; sha256Before = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant(); startedAt = (Get-Date).ToUniversalTime().ToString('o'); stage = 'attach' }
function Save-Report { $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $file -Encoding UTF8 }
function Try-Get([scriptblock]$Read) { try { return & $Read } catch { return "ERROR: $($_.Exception.Message)" } }
Save-Report
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
foreach ($open in $pp.Presentations) { if ($open.FullName -eq $deckPath) { throw 'The deck is already open in PowerPoint; close it and rerun this chart once.' } }
$report.stage = 'open'; Save-Report
# Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoTrue)
$pres = $pp.Presentations.Open($deckPath, -1, 0, -1)
$workbook = $null
try {
  $shape = $null
  foreach ($candidate in $pres.Slides.Item($Slide).Shapes) { if ((Try-Get { $candidate.HasChart }) -eq -1) { $shape = $candidate; break } }
  if ($null -eq $shape) { throw "Slide $Slide has no chart." }
  $report.stage = 'activate'; Save-Report
  $shape.Chart.ChartData.Activate()
  $workbook = $shape.Chart.ChartData.Workbook
  $sheet = $workbook.Worksheets.Item(1)
  $report.stage = 'read'; Save-Report
  $report.usedRange = (Try-Get { $sheet.UsedRange.Address($false, $false) })
  $report.cells = [ordered]@{}
  foreach ($ref in ($Cells -split ',')) { $cell = $sheet.Range($ref); $report.cells[$ref] = [ordered]@{ value2 = $cell.Value2; text = $cell.Text; numberFormat = $cell.NumberFormat } }
  $report.stage = 'done'
} catch {
  $report.error = $_.Exception.Message
  $report.stage = "failed during $($report.stage)"
  throw
} finally {
  # Close the chart's workbook window (not Excel) and the read-only deck without saving.
  if ($null -ne $workbook) { try { $workbook.Close() } catch { $report.workbookCloseError = $_.Exception.Message } }
  $pres.Close()
  $report.sha256After = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-Report
}
