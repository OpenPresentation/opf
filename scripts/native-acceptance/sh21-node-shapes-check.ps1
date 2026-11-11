param([Parameter(Mandatory=$true)][string]$ControllerRoot,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-bootstrap.ps1')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-actions.ps1') @('Assert-Sh21Plan','Assert-Sh21Owner','Get-Sh21ExpectedNodes','Read-Sh21Node','Set-Sh21NodeMap','Read-Sh21Nodes')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-node-shapes-actions.ps1') @('Add-Sh21ShapeFinding','Read-Sh21NodeShapesCapability')
# Managed enumerable, one-based ranges only; no COM object/factory, process query or real export.
Add-Type -TypeDefinition @'
public sealed class Sh21CapabilityRange : System.Collections.IEnumerable {
 private readonly object[] rows;
 public int Enumerations { get; private set; }
 public readonly System.Collections.Generic.List<int> Calls = new System.Collections.Generic.List<int>();
 public bool FailItem; public bool FailCount;
 public Sh21CapabilityRange(object[] rows) { this.rows=rows; }
 public int Count { get { if(FailCount)throw new System.InvalidOperationException("Count fault");return rows.Length; } }
 public object Item(int i) { Calls.Add(i);if(FailItem)throw new System.InvalidOperationException("Item fault");if(i<1||i>rows.Length)throw new System.IndexOutOfRangeException();return rows[i-1]; }
 public System.Collections.IEnumerator GetEnumerator() { Enumerations++;return rows.GetEnumerator(); }
}
'@
$plan=Get-Content -LiteralPath (Join-Path $OutputDirectory 'plan.json') -Raw -Encoding UTF8|ConvertFrom-Json
$modes=@('positive','empty','unavailable','multiple-text','connector','range-fault','item-fault','count-fault','text-fault','font-fault','foreign-owner','count33','total33','nonfinite','different-font-size','child-first')
$results=@()
foreach($mode in $modes){
 $script:root=Join-Path $OutputDirectory $mode;[void](New-Item -ItemType Directory -Path $script:root);$script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:mode=$mode;$script:exports=0
 $script:sourcePath=Join-Path $script:root 'source.pptx';[IO.File]::WriteAllBytes($script:sourcePath,[byte[]]@(83,72,50,49));$script:ownedPath=$script:sourcePath
 $script:app=[pscustomobject]@{};$script:ownedApp=$script:app;$script:presentation=[pscustomobject]@{FullName=$script:ownedPath;ReadOnly=-1};$script:ownedPresentation=$script:presentation
 $script:report=[ordered]@{phases=[ordered]@{};probes=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null}
 $nodes=@();$ranges=@()
 for($i=0;$i -lt 3;$i++){
  $font=[pscustomobject]@{Name='Aptos';Size=27;Bold=0;Italic=0};$tr=[pscustomobject]@{Text=$plan.before[$i].text;Font=$font}
  $shape=[pscustomobject]@{Id=10+$i;Name='Node '+$i;Left=10+$i*20;Top=20;Width=15;Height=10;Rotation=0;Type=1;HasTextFrame=-1;Connector=0;TextFrame2=[pscustomobject]@{TextRange=$tr}}
  if($mode -ceq 'nonfinite' -and $i -eq 0){$shape.Left=[double]::NaN}
  if($mode -ceq 'different-font-size'){$font.Size=40.5}
  if($mode -ceq 'text-fault' -and $i -eq 0){$tr.PSObject.Properties.Remove('Text');$tr|Add-Member ScriptProperty Text {throw 'Text getter fault'}}
  if($mode -ceq 'font-fault' -and $i -eq 0){$font.PSObject.Properties.Remove('Size');$font|Add-Member ScriptProperty Size {throw 'Font getter fault'}}
  $values=@($shape)
  if($mode -ceq 'empty' -and $i -eq 0){$values=@()}
  if($mode -ceq 'multiple-text' -and $i -eq 0){$values=@($shape,$shape)}
  if($mode -ceq 'connector' -and $i -eq 0){$values+=@([pscustomobject]@{Id=30;Name='Associated connector';Left=2;Top=3;Width=20;Height=0;Rotation=0;Type=9;HasTextFrame=0;Connector=-1})}
  if($mode -ceq 'count33' -and $i -eq 0){$values=@();for($k=1;$k -le 33;$k++){$values+=@($shape)}}
  if($mode -ceq 'total33'){$values=@();for($k=1;$k -le 11;$k++){$values+=@($shape)}}
  $range=[Sh21CapabilityRange]::new([object[]]$values);if($mode -ceq 'item-fault' -and $i -eq 0){$range.FailItem=$true};if($mode -ceq 'count-fault' -and $i -eq 0){$range.FailCount=$true};$ranges+=,$range
  $node=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Text=$plan.before[$i].text}};Level=$plan.before[$i].level;Type=1;Nodes=[pscustomobject]@{Count=$plan.before[$i].children};Shapes=$range}
  if($i -eq 0){$node|Add-Member ScriptProperty ParentNode {throw 'Root ParentNode must not run'}}else{$node|Add-Member NoteProperty ParentNode $nodes[0]}
  if($mode -ceq 'unavailable' -and $i -eq 0){$node.Shapes=$null}
  if($mode -ceq 'range-fault' -and $i -eq 0){$node.PSObject.Properties.Remove('Shapes');$node|Add-Member ScriptProperty Shapes {throw 'Shapes getter fault'}}
  if($mode -ceq 'foreign-owner' -and $i -eq 0){$node.PSObject.Properties.Remove('Shapes');$node|Add-Member ScriptProperty Shapes {$script:presentation.FullName+='foreign';return ,$script:rangeForMutation}}
  $nodes+=@($node)
 }
 $script:rangeForMutation=$ranges[0];$ordered=if($mode -ceq 'child-first'){@($nodes[1],$nodes[0],$nodes[2])}else{$nodes};$all=[Sh21CapabilityRange]::new([object[]]$ordered)
 $slide=[pscustomobject]@{};$slide|Add-Member ScriptMethod Export {param($file,$format,$width,$height)if($file -cne (Join-Path $script:root 'capability.png') -or $format -cne 'PNG' -or $width -ne 1280 -or $height -ne 720){throw 'Inert Export arguments differ'};$script:exports++;[IO.File]::WriteAllBytes($file,[byte[]]@(83,72,50,49))}
 $target=[pscustomobject]@{app=$script:app;presentation=$script:presentation;path=$script:ownedPath;smartArt=[pscustomobject]@{AllNodes=$all};shape=[pscustomobject]@{Left=1;Top=2;Width=100;Height=60};slide=$slide}
 $caught=$null;try{Read-Sh21NodeShapesCapability $target $plan}catch{$caught=$_.Exception.Message}
 $fault=$mode -cin @('range-fault','item-fault','count-fault','text-fault','font-fault','foreign-owner')
 if($fault){if($null -eq $caught -or -not $script:stopped){throw 'Managed capability fault did not latch'};$before=$script:sequence;try{Invoke-SevenCom 'forbidden.after-fault' {throw 'Must not run'}}catch{};if($before -ne $script:sequence){throw 'Postfault COM ran'};$durable=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8|ConvertFrom-Json;if($durable.phases.capability.nodes.Count -ne 3 -or $durable.phases.capability.ranges.Count -lt 1){throw 'Partial capability facts lost'}}else{
  if($null -ne $caught -or $script:stopped){throw "Managed capability unexpectedly failed: $mode : $caught"}
  $r=$script:report.phases.capability;if($all.Enumerations -ne 0 -or $script:exports -ne 1 -or $r.geometryAcceptance -isnot [bool] -or $r.geometryAcceptance -or $r.connectorCoverage -cne 'unproven'){throw 'Capability identity/scope changed'}
  foreach($range in $ranges){if($range.Enumerations -ne 0){throw 'Node ShapeRange unrolled'}}
  if($mode -ceq 'empty' -and $r.ranges[0].status -cne 'empty'){throw 'Empty range was not retained'}
  if($mode -ceq 'unavailable' -and $r.ranges[0].status -cne 'unavailable'){throw 'Unavailable range was not retained'}
  if($mode -ceq 'multiple-text' -and $r.ranges[0].items.Count -ne 2){throw 'Multiple text shapes were dropped'}
  if($mode -ceq 'connector' -and $r.ranges[0].items[1].Connector -ne -1){throw 'Associated nontext connector was dropped'}
  if($mode -ceq 'count33' -and ($r.ranges.Count -ne 1 -or $r.ranges[0].status -cne 'bounded-stop' -or $ranges[0].Calls.Count -ne 0)){throw 'Count33 crossed total bound'}
  if($mode -ceq 'total33' -and ($r.ranges[2].status -cne 'bounded-stop' -or $ranges[2].Calls.Count -ne 0)){throw 'Cumulative total33 crossed bound'}
  if($mode -ceq 'child-first' -and ($r.semanticToNativeIndex -join ',') -cne '2,1,3'){throw 'Actual native ordering was not retained'}
  if($mode -ceq 'positive' -and (($ranges[0].Calls -join ',') -cne '1' -or $r.ranges[0].items[0].font.Size -ne 27)){throw 'Actual indexed geometry/style value was not retained'}
  if($mode -ceq 'different-font-size' -and $r.ranges[0].items[0].font.Size -ne 40.5){throw 'Unmeasured source36 was coerced over actual size'}
 }
 $results+=@([ordered]@{scenario=$mode;passed=$true;failure=$caught;nativeRaster=$false})
}
[ordered]@{schemaVersion=1;powerShellEdition=$PSVersionTable.PSEdition;powerShellVersion=$PSVersionTable.PSVersion.ToString();realProcessQueries=0;OfficeActions=0;scenarios=$results}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $OutputDirectory 'managed-controls.json') -Encoding UTF8
