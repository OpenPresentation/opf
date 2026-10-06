# RR-54 re-check: run every step of the set, one child powershell.exe per deck (per chart for Edit Data), 90 s deadline
# each, no retries. Start desktop PowerPoint by hand first (no deck open).
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1 [-Step read|editdata|save|all] [-Only c2-zeros]
# Steps: read (C3, every deck, read-only), editdata (C2, the c2-zeros decks, one child per chart), save (C4, the c4 decks:
# SaveCopyAs of a COPY, see save-copy.ps1). Only the owned child is ever stopped (on its deadline); PowerPoint and Excel
# are never killed, quit or saved. A failed or timed-out step is recorded in out\run.json and NOT retried.
param([ValidateSet('read','editdata','save','all')][string]$Step = 'all', [string]$Only = '')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out = Join-Path $root 'out'
if (-not (Test-Path -LiteralPath $out)) { [void](New-Item -ItemType Directory -Path $out) }
$hostExe = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$runFile = Join-Path $out 'run.json'
$runs = @(); if (Test-Path -LiteralPath $runFile) { $runs = @(Get-Content -LiteralPath $runFile -Raw -Encoding UTF8 | ConvertFrom-Json) }
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
function Invoke-Child([string]$Label, [string]$Script, [string[]]$Arguments) {
  $log = Join-Path $out ("$Label.log" -replace '[\\/:]', '_')
  $argList = @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$(Join-Path $root $Script)`"") + $Arguments
  $child = Start-Process -FilePath $hostExe -ArgumentList $argList -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru
  $null = $child.Handle
  $record = [ordered]@{ attempt = $stamp; label = $Label; pid = $child.Id; timedOut = $false; exitCode = $null }
  if (-not $child.WaitForExit(90000)) { $record.timedOut = $true; if (-not $child.HasExited) { $child.Kill() }; [void]$child.WaitForExit(5000) }
  $record.exitCode = $child.ExitCode
  $child.Dispose()
  $script:runs += [pscustomobject]$record
  Write-Host ("{0} exit={1} timedOut={2}" -f $Label, $record.exitCode, $record.timedOut)
  $script:runs | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $runFile -Encoding UTF8
}
foreach ($deckId in $manifest.decks.PSObject.Properties.Name) {
  if ($Only -ne '' -and $deckId -ne $Only) { continue }
  $deck = $manifest.decks.$deckId
  foreach ($fileName in $deck.files.PSObject.Properties.Name) {
    $path = Join-Path (Join-Path $root 'decks') $fileName
    $file = $deck.files.$fileName
    if ($Step -in @('read','all')) { Invoke-Child "read/$fileName" 'read-deck.ps1' @('-Deck', "`"$path`"", '-Out', "`"$out`"") }
    if ($Step -in @('editdata','all') -and $deck.check -eq 'C2') {
      foreach ($chart in $file.workbook) {
        $cells = ($chart.cells.PSObject.Properties.Name) -join ','
        Invoke-Child ("editdata/{0}/slide{1:D2}" -f $fileName, $chart.slide) 'editdata-chart.ps1' @('-Deck', "`"$path`"", '-Slide', [string]$chart.slide, '-Cells', $cells, '-Out', "`"$out`"")
      }
    }
    if ($Step -in @('save','all') -and $deck.check -eq 'C4') { Invoke-Child "save/$fileName" 'save-copy.ps1' @('-Deck', "`"$path`"", '-Out', "`"$out`"") }
  }
}
