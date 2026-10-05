# FF-05 / opf-pptx#168: read every deck of the set, one child powershell.exe per deck, 90 s deadline each.
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-set.ps1 [-Only a2-thai-repro]
# Start desktop PowerPoint first. Only the owned child process is ever stopped (on its deadline); PowerPoint is never
# killed, quit or saved. A deck that fails or times out is recorded in out\run.json and NOT retried.
param([string]$Only = '')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out = Join-Path $root 'out'
if (-not (Test-Path -LiteralPath $out)) { [void](New-Item -ItemType Directory -Path $out) }
$hostExe = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$runs = @()
$decks = Get-ChildItem -LiteralPath (Join-Path $root 'decks') -Filter '*.pptx' | Sort-Object Name
if ($Only -ne '') { $decks = $decks | Where-Object { $_.BaseName -eq "$Only-before" -or $_.BaseName -eq "$Only-after" } }
foreach ($deck in $decks) {
  $log = Join-Path $out "$($deck.BaseName).log"
  $argList = @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"`"$(Join-Path $root 'native-read-deck.ps1')`"",'-Deck',"`"$($deck.FullName)`"",'-Out',"`"$out`"")
  $child = Start-Process -FilePath $hostExe -ArgumentList $argList -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru
  $null = $child.Handle
  $record = [ordered]@{ deck = $deck.BaseName; pid = $child.Id; timedOut = $false; exitCode = $null }
  if (-not $child.WaitForExit(90000)) { $record.timedOut = $true; if (-not $child.HasExited) { $child.Kill() }; [void]$child.WaitForExit(5000) }
  $record.exitCode = $child.ExitCode
  $child.Dispose()
  $runs += $record
  Write-Host ("{0} exit={1} timedOut={2}" -f $record.deck, $record.exitCode, $record.timedOut)
  $runs | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $out 'run.json') -Encoding UTF8
}
