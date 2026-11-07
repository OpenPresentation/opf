param([string[]]$Keys, [int]$MaxNodes = 8)
# Q4: PowerPoint geometry per layout at 1..8 nodes, for short, medium and long text. COM only.
. "$PSScriptRoot\common.ps1"
if ($Keys) { $Keys = @($Keys | ForEach-Object { $_ -split ',' }) }
if (-not $Keys) { $Keys = @($Candidates.Keys) }
$q = "$Root\q4"; New-Item -ItemType Directory -Force $q | Out-Null
$texts = [ordered]@{ short = 'Plan'; medium = 'Quarterly review'; long = 'A considerably longer label that has to wrap over several lines' }
$tree = @('orgChart1', 'nameTitleOrg', 'hierarchy1')

function Set-NodeCount($sa, [int]$n, [bool]$isTree) {
  if ($isTree) {
    # keep only the root, then add n-1 children below it
    while ($sa.AllNodes.Count -gt 1) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
    $root = $sa.AllNodes.Item(1)
    for ($i = 2; $i -le $n; $i++) { [void]$root.AddNode(5) }  # msoSmartArtNodeBelow
  } else {
    while ($sa.AllNodes.Count -gt $n) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
    while ($sa.AllNodes.Count -lt $n) { [void]$sa.AllNodes.Add() }
  }
}

$rows = New-Object Collections.ArrayList
$app = Start-PPT
try {
  $hold = $app.Presentations.Add(-1)
  foreach ($k in $Keys) {
    $pres = $app.Presentations.Add(-1)
    $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
    $l = Get-LayoutById $app $Candidates[$k]
    $si = 0
    foreach ($n in 1..$MaxNodes) {
      foreach ($tk in $texts.Keys) {
        $si++
        $slide = $pres.Slides.Add($si, 12)
        try {
          $shp = $slide.Shapes.AddSmartArt($l, 80, 60, 800, 420)
          $sa = $shp.SmartArt
          Set-NodeCount $sa $n ($tree -contains $k)
          for ($i = 1; $i -le $sa.AllNodes.Count; $i++) { $sa.AllNodes.Item($i).TextFrame2.TextRange.Text = "$($texts[$tk]) $i" }
          $g = Get-SmartArtGeometry $shp
          foreach ($s in $g) { [void]$rows.Add([pscustomobject]@{ layout = $k; nodes = $sa.AllNodes.Count; text = $tk; i = $s.i; type = $s.type; left = $s.left; top = $s.top; width = $s.width; height = $s.height; fill = $s.fill; fontSize = $s.fontSize; label = $s.text }) }
          if ($n -in 1, 3, 5, 8) { $slide.Export("$q\$k-n$n-$tk.png", 'PNG', 960, 540) }
        } catch { [void]$rows.Add([pscustomobject]@{ layout = $k; nodes = $n; text = $tk; label = "ERROR: $($_.Exception.Message)" }) }
      }
    }
    $pres.SaveAs("$q\$k-sweep.pptx"); $pres.Close()
    "$k done"
  }
} finally { Stop-PPT $app }
$csv = "$q\geometry-$(($Keys -join '_')).csv"
$rows | Export-Csv $csv -NoTypeInformation
"rows=$($rows.Count) -> $csv"
