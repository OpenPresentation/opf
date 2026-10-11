<#
.SYNOPSIS
  Runs run-deck.ps1 for every deck of the chosen sets, one after another (one child powershell.exe per deck, 90 s each). Supervisor-run only.

.DESCRIPTION
  - Reads helpers\decks-order.txt (set, deck id, mode, slides). The FF-13 set (mode "embed") is never run here: it has its own
    supervisor script, ff13-supervise.ps1, because it saves a copy.
  - Preflight: if no POWERPNT process is running it starts PowerPoint (Start-Process POWERPNT.EXE) and waits up to 60 s until it can
    be attached. It never quits, kills or restarts PowerPoint.
  - Each deck runs once. run-deck.ps1 refuses a deck that already has a run.json under -OutRoot, so re-running this script after an
    interruption continues with the decks not yet run (those are first attempts) and never retries one in place.
  - Writes <OutRoot>\run-set.json with the host, the PowerPoint version and one line per deck.

.EXAMPLE
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\opf-work\native-0-18-run\helpers\run-set.ps1 -Sets ff12,ff27 -OutRoot C:\opf-work\native-0-18-run\native\attempt-1
#>
param(
  [string[]]$Sets = @('ff12', 'ff27', 'ff46'),
  [string]$Root = 'C:\opf-work\native-0-18-run',
  [string]$OutRoot = (Join-Path 'C:\opf-work\native-0-18-run' 'native\attempt-1'),
  [int]$TimeoutSeconds = 90
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sets = @($Sets | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$null = New-Item -ItemType Directory -Force -Path $OutRoot

if (-not (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)) {
  $exe = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE' -ErrorAction SilentlyContinue).'(default)'
  if (-not $exe) { $exe = 'POWERPNT.EXE' }
  Write-Output "PowerPoint is not running: starting $exe"
  Start-Process -FilePath $exe | Out-Null
  $deadline = (Get-Date).AddSeconds(60); $attached = $false
  while (-not $attached -and (Get-Date) -lt $deadline) {
    try { $null = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application'); $attached = $true } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $attached) { throw 'PowerPoint did not register within 60 s; start it by hand and run again.' }
}
$app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
$log = [ordered]@{ startedUtc = (Get-Date).ToUniversalTime().ToString('o'); sets = $Sets; powerpoint = [ordered]@{ version = $app.Version; build = $app.Build }
  host = [ordered]@{ os = [System.Environment]::OSVersion.VersionString; powershell = $PSVersionTable.PSVersion.ToString(); culture = [System.Globalization.CultureInfo]::CurrentCulture.Name }; decks = New-Object System.Collections.ArrayList }
$app = $null
foreach ($line in Get-Content -LiteralPath (Join-Path $here 'decks-order.txt') -Encoding UTF8) {
  if (-not $line.Trim()) { continue }
  $set, $id, $mode = ($line -split "`t")[0, 1, 2]
  if ($Sets -notcontains $set -or $mode -eq 'embed') { continue }
  $runJson = Join-Path $OutRoot ($set + '\' + $id + '\' + $id + '.run.json')
  if (Test-Path -LiteralPath $runJson) { Write-Output "$set/${id}: already run under this OutRoot, skipped (no retry in place)"; continue }
  $text = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $here 'run-deck.ps1') -Set $set -DeckId $id -Mode $mode -Root $Root -OutRoot $OutRoot -TimeoutSeconds $TimeoutSeconds 2>&1
  Write-Output $text
  [void]$log.decks.Add([ordered]@{ set = $set; deck = $id; mode = $mode; output = ($text | Out-String).Trim() })
  [System.IO.File]::WriteAllText((Join-Path $OutRoot 'run-set.json'), ($log | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
}
$log.finishedUtc = (Get-Date).ToUniversalTime().ToString('o')
[System.IO.File]::WriteAllText((Join-Path $OutRoot 'run-set.json'), ($log | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("run-set done: {0} decks this pass; next: node compare.mjs --native {1}" -f $log.decks.Count, $OutRoot)
