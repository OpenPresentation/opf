# Builds powerpoint-shapes.pptx, the PowerPoint-authored fixture of SH-05 (test/sh-05-powerpoint-shapes.mjs), through PowerPoint's object model (Windows, PowerPoint installed; no UI control).
param([string]$Out = (Join-Path $PSScriptRoot 'powerpoint-shapes.pptx'))
$ErrorActionPreference = 'Stop'
function RGBc($r, $g, $b) { return [int]($r + 256 * $g + 65536 * $b) }
$ppt = New-Object -ComObject PowerPoint.Application
try {
  $pres = $ppt.Presentations.Add(0)
  $blank = $pres.SlideMaster.CustomLayouts.Item(7)
  function NewSlide() { $script:pres.Slides.AddSlide($script:pres.Slides.Count + 1, $script:blank) }

  # Slide 1: autoshapes, a few with adjustments and text.
  $s = NewSlide
  $types = @(1,5,9,7,4,10,13,14,33,52,92,105,63,21,18,142,20,160,179,17)
  $names = @('rectangle','roundRect','ellipse','triangle','diamond','hexagon','can','cube','rightArrow','chevron','star5','wedgeRectCallout','flowChartDecision','heart','donut','pie','blockArc','teardrop','cloud','smileyFace')
  for ($i = 0; $i -lt $types.Count; $i++) {
    $col = $i % 5; $row = [math]::Floor($i / 5)
    $sh = $s.Shapes.AddShape($types[$i], 40 + $col * 180, 30 + $row * 125, 140, 90)
    $sh.Name = "Shape $($names[$i])"
  }
  $s.Shapes.Item('Shape roundRect').Adjustments.Item(1) = 0.3
  $s.Shapes.Item('Shape rightArrow').Adjustments.Item(1) = 0.35
  $s.Shapes.Item('Shape rightArrow').Adjustments.Item(2) = 0.6
  $s.Shapes.Item('Shape star5').Adjustments.Item(1) = 0.35
  $s.Shapes.Item('Shape rectangle').TextFrame.TextRange.Text = 'Plan'
  $s.Shapes.Item('Shape ellipse').TextFrame.TextRange.Text = 'Build'
  $s.Shapes.Item('Shape ellipse').TextFrame.TextRange.Font.Bold = -1

  # Slide 2: fills and lines.
  $s = NewSlide
  $a = $s.Shapes.AddShape(5, 40, 30, 200, 100); $a.Name = 'Fill gradient linear'
  $a.Fill.TwoColorGradient(1, 1); $a.Fill.ForeColor.RGB = (RGBc 31 90 166); $a.Fill.BackColor.RGB = (RGBc 192 200 208); $a.Fill.GradientAngle = 45
  $b = $s.Shapes.AddShape(9, 270, 30, 200, 100); $b.Name = 'Fill gradient radial'
  $b.Fill.TwoColorGradient(7, 1); $b.Fill.ForeColor.RGB = (RGBc 255 214 102); $b.Fill.BackColor.RGB = (RGBc 176 90 42)
  $c = $s.Shapes.AddShape(1, 500, 30, 200, 100); $c.Name = 'Fill pattern'
  $c.Fill.Patterned(21); $c.Fill.ForeColor.RGB = (RGBc 31 90 166); $c.Fill.BackColor.RGB = (RGBc 255 255 255)
  $d = $s.Shapes.AddShape(5, 730, 30, 190, 100); $d.Name = 'Fill lighter accent'
  $d.Fill.ForeColor.ObjectThemeColor = 5; $d.Fill.ForeColor.Brightness = 0.4
  $e = $s.Shapes.AddShape(1, 40, 170, 200, 100); $e.Name = 'Fill transparent'
  $e.Fill.ForeColor.RGB = (RGBc 176 90 42); $e.Fill.Transparency = 0.5
  $f = $s.Shapes.AddShape(1, 270, 170, 200, 100); $f.Name = 'Line dashed round'
  $f.Fill.Visible = 0; $f.Line.ForeColor.RGB = (RGBc 31 90 166); $f.Line.Weight = 4.5; $f.Line.DashStyle = 4
  $g = $s.Shapes.AddShape(1, 500, 170, 200, 100); $g.Name = 'Line compound'
  $g.Fill.Visible = 0; $g.Line.ForeColor.RGB = (RGBc 74 122 58); $g.Line.Weight = 6; $g.Line.Style = 2
  $h = $s.Shapes.AddShape(1, 730, 170, 190, 100); $h.Name = 'Line none'
  $h.Fill.ForeColor.RGB = (RGBc 122 74 154); $h.Line.Visible = 0
  $i1 = $s.Shapes.AddLine(40, 330, 300, 330); $i1.Name = 'Line arrows'
  $i1.Line.ForeColor.RGB = (RGBc 16 24 32); $i1.Line.Weight = 3; $i1.Line.BeginArrowheadStyle = 3; $i1.Line.EndArrowheadStyle = 2; $i1.Line.EndArrowheadLength = 3
  $j = $s.Shapes.AddShape(25, 360, 300, 200, 100); $j.Name = 'Arc open'
  $j.Line.ForeColor.RGB = (RGBc 176 90 42); $j.Line.Weight = 3; $j.Line.EndArrowheadStyle = 2

  # Slide 3: effects, rotation and flips.
  $s = NewSlide
  $a = $s.Shapes.AddShape(5, 40, 40, 190, 100); $a.Name = 'Effect shadow'
  $a.Shadow.Visible = -1; $a.Shadow.OffsetX = 4; $a.Shadow.OffsetY = 4; $a.Shadow.Blur = 8; $a.Shadow.Transparency = 0.6; $a.Shadow.ForeColor.RGB = 0
  $b = $s.Shapes.AddShape(9, 270, 40, 190, 100); $b.Name = 'Effect glow'
  $b.Glow.Radius = 12; $b.Glow.Color.RGB = (RGBc 255 214 102); $b.Glow.Transparency = 0.5
  $c = $s.Shapes.AddShape(5, 500, 40, 190, 100); $c.Name = 'Effect soft edge'
  $c.SoftEdge.Radius = 10
  $d = $s.Shapes.AddShape(5, 730, 40, 190, 100); $d.Name = 'Effect reflection'
  $d.Reflection.Type = 5
  $e = $s.Shapes.AddShape(5, 40, 200, 190, 100); $e.Name = 'Effect 3-D bevel'
  $e.ThreeD.BevelTopType = 3; $e.ThreeD.BevelTopDepth = 6; $e.ThreeD.BevelTopInset = 6
  $f = $s.Shapes.AddShape(33, 270, 200, 190, 100); $f.Name = 'Rotated arrow'
  $f.Rotation = 30
  $g = $s.Shapes.AddShape(33, 500, 200, 190, 100); $g.Name = 'Flipped arrow'
  $g.Flip(0)
  $h = $s.Shapes.AddShape(8, 730, 200, 190, 100); $h.Name = 'Flipped rotated triangle'
  $h.Flip(1); $h.Rotation = 20

  # Slide 4: connectors and groups.
  $s = NewSlide
  $p = $s.Shapes.AddShape(5, 60, 60, 160, 80); $p.Name = 'Box A'; $p.TextFrame.TextRange.Text = 'A'
  $q = $s.Shapes.AddShape(5, 380, 60, 160, 80); $q.Name = 'Box B'; $q.TextFrame.TextRange.Text = 'B'
  $r = $s.Shapes.AddShape(9, 700, 60, 160, 80); $r.Name = 'Oval C'; $r.TextFrame.TextRange.Text = 'C'
  $t = $s.Shapes.AddShape(4, 380, 280, 160, 100); $t.Name = 'Diamond D'
  $c1 = $s.Shapes.AddConnector(1, 0, 0, 10, 10); $c1.Name = 'Connector straight'
  $c1.ConnectorFormat.BeginConnect($p, 4); $c1.ConnectorFormat.EndConnect($q, 2); $c1.Line.EndArrowheadStyle = 2; $c1.Line.Weight = 2.25
  $c2 = $s.Shapes.AddConnector(3, 0, 0, 10, 10); $c2.Name = 'Connector curved'
  $c2.ConnectorFormat.BeginConnect($q, 4); $c2.ConnectorFormat.EndConnect($r, 2); $c2.Line.EndArrowheadStyle = 2
  $c3 = $s.Shapes.AddConnector(2, 0, 0, 10, 10); $c3.Name = 'Connector elbow'
  $c3.ConnectorFormat.BeginConnect($p, 3); $c3.ConnectorFormat.EndConnect($t, 2); $c3.Line.EndArrowheadStyle = 2; $c3.Line.DashStyle = 4
  $c4 = $s.Shapes.AddConnector(1, 600, 300, 800, 380); $c4.Name = 'Connector free'
  $c4.Line.EndArrowheadStyle = 5
  $g1 = $s.Shapes.AddShape(1, 60, 280, 100, 60); $g1.Name = 'Group member 1'
  $g2 = $s.Shapes.AddShape(9, 120, 320, 100, 60); $g2.Name = 'Group member 2'
  $grp = $s.Shapes.Range(@('Group member 1', 'Group member 2')).Group(); $grp.Name = 'Group of two'
  $grp.Width = $grp.Width * 1.2; $grp.Rotation = 15

  $dir = Split-Path $Out
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  if (Test-Path $Out) { Remove-Item $Out -Force }
  $pres.SaveAs($Out, 24)
  $pres.Close()
  "saved $Out"
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
