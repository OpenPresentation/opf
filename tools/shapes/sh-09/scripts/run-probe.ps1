param([string]$File, [string]$OutPrefix, [string]$SwitchTo = 'urn:microsoft.com/office/officeart/2005/8/layout/chevron1', [int]$TimeoutSec = 90)
# Run probe.ps1 in a child process; kill PowerPoint if it hangs (for example on a repair prompt).
$out = "$OutPrefix-probe.json"
$before = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | ForEach-Object Id)
$args2 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$PSScriptRoot\probe.ps1", '-File', $File, '-OutPrefix', $OutPrefix, '-SwitchTo', $SwitchTo)
$p = Start-Process powershell -ArgumentList $args2 -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError "$OutPrefix-probe.err"
if (-not $p.WaitForExit($TimeoutSec * 1000)) {
  $p.Kill(); Get-Process POWERPNT -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | Stop-Process -Force
  "{`"file`":`"$(Split-Path $File -Leaf)`",`"open`":`"TIMEOUT after $TimeoutSec s (dialog, likely repair prompt)`"}" | Set-Content $out
}
Get-Content $out -Raw

