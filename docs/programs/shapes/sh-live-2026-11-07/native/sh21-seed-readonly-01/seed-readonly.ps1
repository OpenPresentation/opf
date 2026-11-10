# SH21 diagnostic: READ existing seed layouts only. No new presentation, AddSmartArt, node edits, layout changes or save.
param([Parameter(Mandatory=$true)][string]$Seeds,[Parameter(Mandatory=$true)][string]$Out,[Parameter(Mandatory=$true)][string]$NativeHelpersPath,[switch]$PlanOnly)
$ErrorActionPreference='Stop'
. $NativeHelpersPath
$Seeds=[IO.Path]::GetFullPath($Seeds);$Out=[IO.Path]::GetFullPath($Out)
if(Test-Path -LiteralPath $Out){throw 'Preserve existing evidence: use a fresh Out directory.'}
if(-not(Test-Path -LiteralPath $Seeds -PathType Leaf)){throw 'Seed deck does not exist.'}
$hash=Get-OpfFileSha256 $Seeds
$jobs=@(@{kind='orgChart1';slide=14},@{kind='hierarchy1';slide=15},@{kind='venn1';slide=12})
if($PlanOnly){@{scope='Plan only. No output directory or COM object.';source=$Seeds;sha256=$hash;jobs=$jobs}|ConvertTo-Json -Depth 5;return}
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint is already running; close it yourself. No COM object created.'}
[void](New-Item -ItemType Directory -Path $Out)
$copy=Join-Path $Out 'owned-seeds.pptx';Copy-Item -LiteralPath $Seeds -Destination $copy
if((Get-OpfFileSha256 $copy) -ne $hash){throw 'Owned seed copy hash mismatch.'}
$latch=New-OpfNativeLatch;$rows=New-Object 'System.Collections.Generic.List[object]';$app=$null;$presentation=$null
try{
 $app=Invoke-OpfNativeStage $latch 'create-app' {New-Object -ComObject PowerPoint.Application}
 Invoke-OpfNativeStage $latch 'empty-visible-minimized' {if($app.Presentations.Count -ne 0){throw 'PowerPoint acquired an open presentation; refusing.'};$app.Visible=-1;$app.WindowState=2}|Out-Null
 $presentation=Invoke-OpfNativeStage $latch 'open-owned-seed-copy' {$app.Presentations.Open([string]$copy,-1,0,-1)}
 foreach($job in $jobs){
  Invoke-OpfNativeStage $latch ($job.kind+'-read-existing') {
   if([IO.Path]::GetFullPath([string]$presentation.FullName) -ne $copy){throw 'Owned seed identity mismatch.'}
   $slide=$presentation.Slides.Item($job.slide)
   $slide.Export((Join-Path $Out ($job.kind+'.png')),'PNG',[int][Math]::Round($presentation.PageSetup.SlideWidth*4/3),[int][Math]::Round($presentation.PageSetup.SlideHeight*4/3))
   $shape=$null;$found=0
   for($k=1;$k -le $slide.Shapes.Count;$k++){$candidate=$slide.Shapes.Item($k);if($candidate.HasSmartArt -eq -1){$shape=$candidate;$found++}}
   if($found -ne 1 -or -not([string]$shape.SmartArt.Layout.Id).EndsWith('/'+$job.kind)){throw 'Seed layout identity mismatch.'}
   if($shape.GroupItems.Count -lt 1){throw 'Seed SmartArt not materialized after Export.'}
   $sa=$shape.SmartArt;$nodes=@();$items=@()
   for($n=1;$n -le $sa.AllNodes.Count;$n++){
    $node=$sa.AllNodes.Item($n);$level=[int]$node.Level;$parentText=$null
    if($level -gt 1){$parentText=[string]$node.ParentNode.TextFrame2.TextRange.Text}
    $record=@{index=$n;text=[string]$node.TextFrame2.TextRange.Text;level=$level;type=[int]$node.Type;children=$node.Nodes.Count;parent=$parentText}
    if($job.kind -eq 'orgChart1'){$record.orgChartLayout=[int]$node.OrgChartLayout}
    $nodes+=,$record
   }
   for($k=1;$k -le $shape.GroupItems.Count;$k++){
    $g=$shape.GroupItems.Item($k);$record=@{index=$k;shapeType=[int]$g.Type;preset=[int]$g.AutoShapeType;left=[double]$g.Left;top=[double]$g.Top;width=[double]$g.Width;height=[double]$g.Height;rotation=[double]$g.Rotation;fillType=[int]$g.Fill.Type;transparency=[double]$g.Fill.Transparency}
    if($g.HasTextFrame -eq -1 -and $g.TextFrame2.HasText -eq -1){$record.text=[string]$g.TextFrame2.TextRange.Text;$record.size=$g.TextFrame2.TextRange.Font.Size}
    if($g.Type -eq 5){$record.points=@(for($j=1;$j -le $g.Nodes.Count;$j++){$vertex=$g.Nodes.Item($j);@{index=$j;editingType=[int]$vertex.EditingType;segmentType=[int]$vertex.SegmentType;points=@($vertex.Points)}})}
    $items+=,$record
   }
   $rows.Add(@{kind=$job.kind;slide=$job.slide;layout=[string]$sa.Layout.Id;frame=@{left=$shape.Left;top=$shape.Top;width=$shape.Width;height=$shape.Height};nodes=$nodes;items=$items})
  }|Out-Null
 }
 Invoke-OpfNativeStage $latch 'close-owned-seed' {[void](Close-OpfOwnedPresentation $presentation $copy)}|Out-Null
 Invoke-OpfNativeStage $latch 'quit-empty-owned-app' {if($app.Presentations.Count -eq 0){$app.Quit()}}|Out-Null
}finally{
 $after=Get-OpfFileSha256 $Seeds;$copyAfter=Get-OpfFileSha256 $copy
 @{passed=((-not $latch.failed)-and $after -eq $hash -and $copyAfter -eq $hash);failure=$latch.reason;source=$Seeds;sha256=$hash;sha256After=$after;copySha256After=$copyAfter;stages=@($latch.stages.ToArray());cases=@($rows.ToArray())}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
 # No Office cleanup after a failed stage. Source and copy remain preserved.
}
