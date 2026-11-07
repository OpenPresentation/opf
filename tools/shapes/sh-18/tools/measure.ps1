# SH-18: Basic Cycle (cycle2) geometry through COM. For each frame (left, top, width, height) and node count, insert the SmartArt,
# set the node count, and record every drawn shape: type, box, rotation, adjustments, text margins and font size.
param([string]$Out, [string]$Frames = '80,60,800,420;80,60,420,420', [int]$Min = 1, [int]$Max = 10)
. "$PSScriptRoot/ppt.ps1"
$ErrorActionPreference = 'Stop'
$app = Start-Ppt
$pres = $app.Presentations.Add(-1)
$rows = @()
try {
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  $layout = $null
  for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) { $l = $app.SmartArtLayouts.Item($i); if ($l.Id -eq 'urn:microsoft.com/office/officeart/2005/8/layout/cycle2') { $layout = $l; break } }
  if (-not $layout) { throw 'cycle2 not found' }
  foreach ($f in $Frames.Split(';')) {
    $b = $f.Split(',') | ForEach-Object { [double]$_ }
    for ($n = $Min; $n -le $Max; $n++) {

      $slide = $pres.Slides.Add($pres.Slides.Count + 1, 12)
      $shp = $slide.Shapes.AddSmartArt($layout, $b[0], $b[1], $b[2], $b[3])
      $sa = $shp.SmartArt
      while ($sa.AllNodes.Count -gt $n) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
      while ($sa.AllNodes.Count -lt $n) { $null = $sa.AllNodes.Add() }
      for ($k = 1; $k -le $sa.AllNodes.Count; $k++) { $sa.AllNodes.Item($k).TextFrame2.TextRange.Text = "N$k" }
      $gi = $shp.GroupItems
      for ($i = 1; $i -le $gi.Count; $i++) {
        $g = $gi.Item($i)
        $row = [ordered]@{ frame = $f; n = $n; i = $i; type = $g.AutoShapeType; left = $g.Left; top = $g.Top; width = $g.Width; height = $g.Height; rot = $g.Rotation }
        try { $adj = @(); for ($a = 1; $a -le $g.Adjustments.Count; $a++) { $adj += [math]::Round($g.Adjustments.Item($a), 6) }; $row.adj = ($adj -join ' ') } catch { $row.adj = 'err' }
        try { $tf = $g.TextFrame2; $row.ml = $tf.MarginLeft; $row.mt = $tf.MarginTop; $row.size = $tf.TextRange.Font.Size; $row.text = $tf.TextRange.Text } catch { $row.text = 'err' }
        try { $row.fill = ('{0:X6}' -f $g.Fill.ForeColor.RGB); $row.line = $g.Line.Weight; $row.lineVisible = $g.Line.Visible } catch {}
        $rows += [pscustomobject]$row
      }
    }
  }
} catch { Write-Host "ERROR: $($_.Exception.Message) at $($_.InvocationInfo.ScriptLineNumber)" }
finally {
  Stop-Ppt $app @($pres)
}
$rows | Export-Csv -NoTypeInformation -Encoding utf8 $Out
"rows: $($rows.Count)"
