param([string]$listFile, [string]$outRoot, [string]$logFile)
# listFile: lines "id|pptxPath|roundtrip(0/1)". Opens each read-only without a window, exports every slide at 1280x720 to
# <outRoot>\<id>\<n>.png; for roundtrip=1 also SaveAs a copy (<outRoot>\roundtrip\<id>.pptx) and opens that again.
# One PowerPoint instance for the batch; quit at the end.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $outRoot | Out-Null
New-Item -ItemType Directory -Force (Join-Path $outRoot 'roundtrip') | Out-Null
$lines = Get-Content $listFile | Where-Object { $_.Trim() -ne '' }
$app = New-Object -ComObject PowerPoint.Application
$log = @()
try {
  foreach ($line in $lines) {
    $id, $path, $rt = $line.Split('|')
    $row = [ordered]@{ id = $id; path = $path; open = $false; slides = 0; exported = 0; roundtrip = $null; error = $null }
    $dir = Join-Path $outRoot $id
    New-Item -ItemType Directory -Force $dir | Out-Null
    try {
      $deck = $app.Presentations.Open($path, $true, $false, $false)
      $row.open = $true
      $row.slides = $deck.Slides.Count
      for ($i = 1; $i -le $deck.Slides.Count; $i++) {
        $deck.Slides.Item($i).Export((Join-Path $dir ("{0}.png" -f $i)), 'PNG', 1280, 720)
        $row.exported++
      }
      if ($rt -eq '1') {
        $copy = Join-Path (Join-Path $outRoot 'roundtrip') ("{0}.pptx" -f $id)
        if (Test-Path $copy) { Remove-Item $copy -Force }
        $deck.SaveCopyAs($copy)
        $deck.Close()
        $deck = $null
        try {
          $again = $app.Presentations.Open($copy, $true, $false, $false)
          $row.roundtrip = "reopened, $($again.Slides.Count) slides"
          $again.Close()
        } catch { $row.roundtrip = "REOPEN FAILED: $($_.Exception.Message)" }
      }
      if ($deck) { $deck.Close() }
    } catch {
      $row.error = $_.Exception.Message
      try { if ($deck) { $deck.Close() } } catch {}
    }
    $deck = $null
    $log += [pscustomobject]$row
    Write-Output ("{0} open={1} slides={2} exported={3} rt={4} err={5}" -f $id, $row.open, $row.slides, $row.exported, $row.roundtrip, $row.error)
  }
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  $log | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 $logFile
}
