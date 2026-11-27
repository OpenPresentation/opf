# NT-16: the PowerPoint driver on Windows. ONE Windows PowerShell 5.1 process drives the whole run: it creates one
# PowerPoint.Application, handles every file of the plan in turn and quits it only when no presentation is left open.
# driver.mjs writes the plan, starts this script once and builds result.json and run.json from what it writes.
#
#   powershell.exe -NoProfile -NonInteractive -File powerpoint.ps1 -Plan <run dir>\powerpoint-plan.json
#   powershell.exe -NoProfile -NonInteractive -File powerpoint.ps1 -Plan <plan> -SelfTest -Fake <scenario.json>
#
# Rules of this machine, enforced here (README.md beside this file):
#   1. It refuses when POWERPNT.EXE or EXCEL.EXE already runs: that instance is the owner's (exit 3).
#   2. Every COM call runs on one STA worker thread (a runspace) and the main thread waits for it with a time limit. A call
#      that does not return in time is "timeout"; the files after it are "not-run"; the script then exits (4) without
#      ending PowerPoint and says that a POWERPNT.EXE process may be left for the supervisor to look at.
#   3. Presentations.Open(path, ReadOnly msoTrue, Untitled msoFalse, WithWindow msoFalse). The input is never saved:
#      copies go through SaveCopyAs into the run directory; Saved is set before Close. SHA-256 before and after.
#   4. It never stops a process, never sends keys, never shows or activates a window and never answers a dialog.
#   5. It never opens a chart's workbook (no ChartData, no Workbook) and stops the run if EXCEL.EXE appears.
#   6. It installs and registers no font.
# Every COM call is inside a function named Com-*; -SelfTest replaces all of them (and Get-OfficeProcesses) with the
# fakes of powerpoint-fake.ps1, so the control flow below runs without PowerPoint.
param(
  [string]$Plan,
  [switch]$SelfTest,
  [string]$Fake
)
$ErrorActionPreference = 'Stop'

# ---- COM layer (runs on the worker thread only) -----------------------------------------------------------------------

function Com-TryGet {
  param([scriptblock]$Read)
  try { return (& $Read) } catch { return $null }
}

function Com-Round {
  param($Value)
  if ($null -eq $Value) { return $null }
  try { return [math]::Round([double]$Value, 2) } catch { return $null }
}

function Com-Hex {
  param($Bgr)
  if ($null -eq $Bgr) { return $null }
  try { $n = [int]$Bgr; return ('{0:X2}{1:X2}{2:X2}' -f ($n -band 0xFF), (($n -shr 8) -band 0xFF), (($n -shr 16) -band 0xFF)) } catch { return $null }
}

function Com-NewApp {
  param()
  $app = New-Object -ComObject PowerPoint.Application
  # ppAlertsNone: no alert is raised that nobody could answer. The window is never shown and never activated.
  try { $app.DisplayAlerts = 1 } catch {}
  return $app
}

function Com-AppInfo {
  param($App)
  return [ordered]@{ name = 'PowerPoint'; version = [string]$App.Version; build = [string](Com-TryGet { $App.Build }) }
}

function Com-Open {
  param($App, [string]$Path)
  # ReadOnly msoTrue (-1), Untitled msoFalse (0), WithWindow msoFalse (0).
  return $App.Presentations.Open($Path, -1, 0, 0)
}

function Com-PresInfo {
  param($Pres)
  $count = [int]$Pres.Slides.Count
  $slides = New-Object System.Collections.ArrayList
  for ($i = 1; $i -le $count; $i++) {
    $slide = $Pres.Slides.Item($i)
    [void]$slides.Add([ordered]@{
      index = $i
      id = (Com-TryGet { [int]$slide.SlideID })
      hidden = ((Com-TryGet { [int]$slide.SlideShowTransition.Hidden }) -eq -1)
      layout = (Com-TryGet { [string]$slide.CustomLayout.Name })
    })
  }
  $fonts = New-Object System.Collections.ArrayList
  $fontCount = Com-TryGet { [int]$Pres.Fonts.Count }
  if ($fontCount -is [int]) {
    for ($i = 1; $i -le $fontCount; $i++) {
      $font = $Pres.Fonts.Item($i)
      [void]$fonts.Add([ordered]@{ name = (Com-TryGet { [string]$font.Name }); embedded = ((Com-TryGet { [int]$font.Embedded }) -eq -1) })
    }
  }
  return [ordered]@{
    slideCount = $count
    slideSize = @((Com-Round $Pres.PageSetup.SlideWidth), (Com-Round $Pres.PageSetup.SlideHeight))
    fonts = $fonts.ToArray()
    slides = $slides.ToArray()
  }
}

function Com-ExportSlide {
  param($Pres, [int]$Index, [string]$File, [int]$Width, [int]$Height)
  $Pres.Slides.Item($Index).Export($File, 'PNG', $Width, $Height)
}

function Com-Link {
  # A hyperlink of an ActionSettings collection (mouse click), or $null. The Hyperlink's address decides, not Action: the
  # first PowerPoint run (2026-11-27) found no link on words while Action had to be ppActionHyperlink.
  param($Settings)
  $setting = Com-TryGet { $Settings.Item(1) }
  if ($null -eq $setting) { return $null }
  $address = [string](Com-TryGet { $setting.Hyperlink.Address })
  $sub = [string](Com-TryGet { $setting.Hyperlink.SubAddress })
  if ($address -eq '' -and $sub -eq '') { return $null }
  return [ordered]@{ address = $address; subAddress = $sub }
}

function Com-TextFacts {
  # Text, fonts, bullets and hyperlinked runs of one TextRange.
  param($Range)
  $facts = [ordered]@{ text = [string](Com-TryGet { $Range.Text }); fonts = @(); bullets = $false; links = @() }
  $fonts = New-Object System.Collections.ArrayList
  $links = New-Object System.Collections.ArrayList
  $runs = Com-TryGet { [int]$Range.Runs().Count }
  if ($runs -is [int]) {
    for ($r = 1; $r -le $runs; $r++) {
      $run = Com-TryGet { $Range.Runs($r, 1) }
      if ($null -eq $run) { continue }
      $name = [string](Com-TryGet { $run.Font.Name })
      if ($name -ne '' -and -not $fonts.Contains($name)) { [void]$fonts.Add($name) }
      $link = Com-Link (Com-TryGet { $run.ActionSettings })
      if ($null -ne $link) { $link.text = [string](Com-TryGet { $run.Text }); [void]$links.Add($link) }
    }
  }
  $paragraphs = Com-TryGet { [int]$Range.Paragraphs().Count }
  if ($paragraphs -is [int]) {
    for ($p = 1; $p -le $paragraphs; $p++) {
      $bullet = Com-TryGet { $Range.Paragraphs($p, 1).ParagraphFormat.Bullet }
      if ($null -ne $bullet -and (Com-TryGet { [int]$bullet.Visible }) -eq -1 -and (Com-TryGet { [int]$bullet.Type }) -gt 0) { $facts.bullets = $true }
    }
  }
  $facts.fonts = $fonts.ToArray()
  $facts.links = $links.ToArray()
  return $facts
}

function Com-ReadShape {
  param($Shape, [bool]$ReadCharts)
  $type = [int]$Shape.Type
  $row = [ordered]@{
    name = [string]$Shape.Name
    id = (Com-TryGet { [int]$Shape.Id })
    type = $type
    left = (Com-Round $Shape.Left); top = (Com-Round $Shape.Top); width = (Com-Round $Shape.Width); height = (Com-Round $Shape.Height)
    rotation = (Com-Round (Com-TryGet { $Shape.Rotation }))
    alt = [string](Com-TryGet { $Shape.AlternativeText })
  }
  if ($type -eq 14) {
    $row.placeholder = [ordered]@{ type = (Com-TryGet { [int]$Shape.PlaceholderFormat.Type }); containedType = (Com-TryGet { [int]$Shape.PlaceholderFormat.ContainedType }) }
  }
  $row.hasTable = ((Com-TryGet { [int]$Shape.HasTable }) -eq -1)
  $row.hasChart = ((Com-TryGet { [int]$Shape.HasChart }) -eq -1)
  $row.hasSmartArt = ((Com-TryGet { [int]$Shape.HasSmartArt }) -eq -1)
  $row.connector = ((Com-TryGet { [int]$Shape.Connector }) -eq -1)
  $row.click = Com-Link (Com-TryGet { $Shape.ActionSettings })
  if ($row.connector -or $type -eq 9) {
    $ends = [ordered]@{ flipH = ((Com-TryGet { [int]$Shape.HorizontalFlip }) -eq -1); flipV = ((Com-TryGet { [int]$Shape.VerticalFlip }) -eq -1) }
    if ($row.connector) {
      $format = $Shape.ConnectorFormat
      $ends.type = Com-TryGet { [int]$format.Type }
      $ends.begin = [ordered]@{ connected = ((Com-TryGet { [int]$format.BeginConnected }) -eq -1) }
      if ($ends.begin.connected) { $ends.begin.shape = [string](Com-TryGet { $format.BeginConnectedShape.Name }); $ends.begin.site = Com-TryGet { [int]$format.BeginConnectionSite } }
      $ends.end = [ordered]@{ connected = ((Com-TryGet { [int]$format.EndConnected }) -eq -1) }
      if ($ends.end.connected) { $ends.end.shape = [string](Com-TryGet { $format.EndConnectedShape.Name }); $ends.end.site = Com-TryGet { [int]$format.EndConnectionSite } }
    }
    $row.line = $ends
  }
  if ((Com-TryGet { [int]$Shape.HasTextFrame }) -eq -1 -and -not $row.hasTable) {
    $frame = $Shape.TextFrame
    $row.textFrame = [ordered]@{
      autoSize = (Com-TryGet { [int]$Shape.TextFrame2.AutoSize })
      wordWrap = (Com-TryGet { [int]$frame.WordWrap })
      boundHeight = (Com-Round (Com-TryGet { $frame.TextRange.BoundHeight }))
    }
    if ((Com-TryGet { [int]$frame.HasText }) -eq -1) {
      $facts = Com-TextFacts $frame.TextRange
      $row.text = $facts.text; $row.fonts = $facts.fonts; $row.bullets = $facts.bullets; $row.textLinks = $facts.links
    }
  }
  if ($row.hasTable) {
    $table = $Shape.Table
    $rows = [int]$table.Rows.Count
    $columns = [int]$table.Columns.Count
    $row.rows = $rows; $row.columns = $columns
    $cells = New-Object System.Collections.ArrayList
    $cellLinks = New-Object System.Collections.ArrayList
    $fonts = New-Object System.Collections.ArrayList
    for ($r = 1; $r -le $rows; $r++) {
      $line = New-Object System.Collections.ArrayList
      for ($c = 1; $c -le $columns; $c++) {
        $cell = Com-TryGet { $table.Cell($r, $c).Shape }
        $fill = $null
        if ($null -ne $cell -and (Com-TryGet { [int]$cell.Fill.Visible }) -eq -1) { $fill = Com-Hex (Com-TryGet { $cell.Fill.ForeColor.RGB }) }
        $facts = $null
        if ($null -ne $cell) { $facts = Com-TextFacts $cell.TextFrame.TextRange }
        $text = ''
        $color = $null
        if ($null -ne $facts) {
          $text = $facts.text
          $color = Com-Hex (Com-TryGet { $cell.TextFrame.TextRange.Font.Color.RGB })
          foreach ($name in $facts.fonts) { if (-not $fonts.Contains($name)) { [void]$fonts.Add($name) } }
          foreach ($link in $facts.links) { $link.row = $r; $link.column = $c; [void]$cellLinks.Add($link) }
        }
        [void]$line.Add([ordered]@{ text = $text; fill = $fill; color = $color })
      }
      [void]$cells.Add($line.ToArray())
    }
    $row.cells = $cells.ToArray()
    $row.cellLinks = $cellLinks.ToArray()
    $row.fonts = $fonts.ToArray()
  }
  if ($row.hasChart -and $ReadCharts) {
    # Only the chart object's own properties: nothing that opens the chart's workbook (no ChartData, no Workbook).
    $chart = $Shape.Chart
    $names = New-Object System.Collections.ArrayList
    $seriesCount = Com-TryGet { [int]$chart.SeriesCollection().Count }
    if ($seriesCount -is [int]) { for ($i = 1; $i -le $seriesCount; $i++) { [void]$names.Add([string](Com-TryGet { $chart.SeriesCollection($i).Name })) } }
    $row.chart = [ordered]@{
      chartType = (Com-TryGet { [int]$chart.ChartType })
      hasTitle = ((Com-TryGet { [bool]$chart.HasTitle }) -eq $true)
      title = [string](Com-TryGet { $chart.ChartTitle.Text })
      hasLegend = ((Com-TryGet { [bool]$chart.HasLegend }) -eq $true)
      legendPosition = (Com-TryGet { [int]$chart.Legend.Position })
      series = $names.ToArray()
      plotArea = @((Com-Round (Com-TryGet { $chart.PlotArea.InsideLeft })), (Com-Round (Com-TryGet { $chart.PlotArea.InsideTop })), (Com-Round (Com-TryGet { $chart.PlotArea.InsideWidth })), (Com-Round (Com-TryGet { $chart.PlotArea.InsideHeight })))
    }
  }
  if ($row.hasSmartArt) {
    $row.smartArt = [ordered]@{ layout = [string](Com-TryGet { $Shape.SmartArt.Layout.Name }); layoutId = [string](Com-TryGet { $Shape.SmartArt.Layout.Id }); nodes = (Com-TryGet { [int]$Shape.SmartArt.AllNodes.Count }) }
  }
  if ($type -eq 16) { $row.mediaType = Com-TryGet { [int]$Shape.MediaType } }
  if ($type -eq 6 -and -not $row.hasSmartArt) {
    # PowerPoint reports a member's frame in slide coordinates, which is what the shared format means.
    $members = New-Object System.Collections.ArrayList
    foreach ($member in $Shape.GroupItems) { [void]$members.Add((Com-ReadShape $member $ReadCharts)) }
    $row.members = $members.ToArray()
  }
  return $row
}

function Com-ProbeSlide {
  param($Pres, [int]$Index, [bool]$ReadCharts)
  $slide = $Pres.Slides.Item($Index)
  $shapes = New-Object System.Collections.ArrayList
  foreach ($shape in $slide.Shapes) { [void]$shapes.Add((Com-ReadShape $shape $ReadCharts)) }
  $notes = $null
  # HasNotesPage first: reading NotesPage on a slide without one would create it.
  if ((Com-TryGet { [int]$slide.HasNotesPage }) -eq -1) {
    foreach ($placeholder in $slide.NotesPage.Shapes.Placeholders) {
      if ((Com-TryGet { [int]$placeholder.PlaceholderFormat.Type }) -eq 2) { $notes = [string](Com-TryGet { $placeholder.TextFrame.TextRange.Text }) }
    }
  }
  # Every hyperlink of the slide as PowerPoint lists it, also those the per-shape reading above cannot reach.
  $hyperlinks = New-Object System.Collections.ArrayList
  foreach ($link in $slide.Hyperlinks) {
    [void]$hyperlinks.Add([ordered]@{ address = [string](Com-TryGet { $link.Address }); subAddress = [string](Com-TryGet { $link.SubAddress }); type = (Com-TryGet { [int]$link.Type }); text = [string](Com-TryGet { $link.TextToDisplay }) })
  }
  return [ordered]@{ notes = $notes; shapes = $shapes.ToArray(); hyperlinks = $hyperlinks.ToArray() }
}

function Com-SaveCopy {
  param($Pres, [string]$File)
  $Pres.SaveCopyAs($File)
}

function Com-FirstTable {
  param($Pres, [int]$MinRows)
  foreach ($slide in $Pres.Slides) {
    foreach ($shape in $slide.Shapes) {
      if ((Com-TryGet { [int]$shape.HasTable }) -eq -1 -and [int]$shape.Table.Rows.Count -ge $MinRows) { return [ordered]@{ slide = [int]$slide.SlideIndex; shape = $shape } }
    }
  }
  return $null
}

function Com-ApplyEdit {
  # One edit case in memory on the open (read-only) presentation. Returns { applies, what, why }.
  param($Pres, [string]$Case)
  $new = 'https://example.com/changed-in-powerpoint'
  switch ($Case) {
    { $_ -in 'retype-cell', 'refill-cell', 'add-row' } {
      $hit = Com-FirstTable $Pres 1
      if ($null -eq $hit) { return [ordered]@{ applies = $false; why = 'the file has no table' } }
      $table = $hit.shape.Table
      $r = 1
      if ([int]$table.Rows.Count -ge 2) { $r = 2 }
      $where = "table '$($hit.shape.Name)' on slide $($hit.slide)"
      if ($Case -eq 'retype-cell') {
        $table.Cell($r, 1).Shape.TextFrame.TextRange.Text = 'Retyped in PowerPoint'
        return [ordered]@{ applies = $true; what = "retyped the text of row $r, column 1 of $where" }
      }
      if ($Case -eq 'refill-cell') {
        $fill = $table.Cell($r, 1).Shape.Fill
        $fill.Visible = -1
        $fill.Solid()
        $fill.ForeColor.RGB = 49407
        return [ordered]@{ applies = $true; what = "refilled row $r, column 1 of $where with FFC000" }
      }
      [void]$table.Rows.Add()
      return [ordered]@{ applies = $true; what = "added a row at the end of $where" }
    }
    'delete-row' {
      $hit = Com-FirstTable $Pres 2
      if ($null -eq $hit) { return [ordered]@{ applies = $false; why = 'the file has no table with two rows or more' } }
      $count = [int]$hit.shape.Table.Rows.Count
      $hit.shape.Table.Rows.Item($count).Delete()
      return [ordered]@{ applies = $true; what = "deleted row $count of table '$($hit.shape.Name)' on slide $($hit.slide)" }
    }
    'change-link' {
      # Slide.Hyperlinks lists every hyperlink of a slide, on shapes and on text ranges (MsoHyperlinkType: 0 range, 1 shape).
      foreach ($slide in $Pres.Slides) {
        foreach ($link in $slide.Hyperlinks) {
          $old = [string](Com-TryGet { $link.Address })
          if ($old -eq '') { continue }
          $on = 'text'
          if ((Com-TryGet { [int]$link.Type }) -eq 1) { $on = 'a shape' }
          $link.Address = $new
          return [ordered]@{ applies = $true; what = "changed the address of a hyperlink on $on on slide $($slide.SlideIndex) from $old to $new" }
        }
      }
      return [ordered]@{ applies = $false; why = 'no slide has a hyperlink with a web address' }
    }
    'add-paragraph' {
      $hit = $null
      foreach ($slide in $Pres.Slides) {
        foreach ($shape in $slide.Shapes) {
          if ($null -ne $hit) { break }
          if ((Com-TryGet { [int]$shape.HasTextFrame }) -eq -1 -and (Com-TryGet { [int]$shape.TextFrame.HasText }) -eq -1 -and [int]$shape.Type -ne 14) { $hit = [ordered]@{ slide = [int]$slide.SlideIndex; shape = $shape } }
        }
      }
      if ($null -eq $hit) { return [ordered]@{ applies = $false; why = 'the file has no text box with text' } }
      [void]$hit.shape.TextFrame.TextRange.InsertAfter("`rAdded in PowerPoint")
      return [ordered]@{ applies = $true; what = "added a paragraph at the end of '$($hit.shape.Name)' on slide $($hit.slide)" }
    }
    'move-shape' {
      foreach ($slide in $Pres.Slides) {
        foreach ($shape in $slide.Shapes) {
          if ([int]$shape.Type -ne 14) {
            $shape.Left = $shape.Left + 36
            return [ordered]@{ applies = $true; what = "moved '$($shape.Name)' on slide $($slide.SlideIndex) 36 pt to the right" }
          }
        }
      }
      return [ordered]@{ applies = $false; why = 'the file has no shape outside the placeholders' }
    }
    default { throw "unknown edit case $Case" }
  }
}

function Com-Close {
  param($Pres)
  # Saved = msoTrue: PowerPoint does not ask to save; nothing is written to the input.
  try { $Pres.Saved = -1 } catch {}
  $Pres.Close()
}

function Com-OpenCount {
  param($App)
  return [int]$App.Presentations.Count
}

function Com-Quit {
  param($App)
  $App.Quit()
}

function Com-Release {
  # Every reference this thread holds to the application, not just one.
  param($App)
  try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($App) } catch {}
}

function Com-Collect {
  # On the worker (STA) thread that made them: collect the runtime wrappers of every COM object the probe and the edits
  # left behind, so PowerPoint does not wait for COM's clean-up of a client that is gone.
  param()
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

# ---- the verbs (run on the worker thread; they keep the COM objects in its global scope, never on the main thread) ---

function Ppt-Start {
  param()
  $global:NtApp = Com-NewApp
  $global:NtPres = $null
  return (Com-AppInfo $global:NtApp)
}

function Ppt-Open {
  param([string]$Path)
  $global:NtPres = $null
  $global:NtPres = Com-Open $global:NtApp $Path
  try {
    return (Com-PresInfo $global:NtPres)
  } catch {
    # The file opened but could not be read: close it before the failure goes up, so no presentation of this run stays open.
    $problem = $_
    try { Com-Close $global:NtPres } catch {}
    $global:NtPres = $null
    throw $problem
  }
}

function Ppt-SaveCopy {
  param([string]$File)
  Com-SaveCopy $global:NtPres $File
  if (-not (Test-Path -LiteralPath $File)) { throw "PowerPoint wrote no copy at $File" }
  return [ordered]@{ bytes = (Get-Item -LiteralPath $File).Length }
}

function Ppt-Export {
  param([int]$Index, [string]$File, [int]$Width, [int]$Height)
  Com-ExportSlide $global:NtPres $Index $File $Width $Height
  if (-not (Test-Path -LiteralPath $File)) { throw "PowerPoint wrote no picture of slide $Index" }
  return [ordered]@{ written = $true }
}

function Ppt-Probe {
  param([int]$Index, [bool]$ReadCharts)
  return (Com-ProbeSlide $global:NtPres $Index $ReadCharts)
}

function Ppt-Edit {
  param([string]$Case, [string]$File)
  $answer = Com-ApplyEdit $global:NtPres $Case
  if ($answer.applies) {
    Com-SaveCopy $global:NtPres $File
    if (-not (Test-Path -LiteralPath $File)) { throw "PowerPoint wrote no copy at $File" }
  }
  return $answer
}

function Ppt-Close {
  param()
  if ($null -eq $global:NtPres) { return [ordered]@{ closed = $false } }
  Com-Close $global:NtPres
  $global:NtPres = $null
  return [ordered]@{ closed = $true }
}

function Ppt-Finish {
  param()
  # Quit only when no presentation is open: one left open (a close that failed) keeps PowerPoint running for the supervisor.
  # Order (first contact, 2026-11-27): no global keeps a COM object, Quit, release every reference, collect on this thread.
  # Every step runs whatever the one before it did (opf#1557 review): a presentation this run still holds open (the main
  # thread failed while it was open) is closed first; a Quit that throws is recorded, and release and collect still run.
  $problems = New-Object System.Collections.ArrayList
  if ($null -ne $global:NtPres) {
    try { Com-Close $global:NtPres } catch { [void]$problems.Add("closing the presentation the run still held: $($_.Exception.Message)") }
  }
  $app = $global:NtApp
  $global:NtPres = $null
  $global:NtApp = $null
  $count = $null
  $quit = $false
  try {
    try { $count = Com-OpenCount $app } catch { [void]$problems.Add("counting the open presentations: $($_.Exception.Message)") }
    if ($count -eq 0) {
      try { Com-Quit $app; $quit = $true } catch { [void]$problems.Add("Quit: $($_.Exception.Message)") }
    }
  } finally {
    try { Com-Release $app } catch {}
    $app = $null
    Com-Collect
  }
  return [ordered]@{ openCount = $count; quit = $quit; problems = $problems.ToArray() }
}

# ---- main thread: no COM here ----------------------------------------------------------------------------------------

function Get-OfficeProcesses {
  param()
  $names = New-Object System.Collections.ArrayList
  foreach ($name in @('POWERPNT', 'EXCEL')) {
    if (Get-Process -Name $name -ErrorAction SilentlyContinue) { [void]$names.Add("$name.EXE") }
  }
  return $names.ToArray()
}

function Get-PowerPointIds {
  # The process ids of every POWERPNT.EXE now; the run's own is the one that is new after Ppt-Start.
  param()
  return @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.Id })
}

function Wait-PowerPointExit {
  # Waits at most $Seconds in all for these processes to end on their own (Process.WaitForExit: no loop, nothing is ended).
  # Returns { exited, seconds, left: [ids still running] }. The caller passes at least one id.
  param([int[]]$Ids, [double]$Seconds)
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $left = New-Object System.Collections.ArrayList
  foreach ($id in $Ids) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($null -eq $process) { continue }
    $remaining = [int][math]::Max(0, $Seconds * 1000 - $watch.ElapsedMilliseconds)
    if (-not $process.WaitForExit($remaining)) { [void]$left.Add($id) }
  }
  return @{ exited = ($left.Count -eq 0); seconds = [math]::Round($watch.Elapsed.TotalSeconds, 2); left = $left.ToArray() }
}

function Write-Json {
  param([string]$File, $Value)
  $text = ConvertTo-Json -InputObject $Value -Depth 40
  [System.IO.File]::WriteAllText($File, $text, (New-Object System.Text.UTF8Encoding $false))
}

function Say {
  param([string]$Line)
  [Console]::Out.WriteLine($Line)
  [Console]::Out.Flush()
}

function Get-Sha256 {
  param([string]$Path)
  try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() } catch { return $null }
}

function Get-Message {
  param($Exception)
  $e = $Exception
  while ($null -ne $e.InnerException) { $e = $e.InnerException }
  return [string]$e.Message
}

function Invoke-Worker {
  # One verb on the worker thread with a time limit: { status: done / failed / timeout, seconds, message?, value? }.
  param([string]$Command, [hashtable]$Arguments, [double]$Seconds)
  $ps = [powershell]::Create()
  $ps.Runspace = $script:Worker
  [void]$ps.AddCommand($Command)
  foreach ($key in $Arguments.Keys) { [void]$ps.AddParameter($key, $Arguments[$key]) }
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $async = $ps.BeginInvoke()
  $finished = $async.AsyncWaitHandle.WaitOne([int][math]::Ceiling($Seconds * 1000))
  $elapsed = [math]::Round($watch.Elapsed.TotalSeconds, 2)
  if (-not $finished) {
    # The worker is still inside PowerPoint. Nothing more is sent to it; the script stops after writing what it has.
    $script:Stopped = "PowerPoint did not answer $Command within $Seconds s"
    $script:Hung = $true
    return @{ status = 'timeout'; seconds = $elapsed; message = "PowerPoint did not answer $Command within $Seconds s; the run stopped without ending PowerPoint: a POWERPNT.EXE process may be left for the supervisor to look at" }
  }
  try {
    $out = $ps.EndInvoke($async)
    $value = $null
    if ($out.Count -gt 0) { $value = $out[$out.Count - 1].psobject.BaseObject }
    return @{ status = 'done'; seconds = $elapsed; value = $value }
  } catch {
    return @{ status = 'failed'; seconds = $elapsed; message = (Get-Message $_.Exception) }
  } finally {
    $ps.Dispose()
  }
}

function Verb {
  # The part of an Invoke-Worker answer that goes into a raw verb.
  param($Answer)
  $verb = [ordered]@{ status = $Answer.status; seconds = $Answer.seconds }
  if ($Answer.message) { $verb.message = $Answer.message }
  return $verb
}

function New-WorkerText {
  # The worker runspace's definitions: every Com-* and Ppt-* function as this process has it (fakes under -SelfTest).
  $parts = New-Object System.Collections.ArrayList
  [void]$parts.Add('$ErrorActionPreference = ''Stop''')
  foreach ($item in (Get-ChildItem function: | Where-Object { $_.Name -match '^(Com|Ppt)-' })) {
    [void]$parts.Add("function global:$($item.Name) {`n$($item.ScriptBlock.ToString())`n}")
  }
  if ($SelfTest) { [void]$parts.Add("`$global:NtFakeScenario = '$($Fake.Replace("'", "''"))'") }
  return ($parts -join "`n")
}

function New-RawFile {
  param($Entry, [string]$Why)
  $raw = [ordered]@{ id = $Entry.id; path = $Entry.path; sha256Before = $null; sha256After = $null }
  foreach ($name in @('open', 'resave', 'render', 'probe', 'close')) { $raw[$name] = [ordered]@{ status = 'not-run' } }
  if ($Why) { $raw.open.message = $Why }
  $raw.edits = @()
  $raw.slides = @()
  return $raw
}

# ---- the run --------------------------------------------------------------------------------------------------------

if (-not $Plan) { Say 'NT16 usage: powerpoint.ps1 -Plan <plan.json> [-SelfTest -Fake <scenario.json>]'; exit 2 }
if ($SelfTest) {
  if (-not $Fake) { Say 'NT16 -SelfTest needs -Fake <scenario.json>'; exit 2 }
  . (Join-Path $PSScriptRoot 'powerpoint-fake.ps1')
  # Every entry point that touches COM or the process list must now be the fake: refuse to run anything real.
  foreach ($name in @('Com-NewApp', 'Com-AppInfo', 'Com-Open', 'Com-PresInfo', 'Com-ExportSlide', 'Com-ProbeSlide', 'Com-SaveCopy', 'Com-ApplyEdit', 'Com-Close', 'Com-OpenCount', 'Com-Quit', 'Com-Release', 'Com-Collect', 'Get-OfficeProcesses', 'Get-PowerPointIds', 'Wait-PowerPointExit')) {
    $file = (Get-Item "function:$name").ScriptBlock.File
    if (-not $file -or -not $file.EndsWith('powerpoint-fake.ps1')) { Say "NT16 self-test: $name is not faked; nothing runs"; exit 2 }
  }
  Set-FakeMainScenario $Fake
}

$work = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$runDir = [string]$work.runDir
$limits = $work.timeouts
$runFile = Join-Path $runDir 'powerpoint-run.json'
$run = [ordered]@{
  schema = 'nt16-powerpoint-run/1'
  selfTest = [bool]$SelfTest
  check = [ordered]@{ status = 'ready'; reasons = @() }
  application = $null
  powershell = $PSVersionTable.PSVersion.ToString()
  files = @()
  stopped = $null
  powerpointMayBeLeft = $false
  excelSeen = $false
  finish = [ordered]@{ status = 'not-run' }
}

$running = @(Get-OfficeProcesses)
if ($running.Count -gt 0) {
  $run.check.status = 'refused'
  $run.check.reasons = @($running | ForEach-Object { "$_ is running: that instance is the owner's. The driver neither uses nor ends it; run again when it is closed." })
  Write-Json $runFile $run
  Say "NT16 refused: $($running -join ', ') running"
  exit 3
}

$script:Stopped = $null
$script:Hung = $false
$script:MainError = $null
$script:Worker =[runspacefactory]::CreateRunspace()
$script:Worker.ApartmentState = [System.Threading.ApartmentState]::STA
$script:Worker.ThreadOptions = [System.Management.Automation.Runspaces.PSThreadOptions]::ReuseThread
$script:Worker.Open()
$load = [powershell]::Create()
$load.Runspace = $script:Worker
[void]$load.AddScript((New-WorkerText))
[void]$load.Invoke()
$load.Dispose()

$readCharts = $true
$idsBefore = @(Get-PowerPointIds)
$start = Invoke-Worker 'Ppt-Start' @{} ([double]$limits.start)
$run.start = Verb $start
$run.powerpointIds = @(Get-PowerPointIds | Where-Object { $idsBefore -notcontains $_ })
if ($start.status -eq 'done') { $run.application = $start.value }
Say "NT16 start $($start.status) $(if ($run.application) { "PowerPoint $($run.application.version) build $($run.application.build)" })"

function Get-Utc {
  param()
  return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

$ids = New-Object System.Collections.ArrayList
$raw = $null
$rawFile = $null
# An exception on this thread (not PowerPoint's: those come back as failed verbs) must not leave PowerPoint open: it is
# caught, the file it happened in is written as far as it got, and the end below still closes, quits and releases.
try {
foreach ($entry in @($work.files)) {
  $dir = [string]$entry.dir
  $rawFile = Join-Path $dir 'powerpoint-raw.json'
  [void]$ids.Add($entry.id)
  $raw = $null
  if ($start.status -ne 'done' -or $script:Stopped) {
    $why = 'not run: PowerPoint did not start'
    if ($start.status -eq 'done' -or $start.status -eq 'timeout') { $why = "not run: the run stopped earlier ($($script:Stopped))" }
    if ($start.status -eq 'failed') { $why = "not run: PowerPoint did not start: $($start.message)" }
    $raw = New-RawFile $entry $why
    $raw.sha256Before = Get-Sha256 $entry.path
    $raw.sha256After = $raw.sha256Before
    Write-Json $rawFile $raw
    $raw = $null
    continue
  }
  $raw = New-RawFile $entry $null
  $raw.started = Get-Utc
  $raw.sha256Before = Get-Sha256 $entry.path
  $open = Invoke-Worker 'Ppt-Open' @{ Path = [string]$entry.path } ([double]$limits.open)
  $raw.open = Verb $open
  if ($open.status -eq 'done') {
    $info = $open.value
    $raw.slideCount = $info.slideCount
    $raw.slideSize = $info.slideSize
    $raw.fonts = $info.fonts
    $slides = New-Object System.Collections.ArrayList
    foreach ($slide in @($info.slides)) { [void]$slides.Add([ordered]@{ index = $slide.index; id = $slide.id; hidden = $slide.hidden; layout = $slide.layout; picture = $null; shapes = @(); notes = $null }) }
    $raw.slides = $slides.ToArray()

    # resave first: the copy is PowerPoint's reading of the file, before any probe touched the open presentation.
    $answer = Invoke-Worker 'Ppt-SaveCopy' @{ File = (Join-Path $dir 'resaved.pptx') } ([double]$limits.resave)
    $raw.resave = Verb $answer
    if ($answer.status -eq 'done') { $raw.resave.path = 'resaved.pptx' }

    if (-not $script:Stopped) {
      $width = [int]$work.width
      $height = [int][math]::Round($width * [double]$info.slideSize[1] / [double]$info.slideSize[0])
      $raw.render = [ordered]@{ status = 'done'; seconds = 0; pixelSize = @($width, $height) }
      $failed = New-Object System.Collections.ArrayList
      [void](New-Item -ItemType Directory -Force (Join-Path $dir 'slides'))
      foreach ($slide in $raw.slides) {
        if ($script:Stopped) { break }
        $name = 'slides/slide-{0:D3}.png' -f [int]$slide.index
        $answer = Invoke-Worker 'Ppt-Export' @{ Index = [int]$slide.index; File = (Join-Path $dir $name.Replace('/', '\')); Width = $width; Height = $height } ([double]$limits.slide)
        $raw.render.seconds = [math]::Round($raw.render.seconds + $answer.seconds, 2)
        if ($answer.status -eq 'done') { $slide.picture = $name }
        elseif ($answer.status -eq 'timeout') { $raw.render.status = 'timeout'; $raw.render.message = "slide $($slide.index): $($answer.message)" }
        else { [void]$failed.Add("slide $($slide.index): $($answer.message)") }
      }
      if ($raw.render.status -eq 'done' -and $failed.Count -gt 0) { $raw.render.status = 'failed'; $raw.render.message = "PowerPoint exported no picture of $($failed.Count) slide(s): $($failed -join '; ')" }
    }

    if (-not $script:Stopped) {
      $raw.probe = [ordered]@{ status = 'done'; seconds = 0 }
      $failed = New-Object System.Collections.ArrayList
      foreach ($slide in $raw.slides) {
        if ($script:Stopped) { break }
        $answer = Invoke-Worker 'Ppt-Probe' @{ Index = [int]$slide.index; ReadCharts = $readCharts } ([double]$limits.probe)
        $raw.probe.seconds = [math]::Round($raw.probe.seconds + $answer.seconds, 2)
        if ($answer.status -eq 'done') { $slide.shapes = @($answer.value.shapes); $slide.notes = $answer.value.notes; $slide.hyperlinks = @($answer.value.hyperlinks) }
        elseif ($answer.status -eq 'timeout') { $raw.probe.status = 'timeout'; $raw.probe.message = "slide $($slide.index): $($answer.message)" }
        else { $slide.probeError = $answer.message; [void]$failed.Add("slide $($slide.index): $($answer.message)") }
      }
      if ($raw.probe.status -eq 'done' -and $failed.Count -gt 0) { $raw.probe.status = 'failed'; $raw.probe.message = "PowerPoint did not answer the probe of $($failed.Count) slide(s): $($failed -join '; ')" }
    }
    if (-not $script:Stopped) {
      $raw.close = Verb (Invoke-Worker 'Ppt-Close' @{} ([double]$limits.close))
    }

    # Edit cases: each on a fresh read-only open of the same file, one edit, one copy, closed without saving.
    $edits = New-Object System.Collections.ArrayList
    foreach ($case in @($work.edits)) {
      $edit = [ordered]@{ id = [string]$case.id; what = [string]$case.what; status = 'not-run' }
      if ($script:Stopped) { $edit.message = "not run: $($script:Stopped)"; [void]$edits.Add($edit); continue }
      if ($raw.close.status -ne 'done') { $edit.message = 'not run: the file did not close'; [void]$edits.Add($edit); continue }
      $opened = Invoke-Worker 'Ppt-Open' @{ Path = [string]$entry.path } ([double]$limits.open)
      if ($opened.status -ne 'done') {
        $edit.status = $opened.status; $edit.seconds = $opened.seconds; $edit.message = "opening the file again: $($opened.message)"
        [void]$edits.Add($edit)
        if ($opened.status -eq 'timeout') { break }
        continue
      }
      $file = Join-Path $dir ('edits\' + $edit.id + '.pptx')
      [void](New-Item -ItemType Directory -Force (Join-Path $dir 'edits'))
      $answer = Invoke-Worker 'Ppt-Edit' @{ Case = $edit.id; File = $file } ([double]$limits.edit)
      $edit.seconds = $answer.seconds
      if ($answer.status -eq 'done' -and -not $answer.value.applies) { $edit.message = "not applicable: $($answer.value.why)" }
      elseif ($answer.status -eq 'done') { $edit.status = 'done'; $edit.what = [string]$answer.value.what }
      else { $edit.status = $answer.status; $edit.message = $answer.message }
      if ($script:Stopped) { [void]$edits.Add($edit); break }
      $closed = Invoke-Worker 'Ppt-Close' @{} ([double]$limits.close)
      if ($closed.status -ne 'done') {
        if ($edit.status -eq 'done') { $edit.status = $closed.status }
        $edit.message = (@($edit.message, "closing after the edit: $($closed.message)") | Where-Object { $_ }) -join '; '
        [void]$edits.Add($edit)
        break
      }
      [void]$edits.Add($edit)
    }
    $raw.edits = $edits.ToArray()
  }
  $raw.sha256After = Get-Sha256 $entry.path
  $after = @(Get-OfficeProcesses)
  if ($after -contains 'EXCEL.EXE') {
    # Something started Excel (a chart's workbook). It is not ended; charts are no longer read and the run stops here.
    $run.excelSeen = $true
    $raw.excelSeen = $true
    $readCharts = $false
    if (-not $script:Stopped) { $script:Stopped = "EXCEL.EXE appeared while $($entry.id) was open; the driver never starts Excel and does not end it: the supervisor looks at it" }
  }
  $raw.finished = Get-Utc
  Write-Json $rawFile $raw
  Say ("NT16 file {0} open {1} resave {2} render {3} probe {4} close {5} edits {6}" -f $entry.id, $raw.open.status, $raw.resave.status, $raw.render.status, $raw.probe.status, $raw.close.status, (@($raw.edits | Where-Object { $_.status -eq 'done' }).Count))
  $raw = $null
}
} catch {
  $script:MainError = "the driver failed: $(Get-Message $_.Exception)"
  if ($null -ne $raw) {
    $raw.failure = $script:MainError
    $raw.finished = Get-Utc
    try { Write-Json $rawFile $raw } catch {}
  }
  Say "NT16 error: $($script:MainError)"
}
$run.files = $ids.ToArray()

# The end. On every path but a call PowerPoint did not answer, the worker is idle: Ppt-Finish closes a presentation the
# run still holds, quits PowerPoint when nothing is open, releases and collects; then the worker closes and the exit check
# runs. This includes Excel appearing and an exception on this thread (opf#1557 review). Nothing ends a process.
$code = 0
if ($start.status -ne 'timeout' -and -not $script:Hung) {
  $finish = Invoke-Worker 'Ppt-Finish' @{} ([double]$limits.quit)
  $run.finish = Verb $finish
  if ($finish.status -eq 'done') {
    $run.finish.openCount = $finish.value.openCount
    $run.finish.quit = $finish.value.quit
    if (@($finish.value.problems).Count -gt 0) { $run.finish.problems = @($finish.value.problems) }
    if (-not $finish.value.quit -and $start.status -eq 'done') { $run.finish.message = "PowerPoint was not quit ($($finish.value.openCount) presentation(s) open$(if (@($finish.value.problems).Count -gt 0) { '; ' + (@($finish.value.problems) -join '; ') })): a POWERPNT.EXE process is left for the supervisor to look at"; $run.powerpointMayBeLeft = $true }
  } elseif ($finish.status -ne 'done') { $run.powerpointMayBeLeft = $true }
}
if ($script:Stopped) { $run.stopped = $script:Stopped; $code = 4 }
if ($start.status -eq 'failed') { $run.stopped = "PowerPoint did not start: $($start.message)"; $code = 4 }
if ($script:MainError) { $run.error = $script:MainError; $code = 5 }
if ($script:Hung) {
  $run.powerpointMayBeLeft = $true
  Write-Json $runFile $run
  Say "NT16 done exit $code$(if ($run.stopped) { ": $($run.stopped)" })"
  # Only here, where the worker thread still waits inside PowerPoint: Environment.Exit ends this process without it.
  # PowerPoint is not ended.
  [Environment]::Exit($code)
}

# The worker has released and collected everything; close it, then see whether PowerPoint ends on its own.
$script:Worker.Close()
$script:Worker.Dispose()
$run.finish.workerClosed = $true
$exitNote = ''
if ($run.finish.quit) {
  # No id of its own (none was new after it started PowerPoint): nothing to check, and no claim that it exited.
  $gone = @{ exited = $null; seconds = 0; left = @() }
  if (@($run.powerpointIds).Count -gt 0) { $gone = Wait-PowerPointExit ([int[]]@($run.powerpointIds)) ([double]$limits.exit) }
  $run.finish.exited = $gone.exited
  $run.finish.exitSeconds = $gone.seconds
  if ($null -eq $gone.exited) { $exitNote = '; the id of the POWERPNT.EXE it started is not known, so its exit was not checked' }
  elseif ($gone.exited) { $exitNote = "; PowerPoint exited after $($gone.seconds) s" }
  else {
    $run.finish.left = @($gone.left)
    $run.powerpointMayBeLeft = $true
    $run.finish.message = "PowerPoint was quit, but POWERPNT.EXE $($gone.left -join ', ') had not ended $($gone.seconds) s later; the driver does not end it: the supervisor looks at it"
    $exitNote = "; POWERPNT.EXE $($gone.left -join ', ') had not exited after $($gone.seconds) s"
  }
}
Write-Json $runFile $run
Say "NT16 done exit $code$(if ($run.stopped) { ": $($run.stopped)" })$(if ($run.error) { ": $($run.error)" })$exitNote"
exit $code
