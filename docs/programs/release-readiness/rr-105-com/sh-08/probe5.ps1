param([string]$Seeds = 'C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx')
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint running; nothing done.'; exit 1 }
$ppt = New-Object -ComObject PowerPoint.Application
$seed = $null; $pres = $null
try {
  $ppt.Visible = -1; $ppt.WindowState = 2
  $seed = $ppt.Presentations.Open($Seeds, -1, 0, -1)
  $pres = $ppt.Presentations.Add(-1)
  for ($k = 1; $k -le $seed.Slides.Count; $k++) {
    $layout = $null; $ss = $seed.Slides.Item($k)
    for ($s = 1; $s -le $ss.Shapes.Count; $s++) { $c = $ss.Shapes.Item($s); if ($c.HasSmartArt -eq -1) { $layout = $c.SmartArt.Layout; break } }
    if (-not $layout) { Write-Host "$k`tno live SmartArt on seed slide"; continue }
    $slide = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    $sa = $slide.Shapes.AddSmartArt($layout, 40, 40, 880, 400).SmartArt
    $default = $sa.AllNodes.Count; $top = $sa.Nodes.Count
    $deleteAll = 'ok'
    try { while ($sa.AllNodes.Count -gt 0) { $sa.AllNodes.Item(1).Delete() } } catch { $deleteAll = "delete failed at $($sa.AllNodes.Count): $($_.Exception.Message)" }
    $afterDelete = $sa.AllNodes.Count
    $addAfterDelete = 'ok'; try { $null = $sa.Nodes.Add() } catch { $addAfterDelete = $_.Exception.Message }
    $slide2 = $pres.Slides.Add($pres.Slides.Count + 1, 12)
    $sb = $slide2.Shapes.AddSmartArt($layout, 40, 40, 880, 400).SmartArt
    $addKeep = 'ok'; try { $null = $sb.Nodes.Add() } catch { $addKeep = $_.Exception.Message }
    Write-Host ("{0}`t{1}`t{2}`tdefault all={3} top={4}`tdeleteAll={5} left={6}`tadd after delete={7}`tadd keeping defaults={8}" -f $k, $layout.Name, $layout.Id, $default, $top, $deleteAll, $afterDelete, $addAfterDelete, $addKeep)
  }
} finally {
  foreach ($own in @($pres, $seed)) { if ($own) { try { $own.Saved = -1; $own.Close() } catch {} } }
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
