param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$InputPresentation,
    [string]$ActionPlan='',
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$CaptureTextFonts,
    [switch]$ReadOnlySurvey,
    [string]$TextProbePlan='',
    [switch]$ReferenceNameEdit,
    [switch]$ReferenceNameSnapshots
)
if($ReferenceNameSnapshots -and -not $ReferenceNameEdit){throw 'Name snapshots require the exact closed reference-name mode'}
function Test-Integer($Value) { return $Value -is [int] -or $Value -is [long] }
function Assert-FurnitureReferenceNameAction($a) {
    $allowed=@('op','slideIndex','chartName','seriesIndex','expectedName','newName')
    if($a -isnot [pscustomobject] -or @($a.PSObject.Properties.Name).Count -ne $allowed.Count){throw 'Exact reference-name action fields required'}
    foreach($key in $a.PSObject.Properties.Name){if($key -cnotin $allowed){throw 'Unknown reference-name action field'}}
    if(-not(Test-Integer $a.slideIndex) -or $a.slideIndex -ne 1 -or -not(Test-Integer $a.seriesIndex) -or $a.seriesIndex -ne 1){throw 'Reference-name action selects only slide1series1'}
    foreach($pair in @(@('op','set-chart-series-name'),@('chartName','OPF chart 1'),@('expectedName','Actual'),@('newName','Actual edited'))){if($a.($pair[0]) -isnot [string] -or $a.($pair[0]) -cne $pair[1]){throw 'Reference-name action differs from the sealed literal edit'}}
}
function Assert-FurnitureReferenceNameMode($Actions,[string]$SourceHash,[long]$SourceBytes,[bool]$Fonts,[bool]$Survey) {
    if($SourceBytes -ne 129025 -or $SourceHash -cne '06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83' -or $Fonts -or $Survey -or $Actions -isnot [array] -or $Actions.Count -ne 1){throw 'Exact sealed reference-name source and one plan required'}
    Assert-FurnitureReferenceNameAction $Actions[0]
}
$ErrorActionPreference='Stop'
$control=Get-Content -LiteralPath (Join-Path $OutputDirectory 'startup-control.json') -Raw|ConvertFrom-Json
$request=$control.request;$sourceHash=$control.declaredSourceHash;$sourceSnapshot=$InputPresentation;$actions=@($control.actions)
$script:referenceNameModeEnabled=$false
if($ReferenceNameEdit -or $null -ne $request.PSObject.Properties['referenceNameEdit']){
    if(-not $ReferenceNameEdit -or $request.referenceNameEdit -isnot [bool] -or -not $request.referenceNameEdit){throw 'Reference-name switch differs from its snapshotted request'}
    Assert-FurnitureReferenceNameMode $actions $sourceHash (Get-Item -LiteralPath $sourceSnapshot).Length ([bool]$CaptureTextFonts) ([bool]$ReadOnlySurvey)
    $script:referenceNameModeEnabled=$true
}
$script:referenceNameSnapshotsModeEnabled=$false
if($ReferenceNameSnapshots -or $null -ne $request.PSObject.Properties['referenceNameSnapshots']){
    if(-not $script:referenceNameModeEnabled -or -not $ReferenceNameSnapshots -or $request.referenceNameSnapshots -isnot [bool] -or -not $request.referenceNameSnapshots){throw 'Name snapshot switch differs from its closed snapshotted request'}
    $script:referenceNameSnapshotsModeEnabled=$true
}
[pscustomobject]@{referenceSwitch=[bool]$ReferenceNameEdit;snapshotSwitch=[bool]$ReferenceNameSnapshots;referenceEnabled=$script:referenceNameModeEnabled;snapshotsEnabled=$script:referenceNameSnapshotsModeEnabled}