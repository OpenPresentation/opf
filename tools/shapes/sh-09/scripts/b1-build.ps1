param([string[]]$Keys)
. "$PSScriptRoot\common.ps1"
New-Item -ItemType Directory -Force "$Root\q1" | Out-Null
if ($Keys) { $Keys = @($Keys | ForEach-Object { $_ -split ',' }) }
if (-not $Keys) { $Keys = @($Candidates.Keys) }
$app = Start-PPT
try {
  $tmp = $app.Presentations.Add(-1)  # holder: SmartArtLayouts empties when no presentation is open
  "SmartArtLayouts.Count = $($app.SmartArtLayouts.Count)" | Set-Content "$Root\q1\layouts-count.txt"
  foreach ($k in $Candidates.Keys) { $l = Get-LayoutById $app $Candidates[$k]; "$k`t$($l.Name)`t$($l.Id)" | Add-Content "$Root\q1\layouts-count.txt" }

  foreach ($k in $Keys) {
    try {
      $pres = $app.Presentations.Add(-1)
      $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
      $slide = $pres.Slides.Add(1, 12)
      $l = Get-LayoutById $app $Candidates[$k]
      $shp = $slide.Shapes.AddSmartArt($l, 80, 60, 800, 420)
      $shp.Name = "SA-$k"
      $sa = $shp.SmartArt
      $nodes = $sa.AllNodes
      $cnt = $nodes.Count
      for ($i = 1; $i -le $cnt; $i++) { $nodes.Item($i).TextFrame2.TextRange.Text = "Node $i" }
      $file = "$Root\q1\$k-base.pptx"
      $pres.SaveAs($file)
      Export-Slide $pres "$Root\q1\$k-base.png"
      Get-SmartArtGeometry $shp | ConvertTo-Json -Depth 3 | Set-Content "$Root\q1\$k-base-geom.json"
      "$k nodes=$cnt groupItems=$($shp.GroupItems.Count)"
    } catch { "$k ERROR: $($_.Exception.Message) at $($_.InvocationInfo.ScriptLineNumber)" }
    finally { try { $pres.Saved = -1; $pres.Close() } catch {} }
  }
} finally { Stop-PPT $app }

