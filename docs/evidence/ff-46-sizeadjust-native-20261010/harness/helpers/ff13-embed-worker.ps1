<#
.SYNOPSIS
  FF-13 worker: ONE font-embed attempt through PowerPoint's own "Embed fonts" (SaveAs with EmbedTrueTypeFonts). Started only by
  ff13-supervise.ps1, in a child process with a 90 s deadline. Supervisor-run only.

.DESCRIPTION
  Owner decision 2026-10-05 (opf#323 section 4): one bounded SaveAs of a COPY into a fresh directory is allowed for FF-13; the source is
  never overwritten. Everything else stays read-only.
  1. Attach to PowerPoint (start it only when none is running; never quit it).
  2. Open the source READ-ONLY: Presentations.Open(source, -1, 0, 0).
  3. Preflight: Presentation.Fonts must list only the chosen families (default Carlito), each embeddable. Otherwise stop BEFORE any save
     (fail closed, as the 2026-09-22 attempt did on Aptos).
  4. SaveAs(<attempt>\copy.pptx, 24 = ppSaveAsOpenXMLPresentation, -1 = EmbedTrueTypeFonts). The target must not exist.
  5. Close it, reopen the COPY read-only for a diagnostic read of Presentation.Fonts, close it.
  Writes <attempt>\stages.jsonl (one line per stage) and <attempt>\report.json.
#>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$AttemptDir,
  [string[]]$Chosen = @('Carlito')
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$Source = [System.IO.Path]::GetFullPath($Source); $AttemptDir = [System.IO.Path]::GetFullPath($AttemptDir)
$copy = Join-Path $AttemptDir 'copy.pptx'
$stagesPath = Join-Path $AttemptDir 'stages.jsonl'
function Stage([string]$name, $data) { $line = [ordered]@{ at = (Get-Date).ToUniversalTime().ToString('o'); stage = $name; data = $data } | ConvertTo-Json -Compress -Depth 8; [System.IO.File]::AppendAllText($stagesPath, $line + "`n", $utf8) }
function Read-Fonts($pres) { $list = @(); for ($i = 1; $i -le [int]$pres.Fonts.Count; $i++) { $f = $pres.Fonts.Item($i); $list += [ordered]@{ index = $i; name = $f.Name; embedded = $f.Embedded; embeddable = $f.Embeddable } }; return ,$list }
$report = [ordered]@{ schemaVersion = 1; kind = 'ff13-native-font-embed-report'; source = $Source; copy = $copy; chosen = $Chosen; verdict = $null; stage = 'start'; error = $null; startedPowerPoint = $false
  sourceSha256Before = (Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash.ToLowerInvariant(); sourceSha256After = $null; powerpoint = $null; fontsBeforeSave = $null; fontsAfterReopen = $null; saved = $false }
$app = $null; $pres = $null
try {
  if (Test-Path -LiteralPath $copy) { throw "copy.pptx already exists in ${AttemptDir}; a new attempt needs a fresh directory" }
  try { $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') } catch { $app = New-Object -ComObject PowerPoint.Application; try { $app.Visible = -1 } catch {}; $report.startedPowerPoint = $true }
  $report.powerpoint = [ordered]@{ version = $app.Version; build = $app.Build }
  Stage 'attached' $report.powerpoint
  $pres = $app.Presentations.Open($Source, -1, 0, 0)
  Stage 'opened-read-only' @{ readOnly = $pres.ReadOnly }
  $report.fontsBeforeSave = Read-Fonts $pres
  Stage 'fonts-before-save' $report.fontsBeforeSave
  $foreign = @($report.fontsBeforeSave | Where-Object { $Chosen -notcontains $_.name })
  $notEmbeddable = @($report.fontsBeforeSave | Where-Object { $_.embeddable -eq 0 })
  if ($foreign.Count -gt 0 -or $notEmbeddable.Count -gt 0) {
    $report.stage = 'preflight-failed'; $report.verdict = 'FAIL'
    $report.error = 'Presentation.Fonts lists a family outside the chosen set or a font that is not embeddable; no save was made.'
    Stage 'preflight-failed' @{ foreign = $foreign; notEmbeddable = $notEmbeddable }
  } else {
    $pres.SaveAs($copy, 24, -1)
    $report.saved = $true
    Stage 'saved-copy' @{ path = $copy; format = 24; embedTrueTypeFonts = -1 }
    try { $pres.Close() } catch {}
    $pres = $null
    $pres = $app.Presentations.Open($copy, -1, 0, 0)
    $report.fontsAfterReopen = Read-Fonts $pres
    Stage 'reopened-copy-read-only' $report.fontsAfterReopen
    $report.stage = 'done'
  }
}
catch { $report.error = $_.Exception.Message; Stage 'error' $report.error }
finally {
  if ($null -ne $pres) { try { $pres.Saved = -1 } catch {}; try { $pres.Close() } catch {} }
  $report.sourceSha256After = (Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText((Join-Path $AttemptDir 'report.json'), ($report | ConvertTo-Json -Depth 8), $utf8)
}
Write-Output ("ff13 worker stage={0} saved={1} error={2}" -f $report.stage, $report.saved, $report.error)
if ($null -ne $report.error) { exit 1 }
