# Definitions only. A separately bound org-only capability route, never an edit gate.
function Add-Sh21ShapeFinding($Record,[string]$Code,[int]$NodeIndex=0,[int]$ShapeIndex=0) {
    $Record.findings+=@([ordered]@{code=$Code;nativeNodeIndex=$NodeIndex;shapeIndex=$ShapeIndex});Write-SevenReport
}
# Same fault-aware property invocation as the maintained shared reader, but only
# these additional read-only node-shape/text/font properties. No reflection scan.
function Read-Sh21ShapeProperty($Object,[string]$Property,[string]$Stage) {
    if($Property -cnotin @('Connector','TextFrame2','TextRange','Font','Size','Bold','Italic')){Stop-SevenLifecycle 'Property is outside the closed node Shapes descriptor list'}
    return ,(Invoke-SevenCom $Stage {if($null -eq $Object){throw 'Missing owned node Shape object'};$member=$Object.PSObject.Properties[$Property];if($null -eq $member){throw "Missing node Shapes property $Property"};return ,$member.get_Value()})
}
function Read-Sh21NodeShapesCapability($Target,$Plan) {
    Assert-Sh21Plan $Plan
    Assert-SevenProbe ($Plan.caseId -ceq 'org-chart-3') 'capability.case' 'org-chart-3' $Plan.caseId
    Assert-Sh21Owner $Target 'capability.capture.owner'
    $png=Join-Path $script:root 'capability.png';Assert-SevenProbe (-not(Test-Path -LiteralPath $png)) 'capability.png.fresh' $false (Test-Path -LiteralPath $png)
    Invoke-SevenCom 'capability.export' {$Target.slide.Export($png,'PNG',1280,720)}
    $record=[ordered]@{nodes=@();semanticToNativeIndex=@();frame=[ordered]@{};ranges=@();findings=@();raster=[ordered]@{path=$png;sha256=(Get-SevenHash $png)};geometryAcceptance=$false;connectorCoverage='unproven'}
    $script:report.phases['capability']=$record;Write-SevenReport
    $nodes=Read-Sh21Nodes $Target $Plan 'capability' 'before' $record
    foreach($property in @('Left','Top','Width','Height')){$v=Read-SevenProperty $Target.shape $property "capability.frame.$property";$record.frame[$property]=Get-SevenPrimitive $v;Write-SevenReport}
    $total=0
    for($i=1;$i -le 3;$i++){
        $p="capability.range.$i";$row=[ordered]@{nativeNodeIndex=$i;node=$null;status='pending';count=$null;items=@()};$record.ranges+=@($row);Write-SevenReport
        Assert-Sh21Owner $Target "$p.owner"
        $read=Read-Sh21Node $nodes $i "$p.node";$row.node=$read.row;Write-SevenReport
        foreach($key in @('index','text','level','parent','type','children')){Assert-SevenProbe ($read.row[$key] -ceq $record.nodes[$i-1][$key]) "$p.reread.$key" $record.nodes[$i-1][$key] $read.row[$key]}
        try{$range=Read-SevenProperty $read.node 'Shapes' "$p.shapes"}catch{$row.status='getter-fault';Add-Sh21ShapeFinding $record 'node-shapes-getter-fault' $i;throw}
        Assert-Sh21Owner $Target "$p.shapesOwner"
        if($null -eq $range){$row.status='unavailable';Add-Sh21ShapeFinding $record 'node-shapes-unavailable' $i;continue}
        $count=Read-SevenProperty $range 'Count' "$p.count";$row.count=Get-SevenPrimitive $count;Write-SevenReport;Assert-Sh21Owner $Target "$p.countOwner"
        if(-not(Test-SevenInteger $count) -or $count -lt 0 -or $count -gt (32-$total)){$row.status='bounded-stop';Add-Sh21ShapeFinding $record 'node-shapes-count-outside-total-bound' $i;break}
        if($count -eq 0){$row.status='empty';Add-Sh21ShapeFinding $record 'node-shapes-empty' $i;continue}
        $row.status='capturing';Write-SevenReport
        for($j=1;$j -le $count;$j++){
            $ip="$p.item.$j";$item=[ordered]@{index=$j};$row.items+=@($item);Write-SevenReport
            $shape=Invoke-SevenCom "$ip.get" {$range.Item($j)};Assert-Sh21Owner $Target "$ip.owner"
            foreach($property in @('Id','Name','Left','Top','Width','Height','Rotation','Type','HasTextFrame')){$v=Read-SevenProperty $shape $property "$ip.$property";$item[$property]=Get-SevenPrimitive $v;Write-SevenReport}
            $v=Read-Sh21ShapeProperty $shape 'Connector' "$ip.Connector";$item.Connector=Get-SevenPrimitive $v;$item.text=$null;$item.font=$null;Write-SevenReport
            if($item.HasTextFrame -eq -1){
                $frame=Read-Sh21ShapeProperty $shape 'TextFrame2' "$ip.frame";$textRange=Read-Sh21ShapeProperty $frame 'TextRange' "$ip.range";$v=Read-SevenProperty $textRange 'Text' "$ip.text";$item.text=Get-SevenPrimitive $v;Write-SevenReport
                $font=Read-Sh21ShapeProperty $textRange 'Font' "$ip.font";$item.font=[ordered]@{};Write-SevenReport
                foreach($property in @('Name','Size','Bold','Italic')){$v=if($property -ceq 'Name'){Read-SevenProperty $font $property "$ip.font.$property"}else{Read-Sh21ShapeProperty $font $property "$ip.font.$property"};$item.font[$property]=Get-SevenPrimitive $v;Write-SevenReport}
            }
            Assert-Sh21Owner $Target "$ip.finalOwner";$total++
        }
        $row.status='captured';Assert-Sh21Owner $Target "$p.finalOwner";Write-SevenReport
    }
    Add-Sh21ShapeFinding $record 'connector-coverage-unproven'
    Assert-Sh21Owner $Target 'capability.capture.finalOwner';Write-SevenReport
}
