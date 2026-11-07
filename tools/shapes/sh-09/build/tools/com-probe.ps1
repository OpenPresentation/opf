# SH-09 build: open OPF-exported decks read-only through COM and record, per slide, every SmartArt (layout, nodes, geometry, text)
# and a 1280 x 720 PNG of every slide. PowerPoint is visible and minimized (SmartArtLayouts only fills in an interactive session) and
# is quit at the end of the batch.
param([string[]]$Files, [string]$OutDir, [switch]$Edit, [string]$Dir)
if ($Dir) { $Files = @(Get-ChildItem (Join-Path $Dir "*.pptx") | ForEach-Object FullName) }
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$app.Visible = -1
$app.WindowState = 2
$result = @()
try {
  foreach ($file in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($file)
    $deck = [ordered]@{ file = $name; slides = @() }
    try {
      $p = $app.Presentations.Open($file, -1, 0, -1)
      $deck.open = 'ok'
      for ($s = 1; $s -le $p.Slides.Count; $s++) {
        $sl = $p.Slides.Item($s)
        $pw = [int][math]::Round($p.PageSetup.SlideWidth * 4 / 3); $ph = [int][math]::Round($p.PageSetup.SlideHeight * 4 / 3)
        $sl.Export((Join-Path $OutDir "$name-$s.png"), "PNG", $pw, $ph)
        $slide = [ordered]@{ index = $s; smartArt = @() }
        for ($k = 1; $k -le $sl.Shapes.Count; $k++) {
          $shp = $sl.Shapes.Item($k)
          if ($shp.HasSmartArt -ne -1) { continue }
          $sa = $shp.SmartArt
          $entry = [ordered]@{ name = $shp.Name; left = $shp.Left; top = $shp.Top; width = $shp.Width; height = $shp.Height; layout = $sa.Layout.Id; layoutName = $sa.Layout.Name; color = $sa.Color.Id; quickStyle = $sa.QuickStyle.Id; nodes = $sa.AllNodes.Count; texts = @(); items = @() }
          for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $entry.texts += $sa.AllNodes.Item($n).TextFrame2.TextRange.Text }
          # The group's shapes can be missing for a moment after open: ask again until PowerPoint has laid the SmartArt out.
          $gi = $shp.GroupItems
          for ($try = 0; $try -lt 40 -and $gi.Count -lt 1; $try++) { Start-Sleep -Milliseconds 250; $null = $sl.Shapes.Count; $gi = $shp.GroupItems }
          $entry.groupTries = $try
          for ($i = 1; $i -le $gi.Count; $i++) {
            $g = $gi.Item($i)
            $o = [ordered]@{ i = $i; type = $g.AutoShapeType; left = $g.Left; top = $g.Top; width = $g.Width; height = $g.Height; fill = ('{0:X6}' -f $g.Fill.ForeColor.RGB); line = $g.Line.Weight }
            try {
              if ($g.HasTextFrame -and $g.TextFrame2.HasText) {
                $tf = $g.TextFrame2; $tr = $tf.TextRange
                $o.margin = $tf.MarginLeft; $o.size = $tr.Font.Size; $o.face = $tr.Font.Name; $o.text = $tr.Text
                $lines = @(); for ($j = 1; $j -le $tr.Lines().Count; $j++) { $l = $tr.Lines($j); $lines += [pscustomobject]@{ text = $l.Text; left = $l.BoundLeft; top = $l.BoundTop; width = $l.BoundWidth; height = $l.BoundHeight } }
                $o.lines = $lines
              }
            } catch { $o.textError = $_.Exception.Message }
            $entry.items += [pscustomobject]$o
          }
          if ($Edit) {
            # A node edit: PowerPoint lays the SmartArt out again; record whether OPF's explicit size and the node rectangles stay.
            $node = $sa.AllNodes.Item(1); $before = $node.TextFrame2.TextRange.Font.Size
            $node.TextFrame2.TextRange.Text = 'Edited in PowerPoint'
            $sl.Export((Join-Path $OutDir "$name-$s-edited.png"), "PNG", $pw, $ph)
            $entry.edit = [ordered]@{ sizeBefore = $before; sizeAfter = $node.TextFrame2.TextRange.Font.Size; items = @(for ($i = 1; $i -le $shp.GroupItems.Count; $i++) { $g = $shp.GroupItems.Item($i); "$($g.Left),$($g.Top),$($g.Width),$($g.Height)" }) }
            $sizes = @(); for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sizes += $sa.AllNodes.Item($n).TextFrame2.TextRange.Font.Size }
            $entry.edit.sizes = $sizes
            # Layout switching: the SmartArt stays live and takes another built-in layout.
            try {
              if (-not $script:switchTarget) { for ($li = 1; $li -le $app.SmartArtLayouts.Count; $li++) { $l = $app.SmartArtLayouts.Item($li); if ($l.Id -eq 'urn:microsoft.com/office/officeart/2005/8/layout/default') { $script:switchTarget = $l; break } } }; $target = $script:switchTarget
              $sa.Layout = $target; $entry.edit.switchedTo = $sa.Layout.Name
              $sl.Export((Join-Path $OutDir "$name-$s-switched.png"), "PNG", $pw, $ph)
            } catch { $entry.edit.switchedTo = "ERROR: $($_.Exception.Message)" }
          }
          $slide.smartArt += [pscustomobject]$entry
        }
        $deck.slides += [pscustomobject]$slide
      }
      $p.Saved = -1; $p.Close()
    } catch { $deck.error = $_.Exception.Message }
    $result += [pscustomobject]$deck
  }
} finally {
  foreach ($open in @($app.Presentations)) { try { $open.Saved = -1; $open.Close() } catch {} }
  $app.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null; [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
$result | ConvertTo-Json -Depth 14 | Set-Content -Encoding utf8 (Join-Path $OutDir 'probe.json')
