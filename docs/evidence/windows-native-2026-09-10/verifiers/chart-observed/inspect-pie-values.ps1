param([string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$presentation=$null
try {
  $powerpoint=New-Object -ComObject PowerPoint.Application
  $presentation=$powerpoint.Presentations.Open((Join-Path $root 'charts.pptx'),-1,0,0)
  $observations=@()
  foreach($slideNumber in @(1,2)) {
    $chart=$presentation.Slides.Item($slideNumber).Shapes.Item(1).Chart
    $series=$chart.SeriesCollection().Item(1)
    $x=$series.XValues
    $record=@{slide=$slideNumber;type=$x.GetType().FullName;rank=$x.Rank;length=$x.Length;lower=$x.GetLowerBound(0);upper=$x.GetUpperBound(0);formula=$series.Formula}
    $record.indexed=@(for($i=$x.GetLowerBound(0);$i -le $x.GetUpperBound(0);$i++) { @{index=$i;value=$x.GetValue($i);isNull=$null -eq $x.GetValue($i)} })
    $observations+=$record
  }
  $observations | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root 'pie-values-inspection.json') -Encoding UTF8
} finally { if($null -ne $presentation) { $presentation.Close() } }
