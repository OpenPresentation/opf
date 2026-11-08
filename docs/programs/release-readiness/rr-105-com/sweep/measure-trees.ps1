# SH-21 measurement: PowerPoint's own Organization Chart (orgChart1), Hierarchy (hierarchy1) and Basic Venn (venn1), laid out by
# PowerPoint through COM for a set of trees (or Venn counts) in 20 frames, every shape PowerPoint draws recorded (GroupItems), so core
# can fit each layout as SH-17 fitted Basic Process. Creates its own presentation (never saved), closes only it, quits only when no other
# presentation is open. Refuses to run when PowerPoint is already running.
param([string]$Out = 'C:\opf-work\_supervisor\com-jobs\sh-live-extras\trees', [string]$Seeds = 'C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx')
$ErrorActionPreference = 'Stop'
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint is already running; close it first. Nothing was done.'; exit 1 }
. 'C:/opf-work/shapes/sh-17/scripts/ppt.ps1'
New-Item -ItemType Directory -Force $Out | Out-Null
$L = 'urn:microsoft.com/office/officeart/2005/8/layout/'
# A tree: an array of nodes, each @(text, children[, 'asst']).
function T([string]$t, $c = @(), [string]$kind = '') { @{t = $t; c = $c; k = $kind} }
$trees = [ordered]@{
  'k1' = @((T 'Plan' @((T 'Build'))))
  'k2' = @((T 'Plan' @((T 'Build'), (T 'Test'))))
  'k3' = @((T 'Plan' @((T 'Build'), (T 'Test'), (T 'Ship'))))
  'k4' = @((T 'Plan' @((T 'Build'), (T 'Test'), (T 'Ship'), (T 'Learn'))))
  'k6' = @((T 'Plan' @((T 'A1'), (T 'A2'), (T 'A3'), (T 'A4'), (T 'A5'), (T 'A6'))))
  '2x2' = @((T 'Plan' @((T 'Build' @((T 'Web'), (T 'App'))), (T 'Test' @((T 'Unit'), (T 'Load'))))))
  '3x1' = @((T 'Plan' @((T 'Build' @((T 'Web'))), (T 'Test' @((T 'Unit'))), (T 'Ship' @((T 'Docs'))))))
  'uneven' = @((T 'Plan' @((T 'Build' @((T 'Web'), (T 'App'), (T 'API'))), (T 'Test'))))
  'depth3' = @((T 'Plan' @((T 'Build' @((T 'Web' @((T 'CSS'))))))))
  'asst' = @((T 'Plan' @((T 'Aide' @() 'asst'), (T 'Build'), (T 'Test'), (T 'Ship'))))
  'roots2' = @((T 'Plan' @((T 'Build'))), (T 'Run' @((T 'Ops'))))
}
$venn = [ordered]@{}; foreach ($n in 1..7) { $venn["v$n"] = @(1..$n | ForEach-Object { T "Set $_" }) }
$frames = foreach ($w in 300, 450, 600, 750, 900) { foreach ($h in 200, 300, 400, 500) { @{w = $w; h = $h} } }
$jobs = @(
  @{layout = 'orgChart1'; seed = 14; sets = $trees},
  @{layout = 'hierarchy1'; seed = 15; sets = $trees},
  @{layout = 'venn1'; seed = 12; sets = $venn}
)
# Fill a node collection in place (SH-08's fixture found fixed-count layouts refuse deleting every node): the layout's own nodes first,
# a node added only where more are needed, the rest deleted last first; failures go to $script:issues.
function Sync($collection, $specs, $parent) {
  $normal = @(); $assistants = @()
  for ($i = 1; $i -le $collection.Count; $i++) { $n = $collection.Item($i); if ($n.Type -eq 2) { $assistants += $n } else { $normal += $n } }
  $usedN = 0; $usedA = 0
  foreach ($spec in $specs) {
    try {
      if ($spec.k -eq 'asst') { if ($usedA -lt $assistants.Count) { $node = $assistants[$usedA] } else { $node = $parent.AddNode(5, 2) }; $usedA++ }
      else { if ($usedN -lt $normal.Count) { $node = $normal[$usedN] } elseif ($parent) { $node = $parent.AddNode(5, 1) } else { $node = $collection.Add() }; $usedN++ }
      $node.TextFrame2.TextRange.Text = $spec.t
      Sync $node.Nodes $spec.c $node
    } catch { $script:issues += "$($spec.t): $($_.Exception.Message)" }
  }
  $extra = @(@($normal | Select-Object -Skip $usedN) + @($assistants | Select-Object -Skip $usedA))
  for ($i = $extra.Count - 1; $i -ge 0; $i--) { try { $extra[$i].Delete() } catch { $script:issues += "delete a default node: $($_.Exception.Message)" } }
}
$app = Start-PPT
$mine = New-Object Collections.ArrayList
$rows = New-Object Collections.ArrayList
try {
  # This PowerPoint build gives scripts no SmartArtLayouts list: each layout is a seed slide's SmartArt.Layout (SH-08's seed deck).
  $seed = $app.Presentations.Open($Seeds, -1, 0, -1); [void]$mine.Add($seed)
  $pres = $app.Presentations.Add(-1); [void]$mine.Add($pres)
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  foreach ($job in $jobs) {
    $layout = $null; $seedSlide = $seed.Slides.Item($job.seed)
    for ($s = 1; $s -le $seedSlide.Shapes.Count; $s++) { if ($seedSlide.Shapes.Item($s).HasSmartArt -eq -1) { $layout = $seedSlide.Shapes.Item($s).SmartArt.Layout; break } }
    if (-not $layout -or ([string]$layout.Id).Split('/')[-1] -ne $job.layout) { [void]$rows.Add([pscustomobject]@{layout = $job.layout; error = "seed slide $($job.seed) is not $($job.layout)"}); continue }
    foreach ($key in $job.sets.Keys) {
      foreach ($frame in $frames) {
        $slide = $pres.Slides.Add(1, 12)
        try {
          $shape = $slide.Shapes.AddSmartArt($layout, 20, 20, $frame.w, $frame.h)
          $sa = $shape.SmartArt
          $script:issues = @()
          Sync $sa.Nodes $job.sets[$key] $null
          $items = @()
          for ($i = 1; $i -le $shape.GroupItems.Count; $i++) {
            $g = $shape.GroupItems.Item($i)
            $o = [ordered]@{i = $i; type = $g.AutoShapeType; connector = $g.Connector; rotation = $g.Rotation; left = $g.Left - $shape.Left; top = $g.Top - $shape.Top; width = $g.Width; height = $g.Height; hflip = $g.HorizontalFlip; vflip = $g.VerticalFlip}
            try { if ($g.HasTextFrame -and $g.TextFrame2.HasText) { $o.text = $g.TextFrame2.TextRange.Text; $o.size = $g.TextFrame2.TextRange.Font.Size; $o.margins = @($g.TextFrame2.MarginLeft, $g.TextFrame2.MarginTop, $g.TextFrame2.MarginRight, $g.TextFrame2.MarginBottom) } } catch {}
            try { $o.nodes = @($g.Nodes.Count) } catch {}
            $items += [pscustomobject]$o
          }
          [void]$rows.Add([pscustomobject]@{layout = $job.layout; set = $key; frame = "$($frame.w)x$($frame.h)"; nodes = $sa.AllNodes.Count; issues = $script:issues; items = $items})
          if ($frame.w -eq 600 -and $frame.h -eq 400) { $slide.Export((Join-Path $Out "$($job.layout)-$key.png"), 'PNG', 1280, 720) }
        } catch { [void]$rows.Add([pscustomobject]@{layout = $job.layout; set = $key; frame = "$($frame.w)x$($frame.h)"; error = $_.Exception.Message}) }
        $slide.Delete()
      }
      "$($job.layout) $key done"
    }
  }
} finally {
  $rows | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $Out 'trees.json')
  Stop-PPT $app @($mine)
}
