# Closed categorical histogram adaptation only. Historical ChartEx/118 guard is unchanged.
function Assert-SevenHistogramAction($Action) {
    $allowed=@('op','slideIndex','shapeId','shapeName','branch','sourceType','comChartType','seriesIndex','maxSeriesCount','seriesName','chartPart','chartFamily','dataId','dimensionIndex','layoutId','dataFormula','workbookPart','worksheet','workbookCells','pointIndex','expectedValues','newValues','inputSha256','sourceModelSha256')
    if($null -eq $Action -or $Action -isnot [pscustomobject] -or @($Action.PSObject.Properties.Name).Count -ne $allowed.Count){Stop-SevenLifecycle 'Exact classic histogram action required'}
    foreach($name in $Action.PSObject.Properties.Name){if($name -cnotin $allowed){Stop-SevenLifecycle 'Unknown classic histogram action field'}}
    foreach($entry in @(@('slideIndex',2),@('shapeId',3),@('comChartType',51),@('seriesIndex',1),@('maxSeriesCount',1),@('pointIndex',1))){if(-not(Test-SevenInteger $Action.($entry[0])) -or $Action.($entry[0]) -ne $entry[1]){Stop-SevenLifecycle 'Classic histogram integer target differs'}}
    $strings=@{op='set-seven-classic-histogram-values';shapeName='OPF chart 2';branch='direct';sourceType='histogram';seriesName='Value';chartPart='ppt/charts/chart2.xml';chartFamily='classic';dataFormula='Sheet1!$B$2:$B$5';worksheet='Sheet1'}
    foreach($key in $strings.Keys){if($Action.$key -isnot [string] -or $Action.$key -cne $strings[$key]){Stop-SevenLifecycle 'Classic histogram source/role differs'}}
    foreach($key in @('dataId','dimensionIndex','layoutId')){if($null -ne $Action.$key){Stop-SevenLifecycle 'Classic histogram cannot claim ChartEx metadata'}}
    if($Action.workbookPart -isnot [string] -or $Action.workbookPart -cnotmatch '^ppt/embeddings/Microsoft_Excel_Worksheet[0-9]*\.xlsx\z'){Stop-SevenLifecycle 'Actual bound histogram workbook required'}
    foreach($key in @('inputSha256','sourceModelSha256')){if($Action.$key -isnot [string] -or $Action.$key -cnotmatch '^[a-f0-9]{64}\z'){Stop-SevenLifecycle 'Histogram source digest differs'}}
    foreach($key in @('expectedValues','newValues','workbookCells')){if($Action.$key -isnot [array] -or $Action.$key.Rank -ne 1 -or $Action.$key.Length -ne 4){Stop-SevenLifecycle 'Exact four-value histogram arrays required'}}
    $before=@(42,31,-8,19);$after=@(43,31,-8,19);$cells=@('B2','B3','B4','B5')
    for($i=0;$i -lt 4;$i++){if(-not(Test-SevenFiniteNumber $Action.expectedValues[$i]) -or -not(Test-SevenFiniteNumber $Action.newValues[$i]) -or [double]$Action.expectedValues[$i] -ne $before[$i] -or [double]$Action.newValues[$i] -ne $after[$i] -or $Action.workbookCells[$i] -isnot [string] -or $Action.workbookCells[$i] -cne $cells[$i]){Stop-SevenLifecycle 'Only the exact first histogram value42to43 may change'}}
}
function Set-SevenHistogramSnapshotArray($Action,[string]$ModelSha256,$WireIdentity) {
    if($script:stopped){throw 'Histogram snapshot setter already stopped'}
    Assert-SevenHistogramAction $Action;Assert-SevenValueActionIdentity $ModelSha256 $WireIdentity
    if($script:report.actions.Count -ne 0){Stop-SevenLifecycle 'Exactly one histogram setter attempt required'}
    if($null -eq $script:report.beforeAdmission -or -not(Test-Path -LiteralPath $script:report.beforeAdmission.path) -or (Get-SevenHash $script:report.beforeAdmission.path) -cne $script:report.beforeAdmission.sha256){Stop-SevenLifecycle 'Actual histogram before admission required'}
    $before=Get-Content -LiteralPath $script:report.beforeAdmission.path -Raw -Encoding UTF8 | ConvertFrom-Json
    if($before.schemaVersion -ne 2 -or $before.profile -cne 'seven-histogram-classic-setter-native-archives-v1' -or $before.PSObject.Properties.Name -ccontains 'sourceFidelityVerified' -or $before.nativeAcceptance -isnot [bool] -or $before.nativeAcceptance -or $before.nativeTypeQualified -isnot [bool] -or $before.nativeTypeQualified -or $before.sourcePublicModelVerified -isnot [bool] -or -not $before.sourcePublicModelVerified -or $before.nativeRoleBindingVerified -isnot [bool] -or -not $before.nativeRoleBindingVerified -or $before.sourceRawStyleQualification -cne 'OPEN' -or $before.requestSha256 -cne $script:report.requestSha256 -or $before.sourceSha256 -cne $script:report.sourceSha256 -or $before.beforeSha256 -cne $script:report.snapshots.before.sha256){Stop-SevenLifecycle 'Histogram before proof belongs to another state or claims native type fidelity'}
    $probe=[ordered]@{op=$Action.op;actionModelSha256=$ModelSha256;actionFileIdentity=[ordered]@{bytes=$WireIdentity.bytes;sha256=$WireIdentity.sha256};status='begin';setterAttempts=0};$script:report.actions+=@($probe);Write-SevenReport
    $target=Get-SevenValueTarget $Action 'snapshot.target' -HistogramClassic
    Assert-SevenValueTargetOwnership $target 'snapshot.setter'
    $probe.setterAttempts=1;Write-SevenReport
    Invoke-SevenCom 'snapshot.series.values.set' {$target.series.Values=[object[]]$Action.newValues}
    $probe.status='setter-success';Write-SevenReport
}
