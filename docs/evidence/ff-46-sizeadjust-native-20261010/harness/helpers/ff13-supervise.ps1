<#
.SYNOPSIS
  FF-13 (opf#323 section 4): one supervised font-embed attempt, in a fresh directory, audited pass or fail. Supervisor-run only.

.DESCRIPTION
  - Creates <Root>\ff13\attempt-<UTC stamp>\ (refuses an existing directory: one attempt per directory, no retry in place).
  - Carlito is not installed on this host. Its four OFL faces from the npm package @expo-google-fonts/carlito are made available to
    the logon session for the attempt only: AddFontResourceExW(path, 0) plus a WM_FONTCHANGE broadcast, read IN PLACE from
    node_modules (no copy, no registry entry, nothing persists past RemoveFontResourceExW / logoff). They are removed in `finally`.
    GDI probes (System.Drawing.Font) record what "Carlito" resolves to before, during and after.
  - Runs ff13-embed-worker.ps1 in ONE child powershell.exe with a 90 s deadline; on the deadline it stops only that child, by PID.
    It never quits, kills or restarts PowerPoint.
  - Writes supervisor.json and font-registration.json in the attempt directory. The audit is `node compare.mjs --only ff13`.
#>
param(
  [string]$Root = 'C:\opf-work\native-0-18-run',
  [int]$TimeoutSeconds = 90
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
$source = Join-Path $Root 'decks\ff13\ff13-carlito-embed-source.pptx'
$hashLine = Get-Content -LiteralPath (Join-Path $Root 'helpers\decks-order.txt') -Encoding UTF8 | Where-Object { $_ -like "ff13`tff13-carlito-embed-source`t*" } | Select-Object -First 1
if (-not $hashLine) { throw 'ff13-carlito-embed-source is not in helpers\decks-order.txt' }
$expected = ($hashLine -split "`t")[4]
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "Source SHA-256 mismatch (manifest $expected, file $actual); not running." }
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$attempt = Join-Path $Root ('ff13\attempt-' + $stamp)
if (Test-Path -LiteralPath $attempt) { throw "Attempt directory exists: $attempt" }
$null = New-Item -ItemType Directory -Path $attempt

Add-Type -Namespace OpfFf13 -Name Gdi -MemberDefinition @'
[DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int AddFontResourceExW(string name, uint fl, System.IntPtr res);
[DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern bool RemoveFontResourceExW(string name, uint fl, System.IntPtr res);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr SendMessageTimeoutW(System.IntPtr hWnd, uint msg, System.IntPtr wParam, System.IntPtr lParam, uint flags, uint timeout, out System.IntPtr result);
'@
Add-Type -AssemblyName System.Drawing
function Probe([string]$when) { $f = New-Object System.Drawing.Font('Carlito', 12); $r = [ordered]@{ when = $when; requested = 'Carlito'; resolved = $f.Name; fontFamily = $f.FontFamily.Name }; $f.Dispose(); return $r }
function Broadcast { $res = [System.IntPtr]::Zero; [void][OpfFf13.Gdi]::SendMessageTimeoutW([System.IntPtr]0xffff, 0x001D, [System.IntPtr]::Zero, [System.IntPtr]::Zero, 2, 2000, [ref]$res) }

$faces = @(Get-ChildItem -LiteralPath (Join-Path $Root 'node_modules\@expo-google-fonts\carlito') -Recurse -Filter '*.ttf' | Sort-Object FullName)
$registration = [ordered]@{ package = '@expo-google-fonts/carlito'; license = 'OFL-1.1 (LICENSE_FONT in the package)'; flags = 0; faces = New-Object System.Collections.ArrayList }
$supervisor = [ordered]@{ schemaVersion = 1; kind = 'ff13-supervisor'; attempt = $stamp; source = $source; sourceSha256 = $actual; deadlineSeconds = $TimeoutSeconds
  powerpointPids = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }); probes = New-Object System.Collections.ArrayList; child = $null }
[void]$supervisor.probes.Add((Probe 'before-registration'))
try {
  foreach ($face in $faces) {
    $added = [OpfFf13.Gdi]::AddFontResourceExW($face.FullName, 0, [System.IntPtr]::Zero)
    [void]$registration.faces.Add([ordered]@{ file = $face.Name; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $face.FullName).Hash.ToLowerInvariant(); added = $added; removed = $null })
  }
  Broadcast
  [void]$supervisor.probes.Add((Probe 'during'))
  $stdout = Join-Path $attempt 'worker.stdout.txt'; $stderr = Join-Path $attempt 'worker.stderr.txt'
  $arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $here 'ff13-embed-worker.ps1') + '"'), '-Source', ('"' + $source + '"'), '-AttemptDir', ('"' + $attempt + '"'))
  $started = Get-Date
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $null = $p.Handle   # cache the handle now, or ExitCode reads $null after the child exits (harness bug of attempt-1)
  $finished = $p.WaitForExit($TimeoutSeconds * 1000)
  if ($finished) { $p.WaitForExit() }   # the no-argument wait also flushes the exit code
  $status = 'completed'
  if (-not $finished) { $status = 'deadline-child-stopped'; try { Stop-Process -Id $p.Id -Force } catch { $status = 'deadline-child-stop-failed: ' + $_.Exception.Message } }
  $supervisor.child = [ordered]@{ pid = $p.Id; status = $status; exitCode = $(if ($finished) { $p.ExitCode } else { $null }); elapsedSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1) }
}
finally {
  for ($k = 0; $k -lt $registration.faces.Count; $k++) { $registration.faces[$k].removed = [OpfFf13.Gdi]::RemoveFontResourceExW($faces[$k].FullName, 0, [System.IntPtr]::Zero) }
  Broadcast
  [void]$supervisor.probes.Add((Probe 'after-removal'))
  $supervisor.sourceSha256After = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText((Join-Path $attempt 'font-registration.json'), ($registration | ConvertTo-Json -Depth 6), $utf8)
  [System.IO.File]::WriteAllText((Join-Path $attempt 'supervisor.json'), ($supervisor | ConvertTo-Json -Depth 6), $utf8)
}
Write-Output ("ff13 attempt {0}: child {1}; audit with: node compare.mjs --only ff13 --ff13 `"{2}`"" -f $stamp, $supervisor.child.status, $attempt)
