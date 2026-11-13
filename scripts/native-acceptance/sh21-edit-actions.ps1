# Definitions only. No COM factory, process query, cleanup or executable entry.
# Import only after exact source binding, with the maintained Seven functions.
function Assert-Sh21OfficeIdle {
    $count=Invoke-SevenCom 'preflight.globalIdle' {try{return @(Get-Process -Name POWERPNT -ErrorAction Stop).Count}catch{if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return 0};throw}}
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) 'preflight.globalIdle' 0 $count
}
function Assert-Sh21Plan($Plan) {
    $fields=@('schemaVersion','profile','caseId','kind','inputSha256','shapeId','shapeName','layoutId','slideCount','sourceFontSize','before','after','operations','nativeAcceptance','registryAcceptance')
    if($null -eq $Plan -or (($Plan.PSObject.Properties.Name|Sort-Object)-join '|') -cne (($fields|Sort-Object)-join '|')){Stop-SevenLifecycle 'Closed SH21 plan fields required'}
    $layouts=@{'org-chart-3'='orgChart1';'hierarchy-3'='hierarchy1';'venn-3'='venn1'}
    $hashes=@{'org-chart-3'='098581b8ddf53f8fc035cd3fb7164e7605977e702a79db494c5160e98c761c7b';'hierarchy-3'='7f8130b1251ba803d26055f7b4f779ad14c7ee42117fd6e35227e352997f88ca';'venn-3'='d5c3996d89c1ac7b442b65cc6fe81b5985813d36d3df17f5e7f85355e5450db8'}
    if($Plan.caseId -isnot [string] -or -not $layouts.ContainsKey($Plan.caseId)){Stop-SevenLifecycle 'Only three historical diagnostic SH21 inputs admitted'}
    $kind=$Plan.caseId.Substring(0,$Plan.caseId.Length-2);$tree=$kind -cne 'venn'
    foreach($name in @('kind','inputSha256','shapeName','layoutId')){if($Plan.$name -isnot [string]){Stop-SevenLifecycle 'SH21 plan strings must be typed'}}
    foreach($name in @('schemaVersion','shapeId','slideCount','sourceFontSize')){if(-not(Test-SevenInteger $Plan.$name)){Stop-SevenLifecycle 'SH21 plan integers must be typed'}}
    if($Plan.profile -cne 'sh21-three-case-node-and-text-edit-v1' -or $Plan.schemaVersion -ne 1 -or $Plan.kind -cne $kind -or $Plan.inputSha256 -cne $hashes[$Plan.caseId] -or $Plan.layoutId -cne ('urn:microsoft.com/office/officeart/2005/8/layout/'+$layouts[$Plan.caseId]) -or $Plan.shapeId -ne 2 -or $Plan.shapeName -cne 'OPF smartart slides.0.items' -or $Plan.slideCount -ne 1 -or $Plan.sourceFontSize -ne 36 -or $Plan.nativeAcceptance -isnot [bool] -or $Plan.nativeAcceptance -or $Plan.registryAcceptance -isnot [bool] -or $Plan.registryAcceptance){Stop-SevenLifecycle 'SH21 plan differs from closed diagnostic contract'}
    $before=if($tree){@('Lead','Build','Ship')}else{@('N1','N2','N3')};$after=if($tree){@('Lead','Craft','Ship','Grow')}else{@('N1','E2','N3','N4')}
    foreach($pair in @(@('before',$before),@('after',$after))){
        $rows=$Plan.($pair[0]);$texts=$pair[1]
        if($rows -isnot [array] -or $rows.Count -ne $texts.Count){Stop-SevenLifecycle 'Exact three/four-node arrays required'}
        for($i=0;$i -lt $rows.Count;$i++){
            $r=$rows[$i];$level=if($tree -and $i -gt 0){2}else{1};$parent=if($level -eq 2){'Lead'}else{$null};$children=if($tree -and $i -eq 0){$rows.Count-1}else{0}
            if((($r.PSObject.Properties.Name|Sort-Object)-join '|') -cne 'children|index|level|parent|text|type' -or -not(Test-SevenInteger $r.index) -or $r.index -ne $i+1 -or $r.text -isnot [string] -or $r.text -cne $texts[$i] -or -not(Test-SevenInteger $r.level) -or $r.level -ne $level -or $r.parent -cne $parent -or -not(Test-SevenInteger $r.type) -or $r.type -ne 1 -or -not(Test-SevenInteger $r.children) -or $r.children -ne $children){Stop-SevenLifecycle 'SH21 graph is outside closed original/edited outline'}
        }
    }
    $wanted=@(@{op='set-existing-text';index=2;text=$after[1]},@{op='add-node';afterIndex=3;position=2;type=1},@{op='set-new-text';index=4;text=$after[3]})
    # Property order is not semantic; compare individual closed records.
    if($Plan.operations -isnot [array] -or $Plan.operations.Count -ne 3){Stop-SevenLifecycle 'Three fixed SH21 operations required'}
    for($i=0;$i -lt 3;$i++){$a=$Plan.operations[$i];$w=$wanted[$i];if((($a.PSObject.Properties.Name|Sort-Object)-join '|') -cne (($w.Keys|Sort-Object)-join '|')){Stop-SevenLifecycle 'Unknown SH21 operation field'};foreach($key in $w.Keys){if($null -eq $a.$key -or $a.$key.GetType() -ne $w[$key].GetType() -or $a.$key -cne $w[$key]){Stop-SevenLifecycle 'SH21 operation differs'}}}
}
function Assert-Sh21Owner($Target,[string]$Prefix) {
    if($script:stopped){throw 'SH21 stopped; no later Office operation'}
    Assert-SevenOwnedPresentation "$Prefix.ownership"
    $same={return ($null -ne $Target -and [object]::ReferenceEquals($Target.app,$script:app) -and [object]::ReferenceEquals($Target.app,$script:ownedApp) -and [object]::ReferenceEquals($Target.presentation,$script:presentation) -and [object]::ReferenceEquals($Target.presentation,$script:ownedPresentation) -and $Target.path -is [string] -and $Target.path -ceq $script:ownedPath)}
    Assert-SevenProbe (& $same) "$Prefix.capturedRefs" $true (& $same)
    $file=Read-SevenProperty $Target.presentation 'FullName' "$Prefix.fullName";Assert-SevenProbe (& $same) "$Prefix.fullName.refs" $true (& $same)
    Assert-SevenProbe ($file -is [string] -and $file -ceq $Target.path) "$Prefix.fullName" $Target.path (Get-SevenPrimitive $file)
    $ro=Read-SevenProperty $Target.presentation 'ReadOnly' "$Prefix.readOnly";Assert-SevenProbe (& $same) "$Prefix.readOnly.refs" $true (& $same)
    Assert-SevenProbe ((Test-SevenInteger $ro) -and $ro -eq -1) "$Prefix.readOnly" (-1) (Get-SevenPrimitive $ro)
}
function Get-Sh21Target($Plan,[string]$Prefix) {
    Assert-Sh21Plan $Plan
    $target=[pscustomobject]@{app=$script:app;presentation=$script:presentation;path=$script:ownedPath;slide=$null;shape=$null;smartArt=$null}
    Assert-Sh21Owner $target "$Prefix.owner"
    $slides=Read-SevenProperty $target.presentation 'Slides' "$Prefix.slides";$count=Read-SevenProperty $slides 'Count' "$Prefix.slides.count";Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 1) "$Prefix.slides.count" 1 $count
    $target.slide=Invoke-SevenCom "$Prefix.slide.get" {$slides.Item(1)};$shapes=Read-SevenProperty $target.slide 'Shapes' "$Prefix.shapes";$count=Read-SevenProperty $shapes 'Count' "$Prefix.shapes.count";Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 2) "$Prefix.shapes.count" 2 $count
    $matches=0
    for($i=1;$i -le 2;$i++){$shape=Invoke-SevenCom "$Prefix.shape.$i.get" {$shapes.Item($i)};$id=Read-SevenProperty $shape 'Id' "$Prefix.shape.$i.id";$name=Read-SevenProperty $shape 'Name' "$Prefix.shape.$i.name";if((Test-SevenInteger $id) -and $id -eq 2 -and $name -is [string] -and $name -ceq $Plan.shapeName){$matches++;$target.shape=$shape}}
    Assert-SevenProbe ($matches -eq 1) "$Prefix.target" 1 $matches
    $has=Invoke-SevenCom "$Prefix.hasSmartArt" {$target.shape.HasSmartArt};Assert-SevenProbe ((Test-SevenInteger $has) -and $has -eq -1) "$Prefix.hasSmartArt" (-1) $has
    $target.smartArt=Invoke-SevenCom "$Prefix.smartArt" {$target.shape.SmartArt};$layout=Invoke-SevenCom "$Prefix.layout" {$target.smartArt.Layout};$id=Invoke-SevenCom "$Prefix.layout.id" {$layout.Id};Assert-SevenProbe ($id -is [string] -and $id -ceq $Plan.layoutId) "$Prefix.layout.id" $Plan.layoutId (Get-SevenPrimitive $id)
    Assert-Sh21Owner $target "$Prefix.finalOwner";return $target
}
function Get-Sh21ExpectedNodes($Plan,[string]$State) {
    Assert-Sh21Plan $Plan
    if($State -cnotin @('before','middle','after')){Stop-SevenLifecycle 'Closed SH21 graph state required'}
    $rows=if($State -ceq 'after'){$Plan.after}else{$Plan.before};$result=@()
    foreach($r in $rows){$text=if($State -ceq 'middle' -and $r.index -eq 2){$Plan.after[1].text}else{$r.text};$result+=@([pscustomobject]@{index=$r.index;text=$text;level=$r.level;parent=$r.parent;type=$r.type;children=$r.children})}
    return ,$result
}
function Read-Sh21Node($Nodes,[int]$Index,[string]$Prefix) {
    $node=Invoke-SevenCom "$Prefix.get" {$Nodes.Item($Index)};$frame=Invoke-SevenCom "$Prefix.frame" {$node.TextFrame2};$range=Invoke-SevenCom "$Prefix.range" {$frame.TextRange};$text=Invoke-SevenCom "$Prefix.text" {$range.Text};$level=Invoke-SevenCom "$Prefix.level" {$node.Level};$type=Invoke-SevenCom "$Prefix.type" {$node.Type};$children=Invoke-SevenCom "$Prefix.children" {return ,$node.Nodes};$childCount=Invoke-SevenCom "$Prefix.children.count" {$children.Count}
    Assert-SevenProbe ($text -is [string] -and (Test-SevenInteger $type) -and $type -eq 1 -and (Test-SevenInteger $childCount) -and $childCount -ge 0 -and $childCount -le 3) "$Prefix.types" 'string text, type1 and bounded integer child count' ($text -is [string] -and $type -eq 1 -and (Test-SevenInteger $childCount) -and $childCount -ge 0 -and $childCount -le 3)
    Assert-SevenProbe ((Test-SevenInteger $level) -and $level -in @(1,2)) "$Prefix.level" 'native level1 or2' (Get-SevenPrimitive $level)
    $parent=$null
    # Root.ParentNode throws by documented contract; never call it for roots.
    if($level -eq 2){$p=Invoke-SevenCom "$Prefix.parent" {$node.ParentNode};$f=Invoke-SevenCom "$Prefix.parent.frame" {$p.TextFrame2};$r=Invoke-SevenCom "$Prefix.parent.range" {$f.TextRange};$parent=Invoke-SevenCom "$Prefix.parent.text" {$r.Text}}
    Assert-SevenProbe ($null -eq $parent -or $parent -is [string]) "$Prefix.parent.type" 'null or string' ($null -eq $parent -or $parent -is [string])
    return [pscustomobject]@{node=$node;range=$range;row=[ordered]@{index=$Index;text=(Get-SevenPrimitive $text);level=(Get-SevenPrimitive $level);parent=(Get-SevenPrimitive $parent);type=(Get-SevenPrimitive $type);children=(Get-SevenPrimitive $childCount)}}
}
function Set-Sh21NodeMap($Observation,$Expected,[string]$Prefix) {
    $Observation.semanticToNativeIndex=@();Write-SevenReport
    foreach($wanted in $Expected){
        $matches=@($Observation.nodes|Where-Object{$_.text -ceq $wanted.text -and $_.level -ceq $wanted.level -and $_.parent -ceq $wanted.parent -and $_.type -ceq $wanted.type -and $_.children -ceq $wanted.children})
        Assert-SevenProbe ($matches.Count -eq 1) "$Prefix.semantic.$($wanted.index).unique" 1 $matches.Count
        $index=$matches[0].index;Assert-SevenProbe ($Observation.semanticToNativeIndex -cnotcontains $index) "$Prefix.semantic.$($wanted.index).unused" $true ($Observation.semanticToNativeIndex -cnotcontains $index)
        $Observation.semanticToNativeIndex+=@($index);Write-SevenReport
    }
    Assert-SevenProbe ($Observation.semanticToNativeIndex.Count -eq $Observation.nodes.Count) "$Prefix.semantic.complete" $Observation.nodes.Count $Observation.semanticToNativeIndex.Count
}
function Read-Sh21Nodes($Target,$Plan,[string]$Phase,[string]$State,$Observation) {
    $expected=Get-Sh21ExpectedNodes $Plan $State;Assert-Sh21Owner $Target "$Phase.owner"
    $nodes=Invoke-SevenCom "$Phase.nodes" {return ,$Target.smartArt.AllNodes};$count=Invoke-SevenCom "$Phase.nodes.count" {$nodes.Count};Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq $expected.Count) "$Phase.nodes.count" $expected.Count $count
    $Observation.nodes=@();$Observation.semanticToNativeIndex=@();Write-SevenReport
    for($i=1;$i -le $expected.Count;$i++){$read=Read-Sh21Node $nodes $i "$Phase.node.$i";$Observation.nodes+=@($read.row);Write-SevenReport}
    # Complete raw collection rows are durable BEFORE any semantic-match refusal.
    Assert-Sh21Owner $Target "$Phase.finalOwner";Set-Sh21NodeMap $Observation $expected $Phase
    return ,$nodes
}
function Get-Sh21SemanticTarget($Target,$Nodes,$Observation,$Expected,[int]$SemanticIndex,[string]$Prefix,$Record) {
    Assert-Sh21Owner $Target "$Prefix.owner"
    $index=$Observation.semanticToNativeIndex[$SemanticIndex-1];$read=Read-Sh21Node $Nodes $index "$Prefix.node"
    $Record.targets+=@([ordered]@{semanticIndex=$SemanticIndex;node=$read.row});Write-SevenReport
    foreach($key in @('index','text','level','parent','type','children')){Assert-SevenProbe ($read.row[$key] -ceq $Observation.nodes[$index-1][$key]) "$Prefix.reread.$key" $Observation.nodes[$index-1][$key] $read.row[$key]}
    foreach($key in @('text','level','parent','type','children')){Assert-SevenProbe ($read.row[$key] -ceq $Expected[$SemanticIndex-1].$key) "$Prefix.expected.$key" $Expected[$SemanticIndex-1].$key $read.row[$key]}
    Assert-Sh21Owner $Target "$Prefix.finalOwner";return $read
}
function Invoke-Sh21Edit($Target,$Plan) {
    Assert-Sh21Plan $Plan
    if($script:report.actions.Count -ne 0){Stop-SevenLifecycle 'One closed SH21 edit plan only'}
    $record=[ordered]@{status='begin';textSetterAttempts=0;addNodeAttempts=0;newTextSetterAttempts=0;observations=[ordered]@{before=[ordered]@{nodes=@();semanticToNativeIndex=@()};beforeAdd=[ordered]@{nodes=@();semanticToNativeIndex=@()}};targets=@()};$script:report.actions+=@($record);Write-SevenReport
    $nodes=Read-Sh21Nodes $Target $Plan 'edit.before' 'before' $record.observations.before
    $selected=Get-Sh21SemanticTarget $Target $nodes $record.observations.before (Get-Sh21ExpectedNodes $Plan 'before') 2 'edit.node2' $record
    $range=$selected.range;Assert-Sh21Owner $Target 'edit.text.owner';$record.textSetterAttempts=1;Write-SevenReport
    Invoke-SevenCom 'edit.existingText.set' {$range.Text=$Plan.after[1].text}
    Assert-Sh21Owner $Target 'edit.text.afterOwner'
    # Reacquire the ACTUAL collection and identity mapping after the text change.
    $nodes=Read-Sh21Nodes $Target $Plan 'edit.beforeAdd' 'middle' $record.observations.beforeAdd
    $selected=Get-Sh21SemanticTarget $Target $nodes $record.observations.beforeAdd (Get-Sh21ExpectedNodes $Plan 'middle') 3 'edit.node3' $record;$node3=$selected.node
    Assert-Sh21Owner $Target 'edit.add.owner';$record.addNodeAttempts=1;Write-SevenReport
    # Office msoSmartArtNodeAfter=2, msoSmartArtNodeTypeDefault=1.
    $added=Invoke-SevenCom 'edit.node.add' {$node3.AddNode(2,1)}
    Assert-SevenProbe ($null -ne $added) 'edit.node.returned' $true ($null -ne $added)
    Assert-Sh21Owner $Target 'edit.add.afterOwner'
    $frame=Invoke-SevenCom 'edit.new.frame' {$added.TextFrame2};$range=Invoke-SevenCom 'edit.new.range' {$frame.TextRange}
    Assert-Sh21Owner $Target 'edit.newText.owner';$record.newTextSetterAttempts=1;Write-SevenReport
    Invoke-SevenCom 'edit.newText.set' {$range.Text=$Plan.after[3].text}
    $record.status='edited';Write-SevenReport
}
function Read-Sh21Phase($Target,$Plan,[string]$Phase,[bool]$Edited) {
    Assert-Sh21Owner $Target "$Phase.capture.owner"
    $png=Join-Path $script:root "$Phase.png";Assert-SevenProbe (-not(Test-Path -LiteralPath $png)) "$Phase.png.fresh" $false (Test-Path -LiteralPath $png)
    # Export first materializes SmartArt; no Visible/WindowState/UI workaround.
    Invoke-SevenCom "$Phase.export" {$Target.slide.Export($png,'PNG',1280,720)}
    $record=[ordered]@{nodes=@();semanticToNativeIndex=@();frame=[ordered]@{};items=@();raster=[ordered]@{path=$png;sha256=(Get-SevenHash $png)}};$script:report.phases[$Phase]=$record;Write-SevenReport
    $state=if($Edited){'after'}else{'before'};[void](Read-Sh21Nodes $Target $Plan $Phase $state $record)
    foreach($property in @('Left','Top','Width','Height')){$value=Read-SevenProperty $Target.shape $property "$Phase.frame.$property";Assert-SevenProbe (Test-SevenFiniteNumber $value) "$Phase.frame.$property.finite" 'finite' (Get-SevenPrimitive $value);$record.frame[$property]=Get-SevenPrimitive $value}
    $group=Invoke-SevenCom "$Phase.group" {return ,$Target.shape.GroupItems};$count=Invoke-SevenCom "$Phase.group.count" {$group.Count}
    # Dedicated bounded descriptor capture, not a legacy worker cap expansion.
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -ge 1 -and $count -le 32) "$Phase.group.count" '1..32 materialized items' (Get-SevenPrimitive $count)
    for($i=1;$i -le $count;$i++){
        $shape=Invoke-SevenCom "$Phase.item.$i.get" {$group.Item($i)};$item=[ordered]@{index=$i}
        foreach($property in @('Left','Top','Width','Height','Rotation','Type','HasTextFrame')){$v=Read-SevenProperty $shape $property "$Phase.item.$i.$property";Assert-SevenProbe (Test-SevenFiniteNumber $v) "$Phase.item.$i.$property.finite" 'finite' (Get-SevenPrimitive $v);$item[$property]=Get-SevenPrimitive $v}
        $item.text=$null;$item.fontSize=$null
        if($item.HasTextFrame -eq -1){$f=Invoke-SevenCom "$Phase.item.$i.frame" {$shape.TextFrame2};$r=Invoke-SevenCom "$Phase.item.$i.range" {$f.TextRange};$text=Invoke-SevenCom "$Phase.item.$i.text" {$r.Text};Assert-SevenProbe ($text -is [string]) "$Phase.item.$i.text.string" 'string' (Get-SevenPrimitive $text);$item.text=$text;$font=Invoke-SevenCom "$Phase.item.$i.font" {$r.Font};$size=Invoke-SevenCom "$Phase.item.$i.font.size" {$font.Size};Assert-SevenProbe (Test-SevenFiniteNumber $size) "$Phase.item.$i.font.size.finite" 'finite' (Get-SevenPrimitive $size);$item.fontSize=Get-SevenPrimitive $size}
        $record.items+=@($item)
    }
    Assert-Sh21Owner $Target "$Phase.capture.finalOwner"
    $script:report.phases[$Phase]=$record;Write-SevenReport
}
