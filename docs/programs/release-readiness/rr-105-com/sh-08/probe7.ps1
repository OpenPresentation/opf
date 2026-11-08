param([string]$Seeds = 'C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx')
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint running; nothing done.'; exit 1 }
$ppt = New-Object -ComObject PowerPoint.Application
$seed = $null; $pres = $null
try {
  $ppt.Visible = -1; $ppt.WindowState = 2
  $seed = $ppt.Presentations.Open($Seeds, -1, 0, -1)
  $pres = $ppt.Presentations.Add(-1)
  foreach ($k in 9, 11) {
    $ss = $seed.Slides.Item($k); $layout = $null
    for ($s = 1; $s -le $ss.Shapes.Count; $s++) { $c = $ss.Shapes.Item($s); if ($c.HasSmartArt -eq -1) { $layout = $c.SmartArt.Layout; break } }
    # msoSmartArtNodeBelow=5, msoSmartArtNodeAfter=2, msoSmartArtNodeDefault=1.
    foreach ($mode in "paragraph", "belowDefault") {
      $sa = $pres.Slides.Add($pres.Slides.Count + 1, 12).Shapes.AddSmartArt($layout, 40, 40, 880, 400).SmartArt
      $top = $sa.Nodes.Item(1); $before = $top.Nodes.Count
      $r = 'ok'
      try {
        if ($mode -eq "paragraph") { $top.Nodes.Item(1).TextFrame2.TextRange.Text = "First`rSecond`rThird" }
        else { $null = $top.AddNode(1, 1) }
      } catch { $r = $_.Exception.Message }
      Write-Host "$k $($layout.Name) $mode`: children $before -> $($top.Nodes.Count), top-level $($sa.Nodes.Count), all $($sa.AllNodes.Count) ($r): $((1..$sa.AllNodes.Count | ForEach-Object { $n = $sa.AllNodes.Item($_); 'L' + $n.Level + ':' + ($n.TextFrame2.TextRange.Text -replace "`r", '|') }) -join ' ; ')"
    }
  }
} finally {
  foreach ($own in @($pres, $seed)) { if ($own) { try { $own.Saved = -1; $own.Close() } catch {} } }
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
