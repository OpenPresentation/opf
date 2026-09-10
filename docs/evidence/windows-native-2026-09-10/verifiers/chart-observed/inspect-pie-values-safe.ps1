param([string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$presentation=$null; $stage='connect'; $observations=@(); $failure=$null
function Progress([string]$Value) {
  $script:stage=$Value
  @{stage=$stage;observations=$observations;hostVersion=$PSVersionTable.PSVersion.ToString();apartment=[Threading.Thread]::CurrentThread.ApartmentState.ToString()} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root 'progress.json') -Encoding UTF8
}
try {
  Progress 'connect'
  $powerpoint=New-Object -ComObject PowerPoint.Application
  $source=Join-Path $root 'pie-inspection.pptx'
  for($i=1;$i -le $powerpoint.Presentations.Count;$i++) { if($powerpoint.Presentations.Item($i).FullName -eq $source){throw 'Fixture was already open; ownership is not established'} }
  Progress 'open-owned-copy'
  $presentation=$powerpoint.Presentations.Open($source,-1,0,0)
  Progress 'read-slide-2'
  $chart=$presentation.Slides.Item(2).Shapes.Item(1).Chart
  $series=$chart.SeriesCollection().Item(1)
  Progress 'read-xvalues'
  $x=$series.XValues
  $observations+=@{type=$x.GetType().FullName;rank=$x.Rank;length=$x.Length;lower=$x.GetLowerBound(0);upper=$x.GetUpperBound(0)}
  Progress 'read-array-elements'
  $values=@(for($i=$x.GetLowerBound(0);$i -le $x.GetUpperBound(0);$i++){ @{index=$i;value=$x.GetValue($i);isNull=$null -eq $x.GetValue($i)} })
  $observations+=@{indexed=$values}
  Progress 'observed'
} catch {
  $failure=$_.Exception.Message
  @{stage=$stage;error=$failure;observations=$observations} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8
} finally {
  if($null -ne $presentation) {
    try { Progress 'close-owned-copy'; $presentation.Close(); Progress 'closed-owned-copy' }
    catch { @{error=$_.Exception.Message;originalFailure=$failure} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'cleanup-failure.json') -Encoding UTF8; if($null -eq $failure){$failure=$_.Exception.Message} }
  }
}
if($null -ne $failure){throw $failure}
