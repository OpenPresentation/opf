# SH21 read-only product baseline. Coordinator only, through Invoke-OpfNativeWorker with its owned deadline.
# This measures diagnostic live exports and sealed native-shape controls. It performs no edits and grants no eligibility.
param([Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$Out,[Parameter(Mandatory=$true)][string]$NativeHelpersPath,[string[]]$Only,[switch]$PlanOnly)
$ErrorActionPreference='Stop'
. $NativeHelpersPath
$Manifest=[IO.Path]::GetFullPath($Manifest);$Out=[IO.Path]::GetFullPath($Out)
if(Test-Path -LiteralPath $Out){throw 'Preserve prior evidence: select a fresh Out directory.'}
$definition=Get-Content -LiteralPath $Manifest -Raw|ConvertFrom-Json;$sourceRoot=Split-Path -Parent $Manifest
$known=@('org-chart-3','org-chart-5','hierarchy-3','hierarchy-5','venn-1','venn-2','venn-3','venn-4','venn-5','venn-6','venn-7')
if($definition.cases.Count -ne 11 -or @($definition.cases|ForEach-Object {$_.id}|Select-Object -Unique).Count -ne 11){throw 'Expected eleven unique diagnostic cases.'}
$inputs=@(foreach($witnessCase in $definition.cases){
 $id=[string]$witnessCase.id;if($known -notcontains $id){throw 'Unknown diagnostic case.'}
 if(@('org-chart','hierarchy','venn') -notcontains [string]$witnessCase.kind -or $witnessCase.items.Count -ne $witnessCase.count){throw 'Malformed semantic case.'}
 foreach($mode in @('live','native')){
  $relative=if($mode -eq 'live'){'pptx/'+$id+'.pptx'}else{'pptx-shapes/'+$id+'.pptx'}
  if([string]$witnessCase.$mode.file -ne $relative){throw 'Source filename must be the fixed case path.'}
  $source=[IO.Path]::GetFullPath((Join-Path $sourceRoot $relative));if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw "Missing source: $source"}
  $hash=Get-OpfFileSha256 $source;if($hash -ne $witnessCase.$mode.sha256){throw 'Sealed source hash mismatch.'}
  @{id=$id;mode=$mode;spec=$witnessCase;relative=$relative;source=$source;sha256=$hash}
 }
})
foreach($id in $Only){if($known -notcontains $id){throw 'Unknown requested case.'}}
if($Only){$inputs=@($inputs|Where-Object {$Only -contains $_.id})}
function Open-OpfSH21Product {param($Application,[Parameter(Mandatory=$true)][string]$OwnedPath) return $Application.Presentations.Open([string]$OwnedPath,-1,0,-1)}
if($PlanOnly){@{scope='Plan only: no output directory, process or Office object created.';cases=@($inputs|ForEach-Object {@{id=$_.id;mode=$_.mode;source=$_.source;sha256=$_.sha256}})}|ConvertTo-Json -Depth 6;return}
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint is already running; no Office object created.'}
[void](New-Item -ItemType Directory -Path $Out)
foreach($directory in @('pptx','pptx-shapes','preview','ppt','ppt-shapes')){[void](New-Item -ItemType Directory -Path (Join-Path $Out $directory))}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'meta.json') -Destination (Join-Path $Out 'meta.json')
foreach($witnessInput in $inputs){
 $witnessInput.copy=[IO.Path]::GetFullPath((Join-Path $Out $witnessInput.relative));Copy-Item -LiteralPath $witnessInput.source -Destination $witnessInput.copy
 if((Get-OpfFileSha256 $witnessInput.copy) -ne $witnessInput.sha256){throw 'Sealed source-copy hash mismatch.'}
 if($witnessInput.mode -eq 'live'){Copy-Item -LiteralPath (Join-Path $sourceRoot ('preview/'+$witnessInput.id+'-1.png')) -Destination (Join-Path $Out ('preview/'+$witnessInput.id+'-1.png'))}
}
function Read-OpfSH21Shape($Shape){
 $row=@{name=[string]$Shape.Name;shapeType=[int]$Shape.Type;type=[int]$Shape.AutoShapeType;left=[double]$Shape.Left;top=[double]$Shape.Top;width=[double]$Shape.Width;height=[double]$Shape.Height;rotation=[double]$Shape.Rotation;fillType=[int]$Shape.Fill.Type;transparency=[double]$Shape.Fill.Transparency}
 if($Shape.HasTextFrame -eq -1 -and $Shape.TextFrame2.HasText -eq -1){
  $range=$Shape.TextFrame2.TextRange;$paragraph=$range.ParagraphFormat;$font=$range.Font
  $row.text=[string]$range.Text;$row.size=$font.Size;$row.latin=$font.Name;$row.eastAsian=$font.NameFarEast;$row.complexScript=$font.NameComplexScript;$row.alignment=$paragraph.Alignment
  $row.spacing=@{within=$paragraph.SpaceWithin;rule=$paragraph.LineRuleWithin;before=$paragraph.SpaceBefore;after=$paragraph.SpaceAfter}
  $row.lines=@(for($lineIndex=1;$lineIndex -le $range.Lines().Count;$lineIndex++){$line=$range.Lines($lineIndex,1);@{text=[string]$line.Text;left=$line.BoundLeft;top=$line.BoundTop;width=$line.BoundWidth;height=$line.BoundHeight}})
 }
 return $row
}
function Read-OpfSH21SmartArt($Shape,$Expected){
 $sa=$Shape.SmartArt;if([string]$sa.Layout.Id -ne [string]$Expected.layoutId){throw 'Native layout identity changed.'}
 if($sa.AllNodes.Count -ne $Expected.count -or $Shape.GroupItems.Count -lt 1){throw 'Native data count or materialized groups missing.'}
 $nodes=@();$wantedParents=@{};$stack=@();$tree=@('org-chart','hierarchy') -contains [string]$Expected.kind
 foreach($entry in $Expected.items){$text=if($entry -is [string]){[string]$entry}else{[string]$entry.text};$level=if($tree){[int]$entry.level}else{0};$parent=if($level -gt 0){[string]$stack[$level-1]}else{$null};$wantedParents[$text]=@{level=$level+1;parent=$parent};if($stack.Count -le $level){$stack+=,$text}else{$stack[$level]=$text}}
 for($nodeIndex=1;$nodeIndex -le $sa.AllNodes.Count;$nodeIndex++){
  $node=$sa.AllNodes.Item($nodeIndex);$text=[string]$node.TextFrame2.TextRange.Text;$level=[int]$node.Level;$parent=if($level -gt 1){[string]$node.ParentNode.TextFrame2.TextRange.Text}else{$null};$wanted=$wantedParents[$text]
  if($null -eq $wanted -or $level -ne $wanted.level -or $parent -ne $wanted.parent -or [int]$node.Type -ne 1){throw 'Native parent/text/level semantics differ from the source.'}
  $nodes+=,@{index=$nodeIndex;text=$text;level=$level;parent=$parent;type=[int]$node.Type;children=$node.Nodes.Count}
 }
 return @{layout=[string]$sa.Layout.Id;layoutName=[string]$sa.Layout.Name;nodes=$nodes.Count;dataNodes=$nodes;frame=@{left=$Shape.Left;top=$Shape.Top;width=$Shape.Width;height=$Shape.Height};items=@(for($groupIndex=1;$groupIndex -le $Shape.GroupItems.Count;$groupIndex++){Read-OpfSH21Shape $Shape.GroupItems.Item($groupIndex)})}
}
$latch=New-OpfNativeLatch;$controls=New-Object 'System.Collections.Generic.List[object]';$app=$null;$opened=$null
try{
 $app=Invoke-OpfNativeStage $latch 'create-app' {New-Object -ComObject PowerPoint.Application}
 Invoke-OpfNativeStage $latch 'empty-visible-minimized' {if($app.Presentations.Count -ne 0){throw 'Existing presentation appeared; refusing.'};$app.Visible=-1;$app.WindowState=2}|Out-Null
 foreach($witnessInput in $inputs){
  $opened=Invoke-OpfNativeStage $latch ($witnessInput.id+'-'+$witnessInput.mode+'-open') {Open-OpfSH21Product -Application $app -OwnedPath ([string]$witnessInput.copy)}
  Invoke-OpfNativeStage $latch ($witnessInput.id+'-'+$witnessInput.mode+'-export-read') {
   if([IO.Path]::GetFullPath([string]$opened.FullName) -ne $witnessInput.copy -or $opened.Slides.Count -ne 1){throw 'Owned input identity or slide count mismatch.'}
   $slide=$opened.Slides.Item(1);$rasterDirectory=if($witnessInput.mode -eq 'live'){'ppt'}else{'ppt-shapes'}
   $slide.Export((Join-Path $Out ($rasterDirectory+'/'+$witnessInput.id+'-1.png')),'PNG',[int][Math]::Round($opened.PageSetup.SlideWidth*4/3),[int][Math]::Round($opened.PageSetup.SlideHeight*4/3))
   $live=@();$shapes=@();for($shapeIndex=1;$shapeIndex -le $slide.Shapes.Count;$shapeIndex++){$shape=$slide.Shapes.Item($shapeIndex);if($shape.HasSmartArt -eq -1){$live+=,(Read-OpfSH21SmartArt $shape $witnessInput.spec)}else{$shapes+=,(Read-OpfSH21Shape $shape)}}
   if(($witnessInput.mode -eq 'live' -and $live.Count -ne 1) -or ($witnessInput.mode -eq 'native' -and $live.Count -ne 0)){throw 'Expected live/native representation changed.'}
   $controls.Add(@{id=$witnessInput.id;mode=$witnessInput.mode;source=$witnessInput.source;smartArt=$live;shapes=$shapes})
  }|Out-Null
  Invoke-OpfNativeStage $latch ($witnessInput.id+'-'+$witnessInput.mode+'-close-owned') {[void](Close-OpfOwnedPresentation $opened ([string]$witnessInput.copy))}|Out-Null;$opened=$null
 }
 Invoke-OpfNativeStage $latch 'quit-empty-owned-app' {if($app.Presentations.Count -ne 0){throw 'Another presentation remains; refusing Quit.'};$app.Quit()}|Out-Null
}finally{
 foreach($witnessInput in $inputs){$witnessInput.sha256After=Get-OpfFileSha256 $witnessInput.source;$witnessInput.copySha256After=Get-OpfFileSha256 $witnessInput.copy;$witnessInput.unchanged=($witnessInput.sha256After -eq $witnessInput.sha256 -and $witnessInput.copySha256After -eq $witnessInput.sha256)}
 $passed=((-not $latch.failed)-and @($inputs|Where-Object {-not $_.unchanged}).Count -eq 0)
 @{passed=$passed;scope='Read-only product baseline, no native domain acceptance or edit qualification';failure=$latch.reason;inputs=$inputs;controls=@($controls.ToArray());stages=@($latch.stages.ToArray())}|ConvertTo-Json -Depth 24|Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
 @($controls.ToArray()|Where-Object {$_.mode -eq 'live'}|ForEach-Object {@{file=$_.id;slides=@(@{index=1;smartArt=$_.smartArt})}})|ConvertTo-Json -Depth 24|Set-Content -LiteralPath (Join-Path $Out 'ppt/probe.json') -Encoding UTF8
 # A failed Office stage latches. No later Office cleanup calls are made; the coordinator owns exact-path cleanup.
}
