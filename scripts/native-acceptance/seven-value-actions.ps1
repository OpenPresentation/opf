# Definitions only. A separately bound prospective worker imports the exact maintained Seven lifecycle functions first.
# No entrypoint, workbook/Excel/UI access, process factory or classic-policy change is present here.
function Assert-SevenValueAction($Action) {
    $allowed=@('op','slideIndex','shapeId','shapeName','branch','sourceType','comChartType','seriesIndex','maxSeriesCount','seriesName','chartPart','chartFamily','dataId','dimensionIndex','layoutId','dataFormula','workbookPart','worksheet','workbookCells','pointIndex','expectedValues','newValues','inputSha256','sourceModelSha256')
    if($null -eq $Action) {Stop-SevenLifecycle 'Missing prospective value action'}
    $names=@($Action.PSObject.Properties.Name)
    if($names.Count -ne $allowed.Count) {Stop-SevenLifecycle 'Prospective value action field count differs'}
    foreach($name in $names) {if($name -cnotin $allowed) {Stop-SevenLifecycle 'Unknown prospective value action field'}}
    if($Action.op -cne 'set-seven-series-values' -or -not (Test-SevenInteger $Action.slideIndex) -or $Action.slideIndex -lt 1 -or $Action.slideIndex -gt 7 -or -not (Test-SevenInteger $Action.shapeId) -or $Action.shapeId -le 0 -or -not (Test-SevenInteger $Action.seriesIndex) -or $Action.seriesIndex -ne 1) {Stop-SevenLifecycle 'Invalid exact value target'}
    $types=@{treemap=117;histogram=118;pareto=122;'box-and-whisker'=121;waterfall=119;funnel=123;world=51}
    if($Action.sourceType -isnot [string] -or @($types.Keys) -cnotcontains $Action.sourceType -or -not (Test-SevenInteger $Action.comChartType) -or $Action.comChartType -ne $types[$Action.sourceType]) {Stop-SevenLifecycle 'Prospective native type differs'}
    $expectedCount=if($Action.sourceType -ceq 'pareto'){2}else{1}
    if(-not (Test-SevenInteger $Action.maxSeriesCount) -or $Action.maxSeriesCount -ne $expectedCount) {Stop-SevenLifecycle 'Series bound differs from admitted XML owner/derived count'}
    if($Action.sourceType -ceq 'world') {
        if($Action.branch -cne 'direct' -or $Action.chartFamily -cne 'classic' -or $null -ne $Action.dataId -or $null -ne $Action.dimensionIndex -or $null -ne $Action.layoutId) {Stop-SevenLifecycle 'World must remain honestly labeled classic fallback, without native metadata'}
    } else {
        $layouts=@{treemap='treemap';histogram='clusteredColumn';pareto='clusteredColumn';'box-and-whisker'='boxWhisker';waterfall='waterfall';funnel='funnel'}
        if($Action.branch -cne 'choice' -or $Action.chartFamily -cne 'chartEx' -or $Action.dataId -isnot [string] -or [string]::IsNullOrEmpty($Action.dataId) -or $Action.dataId -match '[\x00-\x1f]' -or -not (Test-SevenInteger $Action.dimensionIndex) -or $Action.dimensionIndex -lt 0 -or $Action.layoutId -isnot [string] -or $Action.layoutId -cne $layouts[$Action.sourceType]) {Stop-SevenLifecycle 'Native ChartEx choice and exact typed owner metadata required'}
    }
    foreach($name in @('shapeName','seriesName','chartPart','dataFormula','workbookPart','worksheet')) {if($Action.$name -isnot [string] -or [string]::IsNullOrEmpty($Action.$name) -or $Action.$name -match '[\x00-\x1f]') {Stop-SevenLifecycle 'Invalid bound value string'}}
    foreach($name in @('inputSha256','sourceModelSha256')) {if($Action.$name -isnot [string] -or $Action.$name -cnotmatch '^[a-f0-9]{64}$') {Stop-SevenLifecycle 'Invalid value source digest'}}
    if($Action.seriesName.Length -gt 255) {Stop-SevenLifecycle 'Bound literal series name exceeds admitted maximum'}
    if($Action.expectedValues -isnot [array] -or $Action.newValues -isnot [array] -or $Action.expectedValues.Rank -ne 1 -or $Action.newValues.Rank -ne 1 -or $Action.expectedValues.Count -lt 1 -or $Action.expectedValues.Count -gt 4 -or $Action.expectedValues.Count -ne $Action.newValues.Count) {Stop-SevenLifecycle 'Value arrays exceed actual four-value corpus bound or change length'}
    if(-not (Test-SevenInteger $Action.pointIndex) -or $Action.pointIndex -lt 1 -or $Action.pointIndex -gt $Action.expectedValues.Count) {Stop-SevenLifecycle 'Invalid one-based point index'}
    if($Action.workbookCells -isnot [array] -or $Action.workbookCells.Rank -ne 1 -or $Action.workbookCells.Count -ne $Action.expectedValues.Count) {Stop-SevenLifecycle 'Bound workbook cells must match the numeric array length'}
    $seenCells=@{}
    foreach($cell in $Action.workbookCells) {
        if($cell -isnot [string] -or $cell -cnotmatch '^[A-Z]+[1-9][0-9]*$' -or $seenCells.ContainsKey($cell)) {Stop-SevenLifecycle 'Workbook cell names must be distinct typed uppercase references'}
        $seenCells[$cell]=$true
    }
    $changed=0
    for($index=0;$index -lt $Action.expectedValues.Count;$index++) {
        if(-not (Test-SevenFiniteNumber $Action.expectedValues[$index]) -or -not (Test-SevenFiniteNumber $Action.newValues[$index])) {Stop-SevenLifecycle 'Only finite numeric array elements are admitted'}
        if([double]$Action.expectedValues[$index] -ne [double]$Action.newValues[$index]) {$changed++;if($index -ne ($Action.pointIndex-1)) {Stop-SevenLifecycle 'A nonselected numeric value changes'}}
    }
    if($changed -ne 1) {Stop-SevenLifecycle 'Exactly one meaningful numeric value must change'}
}
function Assert-SevenValueActionIdentity([string]$ActionModelSha256,$ActionFileIdentity) {
    if($ActionModelSha256 -cnotmatch '^[a-f0-9]{64}$' -or $null -eq $ActionFileIdentity) {Stop-SevenLifecycle 'Missing model or wire action identity'}
    $names=@($ActionFileIdentity.PSObject.Properties.Name)
    if($names.Count -ne 2) {Stop-SevenLifecycle 'Wire identity requires exactly bytes and sha256'}
    foreach($name in $names) {if($name -cnotin @('bytes','sha256')) {Stop-SevenLifecycle 'Unknown wire identity field'}}
    if(-not (Test-SevenInteger $ActionFileIdentity.bytes) -or $ActionFileIdentity.bytes -lt 1 -or $ActionFileIdentity.bytes -gt 4194304 -or $ActionFileIdentity.sha256 -isnot [string] -or $ActionFileIdentity.sha256 -cnotmatch '^[a-f0-9]{64}$') {Stop-SevenLifecycle 'Invalid exact action wire identity'}
}
function Assert-SevenValueTargetOwnership($Target,[string]$Prefix) {
    if($script:stopped) {throw 'Seven value operations already stopped'}
    Assert-SevenOwnedPresentation "$Prefix.ownership"
    $sameOwned={
        return ($null -ne $Target -and [object]::ReferenceEquals($Target.ownedApp,$script:app) -and [object]::ReferenceEquals($Target.ownedApp,$script:ownedApp) -and [object]::ReferenceEquals($Target.ownedPresentation,$script:presentation) -and [object]::ReferenceEquals($Target.ownedPresentation,$script:ownedPresentation) -and $Target.ownedPath -is [string] -and $script:ownedPath -is [string] -and $Target.ownedPath -ieq $script:ownedPath)
    }
    Assert-SevenProbe (& $sameOwned) "$Prefix.capturedRefs" 'same captured owned references/path' (& $sameOwned)
    $actualPath=Read-SevenProperty $Target.ownedPresentation 'FullName' "$Prefix.fullName"
    Assert-SevenProbe (& $sameOwned) "$Prefix.fullName.refs" 'same captured owned references/path' (& $sameOwned)
    Assert-SevenProbe ($actualPath -is [string] -and $actualPath -ieq $Target.ownedPath) "$Prefix.fullName" $Target.ownedPath (Get-SevenPrimitive $actualPath)
    $readOnly=Read-SevenProperty $Target.ownedPresentation 'ReadOnly' "$Prefix.readOnly"
    Assert-SevenProbe (& $sameOwned) "$Prefix.readOnly.refs" 'same captured owned references/path' (& $sameOwned)
    Assert-SevenProbe ((Test-SevenInteger $readOnly) -and $readOnly -eq -1) "$Prefix.readOnly" -1 (Get-SevenPrimitive $readOnly)
}
function Get-SevenValueTarget($Action,[string]$Prefix) {
    Assert-SevenValueAction $Action;Assert-SevenOwnedPresentation "$Prefix.ownership"
    $capturedApp=$script:app;$capturedPresentation=$script:presentation;$capturedPath=$script:ownedPath
    $actualPath=Read-SevenProperty $script:presentation 'FullName' "$Prefix.fullName"
    Assert-SevenProbe ($actualPath -is [string] -and $actualPath -ieq $script:ownedPath) "$Prefix.fullName" $script:ownedPath (Get-SevenPrimitive $actualPath)
    $readOnly=Read-SevenProperty $script:presentation 'ReadOnly' "$Prefix.readOnly"
    Assert-SevenProbe ((Test-SevenInteger $readOnly) -and $readOnly -eq -1) "$Prefix.readOnly" -1 (Get-SevenPrimitive $readOnly)
    $slides=Read-SevenProperty $script:presentation 'Slides' "$Prefix.slides";$count=Read-SevenProperty $slides 'Count' "$Prefix.slides.count"
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 7) "$Prefix.slides.count" 7 $count
    $slide=Invoke-SevenCom "$Prefix.slide.get" {$slides.Item([int]$Action.slideIndex)}
    $shapes=Read-SevenProperty $slide 'Shapes' "$Prefix.shapes";$shapeCount=Read-SevenProperty $shapes 'Count' "$Prefix.shapes.count"
    Assert-SevenProbe ((Test-SevenInteger $shapeCount) -and $shapeCount -ge 1 -and $shapeCount -le 3) "$Prefix.shapes.count" '1..3' $shapeCount
    $target=$null;$matches=0
    for($index=1;$index -le $shapeCount;$index++) {
        $shape=Invoke-SevenCom "$Prefix.shape.$index.get" {$shapes.Item($index)}
        $id=Read-SevenProperty $shape 'Id' "$Prefix.shape.$index.id";$name=Read-SevenProperty $shape 'Name' "$Prefix.shape.$index.name"
        if((Test-SevenInteger $id) -and $id -eq $Action.shapeId -and $name -is [string] -and $name -ceq $Action.shapeName) {$matches++;$target=$shape}
    }
    Assert-SevenProbe ($matches -eq 1) "$Prefix.exactTarget" 1 $matches
    $hasChart=Invoke-SevenCom "$Prefix.hasChart" {$target.HasChart};Assert-SevenProbe ((Test-SevenInteger $hasChart) -and $hasChart -eq -1) "$Prefix.hasChart" -1 $hasChart
    $chart=Invoke-SevenCom "$Prefix.chart" {$target.Chart};$type=Invoke-SevenCom "$Prefix.chart.type" {$chart.ChartType}
    Assert-SevenProbe ((Test-SevenInteger $type) -and $type -eq $Action.comChartType) "$Prefix.chart.type" $Action.comChartType $type
    $collection=Invoke-SevenCom "$Prefix.series" {return ,$chart.SeriesCollection()};$seriesCount=Invoke-SevenCom "$Prefix.series.count" {$collection.Count}
    Assert-SevenProbe ((Test-SevenInteger $seriesCount) -and $seriesCount -ge 1 -and $seriesCount -le $Action.maxSeriesCount) "$Prefix.series.count" "1..$($Action.maxSeriesCount)" $seriesCount
    $series=Invoke-SevenCom "$Prefix.series.item" {$collection.Item(1)};$name=Invoke-SevenCom "$Prefix.series.name" {$series.Name}
    Assert-SevenProbe ($name -is [string] -and $name -ceq $Action.seriesName) "$Prefix.series.name" $Action.seriesName (Get-SevenPrimitive $name)
    return [pscustomobject]@{series=$series;chartType=$type;seriesCount=$seriesCount;ownedApp=$capturedApp;ownedPresentation=$capturedPresentation;ownedPath=$capturedPath}
}
function Read-SevenValueArray($Target,[string]$Phase,$Probe) {
    Assert-SevenValueTargetOwnership $Target "value.$Phase.read"
    $raw=Invoke-SevenCom "value.$Phase.values.get" {return ,$Target.series.Values}
    $Probe.observedKind=if($null -eq $raw){'null'}elseif($raw -is [array]){'System.Array'}else{'unsupported-not-array'}
    $Probe.observedRank=$null;$Probe.observedLength=$null;$Probe.observedValues=@();Write-SevenReport
    if($raw -isnot [array]) {Stop-SevenLifecycle 'Native Values is not a managed SAFEARRAY observation'}
    $Probe.observedRank=$raw.Rank;$Probe.observedLength=$raw.Length;Write-SevenReport
    if($raw.Rank -ne 1 -or $raw.Length -lt 1 -or $raw.Length -gt 4) {Stop-SevenLifecycle 'Native Values rank/length exceeds admitted four-value corpus'}
    $lower=$raw.GetLowerBound(0);$values=New-Object 'System.Collections.Generic.List[object]'
    for($index=0;$index -lt $raw.Length;$index++) {
        $value=$raw.GetValue($lower+$index);$Probe.observedValues+=@((Get-SevenPrimitive $value));Write-SevenReport
        if(-not (Test-SevenFiniteNumber $value)) {Stop-SevenLifecycle 'Native Values contains an unavailable/nonfinite/nonnumeric element'}
        $values.Add([double]$value)
    }
    return ,$values.ToArray()
}
function Assert-SevenValueReadback($Actual,$Expected,[string]$Stage) {
    if($Actual -isnot [array] -or $Expected -isnot [array] -or $Actual.Length -ne $Expected.Length) {Stop-SevenLifecycle "$Stage array length differs"}
    for($index=0;$index -lt $Expected.Length;$index++) {Assert-SevenProbe ((Test-SevenFiniteNumber $Actual[$index]) -and (Test-SevenFiniteNumber $Expected[$index]) -and [double]$Actual[$index] -eq [double]$Expected[$index]) "$Stage.$index" $Expected[$index] (Get-SevenPrimitive $Actual[$index])}
}
function Set-SevenNumericArray($Action,[string]$ActionModelSha256,$ActionFileIdentity) {
    if($script:stopped) {throw 'Seven value operations already stopped'}
    Assert-SevenValueAction $Action
    Assert-SevenValueActionIdentity $ActionModelSha256 $ActionFileIdentity
    if($script:report.actions.Count -ne 0) {Stop-SevenLifecycle 'Exactly one source-bound action and one setter attempt are permitted'}
    $probe=[ordered]@{op=$Action.op;actionModelSha256=$ActionModelSha256;actionFileIdentity=[ordered]@{bytes=$ActionFileIdentity.bytes;sha256=$ActionFileIdentity.sha256};status='begin';setterAttempts=0;before=$null;after=$null;reopened=$null;observedKind=$null;observedRank=$null;observedLength=$null;observedValues=@()}
    $script:report.actions+=@($probe);Write-SevenReport
    $target=Get-SevenValueTarget $Action 'value.original.target'
    $before=Read-SevenValueArray $target 'original' $probe;$probe.before=$before;Write-SevenReport;Assert-SevenValueReadback $before $Action.expectedValues 'value.original.expected'
    Assert-SevenValueTargetOwnership $target 'value.setter'
    $probe.setterAttempts=1;Write-SevenReport
    Invoke-SevenCom 'value.series.values.set' {$target.series.Values=[object[]]$Action.newValues}
    $after=Read-SevenValueArray $target 'edited' $probe;$probe.after=$after;Write-SevenReport;Assert-SevenValueReadback $after $Action.newValues 'value.edited.expected'
    $probe.status='edited-readback-success';Write-SevenReport
}
function Read-SevenReopenedNumericArray($Action,[string]$ActionModelSha256,$ActionFileIdentity) {
    if($script:stopped) {throw 'Seven value operations already stopped'}
    Assert-SevenValueActionIdentity $ActionModelSha256 $ActionFileIdentity
    if($script:report.actions.Count -ne 1) {Stop-SevenLifecycle 'Missing/duplicate value action result'}
    $probe=$script:report.actions[0]
    if($probe.actionModelSha256 -cne $ActionModelSha256 -or $probe.actionFileIdentity.bytes -ne $ActionFileIdentity.bytes -or $probe.actionFileIdentity.sha256 -cne $ActionFileIdentity.sha256 -or $probe.setterAttempts -ne 1 -or $probe.status -cne 'edited-readback-success') {Stop-SevenLifecycle 'Reopened probe has no exact successful single setter/model/wire binding'}
    $target=Get-SevenValueTarget $Action 'value.saved-reopened.target';$values=Read-SevenValueArray $target 'saved-reopened' $probe;$probe.reopened=$values;Write-SevenReport
    Assert-SevenValueReadback $values $Action.newValues 'value.saved-reopened.expected';$probe.status='success';Write-SevenReport
}
