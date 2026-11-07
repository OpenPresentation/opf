# Builds powerpoint-smartart.pptx, the PowerPoint-authored SmartArt fixture of SH-08 (test/sh-08-smartart-import.mjs), through
# PowerPoint's object model (Windows, PowerPoint installed; no UI control). One slide per layout: a title ("Title Only" layout) and one
# SmartArt graphic at 40, 110, 880 x 400 pt on a 960 x 540 pt slide, its nodes filled through SmartArt.Nodes. Beside the deck it writes
# powerpoint-smartart.json (per slide: the layout's Id, Name and Category as PowerPoint reports them, and every node of AllNodes in
# order with its Level, NodeType and text) and a 1280 x 720 PNG of each slide, PowerPoint's own drawing of each graphic. Each layout is
# taken from the seed deck (`node test/fixtures/make-smartart-seeds.mjs`, opened read-only), slide k for spec k.
param([string]$Out = 'C:\opf-work\_supervisor\com-jobs\sh-08', [string]$Seeds = 'C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx')
$ErrorActionPreference = 'Stop'
# PowerPoint is single-instance: New-Object would attach to a running PowerPoint (someone's open session), and Quit would close it.
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint is already running; close it first. Nothing was done.'; exit 1 }
New-Item -ItemType Directory -Force $Out | Out-Null
$L = 'urn:microsoft.com/office/officeart/2005/8/layout/'

# Each node: t (text; `v is a line break), b (a substring set in bold), a ($true: an assistant), c (children).
function N([string]$t, $c = @(), [string]$b = '', [bool]$a = $false) { @{t = $t; c = $c; b = $b; a = $a} }
$specs = @(
  @{name = 'Basic Pyramid'; id = "${L}pyramid1"; nodes = @((N 'Vision' @() 'Vision'), (N 'Strategy'), (N 'Programs'), (N 'Teams'))},
  @{name = 'Inverted Pyramid'; id = ''; nodes = @((N 'Leads'), (N 'Prospects'), (N 'Customers'))},
  @{name = 'Basic Matrix'; id = "${L}matrix3"; nodes = @((N 'Enterprise'), (N 'Mid-market'), (N 'Consumer'), (N 'Public sector'))},
  @{name = 'Basic Cycle'; id = "${L}cycle2"; nodes = @((N 'Plan'), (N 'Pilot'), (N 'Measure'), (N 'Adjust'), (N 'Scale'))},
  # Japanese text (kaizen) built from code points, so the script reads the same under any code page.
  @{name = 'Text Cycle'; id = ''; nodes = @((N 'Listen'), (N 'Learn'), (N ('Improve ' + [char]0x6539 + [char]0x5584)))},
  @{name = 'Basic Chevron Process'; id = "${L}chevron1"; nodes = @((N 'Plan'), (N 'Build'), (N 'Test'), (N 'Ship'))},
  @{name = 'Basic Process'; id = "${L}process1"; nodes = @((N 'Research'), (N 'Design'), (N "Run`vthe pilot"), (N 'Review'))},
  @{name = 'Vertical Process'; id = "${L}process2"; nodes = @((N 'Sign up'), (N 'Set up'), (N 'Launch'))},
  @{name = 'Accent Process'; id = ''; nodes = @((N 'Discover' @((N 'Interviews'), (N 'Field visits'))), (N 'Define' @((N 'Problem statement'))), (N 'Deliver' @((N 'Pilot'))))},
  @{name = 'Basic Block List'; id = "${L}default"; nodes = @((N 'Speed'), (N 'Quality' @() 'Qual'), (N 'Cost'), (N 'Reach'), (N 'Trust'))},
  @{name = 'Vertical Bullet List'; id = "${L}vList2"; nodes = @((N 'Goals' @((N 'Grow revenue 12%'), (N 'Enter two markets'))), (N 'Risks' @((N 'Hiring'), (N 'Supply chain'))))},
  @{name = 'Basic Venn'; id = "${L}venn1"; nodes = @((N 'People'), (N 'Process'), (N 'Technology'))},
  @{name = 'Basic Radial'; id = "${L}radial1"; nodes = @((N 'Customer' @((N 'Sales'), (N 'Support'), (N 'Product'), (N 'Marketing'))))},
  @{name = 'Organization Chart'; id = "${L}orgChart1"; nodes = @((N 'Ana Ruiz, CEO' @((N 'Sam Lee, Assistant' @() '' $true), (N 'Kai Chen, CTO' @((N 'Platform'), (N 'Apps'))), (N 'Lea Park, CFO'), (N 'Omar Haddad, COO'))))},
  @{name = 'Hierarchy'; id = "${L}hierarchy1"; nodes = @((N 'Company' @((N 'Sales' @((N 'North'), (N 'South'))), (N 'Engineering' @((N 'Web'), (N 'Mobile'))))))},
  @{name = 'Horizontal Hierarchy'; id = "${L}hierarchy2"; nodes = @((N 'Company' @((N 'Sales' @((N 'North'), (N 'South'))), (N 'Engineering' @((N 'Web'), (N 'Mobile'))))))},
  @{name = 'Name and Title Organization Chart'; id = 'urn:microsoft.com/office/officeart/2008/layout/NameandTitleOrganizationalChart'; titles = @{'Ana Ruiz' = 'Chief Executive'; 'Kai Chen' = 'Technology'}; nodes = @((N 'Ana Ruiz' @((N 'Kai Chen'), (N 'Lea Park'))))}
)

function Fill($node, $spec) {
  $node.TextFrame2.TextRange.Text = $spec.t
  if ($spec.b) {
    $start = $spec.t.IndexOf($spec.b)
    if ($start -ge 0) { $node.TextFrame2.TextRange.Characters($start + 1, $spec.b.Length).Font.Bold = -1 }
  }
  foreach ($child in $spec.c) {
    # msoSmartArtNodeBelow (5); msoSmartArtNodeTypeAssistant (2) for an assistant, else the default type (1).
    $added = if ($child.a) { $node.AddNode(5, 2) } else { $node.AddNode(5, 1) }
    Fill $added $child
  }
}

$ppt = New-Object -ComObject PowerPoint.Application
$manifest = @()
$pres = $null; $seed = $null
try {
  $ppt.Visible = -1; $ppt.WindowState = 2
  # The layouts come from the seed deck (make-smartart-seeds.mjs): this PowerPoint build gives scripts no Application.SmartArtLayouts
  # list, but a graphic's SmartArt.Layout is a layout AddSmartArt takes. Seed slide k holds the layout of spec k.
  $seed = $ppt.Presentations.Open($Seeds, -1, 0, -1)
  $pres = $ppt.Presentations.Add(-1)
  $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
  $titleOnly = $pres.SlideMaster.CustomLayouts.Item(6)
  for ($k = 0; $k -lt $specs.Count; $k++) {
    $spec = $specs[$k]
    $layout = $null; $seedNote = ''
    try {
      $seedSlide = $seed.Slides.Item($k + 1)
      for ($s = 1; $s -le $seedSlide.Shapes.Count; $s++) { $candidate = $seedSlide.Shapes.Item($s); if ($candidate.HasSmartArt -eq -1) { $layout = $candidate.SmartArt.Layout; break } }
      if (-not $layout) { $seedNote = 'the seed slide has no live SmartArt' }
    } catch { $seedNote = $_.Exception.Message }
    if (-not $layout) { $manifest += [pscustomobject]@{name = $spec.name; id = $spec.id; error = "no layout from the seed: $seedNote"}; continue }
    $slide = $pres.Slides.AddSlide($pres.Slides.Count + 1, $titleOnly)
    $slide.Shapes.Item(1).TextFrame.TextRange.Text = $spec.name
    $shape = $slide.Shapes.AddSmartArt($layout, 40, 110, 880, 400)
    $shape.Name = "SmartArt $($spec.name)"
    $sa = $shape.SmartArt
    while ($sa.AllNodes.Count -gt 0) { $sa.AllNodes.Item(1).Delete() }
    foreach ($top in $spec.nodes) { Fill ($sa.Nodes.Add()) $top }
    $titleResult = ''
    if ($spec.titles) {
      # Name and Title Organization Chart: the title box of a node, where the object model reaches it (recorded either way).
      for ($n = 1; $n -le $sa.AllNodes.Count; $n++) {
        $node = $sa.AllNodes.Item($n); $key = $node.TextFrame2.TextRange.Text
        if ($spec.titles.ContainsKey($key)) {
          try { $node.Shapes.Item(2).TextFrame2.TextRange.Text = $spec.titles[$key]; $titleResult += "$key=set;" } catch { $titleResult += "$key=$($_.Exception.Message);" }
        }
      }
    }
    $nodes = @()
    for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $node = $sa.AllNodes.Item($n); $nodes += [pscustomobject]@{level = $node.Level; type = $node.Type; text = $node.TextFrame2.TextRange.Text; shapes = $node.Shapes.Count} }
    $number = $slide.SlideIndex
    $slide.Export((Join-Path $Out ("slide{0:D2}.png" -f $number)), 'PNG', 1280, 720)
    $manifest += [pscustomobject]@{slide = $number; name = $spec.name; id = $sa.Layout.Id; layoutName = $sa.Layout.Name; category = $sa.Layout.Category; groupItems = $shape.GroupItems.Count; titles = $titleResult; nodes = $nodes}
  }
  $pres.SaveAs((Join-Path $Out 'powerpoint-smartart.pptx'), 24)
} finally {
  $manifest | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $Out 'powerpoint-smartart.json')
  # Close only the presentations this script opened or added; quit only when no other presentation is open.
  foreach ($own in @($pres, $seed)) { if ($own) { try { $own.Saved = -1; $own.Close() } catch {} } }
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
