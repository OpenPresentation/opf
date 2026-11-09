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
