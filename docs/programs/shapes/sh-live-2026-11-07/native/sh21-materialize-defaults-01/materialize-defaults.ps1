# SH21 coordinator diagnostic: create native defaults in one visible owned presentation. No Sync, text edits or layout replacement.
param([Parameter(Mandatory=$true)][string]$Seeds,[Parameter(Mandatory=$true)][string]$Out,[Parameter(Mandatory=$true)][string]$NativeHelpersPath,[switch]$PlanOnly)
$ErrorActionPreference='Stop'
. $NativeHelpersPath
$Seeds=[IO.Path]::GetFullPath($Seeds);$Out=[IO.Path]::GetFullPath($Out)
if(Test-Path -LiteralPath $Out){throw 'Preserve prior evidence: select a fresh Out directory.'}
if(-not(Test-Path -LiteralPath $Seeds -PathType Leaf)){throw 'Seed source is missing.'}
$hash=Get-OpfFileSha256 $Seeds
$jobs=@(@{kind='orgChart1';slide=14},@{kind='hierarchy1';slide=15},@{kind='venn1';slide=12})
if($PlanOnly){@{scope='Plan only. No output or Office object.';source=$Seeds;sha256=$hash;jobs=$jobs;ownership=@('owned-seeds.pptx','owned-defaults.pptx');derivative='native-defaults-saved.pptx'}|ConvertTo-Json -Depth 5;return}
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint is already running; no Office object created.'}
[void](New-Item -ItemType Directory -Path $Out)
$copy=Join-Path $Out 'owned-seeds.pptx';$owned=Join-Path $Out 'owned-defaults.pptx';$saved=Join-Path $Out 'native-defaults-saved.pptx'
Copy-Item -LiteralPath $Seeds -Destination $copy
if((Get-OpfFileSha256 $copy) -ne $hash){throw 'Owned source copy hash mismatch.'}
$latch=New-OpfNativeLatch;$rows=New-Object 'System.Collections.Generic.List[object]';$app=$null;$seed=$null;$pres=$null;$savedHash=$null
function Read-OpfNativeDefault($Shape,[string]$Kind){
   $sa=$shape.SmartArt;$nodes=@();$items=@()
   for($n=1;$n -le $sa.AllNodes.Count;$n++){
    $node=$sa.AllNodes.Item($n);$level=[int]$node.Level;$parentText=$null
    if($level -gt 1){$parentText=[string]$node.ParentNode.TextFrame2.TextRange.Text}
    $record=@{index=$n;text=[string]$node.TextFrame2.TextRange.Text;level=$level;type=[int]$node.Type;children=$node.Nodes.Count;parent=$parentText}
    if($Kind -eq 'orgChart1'){$record.orgChartLayout=[int]$node.OrgChartLayout}
    $nodes+=,$record
   }
   for($k=1;$k -le $shape.GroupItems.Count;$k++){
    $g=$shape.GroupItems.Item($k);$record=@{index=$k;shapeType=[int]$g.Type;preset=[int]$g.AutoShapeType;left=[double]$g.Left;top=[double]$g.Top;width=[double]$g.Width;height=[double]$g.Height;rotation=[double]$g.Rotation;fillType=[int]$g.Fill.Type;transparency=[double]$g.Fill.Transparency}
    if($g.HasTextFrame -eq -1 -and $g.TextFrame2.HasText -eq -1){$record.text=[string]$g.TextFrame2.TextRange.Text;$record.size=$g.TextFrame2.TextRange.Font.Size}
    if($g.Type -eq 5){$record.points=@(for($j=1;$j -le $g.Nodes.Count;$j++){$vertex=$g.Nodes.Item($j);@{index=$j;editingType=[int]$vertex.EditingType;segmentType=[int]$vertex.SegmentType;points=@($vertex.Points)}})}
    $items+=,$record
   }

 return @{layout=[string]$sa.Layout.Id;frame=@{left=$shape.Left;top=$shape.Top;width=$shape.Width;height=$shape.Height};rawGroupItems=$shape.GroupItems.Count;nodes=$nodes;items=$items}
}
try{
 $app=Invoke-OpfNativeStage $latch 'create-app' {New-Object -ComObject PowerPoint.Application}
 Invoke-OpfNativeStage $latch 'empty-visible-minimized' {if($app.Presentations.Count -ne 0){throw 'An existing presentation appeared; refusing.'};$app.Visible=-1;$app.WindowState=2}|Out-Null
 $seed=Invoke-OpfNativeStage $latch 'open-owned-seed-copy' {$app.Presentations.Open([string]$copy,-1,0,-1)}
 $pres=Invoke-OpfNativeStage $latch 'create-visible-owned-presentation' {$app.Presentations.Add(-1)}
 Invoke-OpfNativeStage $latch 'save-owned-identity-first' {$pres.SaveAs([string]$owned,24);if([IO.Path]::GetFullPath([string]$pres.FullName) -ne $owned){throw 'Created presentation identity mismatch.'};$pres.PageSetup.SlideWidth=960;$pres.PageSetup.SlideHeight=540}|Out-Null
 foreach($job in $jobs){
  $row=@{kind=$job.kind};$rows.Add($row)
  Invoke-OpfNativeStage $latch ($job.kind+'-create-export-read-defaults') {
   if([IO.Path]::GetFullPath([string]$seed.FullName) -ne $copy -or [IO.Path]::GetFullPath([string]$pres.FullName) -ne $owned){throw 'Owned presentation identity mismatch.'}
   $layout=$null;$found=0;$seedSlide=$seed.Slides.Item($job.slide)
   for($k=1;$k -le $seedSlide.Shapes.Count;$k++){$candidate=$seedSlide.Shapes.Item($k);if($candidate.HasSmartArt -eq -1){$layout=$candidate.SmartArt.Layout;$found++}}
   if($found -ne 1 -or -not([string]$layout.Id).EndsWith('/'+$job.kind)){throw 'Seed layout identity mismatch.'}
   $slide=$pres.Slides.Add($pres.Slides.Count+1,12)
   $shape=$slide.Shapes.AddSmartArt($layout,20,20,600,400)
   $slide.Export((Join-Path $Out ($job.kind+'.png')),'PNG',1280,720)
   $row.measurement=Read-OpfNativeDefault $shape $job.kind
   if($row.measurement.rawGroupItems -lt 1){throw 'New native default has no materialized group after Export; partial facts only.'}
  }|Out-Null
 }
 Invoke-OpfNativeStage $latch 'save-measured-derivative' {$pres.SaveCopyAs([string]$saved,24)}|Out-Null
 $savedHash=Get-OpfFileSha256 $saved
 Invoke-OpfNativeStage $latch 'close-only-owned-presentations' {if([IO.Path]::GetFullPath([string]$pres.FullName) -ne $owned){throw 'Owned output identity mismatch.'};$pres.Saved=-1;[void](Close-OpfOwnedPresentation $pres $owned);[void](Close-OpfOwnedPresentation $seed $copy)}|Out-Null
 Invoke-OpfNativeStage $latch 'quit-empty-owned-app' {if($app.Presentations.Count -ne 0){throw 'Another presentation remains; not quitting Office.'};$app.Quit()}|Out-Null
}finally{
 $after=Get-OpfFileSha256 $Seeds;$copyAfter=Get-OpfFileSha256 $copy
 @{passed=((-not $latch.failed)-and $after -eq $hash -and $copyAfter -eq $hash);failure=$latch.reason;source=$Seeds;sha256=$hash;sha256After=$after;copySha256After=$copyAfter;stages=@($latch.stages.ToArray());cases=@($rows.ToArray());saved=$saved;savedSha256=$savedHash}|ConvertTo-Json -Depth 15|Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
 # On any failed Office stage no later Office cleanup call is made. Coordinator owns exact-path cleanup.
}
