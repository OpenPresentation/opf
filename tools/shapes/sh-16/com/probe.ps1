param([string[]]$Files, [string]$OutDir)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$results = @()
try {
  foreach ($file in $Files) {
    $deck = $app.Presentations.Open($file, -1, 0, 0)
    try {
      $base = [IO.Path]::GetFileNameWithoutExtension($file)
      foreach ($slide in $deck.Slides) {
        foreach ($shape in $slide.Shapes) {
          $nodes = @()
          $smart = $shape.HasSmartArt -eq -1
          if ($smart) { foreach ($node in $shape.SmartArt.AllNodes) { $nodes += $node.TextFrame2.TextRange.Text } }
          $results += [pscustomobject]@{file=$base; slide=$slide.SlideIndex; name=$shape.Name; type=$shape.Type; hasSmartArt=$smart; layout=$(if ($smart) { $shape.SmartArt.Layout.Name } else { '' }); nodes=($nodes -join '|'); alt=$shape.AlternativeText; left=$shape.Left; top=$shape.Top; width=$shape.Width; height=$shape.Height}
        }
        $slide.Export((Join-Path $OutDir "$base-slide$($slide.SlideIndex).png"), 'PNG', 1280, 720)
      }
    } finally { $deck.Close() }
  }
} finally { $app.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
$results | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 (Join-Path $OutDir 'probe.json')
$results | Format-Table file, slide, name, type, hasSmartArt, layout, nodes -AutoSize | Out-String -Width 250
