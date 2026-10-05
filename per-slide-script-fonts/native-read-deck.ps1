# FF-05 / opf-pptx#168: read ONE deck in the running PowerPoint, read-only. Never saves, quits or kills PowerPoint.
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File native-read-deck.ps1 -Deck decks\a-three-profiles-after.pptx -Out out
# Writes out\<name>.json (Presentation.Fonts, designs and their theme fonts, each slide's design, every text run's
# Name / NameFarEast / NameComplexScript, notes runs) and out\<name>-slideNN.png (1280 x 720).
# Start PowerPoint by hand first. run-set.ps1 calls this once per deck in its own process with a 90 s deadline.
param([Parameter(Mandatory=$true)][string]$Deck,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
if (-not (Test-Path -LiteralPath $Out)) { [void](New-Item -ItemType Directory -Path $Out) }
$outDir = (Resolve-Path -LiteralPath $Out).Path
$name = [IO.Path]::GetFileNameWithoutExtension($deckPath)
$report = [ordered]@{ deck = $name; startedAt = (Get-Date).ToUniversalTime().ToString('o'); stage = 'attach' }
function Save-Report { $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $outDir "$name.json") -Encoding UTF8 }
function Try-Get([scriptblock]$Read) { try { return & $Read } catch { return "ERROR: $($_.Exception.Message)" } }
# Every run of a text range: text and the three font names PowerPoint resolves for it.
function Read-Runs($range) {
  $runs = @()
  $count = Try-Get { $range.Runs().Count }
  if ($count -is [int]) { for ($r = 1; $r -le $count; $r++) { $run = $range.Runs($r); $runs += [ordered]@{ text = $run.Text; name = (Try-Get { $run.Font.Name }); nameFarEast = (Try-Get { $run.Font.NameFarEast }); nameComplexScript = (Try-Get { $run.Font.NameComplexScript }) } } }
  return ,$runs
}
# Theme fonts of a slide master: MsoFontLanguageIndex 1 latin, 2 complex script, 3 East Asian.
function Read-ThemeFonts($master) {
  $scheme = $master.Theme.ThemeFontScheme
  $read = { param($group) [ordered]@{ latin = (Try-Get { $group.Item(1).Name }); complexScript = (Try-Get { $group.Item(2).Name }); eastAsian = (Try-Get { $group.Item(3).Name }) } }
  return [ordered]@{ major = (& $read $scheme.MajorFont); minor = (& $read $scheme.MinorFont) }
}
Save-Report
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
$report.powerpoint = [ordered]@{ version = $pp.Version; build = $pp.Build }
foreach ($open in $pp.Presentations) { if ($open.FullName -eq $deckPath) { throw 'The deck is already open in PowerPoint; close it and rerun this deck once.' } }
$report.stage = 'open'; Save-Report
# Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
$pres = $pp.Presentations.Open($deckPath, -1, 0, 0)
try {
  $report.stage = 'read'; Save-Report
  $report.fonts = @(for ($i = 1; $i -le $pres.Fonts.Count; $i++) { $pres.Fonts.Item($i).Name })
  $report.designs = @(for ($i = 1; $i -le $pres.Designs.Count; $i++) { $design = $pres.Designs.Item($i); [ordered]@{ index = $i; name = $design.Name; themeFonts = (Try-Get { Read-ThemeFonts $design.SlideMaster }) } })
  $slides = @()
  foreach ($slide in $pres.Slides) {
    $shapes = @()
    foreach ($shape in $slide.Shapes) {
      if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
        $range = $shape.TextFrame.TextRange
        $shapes += [ordered]@{ name = $shape.Name; text = $range.Text; runs = (Read-Runs $range) }
      }
    }
    $notes = @()
    foreach ($shape in $slide.NotesPage.Shapes) {
      if ((Try-Get { $shape.PlaceholderFormat.Type }) -eq 2 -and $shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) { $notes += [ordered]@{ name = $shape.Name; runs = (Read-Runs $shape.TextFrame.TextRange) } }
    }
    $png = Join-Path $outDir ('{0}-slide{1:D2}.png' -f $name, $slide.SlideIndex)
    $slide.Export($png, 'PNG', 1280, 720)
    $slides += [ordered]@{ index = $slide.SlideIndex; design = (Try-Get { $slide.Design.Name }); designIndex = (Try-Get { $slide.Design.Index }); layout = $slide.CustomLayout.Name; shapes = $shapes; notes = $notes; png = [IO.Path]::GetFileName($png) }
  }
  $report.slides = $slides
  $report.stage = 'done'
} catch {
  $report.error = $_.Exception.Message
  $report.stage = "failed during $($report.stage)"
  throw
} finally {
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-Report
  # Read-only: Close never prompts and never writes the file.
  $pres.Close()
}
