# Release qualification in PowerPoint for Windows, through COM only (no UI control). Reads <Out>\build.json from build.mjs and, for
# every PPTX in it, opens a copy (never the original), records whether it opened, exports every slide as a 1280 x 720 PNG, and probes
# each slide's shapes: SmartArt (layout, nodes, a node edit), charts, tables (a cell edit), connectors, text that runs past its frame,
# shrink-on-overflow autofit, and the Header and Footer settings with a slide move that renumbers live slide-number fields. It saves one
# untouched copy per file through PowerPoint (SaveCopyAs, before any edit) for the import round trip, then closes without saving.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\native-acceptance\qualification\run-powerpoint-windows.ps1 -Out C:\opf-work\qual-out\p1 [-Only smartart,footers] [-WaitMinutes 60]
#
# PowerPoint is shared with other sessions on this machine: the runner starts only when no POWERPNT.EXE is running (waiting up to
# -WaitMinutes, checking once a minute), closes only the presentations it opened, quits PowerPoint only when none other is open, and
# never kills Office. Output: <Out>\powerpoint\<file>\slide-<n>.png, <Out>\powerpoint\<file>.json, <Out>\powerpoint\saved\<file>.pptx and
# <Out>\powerpoint\run.json (PowerPoint version and build, Windows build). Grade it with evaluate.mjs.
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [string[]]$Only = @(),
  [int]$WaitMinutes = 0,
  [double]$Tolerance = 1.5
)
$ErrorActionPreference = 'Stop'
$Out = (Resolve-Path -LiteralPath $Out).Path
$build = Get-Content -LiteralPath (Join-Path $Out 'build.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$root = Join-Path $Out 'powerpoint'
$work = Join-Path $root 'work'
$saved = Join-Path $root 'saved'
New-Item -ItemType Directory -Force $root, $work, $saved | Out-Null

function Test-PowerPointRunning { return [bool](Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) }
$deadline = (Get-Date).AddMinutes($WaitMinutes)
while (Test-PowerPointRunning) {
  if ((Get-Date) -ge $deadline) { Write-Host 'POWERPNT.EXE is running (another session may be measuring); not starting.'; exit 3 }
  Write-Host 'POWERPNT.EXE is running; waiting a minute.'; Start-Sleep -Seconds 60
}

function Invoke-Retry([scriptblock]$Block, [int]$Tries = 10) {
  for ($try = 1; ; $try++) { try { return & $Block } catch { if ($try -ge $Tries) { throw }; Start-Sleep -Milliseconds 1500 } }
}
function Get-Safe([scriptblock]$Block) { try { return & $Block } catch { return $null } }

$app = $null
for ($try = 0; $try -lt 30 -and -not $app; $try++) { try { $app = New-Object -ComObject PowerPoint.Application } catch { Start-Sleep -Seconds 2 } }
if (-not $app) { throw 'PowerPoint did not start' }
$app.Visible = -1
try { $app.WindowState = 2 } catch {}
$exe = Join-Path $app.Path 'POWERPNT.EXE'
$fileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
$windowsKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion')
$environment = [ordered]@{
  powerPointVersion = $app.Version; powerPointBuild = $app.Build; productVersion = $fileVersion.ProductVersion; fileVersion = $fileVersion.FileVersion
  windows = "$($windowsKey.GetValue('ProductName')) $($windowsKey.GetValue('DisplayVersion')) build $($windowsKey.GetValue('CurrentBuildNumber')).$($windowsKey.GetValue('UBR'))"
  culture = [System.Globalization.CultureInfo]::CurrentCulture.Name; startedAt = (Get-Date).ToString('o'); revision = $build.revision; opfVersion = $build.opfVersion
}
$windowsKey.Dispose()
$alerts = $app.DisplayAlerts
$app.DisplayAlerts = 1  # ppAlertsNone: a file that needs repair fails to open instead of prompting.

function Get-TextInfo($shape) {
  $info = $null
  $hasFrame = Get-Safe { $shape.HasTextFrame -eq -1 }
  if (-not $hasFrame) { return $null }
  $tf = $shape.TextFrame2
  if (-not (Get-Safe { $tf.HasText -eq -1 })) { return $null }
  $range = $tf.TextRange
  $info = [ordered]@{
    text = [string]$range.Text; autoSize = $tf.AutoSize; wordWrap = $tf.WordWrap
    minSize = $null; maxSize = $null; font = (Get-Safe { $range.Runs(1).Font.Name })
    bound = @([math]::Round($range.BoundLeft, 2), [math]::Round($range.BoundTop, 2), [math]::Round($range.BoundWidth, 2), [math]::Round($range.BoundHeight, 2))
    overflow = @()
  }
  $sizes = @(for ($r = 1; $r -le $range.Runs().Count; $r++) { Get-Safe { $range.Runs($r).Font.Size } })
  $sizes = @($sizes | Where-Object { $_ -ne $null -and $_ -gt 0 })
  if ($sizes.Count) { $info.minSize = ($sizes | Measure-Object -Minimum).Minimum; $info.maxSize = ($sizes | Measure-Object -Maximum).Maximum }
  if ($shape.Rotation -eq 0 -and $info.text.Trim().Length -gt 0) {
    $left = $shape.Left; $top = $shape.Top; $right = $left + $shape.Width; $bottom = $top + $shape.Height
    if ($range.BoundTop -lt $top - $Tolerance) { $info.overflow += 'top' }
    if ($range.BoundTop + $range.BoundHeight -gt $bottom + $Tolerance) { $info.overflow += 'bottom' }
    if ($range.BoundLeft -lt $left - $Tolerance) { $info.overflow += 'left' }
    if ($range.BoundLeft + $range.BoundWidth -gt $right + $Tolerance) { $info.overflow += 'right' }
  }
  return $info
}

function Get-ShapeInfo($shape, [int]$depth) {
  $rec = [ordered]@{
    name = $shape.Name; type = $shape.Type; autoShapeType = (Get-Safe { $shape.AutoShapeType })
    box = @([math]::Round($shape.Left, 2), [math]::Round($shape.Top, 2), [math]::Round($shape.Width, 2), [math]::Round($shape.Height, 2)); rotation = $shape.Rotation
  }
  $placeholder = Get-Safe { if ($shape.Type -eq 14) { $shape.PlaceholderFormat.Type } }
  if ($placeholder) { $rec.placeholder = $placeholder }
  if (Get-Safe { $shape.Connector -eq -1 }) {
    $cf = $shape.ConnectorFormat
    $rec.connector = [ordered]@{ type = $cf.Type; begin = ($cf.BeginConnected -eq -1); end = ($cf.EndConnected -eq -1) }
  }
  if (Get-Safe { $shape.HasChart -eq -1 }) {
    $chart = $shape.Chart
    $rec.chart = [ordered]@{ type = $chart.ChartType; series = (Get-Safe { $chart.SeriesCollection().Count }); title = (Get-Safe { if ($chart.HasTitle) { $chart.ChartTitle.Text } }) }
  }
  if (Get-Safe { $shape.HasTable -eq -1 }) {
    $table = $shape.Table
    $rec.table = [ordered]@{ rows = $table.Rows.Count; columns = $table.Columns.Count; edit = $false }
    $cell = $table.Cell(1, 1).Shape.TextFrame.TextRange
    $before = $cell.Text; $cell.Text = "$before (edited)"; $rec.table.edit = ($table.Cell(1, 1).Shape.TextFrame.TextRange.Text -eq "$before (edited)"); $cell.Text = $before
  }
  if (Get-Safe { $shape.HasSmartArt -eq -1 }) {
    $sa = $shape.SmartArt
    $nodes = $sa.AllNodes
    $rec.smartArt = [ordered]@{
      layout = (Get-Safe { $sa.Layout.Name }); layoutId = (Get-Safe { $sa.Layout.Id }); nodes = $nodes.Count
      texts = @(for ($n = 1; $n -le $nodes.Count; $n++) { [string]$nodes.Item($n).TextFrame2.TextRange.Text })
      sizes = @(for ($n = 1; $n -le $nodes.Count; $n++) { Get-Safe { $nodes.Item($n).TextFrame2.TextRange.Font.Size } })
    }
  }
  $text = Get-TextInfo $shape
  if ($text) { $rec.text = $text }
  if ($shape.Type -eq 6 -or (Get-Safe { $shape.HasSmartArt -eq -1 })) {
    $items = Get-Safe { $shape.GroupItems }
    if ($items) { $rec.children = @(for ($i = 1; $i -le $items.Count; $i++) { Get-ShapeInfo $items.Item($i) ($depth + 1) }) }
  }
  return $rec
}

# The node edit runs after the round-trip copy is saved: type into the first node and check every node keeps its size and frame.
function Test-SmartArtEdit($shape) {
  $sa = $shape.SmartArt; $nodes = $sa.AllNodes
  $sizes = @(for ($n = 1; $n -le $nodes.Count; $n++) { Get-Safe { $nodes.Item($n).TextFrame2.TextRange.Font.Size } })
  $rects = @(for ($i = 1; $i -le $shape.GroupItems.Count; $i++) { $g = $shape.GroupItems.Item($i); '{0:N1},{1:N1},{2:N1},{3:N1}' -f $g.Left, $g.Top, $g.Width, $g.Height })
  $range = $nodes.Item(1).TextFrame2.TextRange; $before = $range.Text; $range.Text = 'Edited'
  $after = @(for ($n = 1; $n -le $nodes.Count; $n++) { Get-Safe { $nodes.Item($n).TextFrame2.TextRange.Font.Size } })
  $rectsAfter = @(for ($i = 1; $i -le $shape.GroupItems.Count; $i++) { $g = $shape.GroupItems.Item($i); '{0:N1},{1:N1},{2:N1},{3:N1}' -f $g.Left, $g.Top, $g.Width, $g.Height })
  $nodes.Item(1).TextFrame2.TextRange.Text = $before
  return [ordered]@{ sizesKept = (($sizes -join '/') -eq ($after -join '/')); framesKept = (($rects -join ';') -eq ($rectsAfter -join ';')); sizesBefore = $sizes; sizesAfter = $after }
}

function Get-FooterInfo($slide) {
  $hf = $slide.HeadersFooters
  $placeholders = @()
  for ($k = 1; $k -le $slide.Shapes.Count; $k++) {
    $s = $slide.Shapes.Item($k)
    $type = Get-Safe { if ($s.Type -eq 14) { $s.PlaceholderFormat.Type } }
    if ($type -eq 13 -or $type -eq 15 -or $type -eq 16) { $placeholders += [ordered]@{ type = $type; name = $s.Name; text = (Get-Safe { [string]$s.TextFrame.TextRange.Text }) } }
  }
  return [ordered]@{
    footer = (Get-Safe { $hf.Footer.Visible -eq -1 }); footerText = (Get-Safe { [string]$hf.Footer.Text })
    slideNumber = (Get-Safe { $hf.SlideNumber.Visible -eq -1 }); date = (Get-Safe { $hf.DateAndTime.Visible -eq -1 }); placeholders = $placeholders
  }
}

function Get-NumberTexts($presentation) {
  $texts = @()
  for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
    $slide = $presentation.Slides.Item($i); $id = $slide.SlideID; $found = @()
    for ($k = 1; $k -le $slide.Shapes.Count; $k++) {
      $s = $slide.Shapes.Item($k)
      $type = Get-Safe { if ($s.Type -eq 14) { $s.PlaceholderFormat.Type } }
      if ($type -eq 13) { $found += (Get-Safe { [string]$s.TextFrame.TextRange.Text }) }
    }
    $texts += [ordered]@{ slideId = $id; position = $i; numbers = $found }
  }
  return $texts
}

$files = @()
foreach ($deck in $build.decks) {
  foreach ($variant in $deck.variants) {
    if (-not $variant.ok) { continue }
    $name = [IO.Path]::GetFileNameWithoutExtension($variant.pptx)
    if ($Only.Count -and -not ($Only -contains $deck.id -or $Only -contains $name)) { continue }
    $files += [pscustomobject]@{ deck = $deck.id; variant = $variant.name; name = $name; pptx = (Join-Path $Out $variant.pptx); sha256 = $variant.sha256; previewSlides = $deck.previewSlides }
  }
}

$opened = New-Object Collections.ArrayList
$summary = @()
try {
  foreach ($file in $files) {
    $result = [ordered]@{ deck = $file.deck; variant = $file.variant; name = $file.name; sha256 = $file.sha256; opened = $false; previewSlides = $file.previewSlides }
    $copy = Join-Path $work "$($file.name).pptx"
    Copy-Item -LiteralPath $file.pptx -Destination $copy -Force
    $pngDir = Join-Path $root $file.name
    New-Item -ItemType Directory -Force $pngDir | Out-Null
    $presentation = $null
    $started = Get-Date
    try {
      $presentation = $app.Presentations.Open($copy, 0, 0, -1)
      [void]$opened.Add($presentation)
      try { $presentation.Windows.Item(1).WindowState = 2 } catch {}
      $result.opened = $true
      $result.openSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
      $result.slideCount = $presentation.Slides.Count
      $result.slideSize = @($presentation.PageSetup.SlideWidth, $presentation.PageSetup.SlideHeight)
      Invoke-Retry { $presentation.SaveCopyAs((Join-Path $saved "$($file.name).pptx"), 24) } | Out-Null
      $slides = @()
      for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
        $slide = $presentation.Slides.Item($i)
        Invoke-Retry { $slide.Export((Join-Path $pngDir "slide-$i.png"), 'PNG', 1280, 720) } | Out-Null
        $shapes = @(for ($k = 1; $k -le $slide.Shapes.Count; $k++) { Get-ShapeInfo $slide.Shapes.Item($k) 0 })
        $edits = @()
        for ($k = 1; $k -le $slide.Shapes.Count; $k++) {
          $s = $slide.Shapes.Item($k)
          if (Get-Safe { $s.HasSmartArt -eq -1 }) { try { $edits += Test-SmartArtEdit $s } catch { $edits += [ordered]@{ error = $_.Exception.Message } } }
        }
        $slides += [ordered]@{ index = $i; hidden = ($slide.SlideShowTransition.Hidden -eq -1); layout = (Get-Safe { $slide.CustomLayout.Name }); footer = (Get-FooterInfo $slide); shapes = $shapes; smartArtEdits = $edits }
      }
      $result.slides = $slides
      # Live slide numbers: move the first slide to the end and read every slide-number placeholder again, then move it back.
      if ($presentation.Slides.Count -gt 1) {
        $before = Get-NumberTexts $presentation
        $presentation.Slides.Item(1).MoveTo($presentation.Slides.Count)
        $moved = Get-NumberTexts $presentation
        $presentation.Slides.Item($presentation.Slides.Count).MoveTo(1)
        $result.renumber = [ordered]@{ before = $before; moved = $moved }
      }
    } catch {
      $result.error = $_.Exception.Message
    } finally {
      if ($presentation) { try { $presentation.Saved = -1; $presentation.Close() } catch {}; [void]$opened.Remove($presentation) }
    }
    $result.seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
    $result | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $root "$($file.name).json") -Encoding UTF8
    $summary += [pscustomobject]@{ name = $file.name; opened = $result.opened; slides = $result.slideCount; preview = $file.previewSlides; error = $result.error; seconds = $result.seconds }
    Write-Host ("{0}: opened={1} slides={2}/{3} {4}s {5}" -f $file.name, $result.opened, $result.slideCount, $file.previewSlides, $result.seconds, $result.error)
  }
} finally {
  foreach ($p in @($opened)) { try { $p.Saved = -1; $p.Close() } catch {} }
  try { $app.DisplayAlerts = $alerts } catch {}
  $environment.finishedAt = (Get-Date).ToString('o')
  [ordered]@{ environment = $environment; files = $summary } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'run.json') -Encoding UTF8
  try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
