# SH-20/21/22: bounded witness job for the coordinator. Never run while PowerPoint is open.
# Run this file through scripts/native-acceptance/qualification's owned worker / deadline.
# It copies every input into a fresh attempt, hashes before/after, opens copies only and never closes user files.
param(
  [Parameter(Mandatory=$true)][string]$Seeds,
  [Parameter(Mandatory=$true)][string]$Sweep,
  [Parameter(Mandatory=$true)][string]$Out,
  [Parameter(Mandatory=$true)][string]$NativeHelpersPath,
  [switch]$PlanOnly,
  [switch]$BaselineOnly
)
$ErrorActionPreference = 'Stop'
. $NativeHelpersPath
$Out = [IO.Path]::GetFullPath($Out)
if (Test-Path -LiteralPath $Out) { throw 'Preserve prior evidence: choose a fresh Out directory.' }
$Seeds = [IO.Path]::GetFullPath($Seeds)
$Sweep = [IO.Path]::GetFullPath($Sweep)
$inputFiles = @($Seeds)
foreach ($kind in @('pptx','pptx-shapes')) {
  foreach ($name in @('cycle-4-short-square','matrix-4-cjk-wide','matrix-4-rtl-wide')) {
    $inputFiles += Join-Path (Join-Path $Sweep $kind) ($name + '.pptx')
  }
}
$inputs = @($inputFiles | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_ -PathType Leaf)) { throw "Missing witness input: $_" }
  @{ source = $_; sha256 = (Get-OpfFileSha256 $_) }
})
if ($PlanOnly) { @{ out=$Out; inputs=$inputs; treeCases=@('org:k1','org:chain4','org:roots2','org:assistant','hierarchy:k1','hierarchy:chain4','hierarchy:roots2','venn:5','venn:6','venn:7'); scope='Plan only: no directory, process or COM object created.' } | ConvertTo-Json -Depth 6; return }
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { throw 'PowerPoint is already running. Close it yourself; no COM object was created.' }
[void](New-Item -ItemType Directory -Path $Out)
[void](New-Item -ItemType Directory -Path (Join-Path $Out 'inputs'))
for ($i=0; $i -lt $inputs.Count; $i++) {
  $copy = Join-Path (Join-Path $Out 'inputs') ("$i-" + [IO.Path]::GetFileName($inputs[$i].source))
  Copy-Item -LiteralPath $inputs[$i].source -Destination $copy
  if ((Get-OpfFileSha256 $copy) -ne $inputs[$i].sha256) { throw 'Witness copy hash mismatch.' }
  $inputs[$i].copy = $copy
}
$latch = New-OpfNativeLatch
$rows = New-Object 'System.Collections.Generic.List[object]'
$controls = New-Object 'System.Collections.Generic.List[object]'
$app = $null; $seed = $null; $pres = $null
$owned = Join-Path $Out 'tree-witness.pptx'
function T([string]$Text, $Children=@(), [bool]$Assistant=$false) { @{ text=$Text; children=@($Children); assistant=$Assistant } }
function Sync-Nodes($Collection, $Specs, $Parent) {
  $normal=@(); $assistants=@()
  for ($i=1;$i -le $Collection.Count;$i++) { $n=$Collection.Item($i); if ($n.Type -eq 2) {$assistants+=,$n} else {$normal+=,$n} }
  $usedN=0; $usedA=0
  foreach ($spec in $Specs) {
    if ($spec.assistant) { if ($usedA -lt $assistants.Count) {$n=$assistants[$usedA]} else {$n=$Parent.AddNode(5,2)}; $usedA++ }
    else { if ($usedN -lt $normal.Count) {$n=$normal[$usedN]} elseif ($null -ne $Parent) {$n=$Parent.AddNode(5,1)} else {$n=$Collection.Add()}; $usedN++ }
    $n.TextFrame2.TextRange.Text=$spec.text
    Sync-Nodes $n.Nodes $spec.children $n
  }
  $extra=@(@($normal | Select-Object -Skip $usedN)+@($assistants | Select-Object -Skip $usedA))
  for ($i=$extra.Count-1;$i -ge 0;$i--) { $extra[$i].Delete() }
}
function Read-TextShape($Shape) {
  $r=@{ name=[string]$Shape.Name; shapeType=[int]$Shape.Type; preset=[int]$Shape.AutoShapeType; left=[double]$Shape.Left; top=[double]$Shape.Top; width=[double]$Shape.Width; height=[double]$Shape.Height; rotation=[double]$Shape.Rotation }
  if ($Shape.HasTextFrame -eq -1 -and $Shape.TextFrame2.HasText -eq -1) {
    $tf=$Shape.TextFrame2; $text=$tf.TextRange; $font=$text.Font; $paragraph=$text.ParagraphFormat
    $r.text=[string]$text.Text; $r.size=$font.Size; $r.latin=$font.Name; $r.eastAsian=$font.NameFarEast; $r.complexScript=$font.NameComplexScript
    $r.margins=@($tf.MarginLeft,$tf.MarginTop,$tf.MarginRight,$tf.MarginBottom); $r.anchor=$tf.VerticalAnchor
    $r.spacing=@{ within=$paragraph.SpaceWithin; rule=$paragraph.LineRuleWithin; before=$paragraph.SpaceBefore; after=$paragraph.SpaceAfter }
    $r.lines=@(for($j=1;$j -le $text.Lines().Count;$j++) { $line=$text.Lines($j,1); @{ text=[string]$line.Text; left=$line.BoundLeft; top=$line.BoundTop; width=$line.BoundWidth; height=$line.BoundHeight } })
  }
  if ($Shape.Type -eq 5) { # msoFreeform: ShapeNodes are vertices/control points, not SmartArt data nodes.
    $r.points=@(for($j=1;$j -le $Shape.Nodes.Count;$j++) { $node=$Shape.Nodes.Item($j); @{ index=$j; editingType=$node.EditingType; segmentType=$node.SegmentType; points=@($node.Points) } })
  }
  return $r
}
function Read-SmartArt($Shape) {
  $sa=$Shape.SmartArt
  $nodes=@(for($j=1;$j -le $sa.AllNodes.Count;$j++) {
    $n=$sa.AllNodes.Item($j); $level=[int]$n.Level
    $parent=$null; if($level -gt 1) { $parent=[string]$n.ParentNode.TextFrame2.TextRange.Text }
    @{ index=$j; text=[string]$n.TextFrame2.TextRange.Text; level=$level; type=[int]$n.Type; children=$n.Nodes.Count; parent=$parent }
  })
  return @{ layout=[string]$sa.Layout.Id; nodes=$nodes; items=@(for($j=1;$j -le $Shape.GroupItems.Count;$j++) {Read-TextShape $Shape.GroupItems.Item($j)}) }
}
try {
  $app=Invoke-OpfNativeStage $latch 'create-app' { New-Object -ComObject PowerPoint.Application }
  Invoke-OpfNativeStage $latch 'empty-app' { if($app.Presentations.Count -ne 0) { throw 'PowerPoint acquired an open presentation; refusing this attempt.' } } | Out-Null
  if (-not $BaselineOnly) {
  $seed=Invoke-OpfNativeStage $latch 'open-seed-copy' { $app.Presentations.Open($inputs[0].copy,-1,0,0) }
  Invoke-OpfNativeStage $latch 'seed-identity' { if([IO.Path]::GetFullPath([string]$seed.FullName) -ne $inputs[0].copy) {throw 'Seed identity mismatch.'} } | Out-Null
  $pres=Invoke-OpfNativeStage $latch 'create-owned' { $app.Presentations.Add(0) }
  Invoke-OpfNativeStage $latch 'save-owned' { $pres.SaveAs($owned,24) } | Out-Null
  Invoke-OpfNativeStage $latch 'measure-trees' {
    $pres.PageSetup.SlideWidth=960; $pres.PageSetup.SlideHeight=540
    $cases=@(
      @{layout='orgChart1';seed=14;name='k1';tree=@((T 'Plan' @((T 'Build'))))},
      @{layout='orgChart1';seed=14;name='chain4';tree=@((T 'Plan' @((T 'Build' @((T 'Web' @((T 'CSS'))))))))},
      @{layout='orgChart1';seed=14;name='roots2';tree=@((T 'Plan' @((T 'Build'))),(T 'Run' @((T 'Ops'))))},
      @{layout='orgChart1';seed=14;name='assistant';tree=@((T 'Plan' @((T 'Aide' @() $true),(T 'Build'),(T 'Test'),(T 'Ship'))))},
      @{layout='hierarchy1';seed=15;name='k1';tree=@((T 'Plan' @((T 'Build'))))},
      @{layout='hierarchy1';seed=15;name='chain4';tree=@((T 'Plan' @((T 'Build' @((T 'Web' @((T 'CSS'))))))))},
      @{layout='hierarchy1';seed=15;name='roots2';tree=@((T 'Plan' @((T 'Build'))),(T 'Run' @((T 'Ops'))))}
    )
    foreach($count in @(5,6,7)) {$cases+=@{layout='venn1';seed=12;name="v$count";tree=@(1..$count | ForEach-Object {T "Set $_"})}}
    foreach($case in $cases) {
      $layout=$null; foreach($shape in $seed.Slides.Item($case.seed).Shapes) {if($shape.HasSmartArt -eq -1){$layout=$shape.SmartArt.Layout;break}}
      if($null -eq $layout -or -not ([string]$layout.Id).EndsWith('/'+$case.layout)) {throw 'Seed layout mismatch.'}
      $slide=$pres.Slides.Add($pres.Slides.Count+1,12); $shape=$slide.Shapes.AddSmartArt($layout,20,20,600,400)
      Sync-Nodes $shape.SmartArt.Nodes $case.tree $null
      $rows.Add(@{case=$case.name;requested=$case.tree;data=(Read-SmartArt $shape)})
      $slide.Export((Join-Path $Out ($case.layout+'-'+$case.name+'.png')),'PNG',1280,720)
    }
    $pres.SaveCopyAs((Join-Path $Out 'tree-witness-saved.pptx'),24)
  } | Out-Null
  Invoke-OpfNativeStage $latch 'close-owned' { [void](Close-OpfOwnedPresentation $pres $owned) } | Out-Null; $pres=$null
  Invoke-OpfNativeStage $latch 'close-seed' { [void](Close-OpfOwnedPresentation $seed $inputs[0].copy) } | Out-Null; $seed=$null
  }
  for($i=1;$i -lt $inputs.Count;$i++) {
    $input=$inputs[$i]
    $opened=Invoke-OpfNativeStage $latch "open-control-$i" {$app.Presentations.Open($input.copy,-1,0,0)}
    Invoke-OpfNativeStage $latch "control-$i" {
      if([IO.Path]::GetFullPath([string]$opened.FullName) -ne $input.copy) {throw 'Control identity mismatch.'}
      $slide=$opened.Slides.Item(1)
      $controls.Add(@{source=$input.source;shapes=@(foreach($shape in $slide.Shapes) {if($shape.HasSmartArt -eq -1){Read-SmartArt $shape}elseif($shape.HasTextFrame -eq -1 -and $shape.TextFrame2.HasText -eq -1){Read-TextShape $shape}})})
    } | Out-Null
    Invoke-OpfNativeStage $latch "close-control-$i" {[void](Close-OpfOwnedPresentation $opened $input.copy)} | Out-Null
  }
  Invoke-OpfNativeStage $latch 'quit-empty-owned-app' {if($app.Presentations.Count -eq 0){$app.Quit()}} | Out-Null
} finally {
  # A failed stage closes the latch: no cleanup Office calls after failure. Preserve the exact evidence and leave the unknown state alone.
  foreach($input in $inputs) {$input.sha256After=Get-OpfFileSha256 $input.source; $input.unchanged=($input.sha256After -eq $input.sha256)}
  @{passed=((-not $latch.failed) -and @($inputs | Where-Object {-not $_.unchanged}).Count -eq 0);failure=$latch.reason;stages=@($latch.stages.ToArray());inputs=$inputs;trees=@($rows.ToArray());controls=@($controls.ToArray())} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
}
