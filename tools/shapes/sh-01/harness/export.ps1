param([string]$Pptx = "C:\opf-work\shapes\sh-01\run\shapes.pptx", [string]$Out = "C:\opf-work\shapes\sh-01\run\ppt")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
  # Open(FileName, ReadOnly, Untitled, WithWindow)
  $deck = $app.Presentations.Open($Pptx, -1, 0, 0)
  try {
    $count = $deck.Slides.Count
    for ($i = 1; $i -le $count; $i++) {
      $file = Join-Path $Out ("{0:D3}.png" -f $i)
      $deck.Slides.Item($i).Export($file, "PNG", 1280, 720)
    }
    Write-Output "exported $count slides"
  } finally { $deck.Close() }
} finally { $app.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null }
