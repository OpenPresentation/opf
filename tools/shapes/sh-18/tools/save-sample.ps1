# SH-18 research: save a PowerPoint-authored Basic Cycle (local research file only; nothing of it ships).
param([string]$Out, [int]$N = 4, [string]$Frame = '80,60,800,420')
. "$PSScriptRoot/ppt.ps1"
$ErrorActionPreference = 'Stop'
$app = Start-Ppt
$pres = $app.Presentations.Add(-1)
try {
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) { $l = $app.SmartArtLayouts.Item($i); if ($l.Id -eq 'urn:microsoft.com/office/officeart/2005/8/layout/cycle2') { $layout = $l; break } }
  $b = $Frame.Split(',') | ForEach-Object { [double]$_ }
  $slide = $pres.Slides.Add(1, 12)
  $shp = $slide.Shapes.AddSmartArt($layout, $b[0], $b[1], $b[2], $b[3])
  $sa = $shp.SmartArt
  while ($sa.AllNodes.Count -gt $N) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
  while ($sa.AllNodes.Count -lt $N) { $null = $sa.AllNodes.Add() }
  for ($k = 1; $k -le $sa.AllNodes.Count; $k++) { $sa.AllNodes.Item($k).TextFrame2.TextRange.Text = "Step $k" }
  $pres.SaveAs($Out)
} finally { Stop-Ppt $app @($pres) }
