# SH-19 spike: open OPF-built files read-only through COM and record every SmartArt's layout and its shapes; optionally resize each
# frame and change its node count through COM (PowerPoint lays the SmartArt out again each time) and record again.
# PowerPoint visible and minimized; only our presentations are closed; quit when none is open.
param([string]$List, [string]$Out, [string]$Frames = '', [string]$Counts = '', [switch]$Png, [string]$PngDir = '')
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
function Shapes-Of($shp) {
  $rows = @()
  $gi = $shp.GroupItems
  for ($try = 0; $try -lt 40 -and $gi.Count -lt 1; $try++) { Start-Sleep -Milliseconds 250; $gi = $shp.GroupItems }
  for ($i = 1; $i -le $gi.Count; $i++) {
    $g = $gi.Item($i)
    $o = [ordered]@{ i = $i; type = $g.AutoShapeType; l = [math]::Round($g.Left - $shp.Left, 4); t = [math]::Round($g.Top - $shp.Top, 4); w = [math]::Round($g.Width, 4); h = [math]::Round($g.Height, 4); rot = $g.Rotation }
    try { $adj = @(); for ($a = 1; $a -le $g.Adjustments.Count; $a++) { $adj += [math]::Round($g.Adjustments.Item($a), 5) }; $o.adj = $adj } catch { $o.adjError = $_.Exception.Message }
    try { $o.fill = ('{0:X6}' -f $g.Fill.ForeColor.RGB); $o.fillVisible = $g.Fill.Visible; $o.line = $g.Line.Weight; $o.lineVisible = $g.Line.Visible } catch {}
    try {
      if ($g.HasTextFrame -and $g.TextFrame2.HasText) {
        $tf = $g.TextFrame2; $tr = $tf.TextRange
        $o.text = $tr.Text; $o.size = $tr.Font.Size; $o.face = $tr.Font.Name; $o.ml = $tf.MarginLeft; $o.mr = $tf.MarginRight; $o.mt = $tf.MarginTop; $o.mb = $tf.MarginBottom
        $o.anchor = $tf.VerticalAnchor; $o.align = $tr.ParagraphFormat.Alignment; $o.autoSize = $tf.AutoSize; $o.wrap = $tf.WordWrap
        $lines = @(); for ($j = 1; $j -le $tr.Lines().Count; $j++) { $l = $tr.Lines($j); $lines += [pscustomobject]@{ text = $l.Text; l = [math]::Round($l.BoundLeft - $shp.Left, 3); t = [math]::Round($l.BoundTop - $shp.Top, 3); w = [math]::Round($l.BoundWidth, 3); h = [math]::Round($l.BoundHeight, 3) } }
        $o.lines = $lines
      }
    } catch { $o.textError = $_.Exception.Message }
    $rows += [pscustomobject]$o
  }
  return $rows
}
$Files = @($List -split ";" | Where-Object { $_ })
$app = Start-PPT
$mine = New-Object Collections.ArrayList
$result = @()
try {
  foreach ($file in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($file)
    $deck = [ordered]@{ file = $name; diagrams = @() }
    try {
      $p = Invoke-Retry { $app.Presentations.Open($file, -1, 0, -1) }; [void]$mine.Add($p)
      $sl = $p.Slides.Item(1)
      try { $p.Windows.Item(1).View.GotoSlide(1) } catch {}
      if ($Png) { $d = if ($PngDir) { $PngDir } else { Split-Path $file }; $pw = [int][math]::Round($p.PageSetup.SlideWidth * 4 / 3); $ph = [int][math]::Round($p.PageSetup.SlideHeight * 4 / 3); $sl.Export((Join-Path $d "$name.png"), 'PNG', $pw, $ph) }
      for ($k = 1; $k -le $sl.Shapes.Count; $k++) {
        $shp = $sl.Shapes.Item($k)
        $entry = [ordered]@{ name = $shp.Name; hasSmartArt = $shp.HasSmartArt; l = $shp.Left; t = $shp.Top; w = $shp.Width; h = $shp.Height }
        if ($shp.HasSmartArt -ne -1) { $deck.diagrams += [pscustomobject]$entry; continue }
        $sa = $shp.SmartArt
        $entry.layout = $sa.Layout.Id; $entry.layoutName = $sa.Layout.Name; $entry.layoutDesc = $sa.Layout.Description; $entry.layoutCategory = $sa.Layout.Category; $entry.nodes = $sa.AllNodes.Count
        $entry.shapes = Shapes-Of $shp
        if ($Frames -or $Counts) {
          $sweep = @()
          $frameList = if ($Frames) { $Frames -split ';' } else { @("$($shp.Width)x$($shp.Height)") }
          $countList = if ($Counts) { @($Counts -split ',' | ForEach-Object { [int]$_ }) } else { @($sa.AllNodes.Count) }
          foreach ($fr in $frameList) {
            $wh = $fr -split 'x'; $shp.LockAspectRatio = 0; $shp.Width = [double]$wh[0]; $shp.Height = [double]$wh[1]
            foreach ($n in $countList) {
              while ($sa.AllNodes.Count -gt $n) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
              while ($sa.AllNodes.Count -lt $n) { $node = $sa.AllNodes.Add(); $node.TextFrame2.TextRange.Text = "N$($sa.AllNodes.Count)" }
              $sweep += [pscustomobject]@{ W = $shp.Width; H = $shp.Height; n = $sa.AllNodes.Count; shapes = (Shapes-Of $shp) }
            }
          }
          $entry.sweep = $sweep
        }
        $deck.diagrams += [pscustomobject]$entry
      }
      $p.Saved = -1; $p.Close(); $mine.Remove($p)
    } catch { $deck.error = "$($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" }
    $result += [pscustomobject]$deck
  }
} finally { Stop-PPT $app @($mine) }
$result | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 $Out
"done $($result.Count) -> $Out"
