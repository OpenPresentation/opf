param([string]$pptx, [string]$outDir, [int]$w = 1280, [int]$h = 720)
# SH-04: export each slide as PNG, list every connector's glue (BeginConnectedShape, EndConnectedShape and the 1-based site indexes),
# then move each glued shape and read the connector again: a glued connector follows the shape it is attached to.
New-Item -ItemType Directory -Force $outDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$report = @()
try {
  $pres = $app.Presentations.Open($pptx, -1, 0, 0)
  for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    $slide = $pres.Slides.Item($i)
    $slide.Export((Join-Path $outDir ("ppt{0}.png" -f $i)), 'PNG', $w, $h)
    foreach ($shape in $slide.Shapes) {
      if (-not $shape.Connector) { continue }
      $c = $shape.ConnectorFormat
      $line = [ordered]@{ slide = $i; name = $shape.Name; type = $c.Type; begin = $null; end = $null }
      if ($c.BeginConnected) { $line.begin = "{0} site {1}" -f $c.BeginConnectedShape.Name, $c.BeginConnectionSite }
      if ($c.EndConnected) { $line.end = "{0} site {1}" -f $c.EndConnectedShape.Name, $c.EndConnectionSite }
      $before = "{0:N1},{1:N1},{2:N1},{3:N1}" -f $shape.Left, $shape.Top, $shape.Width, $shape.Height
      $moved = $null
      if ($c.EndConnected) {
        $target = $c.EndConnectedShape
        $target.Left = $target.Left + 40
        $target.Top = $target.Top + 30
        $moved = $target.Name
      }
      $after = "{0:N1},{1:N1},{2:N1},{3:N1}" -f $shape.Left, $shape.Top, $shape.Width, $shape.Height
      $line.box_before = $before
      $line.moved = $moved
      $line.box_after = $after
      $line.still_glued = ($c.BeginConnected -or -not $line.begin) -and ($c.EndConnected -or -not $line.end)
      $report += [pscustomobject]$line
    }
  }
  $pres.Close()
} finally { $app.Quit() }
$report | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $outDir 'com-connectors.json')
$report | Format-Table -AutoSize | Out-String -Width 250
