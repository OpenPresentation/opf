param([string]$Seeds = 'C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx')
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint running; nothing done.'; exit 1 }
$ppt = New-Object -ComObject PowerPoint.Application
$seed = $null; $pres = $null
try {
  $ppt.Visible = -1; $ppt.WindowState = 2
  $seed = $ppt.Presentations.Open($Seeds, -1, 0, -1)
  $ss = $seed.Slides.Item(3); $layout = $null
  for ($s = 1; $s -le $ss.Shapes.Count; $s++) { $c = $ss.Shapes.Item($s); if ($c.HasSmartArt -eq -1) { $layout = $c.SmartArt.Layout; break } }
  $pres = $ppt.Presentations.Add(-1)
  # A: delete all, then add four.
  $sa = $pres.Slides.Add(1, 12).Shapes.AddSmartArt($layout, 40, 40, 880, 400).SmartArt
  while ($sa.AllNodes.Count -gt 0) { $sa.AllNodes.Item(1).Delete() }
  for ($i = 1; $i -le 4; $i++) { try { $n = $sa.Nodes.Add(); $n.TextFrame2.TextRange.Text = "N$i"; Write-Host "A add $i ok (all=$($sa.AllNodes.Count))" } catch { Write-Host "A add $i failed (all=$($sa.AllNodes.Count)): $($_.Exception.Message)" } }
  # B: keep the four default nodes and set their text.
  $sb = $pres.Slides.Add(2, 12).Shapes.AddSmartArt($layout, 40, 40, 880, 400).SmartArt
  for ($i = 1; $i -le $sb.Nodes.Count; $i++) { $sb.Nodes.Item($i).TextFrame2.TextRange.Text = "K$i" }
  Write-Host "B texts: $((1..$sb.AllNodes.Count | ForEach-Object { $sb.AllNodes.Item($_).TextFrame2.TextRange.Text }) -join ',')"
} finally {
  foreach ($own in @($pres, $seed)) { if ($own) { try { $own.Saved = -1; $own.Close() } catch {} } }
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
