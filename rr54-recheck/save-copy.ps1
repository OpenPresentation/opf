# RR-54 re-check, C4: the one writing step of the set. Copies ONE deck to out\work\, opens that COPY read-only in the
# running PowerPoint and calls SaveCopyAs to out\saved\ (a plain save with no edit), then closes it. The source deck in
# decks\ is never opened; its sha256 is recorded before and after. Never quits or kills PowerPoint; never reads
# Series.Formula.
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File save-copy.ps1 -Deck decks\c4-formats-after.pptx -Out out
param([Parameter(Mandatory=$true)][string]$Deck,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
foreach ($folder in @($Out, (Join-Path $Out 'work'), (Join-Path $Out 'saved'))) { if (-not (Test-Path -LiteralPath $folder)) { [void](New-Item -ItemType Directory -Path $folder) } }
$outDir = (Resolve-Path -LiteralPath $Out).Path
$leaf = [IO.Path]::GetFileName($deckPath)
$name = [IO.Path]::GetFileNameWithoutExtension($deckPath)
$work = Join-Path (Join-Path $outDir 'work') $leaf
$saved = Join-Path (Join-Path $outDir 'saved') $leaf
if ((Test-Path -LiteralPath $work) -or (Test-Path -LiteralPath $saved)) { throw "out\work or out\saved already holds $leaf; preserve it and use a fresh out folder." }
$report = [ordered]@{ deck = $name; sourceSha256Before = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant(); startedAt = (Get-Date).ToUniversalTime().ToString('o'); stage = 'copy' }
function Save-Report { $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outDir "save-$name.json") -Encoding UTF8 }
Copy-Item -LiteralPath $deckPath -Destination $work
Save-Report
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
$report.powerpoint = [ordered]@{ version = $pp.Version; build = $pp.Build }
$report.stage = 'open'; Save-Report
$pres = $pp.Presentations.Open($work, -1, 0, 0)
try {
  $report.stage = 'save'; Save-Report
  $pres.SaveCopyAs($saved)
  $report.stage = 'done'
} catch {
  $report.error = $_.Exception.Message
  $report.stage = "failed during $($report.stage)"
  throw
} finally {
  $pres.Close()
  $report.sourceSha256After = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $report.workSha256 = (Get-FileHash -LiteralPath $work -Algorithm SHA256).Hash.ToLowerInvariant()
  if (Test-Path -LiteralPath $saved) { $report.savedSha256 = (Get-FileHash -LiteralPath $saved -Algorithm SHA256).Hash.ToLowerInvariant() }
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-Report
}
