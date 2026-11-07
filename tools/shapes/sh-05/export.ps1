# Exports every slide of a PPTX to PNG through PowerPoint's object model (read-only open, no UI control), then quits PowerPoint.
param([string]$Pptx, [string]$OutDir, [int]$Width = 1280, [int]$Height = 720)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
$ppt = New-Object -ComObject PowerPoint.Application
try {
  $pres = $ppt.Presentations.Open($Pptx, -1, 0, 0)
  $count = $pres.Slides.Count
  for ($i = 1; $i -le $count; $i++) { $pres.Slides.Item($i).Export((Join-Path $OutDir "slide$i.png"), 'PNG', $Width, $Height) }
  $pres.Close()
  "exported $count slides"
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
