param()
$ErrorActionPreference = 'Stop'
$evidencePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../artifacts/browser-evidence'))
$inputPath = Join-Path $evidencePath 'export.pptx'
if (-not (Test-Path -LiteralPath $inputPath)) { throw 'Run npm run test:playground first.' }
$outputPath = Join-Path $evidencePath 'native-saved.pptx'
$pngPath = Join-Path $evidencePath 'native-slide.png'
$presentation = $null
$reopened = $null
$powerpoint = New-Object -ComObject PowerPoint.Application
try {
  $presentation = $powerpoint.Presentations.Open($inputPath, 0, 0, 0)
  if ($presentation.Slides.Count -ne 1) { throw 'Expected the single browser fixture slide.' }
  $tables = 0
  $edited = $false
  foreach ($shape in $presentation.Slides.Item(1).Shapes) {
    if ($shape.HasTable -eq -1) { $tables++ }
    if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1 -and $shape.TextFrame.TextRange.Text.Contains('Edited before export')) {
      $shape.TextFrame.TextRange.Text = 'Edited in native PowerPoint'
      $edited = $true
    }
  }
  if ($tables -ne 1 -or -not $edited) { throw 'Browser export did not expose the expected native text/table.' }
  $presentation.SaveAs($outputPath, 24)
  $presentation.Close()
  $presentation = $null
  $reopened = $powerpoint.Presentations.Open($outputPath, -1, 0, 0)
  $found = $false
  foreach ($shape in $reopened.Slides.Item(1).Shapes) {
    if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1 -and $shape.TextFrame.TextRange.Text.Contains('Edited in native PowerPoint')) { $found = $true }
  }
  if (-not $found) { throw 'Native edit was not preserved after save/reopen.' }
  $reopened.Slides.Item(1).Export($pngPath, 'PNG', 1280, 720)
  $report = [ordered]@{ passed = $true; powerpointVersion = $powerpoint.Version; slides = 1; nativeTables = $tables; editedAndReopened = $found; sourceSha256 = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLower(); raster = 'native-slide.png' }
  $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidencePath 'native.json') -Encoding utf8
  $report | ConvertTo-Json
} finally {
  if ($presentation) { $presentation.Close() }
  if ($reopened) { $reopened.Close() }
  # Preserve PowerPoint and any other presentations the user already has open.
}
