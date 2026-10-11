<#
.SYNOPSIS
  opf#323 (0.18 run): read-only native read of ONE deck through desktop PowerPoint (COM). Supervisor-run only.

.DESCRIPTION
  - Attaches with GetActiveObject('PowerPoint.Application'). Only when no PowerPoint is running does it start one
    (New-Object -ComObject, made visible so it stays up) and records "startedPowerPoint": true. It never quits or kills PowerPoint,
    never closes a presentation it did not open, and never saves.
  - Opens the deck READ-ONLY with Presentations.Open(path, -1, 0, 0) (ReadOnly, not Untitled, no window).
  - Reads, in this order (the JSON is rewritten after every step, so a deadline kill keeps a partial result):
      Presentation.Fonts (name, embedded, embeddable);
      the theme font slots (major / minor x latin / eastAsian / complexScript) of the slide master AND of the notes master;
      the slide size; per slide: every shape (recursively in groups) with geometry, placeholder type, text frame margins and wrap,
      every paragraph and run (Font.Name / NameAscii / NameOther / NameFarEast / NameComplexScript, size, bold, italic, LanguageID,
      paragraph direction and alignment), the native LINES of each text shape (TextRange.Lines(): BoundLeft / Top / Width / Height
      and text), tables (cell text and run fonts), charts (ChartType, title, series count; never Series.Formula, which crashes
      PowerPoint 16.0.20430), the notes-page body text, Slide.HeadersFooters; and exports each slide as PNG (default 1280 px wide).
  - Closes the deck with Saved = -1 (in-memory flag only) then Close(). Nothing is written to the deck.
  - A time budget (default 80 s, under run-deck.ps1's 90 s deadline) stops reading further slides and sets "truncated": true.

  Windows PowerShell 5.1. ASCII-only source on purpose.

.EXAMPLE
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File native-read-deck.ps1 -Deck C:\opf-work\native-0-18-run\decks\ff12\05-ar-rtl.pptx -OutDir C:\opf-work\native-0-18-run\native\attempt-1\ff12\05-ar-rtl
#>
param(
  [Parameter(Mandatory = $true)][string]$Deck,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$ExportWidth = 1280,
  [int]$BudgetSeconds = 80,
  [int]$MaxParagraphsPerShape = 60,
  [int]$MaxRunsPerParagraph = 40,
  [int]$MaxLinesPerShape = 12,
  [switch]$SkipExport
)
$ErrorActionPreference = 'Stop'
$clock = [System.Diagnostics.Stopwatch]::StartNew()
$Deck = [System.IO.Path]::GetFullPath($Deck)
$null = New-Item -ItemType Directory -Force -Path $OutDir
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$base = [System.IO.Path]::GetFileNameWithoutExtension($Deck)
$jsonPath = Join-Path $OutDir ($base + '.json')
$utf8 = New-Object System.Text.UTF8Encoding($false)

$script:errors = New-Object System.Collections.ArrayList
function Get-Val {
  param([scriptblock]$Read, [string]$What)
  try { return (& $Read) } catch { if ($script:errors.Count -lt 80) { [void]$script:errors.Add(($What + ': ' + $_.Exception.Message)) }; return $null }
}
function Clip([string]$s, [int]$n) { if ($null -eq $s) { return $null }; if ($s.Length -gt $n) { return $s.Substring(0, $n) }; return $s }
function Is-True($v) { return ($null -ne $v) -and (($v -is [bool] -and $v) -or ($v -is [int] -and $v -ne 0)) }
function Round2($v) { if ($null -eq $v) { return $null }; return [math]::Round([double]$v, 2) }

$result = [ordered]@{
  schema = 'opf323-native-read/v2'; deck = $Deck; id = $base; stage = 'start'; opened = $false; readOnlyRequested = $true
  startedPowerPoint = $false; error = $null; truncated = $false
  app = $null; deckSha256 = $null; slideSize = $null; exportWidth = $ExportWidth
  presentationFonts = @(); theme = $null; notesTheme = $null
  slides = New-Object System.Collections.ArrayList; readErrors = $null; elapsedMs = 0
}
function Save-Result {
  $result.elapsedMs = $clock.ElapsedMilliseconds
  $result.readErrors = @($script:errors)
  [System.IO.File]::WriteAllText($jsonPath, ($result | ConvertTo-Json -Depth 30), $utf8)
}

function Read-Font($font) {
  if ($null -eq $font) { return $null }
  return [ordered]@{
    name = (Get-Val { $font.Name } 'Font.Name'); nameAscii = (Get-Val { $font.NameAscii } 'Font.NameAscii'); nameOther = (Get-Val { $font.NameOther } 'Font.NameOther')
    nameFarEast = (Get-Val { $font.NameFarEast } 'Font.NameFarEast'); nameComplexScript = (Get-Val { $font.NameComplexScript } 'Font.NameComplexScript')
    size = (Get-Val { $font.Size } 'Font.Size'); bold = (Get-Val { $font.Bold } 'Font.Bold'); italic = (Get-Val { $font.Italic } 'Font.Italic')
  }
}

function Read-ThemeSlots($fs) {
  if ($null -eq $fs) { return $null }
  # MsoFontLanguageIndex: 1 = msoThemeLatin, 2 = msoThemeComplexScript, 3 = msoThemeEastAsian
  $theme = [ordered]@{ major = [ordered]@{}; minor = [ordered]@{} }
  foreach ($s in @(@('latin', 1), @('complexScript', 2), @('eastAsian', 3))) {
    $theme.major[$s[0]] = Get-Val { $fs.MajorFont.Item($s[1]).Name } ('MajorFont ' + $s[0])
    $theme.minor[$s[0]] = Get-Val { $fs.MinorFont.Item($s[1]).Name } ('MinorFont ' + $s[0])
  }
  return $theme
}

# TextDirection: 1 = left to right, 2 = right to left. Alignment: 1 left, 2 center, 3 right, 4 justify, 5 distribute.
function Read-TextRange($tr, [string]$where, [bool]$withLines) {
  $out = [ordered]@{ text = $null; paragraphs = (New-Object System.Collections.ArrayList); lines = $null; lineCount = $null }
  if ($null -eq $tr) { return $out }
  $out.text = Clip (Get-Val { $tr.Text } ($where + ' text')) 2000
  $pc = Get-Val { $tr.Paragraphs().Count } ($where + ' paragraphs.count')
  if ($null -ne $pc) {
    for ($i = 1; $i -le [math]::Min([int]$pc, $MaxParagraphsPerShape); $i++) {
      $p = Get-Val { $tr.Paragraphs($i, 1) } ($where + ' paragraph ' + $i)
      if ($null -eq $p) { continue }
      $pf = Get-Val { $p.ParagraphFormat } ($where + ' paragraphformat')
      $para = [ordered]@{
        index = $i; text = Clip ((Get-Val { $p.Text } ($where + ' ptext')) -replace '[\r\n]+$', '') 600
        textDirection = $(if ($null -ne $pf) { Get-Val { $pf.TextDirection } 'ParagraphFormat.TextDirection' } else { $null })
        alignment = $(if ($null -ne $pf) { Get-Val { $pf.Alignment } 'ParagraphFormat.Alignment' } else { $null })
        bulletVisible = $(if ($null -ne $pf) { Get-Val { $pf.Bullet.Visible } 'Bullet.Visible' } else { $null })
        runs = (New-Object System.Collections.ArrayList)
      }
      $rc = Get-Val { $p.Runs().Count } ($where + ' runs.count')
      if ($null -ne $rc) {
        for ($j = 1; $j -le [math]::Min([int]$rc, $MaxRunsPerParagraph); $j++) {
          $r = Get-Val { $p.Runs($j, 1) } ($where + ' run ' + $j)
          if ($null -eq $r) { continue }
          [void]$para.runs.Add([ordered]@{ text = Clip ((Get-Val { $r.Text } 'Run.Text') -replace '[\r\n]+$', '') 400; languageId = (Get-Val { $r.LanguageID } 'Run.LanguageID'); font = Read-Font (Get-Val { $r.Font } 'Run.Font') })
        }
      }
      [void]$out.paragraphs.Add($para)
    }
  }
  if ($withLines) {
    # Native line layout: where PowerPoint broke the text and how wide each line is (points, slide coordinates).
    $lc = Get-Val { $tr.Lines().Count } ($where + ' lines.count')
    $out.lineCount = $lc
    if ($null -ne $lc) {
      $lines = New-Object System.Collections.ArrayList
      for ($k = 1; $k -le [math]::Min([int]$lc, $MaxLinesPerShape); $k++) {
        $ln = Get-Val { $tr.Lines($k, 1) } ($where + ' line ' + $k)
        if ($null -eq $ln) { continue }
        [void]$lines.Add([ordered]@{ index = $k; text = Clip ((Get-Val { $ln.Text } 'Line.Text') -replace '[\r\n]+$', '') 400
          boundLeft = Round2 (Get-Val { $ln.BoundLeft } 'Line.BoundLeft'); boundTop = Round2 (Get-Val { $ln.BoundTop } 'Line.BoundTop')
          boundWidth = Round2 (Get-Val { $ln.BoundWidth } 'Line.BoundWidth'); boundHeight = Round2 (Get-Val { $ln.BoundHeight } 'Line.BoundHeight') })
      }
      $out.lines = $lines
    }
  }
  return $out
}

function Read-Shape($shape, [int]$depth) {
  $o = [ordered]@{
    name = (Get-Val { $shape.Name } 'Shape.Name'); type = (Get-Val { $shape.Type } 'Shape.Type')
    left = Round2 (Get-Val { $shape.Left } 'Shape.Left'); top = Round2 (Get-Val { $shape.Top } 'Shape.Top')
    width = Round2 (Get-Val { $shape.Width } 'Shape.Width'); height = Round2 (Get-Val { $shape.Height } 'Shape.Height')
    hasTextFrame = $false; hasTable = $false; hasChart = $false
  }
  if ($o.type -eq 14) { $o.placeholderType = (Get-Val { $shape.PlaceholderFormat.Type } 'PlaceholderFormat.Type') }
  $o.hasChart = (Is-True (Get-Val { $shape.HasChart } 'HasChart'))
  $o.hasTable = (Is-True (Get-Val { $shape.HasTable } 'HasTable'))
  $o.hasTextFrame = (Is-True (Get-Val { $shape.HasTextFrame } 'HasTextFrame'))
  if ($o.type -eq 6 -and $depth -lt 4) {
    $items = New-Object System.Collections.ArrayList
    $n = Get-Val { $shape.GroupItems.Count } 'GroupItems.Count'
    for ($k = 1; $k -le [int]$n; $k++) { $gi = Get-Val { $shape.GroupItems.Item($k) } 'GroupItems.Item'; if ($null -ne $gi) { [void]$items.Add((Read-Shape $gi ($depth + 1))) } }
    $o.children = $items
  }
  if ($o.hasChart) {
    $ch = Get-Val { $shape.Chart } 'Chart'
    if ($null -ne $ch) {
      $o.chart = [ordered]@{
        chartType = (Get-Val { $ch.ChartType } 'Chart.ChartType'); hasTitle = (Get-Val { $ch.HasTitle } 'Chart.HasTitle')
        seriesCount = (Get-Val { $ch.SeriesCollection().Count } 'SeriesCollection.Count')
        chartAreaFontName = (Get-Val { $ch.ChartArea.Format.TextFrame2.TextRange.Font.Name } 'ChartArea font name')
      }
    }
  }
  if ($o.hasTable) {
    $tb = Get-Val { $shape.Table } 'Table'
    if ($null -ne $tb) {
      $rows = [int](Get-Val { $tb.Rows.Count } 'Table.Rows.Count'); $cols = [int](Get-Val { $tb.Columns.Count } 'Table.Columns.Count')
      $cells = New-Object System.Collections.ArrayList
      for ($r = 1; $r -le [math]::Min($rows, 12); $r++) {
        for ($c = 1; $c -le [math]::Min($cols, 8); $c++) {
          $tr = Get-Val { $tb.Cell($r, $c).Shape.TextFrame.TextRange } 'Cell.TextRange'
          $rt = Read-TextRange $tr ('cell ' + $r + ',' + $c) $false
          [void]$cells.Add([ordered]@{ row = $r; col = $c; text = $rt.text; paragraphs = $rt.paragraphs })
        }
      }
      $o.table = [ordered]@{ rows = $rows; columns = $cols; cells = $cells }
    }
  }
  if ($o.hasTextFrame -and -not $o.hasTable) {
    $o.hasText = (Is-True (Get-Val { $shape.TextFrame.HasText } 'TextFrame.HasText'))
    $o.textFrame = [ordered]@{
      wordWrap = (Get-Val { $shape.TextFrame.WordWrap } 'TextFrame.WordWrap'); autoSize = (Get-Val { $shape.TextFrame.AutoSize } 'TextFrame.AutoSize')
      marginLeft = Round2 (Get-Val { $shape.TextFrame.MarginLeft } 'MarginLeft'); marginRight = Round2 (Get-Val { $shape.TextFrame.MarginRight } 'MarginRight')
      marginTop = Round2 (Get-Val { $shape.TextFrame.MarginTop } 'MarginTop'); marginBottom = Round2 (Get-Val { $shape.TextFrame.MarginBottom } 'MarginBottom')
    }
    if ($o.hasText) {
      $rt = Read-TextRange (Get-Val { $shape.TextFrame.TextRange } 'TextFrame.TextRange') ([string]$o.name) $true
      $o.text = $rt.text; $o.paragraphs = $rt.paragraphs; $o.lineCount = $rt.lineCount; $o.lines = $rt.lines
    }
  }
  return $o
}

$app = $null; $pres = $null
try {
  $result.deckSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Deck).Hash.ToLowerInvariant()
  try { $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
  catch {
    # No running PowerPoint: start one and leave it running (never quit it).
    $app = New-Object -ComObject PowerPoint.Application
    try { $app.Visible = -1 } catch {}
    $result.startedPowerPoint = $true
  }
  $result.app = [ordered]@{ version = (Get-Val { $app.Version } 'App.Version'); build = (Get-Val { $app.Build } 'App.Build'); presentationsOpenBefore = (Get-Val { $app.Presentations.Count } 'Presentations.Count') }
  $result.stage = 'opening'; Save-Result
  # ReadOnly = msoTrue (-1), Untitled = msoFalse (0), WithWindow = msoFalse (0)
  $pres = $app.Presentations.Open($Deck, -1, 0, 0)
  $result.opened = $true
  $result.readOnly = (Get-Val { $pres.ReadOnly } 'Presentation.ReadOnly')
  $w = [double]$pres.PageSetup.SlideWidth; $h = [double]$pres.PageSetup.SlideHeight
  $exportHeight = [int][math]::Round($ExportWidth * $h / $w)
  $result.slideSize = [ordered]@{ widthPt = $w; heightPt = $h; exportWidth = $ExportWidth; exportHeight = $exportHeight }

  $fonts = New-Object System.Collections.ArrayList
  $fc = Get-Val { $pres.Fonts.Count } 'Fonts.Count'
  for ($i = 1; $i -le [int]$fc; $i++) {
    $f = Get-Val { $pres.Fonts.Item($i) } 'Fonts.Item'
    if ($null -ne $f) { [void]$fonts.Add([ordered]@{ name = (Get-Val { $f.Name } 'Font.Name'); embedded = (Get-Val { $f.Embedded } 'Font.Embedded'); embeddable = (Get-Val { $f.Embeddable } 'Font.Embeddable') }) }
  }
  $result.presentationFonts = $fonts
  $result.theme = Read-ThemeSlots (Get-Val { $pres.SlideMaster.Theme.ThemeFontScheme } 'SlideMaster ThemeFontScheme')
  $result.notesTheme = Read-ThemeSlots (Get-Val { $pres.NotesMaster.Theme.ThemeFontScheme } 'NotesMaster ThemeFontScheme')
  $result.stage = 'slides'; Save-Result

  foreach ($slide in $pres.Slides) {
    if ($clock.Elapsed.TotalSeconds -gt $BudgetSeconds) { $result.truncated = $true; break }
    $idx = [int]$slide.SlideIndex
    $entry = [ordered]@{ index = $idx; slideId = (Get-Val { $slide.SlideID } 'SlideID'); png = $null; shapes = (New-Object System.Collections.ArrayList); notes = $null; headersFooters = $null }
    if (-not $SkipExport) {
      $png = Join-Path $OutDir ($base + '-slide-' + $idx + '.native.png')
      try { $slide.Export($png, 'PNG', $ExportWidth, $exportHeight); $entry.png = [System.IO.Path]::GetFileName($png) } catch { $entry.pngError = $_.Exception.Message }
    }
    foreach ($shape in $slide.Shapes) { [void]$entry.shapes.Add((Read-Shape $shape 0)) }
    $notesText = $null
    $np = Get-Val { $slide.NotesPage.Shapes } 'NotesPage.Shapes'
    if ($null -ne $np) {
      foreach ($ns in $np) {
        if ((Get-Val { $ns.Type } 'Notes shape type') -eq 14 -and (Get-Val { $ns.PlaceholderFormat.Type } 'Notes placeholder type') -eq 2) { $notesText = Clip (Get-Val { $ns.TextFrame.TextRange.Text } 'Notes text') 2000 }
      }
    }
    $entry.notes = $notesText
    $hf = Get-Val { $slide.HeadersFooters } 'HeadersFooters'
    if ($null -ne $hf) {
      $entry.headersFooters = [ordered]@{
        slideNumberVisible = (Get-Val { $hf.SlideNumber.Visible } 'HF.SlideNumber.Visible')
        dateVisible = (Get-Val { $hf.DateAndTime.Visible } 'HF.DateAndTime.Visible'); dateUseFormat = (Get-Val { $hf.DateAndTime.UseFormat } 'HF.DateAndTime.UseFormat')
        dateFormat = (Get-Val { $hf.DateAndTime.Format } 'HF.DateAndTime.Format'); footerVisible = (Get-Val { $hf.Footer.Visible } 'HF.Footer.Visible')
        footerText = (Get-Val { $hf.Footer.Text } 'HF.Footer.Text')
      }
    }
    [void]$result.slides.Add($entry)
    Save-Result
  }
  $result.stage = 'done'
}
catch { $result.error = $_.Exception.Message }
finally {
  if ($null -ne $pres) {
    try { $pres.Saved = -1 } catch {}   # in-memory flag only: no save prompt; the file is never written
    try { $pres.Close() } catch { $result.closeError = $_.Exception.Message }
  }
  Save-Result
}
Write-Output ("{0} opened={1} slides={2} stage={3} truncated={4} elapsedMs={5} error={6}" -f $base, $result.opened, $result.slides.Count, $result.stage, $result.truncated, $clock.ElapsedMilliseconds, $result.error)
if ($null -ne $result.error) { exit 1 }
