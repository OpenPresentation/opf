# SH23 ninth-node qualification. Coordinator only: run through Invoke-OpfNativeWorker with a deadline.
# Opens sealed input copies read-only; edits those owned in-memory copies, SaveCopyAs derivative, then reopens THE DERIVATIVE.
param(
 [Parameter(Mandatory=$true)][string]$Manifest,
 [Parameter(Mandatory=$true)][string]$Out,
 [Parameter(Mandatory=$true)][string]$NativeHelpersPath,
 [switch]$PlanOnly,
 [ValidateSet('pyramid','matrix','flow','chevrons','vertical-flow')][string]$Only
)
$ErrorActionPreference='Stop'
. $NativeHelpersPath
$Manifest=[IO.Path]::GetFullPath($Manifest);$Out=[IO.Path]::GetFullPath($Out)
if(Test-Path -LiteralPath $Out){throw 'Preserve earlier evidence: select a fresh Out directory.'}
$definition=Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$root=Split-Path -Parent $Manifest
$knownKinds=@('pyramid','matrix','flow','chevrons','vertical-flow')
$inputs=@(foreach($witnessCase in $definition.cases){
 if($knownKinds -notcontains [string]$witnessCase.kind){throw 'Unknown witness kind; output filename refused.'}
 if([IO.Path]::GetFileName([string]$witnessCase.file) -ne $witnessCase.file){throw 'Witness filename must be a leaf.'}
 if(@('l','ctr','r') -notcontains [string]$witnessCase.paragraphAlignment -or $witnessCase.text9.Count -ne 9){throw 'Manifest lacks nine-node text alignment expectations.'}
 if($witnessCase.initialCount -lt 1 -or $witnessCase.initialCount -gt 8){throw 'Witness starts with 1 to 8 nodes.'}
 $source=Join-Path $root $witnessCase.file
 if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw "Missing witness input: $source"}
 $hash=Get-OpfFileSha256 $source
 if($hash -ne $witnessCase.sha256){throw 'Witness source hash mismatch.'}
 @{source=$source;sha256=$hash;spec=$witnessCase}
})
if($inputs.Count -ne 5 -or @($inputs | ForEach-Object {$_.spec.kind} | Select-Object -Unique).Count -ne 5){throw 'Expected all five unique production layout witnesses.'}
if($Only){$inputs=@($inputs | Where-Object {$_.spec.kind -eq $Only})}
function Open-OpfSH23Input {param($Application,[string]$OwnedPath) return $Application.Presentations.Open([string]$OwnedPath,-1,0,-1)}
if($PlanOnly){@{scope='Plan only: no output directory, process or COM object created.';cases=@($inputs | ForEach-Object { @{source=$_.source;sha256=$_.sha256;initialCount=$_.spec.initialCount;ninthShapes=$_.spec.geometry9.Count} })}|ConvertTo-Json -Depth 8;return}
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint is already running. Close it yourself; nothing opened.'}
[void](New-Item -ItemType Directory -Path $Out)
[void](New-Item -ItemType Directory -Path (Join-Path $Out 'inputs'))
foreach($witnessInput in $inputs){
 $witnessInput.copy=Join-Path (Join-Path $Out 'inputs') ([IO.Path]::GetFileName($witnessInput.source))
 Copy-Item -LiteralPath $witnessInput.source -Destination $witnessInput.copy
 if((Get-OpfFileSha256 $witnessInput.copy) -ne $witnessInput.sha256){throw 'Sealed witness copy hash mismatch.'}
}
function Find-OpfSmartArt($Slide){
 $found=$null;$count=0
 for($k=1;$k -le $Slide.Shapes.Count;$k++){$candidate=$Slide.Shapes.Item($k);if($candidate.HasSmartArt -eq -1){$found=$candidate;$count++}}
 if($count -ne 1){throw 'Expected exactly one live SmartArt frame.'}
 return $found
}
function Measure-OpfSH23($Presentation,$Expected,[int]$Count,[string]$Raster){
 $slide=$Presentation.Slides.Item(1)
 $slide.Export($Raster,'PNG',[int][Math]::Round($Presentation.PageSetup.SlideWidth*4/3),[int][Math]::Round($Presentation.PageSetup.SlideHeight*4/3))
 $shape=Find-OpfSmartArt $slide;$sa=$shape.SmartArt
 if($sa.AllNodes.Count -ne $Count){throw "Expected $Count data nodes, got $($sa.AllNodes.Count)."}
 if([string]$sa.Layout.Id -ne $Expected.layoutId){throw 'The OPF layout identity changed.'}
 if($shape.GroupItems.Count -lt 1){throw 'No materialized SmartArt shapes after Export.'}
 $texts=@();$levels=@()
 for($n=1;$n -le $sa.AllNodes.Count;$n++){$node=$sa.AllNodes.Item($n);$texts+=,[string]$node.TextFrame2.TextRange.Text;$levels+=,[int]$node.Level}
 if(@($levels|Where-Object {$_ -ne 1}).Count -ne 0){throw 'A flat list node was reparented.'}
 $rects=@();$sizes=@();$paragraphs=@()
 for($k=1;$k -le $shape.GroupItems.Count;$k++){
  $g=$shape.GroupItems.Item($k)
  $rects+=@{left=[double]$g.Left;top=[double]$g.Top;width=[double]$g.Width;height=[double]$g.Height;rotation=[double]$g.Rotation;arrow=($g.AutoShapeType -eq 33)}
  if($g.HasTextFrame -eq -1 -and $g.TextFrame2.HasText -eq -1){
   $text=$g.TextFrame2.TextRange;$sizes+=,[double]$text.Font.Size
   $paragraphs+=@{text=[string]$text.Text;alignment=[int]$text.ParagraphFormat.Alignment;left=[double]$text.Lines(1,1).BoundLeft+[double]$shape.Left;width=[double]$text.Lines(1,1).BoundWidth;top=[double]$text.Lines(1,1).BoundTop+[double]$shape.Top}
  }
 }
 if($sizes.Count -ne $Count -or @($sizes|Where-Object {[Math]::Abs($_-$Expected.fontSize) -gt .01}).Count -ne 0){throw 'A node font changed or a node has no visible text shape.'}
 $wantedAlignment=@{l=1;ctr=2;r=3}[[string]$Expected.paragraphAlignment]
 if(@($paragraphs|Where-Object {$_.alignment -ne $wantedAlignment}).Count -ne 0){throw 'A node paragraph differs from the layout alignment, even though its rectangle matches.'}
 if($Count -eq 9){
  for($k=0;$k -lt $paragraphs.Count;$k++){
   $p=$paragraphs[$k];$e=$Expected.text9[$k]
   $delta=if($wantedAlignment -eq 1){[Math]::Abs($p.left-$e.left)}elseif($wantedAlignment -eq 3){[Math]::Abs($p.left+$p.width-$e.right)}else{[Math]::Abs($p.left+$p.width/2-($e.left+$e.right)/2)}
   if($delta -gt 1.125){throw "Node first-line alignment differs by $delta pt (SH07's 1.5px text bound)."}
  }
 }
 $actual=@($rects|Where-Object {-not $_.arrow})+@($rects|Where-Object {$_.arrow})
 $expectedShapes=if($Count -eq 8){$Expected.geometry8}else{$Expected.geometry9}
 $expectedShapes=@($expectedShapes|Where-Object {-not $_.arrow})+@($expectedShapes|Where-Object {$_.arrow})
 if($actual.Count -ne $expectedShapes.Count){throw 'A table node or connector was dropped.'}
 $maxRect=0.0;$maxTurn=0.0
 for($k=0;$k -lt $actual.Count;$k++){
  foreach($key in @('left','top','width','height')){$maxRect=[Math]::Max($maxRect,[Math]::Abs($actual[$k][$key]-$expectedShapes[$k].$key))}
  $turn=[Math]::Abs(((($actual[$k].rotation-$expectedShapes[$k].rotation)%360+540)%360)-180);$maxTurn=[Math]::Max($maxTurn,$turn)
 }
 if($maxRect -gt .1 -or $maxTurn -gt .01){throw "Table geometry differs: $maxRect pt, $maxTurn degrees."}
 return @{nodeCount=$Count;texts=$texts;levels=$levels;sizes=$sizes;layout=[string]$sa.Layout.Id;maxPointError=$maxRect;maxRotationError=$maxTurn;rects=$rects;paragraphs=$paragraphs}
}
$latch=New-OpfNativeLatch;$rows=New-Object 'System.Collections.Generic.List[object]';$app=$null
try{
 $app=Invoke-OpfNativeStage $latch 'create-app' {New-Object -ComObject PowerPoint.Application}
 Invoke-OpfNativeStage $latch 'empty-visible-minimized' {if($app.Presentations.Count -ne 0){throw 'PowerPoint has an existing presentation; refusing.'};$app.Visible=-1;$app.WindowState=2}|Out-Null
 foreach($witnessInput in $inputs){
  $spec=$witnessInput.spec;$saved=Join-Path $Out ($spec.kind+'-ninth-saved.pptx');$row=@{kind=$spec.kind;source=$witnessInput.source;saved=$saved};$rows.Add($row)
  $presentation=Invoke-OpfNativeStage $latch ($spec.kind+'-open-copy') {Open-OpfSH23Input $app ([string]$witnessInput.copy)}
  Invoke-OpfNativeStage $latch ($spec.kind+'-prepare-eight') {
   if([IO.Path]::GetFullPath([string]$presentation.FullName) -ne $witnessInput.copy){throw 'Owned input identity mismatch.'}
   $slide=$presentation.Slides.Item(1);$slide.Export((Join-Path $Out ($spec.kind+'-initial.png')),'PNG',1280,720)
   $shape=Find-OpfSmartArt $slide;$sa=$shape.SmartArt
   if($sa.AllNodes.Count -ne $spec.initialCount -or $shape.GroupItems.Count -lt 1){throw 'Initial node count/materialization mismatch.'}
   for($n=[int]$spec.initialCount;$n -lt 8;$n++){$added=$sa.AllNodes.Add();$added.TextFrame2.TextRange.Text=[string]('Extra '+($n+1));if($sa.AllNodes.Count -ne ($n+1)){throw 'Adding a node did not increase the data count by one.'}}
   $row.eight=Measure-OpfSH23 $presentation $spec 8 (Join-Path $Out ($spec.kind+'-eight.png'))
  }|Out-Null
  Invoke-OpfNativeStage $latch ($spec.kind+'-edit-add-ninth') {
   $sa=(Find-OpfSmartArt $presentation.Slides.Item(1)).SmartArt
   $sa.AllNodes.Item(1).TextFrame2.TextRange.Text='Edited'
   $added=$sa.AllNodes.Add();$added.TextFrame2.TextRange.Text='Ninth'
   $row.ninth=Measure-OpfSH23 $presentation $spec 9 (Join-Path $Out ($spec.kind+'-ninth.png'))
   if($row.ninth.texts[0] -ne 'Edited' -or $row.ninth.texts[8] -ne 'Ninth'){throw 'Edited/ninth text is missing or reordered.'}
  }|Out-Null
  Invoke-OpfNativeStage $latch ($spec.kind+'-save-ninth-copy') {$presentation.SaveCopyAs([string]$saved,24)}|Out-Null
  Invoke-OpfNativeStage $latch ($spec.kind+'-close-owned-input') {if([IO.Path]::GetFullPath([string]$presentation.FullName) -ne $witnessInput.copy){throw 'Input identity changed after SaveCopyAs.'};$presentation.Saved=-1;[void](Close-OpfOwnedPresentation $presentation $witnessInput.copy)}|Out-Null
  $reopened=Invoke-OpfNativeStage $latch ($spec.kind+'-reopen-saved-ninth') {Open-OpfSH23Input $app ([string]$saved)}
  Invoke-OpfNativeStage $latch ($spec.kind+'-verify-saved-ninth') {
   if([IO.Path]::GetFullPath([string]$reopened.FullName) -ne $saved){throw 'Did not reopen the saved derivative.'}
   $row.reopened=Measure-OpfSH23 $reopened $spec 9 (Join-Path $Out ($spec.kind+'-reopened.png'))
   if(($row.reopened.texts -join [char]0) -cne ($row.ninth.texts -join [char]0)){throw 'Nine-node text changed after save/reopen.'}
   $row.savedSha256=Get-OpfFileSha256 $saved
  }|Out-Null
  Invoke-OpfNativeStage $latch ($spec.kind+'-close-saved') {[void](Close-OpfOwnedPresentation $reopened $saved)}|Out-Null
 }
 Invoke-OpfNativeStage $latch 'quit-empty-owned-app' {if($app.Presentations.Count -eq 0){$app.Quit()}}|Out-Null
}finally{
 foreach($witnessInput in $inputs){$witnessInput.sha256After=Get-OpfFileSha256 $witnessInput.source;$witnessInput.copySha256After=Get-OpfFileSha256 $witnessInput.copy;$witnessInput.unchanged=($witnessInput.sha256After -eq $witnessInput.sha256 -and $witnessInput.copySha256After -eq $witnessInput.sha256)}
 @{passed=((-not $latch.failed)-and @($inputs|Where-Object {-not $_.unchanged}).Count -eq 0);failure=$latch.reason;stages=@($latch.stages.ToArray());inputs=$inputs;cases=@($rows.ToArray())}|ConvertTo-Json -Depth 22|Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
 # A failed stage makes no further Office call, including cleanup. Preserve its exact unknown state for the coordinator.
}
