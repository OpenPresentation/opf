param([Parameter(Mandatory=$true)][string]$ReportPath,[switch]$ProbeComAdapter)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve prior probe report' }
# Fixed-size file-only phase witness. Diagnostic IO must not replace an original operation failure.
$phasePath=$ReportPath+'.phases.jsonl';$phaseClock=[Diagnostics.Stopwatch]::StartNew();$phaseCount=0;$phaseErrors=@()
if(Test-Path -LiteralPath $phasePath) { throw 'Preserve prior probe phases' }
function Write-FontPropertyProbePhase([string]$Phase) {
 if($script:phaseCount -ge 32) { if($script:phaseErrors.Count -lt 32) {$script:phaseErrors+=@('Phase witness overflow')};return }
 $script:phaseCount++
 try { [ordered]@{sequence=$script:phaseCount;phase=$Phase;timestamp=[DateTime]::UtcNow.ToString('o');elapsedMilliseconds=$script:phaseClock.Elapsed.TotalMilliseconds}|ConvertTo-Json -Compress|Add-Content -LiteralPath $script:phasePath -Encoding UTF8 }
 catch { if($script:phaseErrors.Count -lt 32) {$script:phaseErrors+=@($_.Exception.Message)} }
}
Write-FontPropertyProbePhase 'ast.begin'
$worker=Join-Path $PSScriptRoot 'native-furniture-control.ps1'
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if($errors.Count) { throw ($errors | Out-String) }
foreach($name in @('Test-Integer','Invoke-FurnitureCom','Read-FurnitureProperty','Read-FurnitureTextFont')) {
 $node=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
 if($null -eq $node) { throw "Missing function $name" }
 Invoke-Expression $node.Extent.Text
}
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) { }
Write-FontPropertyProbePhase 'ast.complete'
# Pure managed getter throws COMException; no COM activation, Office or files opened.
Write-FontPropertyProbePhase 'add-type.begin'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class OpfThrowingFontProperty {
 public string Name { get { throw new COMException("Deliberate managed getter COMException", unchecked((int)0x80004005)); } }
 public float Size { get { return 18; } }
 public int Bold { get { return 0; } }
 public int Italic { get { return 0; } }
}
'@
Write-FontPropertyProbePhase 'add-type.complete'
function Observe-Read($Font,[string]$Kind,[string]$Strategy) {
 $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
 $caught=$false; $value=$null; $message=$null
 try {
  if($Strategy -eq 'current-worker') {
   $shape=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Font=$Font}}}
   $value=Read-FurnitureTextFont $shape 'unchanged words' 'probe'
  } else {
   $value=Invoke-FurnitureCom 'probe.explicit-name.get' { $property=$Font.PSObject.Properties['Name']; if($null -eq $property) { return $null }; $property.get_Value() }
  }
 } catch { $caught=$true; $message=$_.Exception.Message }
 return [ordered]@{kind=$Kind;strategy=$Strategy;caught=$caught;officeOperationsStopped=$script:officeOperationsStopped;cleanupConfirmed=$script:cleanupConfirmed;value=$value;error=$message}
}
Write-FontPropertyProbePhase 'managed-reads.begin'
$scriptFont=[pscustomobject]@{Size=18;Bold=0;Italic=0}
$scriptFont | Add-Member -MemberType ScriptProperty -Name Name -Value { throw 'Deliberate ScriptProperty failure' }
$records=@()
foreach($case in @(@{kind='ScriptProperty';font=$scriptFont},@{kind='managed-COMException-getter';font=(New-Object OpfThrowingFontProperty)})) {
 foreach($strategy in @('current-worker','explicit-property-method')) { $records+=Observe-Read $case.font $case.kind $strategy }
}
$normal=[pscustomobject]@{Name='Roboto';Size=[single]18;Bold=0;Italic=0}
$normalRead=Observe-Read $normal 'normal' 'current-worker'
$normalExplicit=Observe-Read $normal 'normal' 'explicit-property-method'
$missing=Observe-Read ([pscustomobject]@{}) 'missing' 'explicit-property-method'
$empty=Observe-Read ([pscustomobject]@{Name=$null}) 'null' 'explicit-property-method'
$records+=@($normalRead,$normalExplicit,$missing,$empty)
Write-FontPropertyProbePhase 'managed-reads.complete'
$comObservation=[ordered]@{requested=[bool]$ProbeComAdapter;executed=$false;passed=$false;released=$false;reads=@();error=$null}
if($ProbeComAdapter) {
 $dictionary=$null
 try {
  if($env:OS -ne 'Windows_NT') { throw 'COM adapter probe requires Windows' }
  Write-FontPropertyProbePhase 'dictionary.create.begin'
  $dictionary=New-Object -ComObject Scripting.Dictionary
  Write-FontPropertyProbePhase 'dictionary.create.complete'
  if(-not [Runtime.InteropServices.Marshal]::IsComObject($dictionary)) { throw 'Expected real COM adapter object' }
  $comObservation.executed=$true
  foreach($expected in @(0,1)) {
   Write-FontPropertyProbePhase ('dictionary.count-'+$expected+'.begin')
   if($expected -eq 1) { $dictionary.Add('key','value') }
   $property=$dictionary.PSObject.Properties['Count']
   if($null -eq $property) { throw 'COM Count property unavailable' }
   $actual=Read-FurnitureProperty $dictionary 'Count' 'probe.com-count.get'
   $comObservation.reads+=@([ordered]@{expected=$expected;actual=$actual;type=$actual.GetType().FullName;adapter=$property.GetType().FullName})
   if($actual -isnot [int] -or $actual -ne $expected) { throw 'COM Count type/value changed' }
   Write-FontPropertyProbePhase ('dictionary.count-'+$expected+'.complete')
  }
  $comObservation.passed=$true
 } catch { $comObservation.error=$_.Exception.Message }
 finally { if($null -ne $dictionary -and [Runtime.InteropServices.Marshal]::IsComObject($dictionary)) { try { Write-FontPropertyProbePhase 'dictionary.release.begin';[void][Runtime.InteropServices.Marshal]::ReleaseComObject($dictionary);$comObservation.released=$true;Write-FontPropertyProbePhase 'dictionary.release.complete' } catch { $comObservation.error='COM release failure: '+$_.Exception.Message } } }
}
Write-FontPropertyProbePhase 'report.begin'
$report=[ordered]@{powerShell=$PSVersionTable.PSVersion.ToString();observations=$records;explicitMethodControlsPassed=$false;comAdapter=$comObservation;officeInvoked=$false;lateBoundPowerPointComAdapterProven=$false;scope='Managed/script getter behavior and optional Windows Scripting.Dictionary adapter only; no PowerPoint or native acceptance.'}
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
foreach($record in $records | Where-Object {$_.kind -in @('ScriptProperty','managed-COMException-getter')}) {
 if(-not $record.caught -or -not $record.officeOperationsStopped -or $record.cleanupConfirmed) { throw 'Property method did not retain failure latch' }
}
if($normalRead.caught -or $normalRead.value.status -ne 'uniform' -or $normalRead.value.sizePoints -ne 18) { throw 'Normal current worker value changed' }
if($normalExplicit.caught -or $normalExplicit.value -cne 'Roboto') { throw 'Explicit property method changed normal value' }
if($missing.caught -or $null -ne $missing.value -or $empty.caught -or $null -ne $empty.value) { throw 'Missing/null semantics changed' }
if($ProbeComAdapter -and (-not $comObservation.passed -or -not $comObservation.released)) { throw 'COM adapter compatibility probe failed; inspect preserved report' }
$report.explicitMethodControlsPassed=$true
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-FontPropertyProbePhase 'report.complete'
if($phaseErrors.Count -gt 0) { throw ('Probe phase preservation failed: '+($phaseErrors -join '; ')) }
