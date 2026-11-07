param([string]$Layout, [int]$N = 3, [double]$W = 800, [double]$H = 420, [double]$Size = 24, [string]$Text = 'Plan', [string]$Out)
. "$PSScriptRoot\ppt.ps1"
$app = Start-PPT; $pres = $null
try {
  $pres = Invoke-Retry { $app.Presentations.Add(-1) }; $app.WindowState = 2
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  try { $pres.Windows.Item(1).Activate() } catch {}
  $l = Get-Layout $app "urn:microsoft.com/office/officeart/2005/8/layout/$Layout"
  $slide = $pres.Slides.Add(1, 12)
  $shp = $slide.Shapes.AddSmartArt($l, 80, 60, $W, $H); $sa = $shp.SmartArt
  while ($sa.AllNodes.Count -gt $N) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
  while ($sa.AllNodes.Count -lt $N) { [void]$sa.AllNodes.Add() }
  for ($i = 1; $i -le $N; $i++) { $tr = $sa.AllNodes.Item($i).TextFrame2.TextRange; $tr.Text = "$Text $i"; $tr.Font.Size = $Size }
  $pres.SaveAs($Out)
} finally { Stop-PPT $app @($pres) }
