# SH-18: shared PowerPoint helpers. Two agents share this machine's PowerPoint: attach, open only our own files, close only ours,
# and quit only when no other presentation is open.
function Start-Ppt {
  for ($try = 0; $try -lt 60; $try++) {
    try {
      $app = New-Object -ComObject PowerPoint.Application
      $app.Visible = -1
      $app.WindowState = 2
      return $app
    } catch { Start-Sleep -Seconds 5 }
  }
  throw 'PowerPoint stayed busy'
}
function Stop-Ppt($app, $mine) {
  foreach ($p in @($mine)) { try { $p.Saved = -1; $p.Close() } catch {} }
  try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
  try { [Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } catch {}
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
