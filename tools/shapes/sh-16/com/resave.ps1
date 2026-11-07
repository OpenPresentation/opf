param([string]$File, [string]$Copy, [string]$OutDir)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
try {
  $deck = $app.Presentations.Open($File, -1, 0, 0)
  try { $deck.SaveCopyAs($Copy) } finally { $deck.Close() }
} finally { $app.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
