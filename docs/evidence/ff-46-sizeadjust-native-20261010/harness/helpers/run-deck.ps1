<#
.SYNOPSIS
  Runs ONE native read in its own child powershell.exe with a hard deadline (default 90 s). Supervisor-run only.

.DESCRIPTION
  - -Mode read runs native-read-deck.ps1, -Mode fields runs native-fields.ps1 (FF-27).
  - Checks the deck's SHA-256 against manifest.json before starting; a mismatch is refused (rebuilt or changed deck).
  - On the deadline it stops ONLY the child powershell.exe it started, by PID. It never touches PowerPoint: it does not quit, kill,
    save or close anything in Office. A deck a stopped child left open stays the supervisor's to close.
  - Writes <OutRoot>\<set>\<id>\<id>.run.json (status, exit code, child PID, elapsed, stdout/stderr paths).
  - No retries: it refuses to run a deck whose run.json already exists under this OutRoot. A failed or timed-out run is evidence;
    a new attempt uses a new -OutRoot.

.EXAMPLE
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\opf-work\native-0-18-run\helpers\run-deck.ps1 -Set ff12 -DeckId 04-ja-meiryo -OutRoot C:\opf-work\native-0-18-run\native\attempt-1
#>
param(
  [Parameter(Mandatory = $true)][string]$Set,
  [Parameter(Mandatory = $true)][string]$DeckId,
  [ValidateSet('read', 'fields')][string]$Mode = 'read',
  [string]$Root = 'C:\opf-work\native-0-18-run',
  [string]$OutRoot = (Join-Path 'C:\opf-work\native-0-18-run' 'native\attempt-1'),
  [int]$TimeoutSeconds = 90,
  [int]$ExportWidth = 0   # 0: the sixth column of decks-order.txt (1280 for the FF sets, 2880 for the probe38 decks)
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$deck = Join-Path $Root ('decks\' + $Set + '\' + $DeckId + '.pptx')
if (-not (Test-Path -LiteralPath $deck)) { throw "Deck not found: $deck" }
# decks-order.txt (set, id, mode, slides, sha256) is written with manifest.json by the build; reading it avoids parsing the 1 MB manifest.
$hashLine = Get-Content -LiteralPath (Join-Path $Root 'helpers\decks-order.txt') -Encoding UTF8 | Where-Object { $parts = $_ -split "`t"; $parts[0] -eq $Set -and $parts[1] -eq $DeckId } | Select-Object -First 1
if (-not $hashLine) { throw ("{0} is not in helpers\decks-order.txt (set {1})" -f $DeckId, $Set) }
$expected = ($hashLine -split "`t")[4]
if ($ExportWidth -le 0) { $col = ($hashLine -split "`t")[5]; $ExportWidth = $(if ($col) { [int]$col } else { 1280 }) }
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $deck).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "SHA-256 mismatch for $DeckId (manifest $expected, file $actual): rebuild the manifest or restore the deck; not running." }
$out = Join-Path $OutRoot ($Set + '\' + $DeckId)
$runJson = Join-Path $out ($DeckId + '.run.json')
if (Test-Path -LiteralPath $runJson) { throw "Refusing to rerun in place: $runJson exists (the first attempt is evidence; use a new -OutRoot)." }
$null = New-Item -ItemType Directory -Force -Path $out
$stdout = Join-Path $out ($DeckId + '.stdout.txt'); $stderr = Join-Path $out ($DeckId + '.stderr.txt')
$script = Join-Path $here $(if ($Mode -eq 'fields') { 'native-fields.ps1' } else { 'native-read-deck.ps1' })
$budget = [string]([math]::Max(10, $TimeoutSeconds - 10))
$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $script + '"'), '-Deck', ('"' + $deck + '"'), '-OutDir', ('"' + $out + '"'), '-BudgetSeconds', $budget)
if ($Mode -eq 'read') { $arguments += @('-ExportWidth', [string]$ExportWidth) }
$started = Get-Date
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$null = $p.Handle   # cache the handle now, or ExitCode reads $null after the child exits (harness bug of attempt-1)
$finished = $p.WaitForExit($TimeoutSeconds * 1000)
if ($finished) { $p.WaitForExit() }   # the no-argument wait also flushes the exit code
$status = 'completed'
if (-not $finished) {
  $status = 'deadline-child-stopped'
  # Only the child this script started, by its PID. Never PowerPoint.
  try { Stop-Process -Id $p.Id -Force } catch { $status = 'deadline-child-stop-failed: ' + $_.Exception.Message }
}
$exit = $null; if ($finished) { $exit = $p.ExitCode }
$run = [ordered]@{ set = $Set; deck = $DeckId; mode = $Mode; exportWidth = $ExportWidth; status = $status; exitCode = $exit; childPid = $p.Id; timeoutSeconds = $TimeoutSeconds; sha256 = $actual
  startedUtc = $started.ToUniversalTime().ToString('o'); elapsedSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  powerpointPids = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }) }
[System.IO.File]::WriteAllText($runJson, ($run | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("{0}/{1}: {2} exit={3} elapsed={4}s" -f $Set, $DeckId, $status, $exit, $run.elapsedSeconds)
