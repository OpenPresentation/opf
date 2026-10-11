<#
.SYNOPSIS
  FF-27 (opf#323 section 2): do the exported slide-number and date fields renumber and update in PowerPoint? Supervisor-run only.

.DESCRIPTION
  - Attaches with GetActiveObject('PowerPoint.Application'); starts PowerPoint only when none is running (and leaves it running).
  - Opens the deck READ-ONLY with Presentations.Open(path, -1, 0, 0).
  - Reads the furniture shapes (names starting "OPF furniture"), their placeholder type and text, and Slide.HeadersFooters, on every
    slide, before and after Slide.Export (which lays the slide out), three times:
      initial          no change
      after-duplicate  Slides(1).Duplicate()            (IN MEMORY: an insert)
      after-move       Slides(<last>).MoveTo(1)          (IN MEMORY: a move)
  - Records the host clock and culture so compare.mjs can compute the date the live field must show.
  - Never saves (no Save, SaveAs, SaveCopyAs): the in-memory edits are discarded with Saved = -1 and Close(). Never quits PowerPoint.

  Windows PowerShell 5.1. ASCII-only source on purpose.
#>
param(
  [Parameter(Mandatory = $true)][string]$Deck,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$BudgetSeconds = 80
)
$ErrorActionPreference = 'Stop'
$clock = [System.Diagnostics.Stopwatch]::StartNew()
$Deck = [System.IO.Path]::GetFullPath($Deck)
$null = New-Item -ItemType Directory -Force -Path $OutDir
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
$base = [System.IO.Path]::GetFileNameWithoutExtension($Deck)
$jsonPath = Join-Path $OutDir ($base + '.fields.json')
$utf8 = New-Object System.Text.UTF8Encoding($false)
$script:errors = New-Object System.Collections.ArrayList
function Get-Val { param([scriptblock]$Read, [string]$What) try { return (& $Read) } catch { if ($script:errors.Count -lt 80) { [void]$script:errors.Add(($What + ': ' + $_.Exception.Message)) }; return $null } }

$now = Get-Date
$en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
$result = [ordered]@{
  schema = 'opf323-native-fields/v2'; deck = $Deck; id = $base; stage = 'start'; startedAt = $now.ToUniversalTime().ToString('o'); startedPowerPoint = $false; error = $null
  deckSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Deck).Hash.ToLowerInvariant()
  powerpoint = $null
  clock = [ordered]@{ localDate = $now.ToString('yyyy-MM-dd'); localTime = $now.ToString('HH:mm:ss'); culture = [System.Globalization.CultureInfo]::CurrentCulture.Name; uiCulture = [System.Globalization.CultureInfo]::CurrentUICulture.Name
    shortDatePattern = [System.Globalization.CultureInfo]::CurrentCulture.DateTimeFormat.ShortDatePattern
    expectedEnUS = [ordered]@{ 'MMMM d, yyyy' = $now.ToString('MMMM d, yyyy', $en); 'M/d/yyyy' = $now.ToString('M/d/yyyy', $en) } }
  steps = New-Object System.Collections.ArrayList; readErrors = $null; elapsedMs = 0
}
function Save-Result { $result.elapsedMs = $clock.ElapsedMilliseconds; $result.readErrors = @($script:errors); [System.IO.File]::WriteAllText($jsonPath, ($result | ConvertTo-Json -Depth 20), $utf8) }

function Read-Slides($pres, [string]$phase) {
  $slides = New-Object System.Collections.ArrayList
  foreach ($slide in $pres.Slides) {
    $shapes = New-Object System.Collections.ArrayList
    foreach ($shape in $slide.Shapes) {
      $name = Get-Val { $shape.Name } 'Shape.Name'
      $ph = $null; if ((Get-Val { $shape.Type } 'Shape.Type') -eq 14) { $ph = Get-Val { $shape.PlaceholderFormat.Type } 'PlaceholderFormat.Type' }
      $text = $null; if ((Get-Val { $shape.HasTextFrame } 'HasTextFrame') -ne 0) { $text = Get-Val { $shape.TextFrame.TextRange.Text } 'Text' }
      if ($null -ne $name -and ($name -like 'OPF furniture*' -or $name -like 'OPF heading*' -or $null -ne $ph)) { [void]$shapes.Add([ordered]@{ name = $name; placeholderType = $ph; text = $text }) }
    }
    $hf = Get-Val { $slide.HeadersFooters } 'HeadersFooters'
    [void]$slides.Add([ordered]@{
      index = [int]$slide.SlideIndex; slideId = (Get-Val { $slide.SlideID } 'SlideID'); phase = $phase; shapes = $shapes
      headersFooters = $(if ($null -ne $hf) { [ordered]@{ slideNumberVisible = (Get-Val { $hf.SlideNumber.Visible } 'HF.SlideNumber.Visible'); dateVisible = (Get-Val { $hf.DateAndTime.Visible } 'HF.Date.Visible'); dateUseFormat = (Get-Val { $hf.DateAndTime.UseFormat } 'HF.Date.UseFormat'); dateFormat = (Get-Val { $hf.DateAndTime.Format } 'HF.Date.Format'); footerVisible = (Get-Val { $hf.Footer.Visible } 'HF.Footer.Visible') } } else { $null })
    })
  }
  return $slides
}
function Read-Step($pres, [string]$step, [string]$operation) {
  $before = Read-Slides $pres 'before-layout'
  # Slide.Export lays the slide out, so field text is current; the PNGs are kept as evidence of what was drawn.
  foreach ($slide in $pres.Slides) { $png = Join-Path $OutDir ($base + '-' + $step + '-slide-' + [int]$slide.SlideIndex + '.native.png'); try { $slide.Export($png, 'PNG', 1280, 720) } catch { [void]$script:errors.Add('Export ' + $step + ': ' + $_.Exception.Message) } }
  $after = Read-Slides $pres 'after-layout'
  [void]$result.steps.Add([ordered]@{ step = $step; operation = $operation; slideCount = [int]$pres.Slides.Count; before = $before; after = $after })
  Save-Result
}

$app = $null; $pres = $null
try {
  try { $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
  catch { $app = New-Object -ComObject PowerPoint.Application; try { $app.Visible = -1 } catch {}; $result.startedPowerPoint = $true }
  $result.powerpoint = [ordered]@{ version = (Get-Val { $app.Version } 'App.Version'); build = (Get-Val { $app.Build } 'App.Build') }
  $result.stage = 'opening'; Save-Result
  $pres = $app.Presentations.Open($Deck, -1, 0, 0)
  $result.readOnly = (Get-Val { $pres.ReadOnly } 'Presentation.ReadOnly')
  Read-Step $pres 'initial' ''
  if ($clock.Elapsed.TotalSeconds -lt $BudgetSeconds) { $null = $pres.Slides.Item(1).Duplicate(); Read-Step $pres 'after-duplicate' 'Slides(1).Duplicate()' }
  if ($clock.Elapsed.TotalSeconds -lt $BudgetSeconds) { $last = [int]$pres.Slides.Count; $pres.Slides.Item($last).MoveTo(1); Read-Step $pres 'after-move' ('Slides(' + $last + ').MoveTo(1)') }
  $result.stage = 'done'
}
catch { $result.error = $_.Exception.Message }
finally {
  if ($null -ne $pres) { try { $pres.Saved = -1 } catch {}; try { $pres.Close() } catch { $result.closeError = $_.Exception.Message } }
  Save-Result
}
Write-Output ("{0} stage={1} steps={2} elapsedMs={3} error={4}" -f $base, $result.stage, $result.steps.Count, $clock.ElapsedMilliseconds, $result.error)
if ($null -ne $result.error) { exit 1 }
