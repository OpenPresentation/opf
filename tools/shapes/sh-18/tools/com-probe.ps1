# SH-18: open OPF-exported decks read-only through COM and record, per slide, every SmartArt (layout, nodes, geometry with rotation,
# text and sizes) and a PNG of every slide at the canvas's pixel size. With -Edit: a node edit, its sizes after, and Change Layout.
# PowerPoint is shared with another agent: only our presentations are closed, and PowerPoint quits only when none is left open.
param([string[]]$Files, [string]$OutDir, [switch]$Edit, [string]$Dir)
. "$PSScriptRoot/ppt.ps1"
if ($Dir) { $Files = @(Get-ChildItem (Join-Path $Dir "*.pptx") | ForEach-Object FullName) }
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$app = Start-Ppt
$result = @(); $mine = @()
try {
  foreach ($file in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($file)
    $deck = [ordered]@{ file = $name; slides = @() }
    try {
      $p = $app.Presentations.Open($file, -1, 0, -1); $mine += $p
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
          $entry = [ordered]@{ name = $shp.Name; left = $shp.Left; top = $shp.Top; width = $shp.Width; height = $shp.Height; layout = $sa.Layout.Id; layoutName = $sa.Layout.Name; nodes = $sa.AllNodes.Count; texts = @(); items = @() }
          for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $entry.texts += $sa.AllNodes.Item($n).TextFrame2.TextRange.Text }
          $gi = $shp.GroupItems
          for ($try = 0; $try -lt 40 -and $gi.Count -lt 1; $try++) { Start-Sleep -Milliseconds 250; $null = $sl.Shapes.Count; $gi = $shp.GroupItems }
          for ($i = 1; $i -le $gi.Count; $i++) {
            $g = $gi.Item($i)
            $o = [ordered]@{ i = $i; type = $g.AutoShapeType; left = $g.Left; top = $g.Top; width = $g.Width; height = $g.Height; rot = $g.Rotation; fill = ('{0:X6}' -f $g.Fill.ForeColor.RGB); lineVisible = $g.Line.Visible; line = $g.Line.Weight }
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
            $node = $sa.AllNodes.Item(1); $before = $node.TextFrame2.TextRange.Font.Size
            $node.TextFrame2.TextRange.Text = 'Edited'
            $sl.Export((Join-Path $OutDir "$name-$s-edited.png"), "PNG", $pw, $ph)
            $entry.edit = [ordered]@{ sizeBefore = $before; sizeAfter = $node.TextFrame2.TextRange.Font.Size; items = @(for ($i = 1; $i -le $shp.GroupItems.Count; $i++) { $g = $shp.GroupItems.Item($i); "$($g.Left),$($g.Top),$($g.Width),$($g.Height),$($g.Rotation)" }) }
            $sizes = @(); for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sizes += $sa.AllNodes.Item($n).TextFrame2.TextRange.Font.Size }
            $entry.edit.sizes = $sizes
            try {
              if (-not $script:switchTarget) { for ($li = 1; $li -le $app.SmartArtLayouts.Count; $li++) { $l = $app.SmartArtLayouts.Item($li); if ($l.Id -eq 'urn:microsoft.com/office/officeart/2005/8/layout/default') { $script:switchTarget = $l; break } } }
              $sa.Layout = $script:switchTarget; $entry.edit.switchedTo = $sa.Layout.Name; $entry.edit.nodesAfterSwitch = $sa.AllNodes.Count
              $sl.Export((Join-Path $OutDir "$name-$s-switched.png"), "PNG", $pw, $ph)
            } catch { $entry.edit.switchedTo = "ERROR: $($_.Exception.Message)" }
          }
          $slide.smartArt += [pscustomobject]$entry
        }
        $deck.slides += [pscustomobject]$slide
      }
    } catch { $deck.error = $_.Exception.Message }
    $result += [pscustomobject]$deck
  }
} finally { Stop-Ppt $app $mine }
$result | ConvertTo-Json -Depth 14 | Set-Content -Encoding utf8 (Join-Path $OutDir 'probe.json')
"decks: $($result.Count)"
