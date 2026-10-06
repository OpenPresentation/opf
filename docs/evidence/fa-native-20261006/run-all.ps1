# Runs probe.ps1 once per deck, sequentially, each in its own child powershell with a 90 s deadline, and collects every
# JSON line into results.jsonl. Only the child powershell this script started is ever stopped (by PID) on a timeout;
# PowerPoint itself is never quit or killed. Usage: powershell -NoProfile -File run-all.ps1 [-Only fa-14]
param([string]$Only = '', [int]$TimeoutSeconds = 90)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$probe = Join-Path $root 'probe.ps1'
$results = Join-Path $root 'results.jsonl'
$logs = Join-Path $root 'run-logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Set-Content -LiteralPath $results -Value '' -Encoding UTF8
$decks = @(Get-ChildItem -LiteralPath (Join-Path $root 'decks') -Filter 'fa-*.pptx' | Sort-Object Name)
if ($Only) { $decks = @($decks | Where-Object { $_.Name -like ($Only + '*') }) }
$lines = New-Object System.Collections.ArrayList
foreach ($deck in $decks) {
    $item = 'FA-' + $deck.Name.Substring(3, 2)
    $out = Join-Path $logs ($deck.BaseName + '.stdout.txt')
    $err = Join-Path $logs ($deck.BaseName + '.stderr.txt')
    $procArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $probe, '-Deck', $deck.FullName, '-Item', $item)
    $child = Start-Process -FilePath 'powershell.exe' -ArgumentList $procArgs -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err
    $finished = $child.WaitForExit($TimeoutSeconds * 1000)
    if (-not $finished) {
        # stop only the child this script started
        try { Stop-Process -Id $child.Id -Force } catch {}
        $line = [ordered]@{ item = $item; check = 'probe-run'; expected = ('finishes within ' + $TimeoutSeconds + ' s'); actual = ('timed out; deck ' + $deck.Name); pass = $false; note = 'child powershell stopped by PID; PowerPoint was not touched. A repair or modal dialog is the usual cause: look at PowerPoint, close the dialog by hand.' }
        [void]$lines.Add((ConvertTo-Json -InputObject $line -Compress))
        continue
    }
    $emitted = 0
    foreach ($text in (Get-Content -LiteralPath $out -Encoding UTF8)) {
        if ($text.StartsWith('{')) { [void]$lines.Add($text); $emitted++ }
    }
    $stderr = [string](Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue)
    if ($child.ExitCode -ne 0 -or $emitted -eq 0) {
        $line = [ordered]@{ item = $item; check = 'probe-run'; expected = 'exit code 0 and at least one result line'; actual = ('exit ' + $child.ExitCode + ', ' + $emitted + ' lines; ' + ($stderr -replace '\s+', ' ').Trim()); pass = $false; note = $deck.Name }
        [void]$lines.Add((ConvertTo-Json -InputObject $line -Compress))
    }
}
Set-Content -LiteralPath $results -Value $lines -Encoding UTF8
$parsed = @($lines | ForEach-Object { $_ | ConvertFrom-Json })
$pass = @($parsed | Where-Object { $_.pass -eq $true }).Count
$fail = @($parsed | Where-Object { $_.pass -eq $false }).Count
$null_ = @($parsed | Where-Object { $null -eq $_.pass }).Count
Write-Output ('decks=' + $decks.Count + ' checks=' + $parsed.Count + ' pass=' + $pass + ' fail=' + $fail + ' unread=' + $null_ + ' -> ' + $results)
