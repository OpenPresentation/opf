param([string]$pptx, [string]$outDir, [int]$w = 1280, [int]$h = 720)
New-Item -ItemType Directory -Force $outDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open($pptx, -1, 0, 0)
  for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    $pres.Slides.Item($i).Export((Join-Path $outDir ("slide{0}.png" -f $i)), 'PNG', $w, $h)
  }
  $pres.Close()
} finally { $app.Quit() }
