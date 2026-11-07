# SH-17: PowerPoint through COM, shared with another agent's sessions: open our own presentations only, close only those, quit only when
# no other presentation is open. Visible and minimized (SmartArtLayouts only fills then).
$ErrorActionPreference = 'Stop'
function Start-PPT {
  for ($try = 0; $try -lt 30; $try++) {
    try { $app = New-Object -ComObject PowerPoint.Application; $app.Visible = -1; $app.WindowState = 2; return $app } catch { Start-Sleep -Seconds 2 }
  }
  throw 'PowerPoint did not start'
}
function Invoke-Retry([scriptblock]$Block) {
  for ($try = 0; $try -lt 20; $try++) { try { return & $Block } catch { if ($try -ge 19) { throw }; Start-Sleep -Milliseconds 1500 } }
}
function Stop-PPT($app, $mine) {
  foreach ($p in @($mine)) { if ($p) { try { $p.Saved = -1; $p.Close() } catch {} } }
  try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
  [Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
$script:LayoutCache = @{}
function Get-Layout($app, $id) {
  if ($script:LayoutCache.ContainsKey($id)) { return $script:LayoutCache[$id] }
  for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) { $l = $app.SmartArtLayouts.Item($i); $script:LayoutCache[$l.Id] = $l }
  if ($script:LayoutCache.ContainsKey($id)) { return $script:LayoutCache[$id] }
  throw "layout not found: $id"
}
