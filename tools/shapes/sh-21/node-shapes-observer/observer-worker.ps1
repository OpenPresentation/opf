# SH21 read-only product baseline. Coordinator only, through Invoke-OpfNativeWorker with its owned deadline.
# This measures diagnostic live exports and sealed native-shape controls. It performs no edits and grants no eligibility.
param([Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$Out,[Parameter(Mandatory=$true)][string]$NativeHelpersPath,[string[]]$Only,[switch]$PlanOnly)
$ErrorActionPreference='Stop'
# NEVERMERGE. Read-only observations; no Office object is constructed here.
function Assert-OpfSH21ObserverDefinition($Definition) {
    if($Definition.observerManifestVersion -ne 1 -or $Definition.diagnosticOnly -isnot [bool] -or -not $Definition.diagnosticOnly -or $Definition.nativeAcceptance -isnot [bool] -or $Definition.nativeAcceptance) { throw 'Closed diagnostic manifest required' }
    $wanted=@{
        'venn-1'=@{count=1;live='bcf90fc7447075b8938bb0c51d27d458ec185a262f95a8febcf756ccb9f3cbad';native='440b81dd31258d534bd6ed5c9aa8a131d5d8aa60b00a285d90f2a66340efcdd4'}
        'venn-2'=@{count=2;live='1f055af76d369c341f4cfd46d33e928f38f8ad12e6e0136b8a51d480579f6e87';native='5df748361e43cfde88e5f38c569a3fb6a2a6980e2c1a1c75650fd3ffe041e048'}
    }
    if($Definition.cases -isnot [array] -or $Definition.cases.Count -ne 2) { throw 'Exactly the sealed Venn1 and Venn2 cases are required' }
    if($Definition.cases[0].id -cne 'venn-1' -or $Definition.cases[1].id -cne 'venn-2') { throw 'The sealed observation order is Venn1 then Venn2' }
    $seen=@{}
    foreach($spec in $Definition.cases) {
        if($spec.id -isnot [string] -or -not $wanted.ContainsKey($spec.id) -or $seen.ContainsKey($spec.id)) { throw 'Foreign or duplicate diagnostic case' }
        $seen[$spec.id]=$true;$expected=$wanted[$spec.id]
        if($spec.kind -cne 'venn' -or $spec.layoutId -cne 'urn:microsoft.com/office/officeart/2005/8/layout/venn1' -or $spec.count -isnot [int] -or $spec.count -ne $expected.count -or $spec.fontSize -ne 36) { throw 'Sealed Venn semantics changed' }
        if($spec.items -isnot [array] -or $spec.items.Count -ne $expected.count) { throw 'Sealed Venn labels changed' }
        for($i=0;$i -lt $expected.count;$i++) { if($spec.items[$i] -cne ('N'+($i+1))) { throw 'Sealed Venn label order changed' } }
        foreach($mode in @('live','native')) { $folder=if($mode -ceq 'live'){'pptx'}else{'pptx-shapes'};if($spec.$mode.file -cne ($folder+'/'+$spec.id+'.pptx') -or $spec.$mode.sha256 -cne $expected[$mode]) { throw 'Sealed archive identity changed' } }
    }
}
function Stop-OpfSH21Observer([string]$Message) {
    $script:observerStopped=$true
    if($null -ne $latch) { $latch.failed=$true;$latch.reason='observer: '+$Message }
    throw $Message
}
function Invoke-OpfSH21ObserverRead([string]$Name,[scriptblock]$Getter,[string]$Kind,[int]$Maximum=30) {
    if($script:observerStopped -or ($null -ne $latch -and $latch.failed)) { throw 'Observer read refused after the failure latch' }
    $row=[ordered]@{name=$Name;kind=$Kind;observed=$null;status='begin';failure=$null}
    $script:observerQueries.Add($row)
    try {
        $value=& $Getter
        if($null -eq $value -or $value -is [ValueType] -or $value -is [string]) { $row.observed=$value } else { $row.observed='Object reference or nonprimitive value; never serialized' }
        $integer=$value -is [int] -or $value -is [long] -or $value -is [int16]
        $numeric=$integer -or $value -is [double] -or $value -is [single] -or $value -is [decimal]
        $valid=switch($Kind) {
            'count' { $integer -and $value -ge 0 -and $value -le $Maximum }
            'integer' { $integer -and $value -ge 0 }
            'number' { $numeric -and -not [double]::IsNaN([double]$value) -and -not [double]::IsInfinity([double]$value) }
            'string' { $value -is [string] -and $value.Length -le 2048 }
            'tristate' { $integer -and $value -in @(-1,0) }
            'object' { $null -ne $value -and $value -isnot [ValueType] -and $value -isnot [string] -and $value -isnot [array] }
            default { $false }
        }
        if(-not $valid) { throw ('Invalid or out-of-cap observer read: '+$Name) }
        $row.status='ok'
        return ,$value
    } catch {
        $row.status='failed';$row.failure=$_.Exception.Message
        Stop-OpfSH21Observer $row.failure
    }
}
function Read-OpfSH21NodeShapeObservation($Shape,$SmartArt,$Expected,[int]$FirstDataCount,[int]$FirstGroupCount) {
    $probe=[ordered]@{id=$Expected.id;firstDataCount=$FirstDataCount;firstGroupCount=$FirstGroupCount;originalGuardWouldPass=($FirstDataCount -eq $Expected.count -and $FirstGroupCount -ge 1);nodes=@();totalNodeShapes=0;postProbeGroupCount=$null;status='begin';failure=$null;units='Native PowerPoint points; actual values only';nativeAcceptance=$false}
    $script:observerProbes.Add($probe)
    try {
        $nodes=Invoke-OpfSH21ObserverRead 'observer.nodes.get' { return ,$SmartArt.AllNodes } 'object'
        for($nodeIndex=1;$nodeIndex -le $FirstDataCount;$nodeIndex++) {
            $prefix='observer.node-'+$nodeIndex
            $nodeRecord=[ordered]@{index=$nodeIndex;text=$null;shapeCount=$null;shapes=@()};$probe.nodes+=@($nodeRecord)
            $node=Invoke-OpfSH21ObserverRead ($prefix+'.get') { return ,$nodes.Item($nodeIndex) } 'object'
            $nodeFrame=Invoke-OpfSH21ObserverRead ($prefix+'.textFrame.get') { return ,$node.TextFrame2 } 'object'
            $nodeText=Invoke-OpfSH21ObserverRead ($prefix+'.textRange.get') { return ,$nodeFrame.TextRange } 'object'
            $nodeRecord.text=Invoke-OpfSH21ObserverRead ($prefix+'.text.get') { return ,$nodeText.Text } 'string'
            $range=Invoke-OpfSH21ObserverRead ($prefix+'.shapes.get') { return ,$node.Shapes } 'object'
            $shapeCount=Invoke-OpfSH21ObserverRead ($prefix+'.shapes.count') { return ,$range.Count } 'count' 30
            $nodeRecord.shapeCount=$shapeCount
            $probe.totalNodeShapes=Invoke-OpfSH21ObserverRead ($prefix+'.totalShapeCap') { return ,($probe.totalNodeShapes+$shapeCount) } 'count' 30
            for($shapeIndex=1;$shapeIndex -le $shapeCount;$shapeIndex++) {
                $shapePrefix=$prefix+'.shape-'+$shapeIndex
                $native=Invoke-OpfSH21ObserverRead ($shapePrefix+'.get') { return ,$range.Item($shapeIndex) } 'object'
                $record=[ordered]@{index=$shapeIndex};$nodeRecord.shapes+=@($record)
                foreach($property in @('Id','Type','Name','Left','Top','Width','Height','Rotation')) {
                    $kind=if($property -in @('Id','Type')){'integer'}elseif($property -ceq 'Name'){'string'}else{'number'}
                    $record[$property]=Invoke-OpfSH21ObserverRead ($shapePrefix+'.'+$property) { return ,$native.$property } $kind
                }
                $hasText=Invoke-OpfSH21ObserverRead ($shapePrefix+'.hasTextFrame') { return ,$native.HasTextFrame } 'tristate'
                $record.hasTextFrame=$hasText
                if($hasText -eq -1) {
                    $frame=Invoke-OpfSH21ObserverRead ($shapePrefix+'.textFrame.get') { return ,$native.TextFrame2 } 'object'
                    $text=Invoke-OpfSH21ObserverRead ($shapePrefix+'.textRange.get') { return ,$frame.TextRange } 'object'
                    $record.text=Invoke-OpfSH21ObserverRead ($shapePrefix+'.text.get') { return ,$text.Text } 'string'
                }
            }
        }
        # One predetermined second observation, never a readiness poll or a replacement for the first count.
        $probe.postProbeGroupCount=Invoke-OpfSH21ObserverRead 'observer.groups.postProbeCount' { return ,$Shape.GroupItems.Count } 'count' 30
        if($FirstGroupCount -gt 0 -and $probe.postProbeGroupCount -ne $FirstGroupCount) { Stop-OpfSH21Observer 'The native group count changed during the observation probe' }
        $probe.status='collected'
        return ,$probe
    } catch {
        $probe.status='failed';$probe.failure=$_.Exception.Message
        throw
    }
}

if((Get-FileHash -LiteralPath $NativeHelpersPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne "fbe78773d0baf70bbb17fba75f08dd483ec596f9ae638b5c5be3885591b6057c") { throw "Frozen native helper identity changed" }
. $NativeHelpersPath
$Manifest=[IO.Path]::GetFullPath($Manifest);$Out=[IO.Path]::GetFullPath($Out)
if(Test-Path -LiteralPath $Out){throw 'Preserve prior evidence: select a fresh Out directory.'}
$definition=Get-Content -LiteralPath $Manifest -Raw|ConvertFrom-Json;$sourceRoot=Split-Path -Parent $Manifest
Assert-OpfSH21ObserverDefinition $definition
$known=@('venn-1','venn-2')
if($definition.cases.Count -ne 2 -or @($definition.cases|ForEach-Object {$_.id}|Select-Object -Unique).Count -ne 2){throw 'Expected exactly two sealed diagnostic cases.'}
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
if($Only -and (($Only -join '|') -cne 'venn-1|venn-2')) { throw 'The observation diagnostic requires the complete Venn1 then Venn2 pair' }
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
 $rawDataCount=Invoke-OpfSH21ObserverRead 'observer.firstDataCount' { return ,$sa.AllNodes.Count } 'count' 2
 $rawGroupCount=Invoke-OpfSH21ObserverRead 'observer.firstGroupCount' { return ,$Shape.GroupItems.Count } 'count' 30
 # DEFERRED GUARD: collect one bounded observation, then retain the ORIGINAL first-count guard below.
 $null=Read-OpfSH21NodeShapeObservation $Shape $sa $Expected $rawDataCount $rawGroupCount
 if($rawDataCount -ne $Expected.count -or $rawGroupCount -lt 1){throw "Native count/materialization mismatch: expected $($Expected.count) data nodes; observed $rawDataCount data nodes and $rawGroupCount group items."}
 $nodes=@();$wantedParents=@{};$stack=@();$tree=@('org-chart','hierarchy') -contains [string]$Expected.kind
 foreach($entry in $Expected.items){$text=if($entry -is [string]){[string]$entry}else{[string]$entry.text};$level=if($tree){[int]$entry.level}else{0};$parent=if($level -gt 0){[string]$stack[$level-1]}else{$null};$wantedParents[$text]=@{level=$level+1;parent=$parent};if($stack.Count -le $level){$stack+=,$text}else{$stack[$level]=$text}}
 for($nodeIndex=1;$nodeIndex -le $sa.AllNodes.Count;$nodeIndex++){
  $node=$sa.AllNodes.Item($nodeIndex);$text=[string]$node.TextFrame2.TextRange.Text;$level=[int]$node.Level;$parent=if($level -gt 1){[string]$node.ParentNode.TextFrame2.TextRange.Text}else{$null};$wanted=$wantedParents[$text]
  if($null -eq $wanted -or $level -ne $wanted.level -or $parent -ne $wanted.parent -or [int]$node.Type -ne 1){throw 'Native parent/text/level semantics differ from the source.'}
  $nodes+=,@{index=$nodeIndex;text=$text;level=$level;parent=$parent;type=[int]$node.Type;children=$node.Nodes.Count}
 }
 return @{layout=[string]$sa.Layout.Id;layoutName=[string]$sa.Layout.Name;nodes=$nodes.Count;dataNodes=$nodes;frame=@{left=$Shape.Left;top=$Shape.Top;width=$Shape.Width;height=$Shape.Height};items=@(for($groupIndex=1;$groupIndex -le $Shape.GroupItems.Count;$groupIndex++){Read-OpfSH21Shape $Shape.GroupItems.Item($groupIndex)})}
}
$script:observerQueries=New-Object 'System.Collections.Generic.List[object]'
$script:observerProbes=New-Object 'System.Collections.Generic.List[object]'
$script:observerStopped=$false
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
   $null=Invoke-OpfSH21ObserverRead ($witnessInput.id+'-'+$witnessInput.mode+'-topShapeCount') { return ,$slide.Shapes.Count } 'count' 30
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
 @{observerQueries=@($script:observerQueries.ToArray());observerProbes=@($script:observerProbes.ToArray());nativeAcceptance=$false;passed=$passed;scope='Bounded read-only observation diagnostic; first-count guard retained, no native acceptance';failure=$latch.reason;inputs=$inputs;controls=@($controls.ToArray());stages=@($latch.stages.ToArray())}|ConvertTo-Json -Depth 24|Set-Content -LiteralPath (Join-Path $Out 'witness.json') -Encoding UTF8
 @($controls.ToArray()|Where-Object {$_.mode -eq 'live'}|ForEach-Object {@{file=$_.id;slides=@(@{index=1;smartArt=$_.smartArt})}})|ConvertTo-Json -Depth 24|Set-Content -LiteralPath (Join-Path $Out 'ppt/probe.json') -Encoding UTF8
 # A failed Office stage latches. No later Office cleanup calls are made; the coordinator owns exact-path cleanup.
}
