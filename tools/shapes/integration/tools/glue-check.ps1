param([string[]]$Decks, [string]$LogFile)
# For each deck (read-only, no window): every connector shape (also inside groups) with its BeginConnected/EndConnected state and the
# names and connection sites of the shapes it is glued to.
$ErrorActionPreference = 'Continue'
$app = New-Object -ComObject PowerPoint.Application
$rows = @()
function Walk($shapes, $slide, $deckName) {
  foreach ($shape in $shapes) {
    if ($shape.Type -eq 6) { Walk $shape.GroupItems $slide $deckName; continue }
    if ($shape.Connector -ne 0) {
      $c = $shape.ConnectorFormat
      $row = [ordered]@{ deck = $deckName; slide = $slide; name = $shape.Name; begin = [bool]$c.BeginConnected; end = [bool]$c.EndConnected; beginShape = $null; endShape = $null; beginSite = $null; endSite = $null }
      if ($c.BeginConnected) { $row.beginShape = $c.BeginConnectedShape.Name; $row.beginSite = $c.BeginConnectionSite }
      if ($c.EndConnected) { $row.endShape = $c.EndConnectedShape.Name; $row.endSite = $c.EndConnectionSite }
      $script:rows += [pscustomobject]$row
    }
  }
}
try {
  foreach ($deck in $Decks) {
    $p = $app.Presentations.Open($deck, $true, $false, $false)
    for ($i = 1; $i -le $p.Slides.Count; $i++) { Walk $p.Slides.Item($i).Shapes $i ([IO.Path]::GetFileNameWithoutExtension($deck)) }
    $p.Close()
  }
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  $rows | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 $LogFile
}
$rows | Group-Object deck | ForEach-Object { "{0}: {1} connectors, {2} glued at both ends, {3} at one end, {4} free" -f $_.Name, $_.Count, ($_.Group | Where-Object { $_.begin -and $_.end }).Count, ($_.Group | Where-Object { $_.begin -xor $_.end }).Count, ($_.Group | Where-Object { -not $_.begin -and -not $_.end }).Count }
