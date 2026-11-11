param([Parameter(Mandatory=$true)][string]$Worker,[Parameter(Mandatory=$true)][string]$Actions,[Parameter(Mandatory=$true)][string]$ActionFile,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedActionModelSha256,[Parameter(Mandatory=$true)][ValidateRange(1,4194304)][int]$ExpectedActionFileBytes,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedActionFileSha256,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $Output) {throw 'Select fresh managed value-test output'}
[void](New-Item -ItemType Directory -Path $Output)
function Import-ValueTestFunctions([string]$Path,[string[]]$Names) {
    $tokens=$null;$parseErrors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) {throw ($parseErrors|Out-String)}
    foreach($name in $Names) {
        $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($found.Count -ne 1) {throw 'Missing/duplicate exact test-import definition'}
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}
# Actual implementations only; no executable bootstrap, factory, query or supervisor is imported.
Import-ValueTestFunctions $Worker @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
Import-ValueTestFunctions $Actions @('Assert-SevenValueAction','Assert-SevenValueActionIdentity','Assert-SevenValueTargetOwnership','Get-SevenValueTarget','Read-SevenValueArray','Assert-SevenValueReadback','Set-SevenNumericArray','Read-SevenReopenedNumericArray')
function global:Get-Process {throw 'Managed value test forbids process queries'}
function global:Start-Process {throw 'Managed value test forbids child processes'}
function global:Stop-Process {throw 'Managed value test forbids process termination'}
function global:New-Object {
    param([string]$TypeName,[object[]]$ArgumentList,[string]$ComObject)
    if($ComObject) {throw 'Managed value test forbids COM activation'}
    return Microsoft.PowerShell.Utility\New-Object @PSBoundParameters
}
Add-Type -TypeDefinition @"
using System; using System.Collections.Generic;
public static class SevenValueFake {
 public static List<string> Calls=new List<string>();public static string Fault,Mutant;public static int FaultCallIndex,Gets,Sets,UnexpectedReads,TargetId;public static string TargetName;public static Action BeforeFirstValueReturn;
 public static void Hit(string name){Calls.Add(name);if(name==Fault||FaultCallIndex>0&&Calls.Count==FaultCallIndex)throw new InvalidOperationException("managed injected fault: "+name);}
 public static void Reset(string fault,string mutant,int id,string name){Calls.Clear();Fault=fault;Mutant=mutant;FaultCallIndex=0;Gets=0;Sets=0;UnexpectedReads=0;TargetId=id;TargetName=name;BeforeFirstValueReturn=null;}
}
public sealed class SevenValueUnexpected { public int Forbidden {get {SevenValueFake.UnexpectedReads++;return 42;}} }
public sealed class SevenValuePresentation {
 public string FullName {get {SevenValueFake.Hit("fullName");return SevenValueFake.Mutant=="foreignPath"||SevenValueFake.Mutant=="beforeValueForeignPath"&&SevenValueFake.Gets>=1?"foreign-owned-file":"managed-owned-only";}}
 public int ReadOnly {get {SevenValueFake.Hit("readOnly");return SevenValueFake.Mutant=="writable"||SevenValueFake.Mutant=="beforeValueWritable"&&SevenValueFake.Gets>=1?0:-1;}}
 public SevenValueSlides Slides {get {SevenValueFake.Hit("slides");return new SevenValueSlides();}}
}
public sealed class SevenValueSlides {
 public int Count {get {SevenValueFake.Hit("slideCount");return SevenValueFake.Mutant=="slideCount"?8:7;}}
 public SevenValueSlide Item(int n){SevenValueFake.Hit("slideItem");if(n!=1)throw new Exception("wrong source slide");return new SevenValueSlide();}
}
public sealed class SevenValueSlide {public SevenValueShapes Shapes {get {SevenValueFake.Hit("shapes");return new SevenValueShapes();}}}
public sealed class SevenValueShapes {
 public int Count {get {SevenValueFake.Hit("shapeCount");return SevenValueFake.Mutant=="shapeCount"?4:2;}}
 public SevenValueShape Item(int n){SevenValueFake.Hit("shapeItem."+n);return new SevenValueShape(n);}
}
public sealed class SevenValueShape {
 int n;public SevenValueShape(int position){n=position;}
 public int Id {get {SevenValueFake.Hit("shapeId."+n);return n==2||SevenValueFake.Mutant=="duplicateTarget"?SevenValueFake.TargetId:999;}}
 public string Name {get {SevenValueFake.Hit("shapeName."+n);return n==2||SevenValueFake.Mutant=="duplicateTarget"?SevenValueFake.TargetName:"Managed title";}}
 public int HasChart {get {SevenValueFake.Hit("hasChart");return SevenValueFake.Mutant=="hasChart"?0:-1;}}
 public SevenValueChart Chart {get {SevenValueFake.Hit("chart");return new SevenValueChart();}}
}
public sealed class SevenValueChart {
 public int ChartType {get {SevenValueFake.Hit("chartType");return SevenValueFake.Mutant=="wrongType"?51:117;}}
 public SevenValueSeriesCollection SeriesCollection(){SevenValueFake.Hit("seriesCollection");return new SevenValueSeriesCollection();}
}
public sealed class SevenValueSeriesCollection {
 public int Count {get {SevenValueFake.Hit("seriesCount");return SevenValueFake.Mutant=="zeroSeries"?0:SevenValueFake.Mutant=="extraSeries"?3:1;}}
 public SevenValueSeries Item(int n){SevenValueFake.Hit("seriesItem");if(n!=1)throw new Exception("wrong owner series");return new SevenValueSeries();}
}
public sealed class SevenValueSeries {
 public string Name {get {SevenValueFake.Hit("seriesName");return SevenValueFake.Mutant=="seriesName"?"Other":"Value";}}
 public object Values {
  get {
   SevenValueFake.Gets++;SevenValueFake.Hit("valuesGet."+SevenValueFake.Gets);
   if(SevenValueFake.Gets==1&&SevenValueFake.BeforeFirstValueReturn!=null)SevenValueFake.BeforeFirstValueReturn();
   string m=SevenValueFake.Mutant;
   if(m=="null")return null;if(m=="scalar")return 42.0;if(m=="rankTwo")return new double[,]{{42.0,31.0}};
   if(m=="tooLong")return new double[]{42,31,-8,19,5};if(m=="empty")return new double[]{};
   object first=SevenValueFake.Sets==0?42.0:43.0;
   if(m=="bool")first=true;if(m=="string")first="42";if(m=="nan")first=double.NaN;if(m=="infinity")first=double.PositiveInfinity;if(m=="unexpected")first=new SevenValueUnexpected();
   if(m=="wrongOriginal"&&SevenValueFake.Gets==1)first=41.0;
   if(m=="silentSetter"||m=="staleReopened"&&SevenValueFake.Gets==3)first=42.0;
   return new object[]{first,m=="otherPoint"&&SevenValueFake.Sets==1?32.0:31.0,-8.0,19.0};
  }
  set {
   SevenValueFake.Hit("valuesSet");SevenValueFake.Sets++;
   Array a=value as Array;if(a==null||a.Rank!=1||a.Length!=4||Convert.ToDouble(a.GetValue(0))!=43.0||SevenValueFake.Sets!=1)throw new Exception("setter argument/count differs");
  }
 }
}
"@
# Test the same future entry pattern: read ONE buffer, verify its exact wire identity, then parse THAT buffer.
# The model digest comes from Node's source/cache/workbook rebind; never recompute it with PS ConvertTo-Json.
$actionBytes=[IO.File]::ReadAllBytes($ActionFile)
$algorithm=[Security.Cryptography.SHA256]::Create()
try {$actionWireSha256=([BitConverter]::ToString($algorithm.ComputeHash($actionBytes))).Replace('-','').ToLowerInvariant()} finally {$algorithm.Dispose()}
if($actionBytes.Length -ne $ExpectedActionFileBytes -or $actionWireSha256 -cne $ExpectedActionFileSha256) {
    [ordered]@{scope='MANAGED_TEST_WIRE_REFUSAL_NOT_NATIVE';actual=[ordered]@{bytes=$actionBytes.Length;sha256=$actionWireSha256};expected=[ordered]@{bytes=$ExpectedActionFileBytes;sha256=$ExpectedActionFileSha256};managedOperations=[SevenValueFake]::Calls.Count;officeInvoked=$false}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $Output 'wire-identity-refusal.json') -Encoding UTF8
    throw 'Action wire snapshot identity differs before any managed target operation'
}
$actionFileIdentity=[pscustomobject]@{bytes=$actionBytes.Length;sha256=$actionWireSha256};$actionModelSha256=$ExpectedActionModelSha256
$baselineActionJson=([Text.UTF8Encoding]::new($false,$true)).GetString($actionBytes)
if($baselineActionJson.StartsWith([string][char]0xfeff)) {$baselineActionJson=$baselineActionJson.Substring(1)}
$action=$baselineActionJson|ConvertFrom-Json
$results=@()
function Initialize-ValueTest([string]$Name,[string]$Fault,[string]$Mutant) {
    $script:root=Join-Path $Output $Name;[void](New-Item -ItemType Directory -Path $script:root)
    [SevenValueFake]::Reset($Fault,$Mutant,[int]$action.shapeId,$action.shapeName)
    $script:app=[object]::new();$script:ownedApp=$script:app;$script:presentation=[SevenValuePresentation]::new();$script:ownedPresentation=$script:presentation;$script:ownedPath='managed-owned-only'
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$false
    $script:report=[ordered]@{probes=@();actions=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null}
}
function Invoke-ValueTestSequence {
    Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity
    # A new managed presentation models the owned reopened reference; it performs no lifecycle API.
    $script:presentation=[SevenValuePresentation]::new();$script:ownedPresentation=$script:presentation
    Read-SevenReopenedNumericArray $action $actionModelSha256 $actionFileIdentity
}
Initialize-ValueTest 'success' '' ''
Invoke-ValueTestSequence
if($script:stopped -or [SevenValueFake]::Sets -ne 1 -or [SevenValueFake]::Gets -ne 3 -or $script:report.actions.Count -ne 1 -or $script:report.actions[0].status -cne 'success') {throw 'Actual managed single-setter/readback contract differs'}
$baselineCalls=@([SevenValueFake]::Calls)
$results+=@([ordered]@{name='actual one-setter before/after/reopened managed readbacks';passed=$true;setterCalls=1;getterCalls=3})
for($faultAt=0;$faultAt -lt $baselineCalls.Count;$faultAt++) {
    $fault=$baselineCalls[$faultAt]
    Initialize-ValueTest ('fault-'+$faultAt+'-'+($fault-replace '\.','-')) '' ''
    [SevenValueFake]::FaultCallIndex=$faultAt+1
    $caught=$false;try {Invoke-ValueTestSequence}catch{$caught=$true}
    $before=[SevenValueFake]::Calls.Count
    try {Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN.after')}}catch{}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $before -or [SevenValueFake]::Calls[-1] -cne $fault -or $before -ne $faultAt+1) {throw "Later managed operation after $fault"}
    $results+=@([ordered]@{name=$fault;faultCallIndex=$faultAt+1;passed=$true;laterOperations=0})
}
foreach($mutant in @('foreignPath','writable','slideCount','shapeCount','duplicateTarget','hasChart','wrongType','zeroSeries','extraSeries','seriesName','null','scalar','rankTwo','tooLong','empty','bool','string','nan','infinity','unexpected','wrongOriginal','silentSetter','otherPoint','staleReopened')) {
    Initialize-ValueTest ('mutant-'+$mutant) '' $mutant
    $caught=$false;try {Invoke-ValueTestSequence}catch{$caught=$true}
    $before=[SevenValueFake]::Calls.Count
    try {Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN.after')}}catch{}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $before -or [SevenValueFake]::UnexpectedReads -ne 0) {throw "Primitive/target refusal failed: $mutant"}
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($persisted.actions.Count -ne 1) {throw 'Actual observation was not retained before refusal'}
    $results+=@([ordered]@{name=$mutant;passed=$true;laterOperations=0;unexpectedGetterReads=0;setterCalls=[SevenValueFake]::Sets})
}
foreach($mutant in @('foreignApplication','foreignPresentation','stopped','secondSetter')) {
    Initialize-ValueTest ('ownership-'+$mutant) '' ''
    if($mutant -ceq 'foreignApplication') {$script:ownedApp=[object]::new()}
    if($mutant -ceq 'foreignPresentation') {$script:ownedPresentation=[object]::new()}
    if($mutant -ceq 'stopped') {$script:stopped=$true}
    if($mutant -ceq 'secondSetter') {Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity}
    $before=[SevenValueFake]::Calls.Count;$setters=[SevenValueFake]::Sets
    $caught=$false;try {Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $before -or [SevenValueFake]::Sets -ne $setters) {throw 'Ownership/second-setter guard reached a getter or setter'}
    $results+=@([ordered]@{name=$mutant;passed=$true;laterOperations=0})
}
foreach($mutant in @('beforeValueOwnedAppSwap','beforeValueOwnedPresentationSwap','beforeValueOwnedPathSwap','beforeValueForeignPath','beforeValueWritable')) {
    Initialize-ValueTest $mutant '' $mutant
    if($mutant -ceq 'beforeValueOwnedAppSwap') {[SevenValueFake]::BeforeFirstValueReturn=[Action]{$foreign=[object]::new();$script:app=$foreign;$script:ownedApp=$foreign}}
    if($mutant -ceq 'beforeValueOwnedPresentationSwap') {[SevenValueFake]::BeforeFirstValueReturn=[Action]{$foreign=[SevenValuePresentation]::new();$script:presentation=$foreign;$script:ownedPresentation=$foreign}}
    if($mutant -ceq 'beforeValueOwnedPathSwap') {[SevenValueFake]::BeforeFirstValueReturn=[Action]{$script:ownedPath='foreign-owned-file'}}
    $caught=$false;try {Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity}catch{$caught=$true}
    $lastExpected=if($mutant -ceq 'beforeValueForeignPath'){'fullName'}elseif($mutant -ceq 'beforeValueWritable'){'readOnly'}else{'valuesGet.1'}
    $before=[SevenValueFake]::Calls.Count;try {Invoke-SevenCom 'after-refusal' {[SevenValueFake]::Hit('FORBIDDEN.after')}}catch{}
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Gets -ne 1 -or [SevenValueFake]::Sets -ne 0 -or [SevenValueFake]::Calls.Count -ne $before -or [SevenValueFake]::Calls[-1] -cne $lastExpected -or $persisted.actions[0].setterAttempts -ne 0 -or $persisted.probes[-1].matched) {throw 'Before-value ownership mutation reached a setter/later getter or lost its refusal'}
    $results+=@([ordered]@{name=$mutant;passed=$true;setterCalls=0;setterAttempts=0;valueReads=1;laterOperationsAfterRefusal=0})
}
$metadataMutants=@(
    @('nullDataId',{$script:action.dataId=$null}),
    @('emptyDataId',{$script:action.dataId=''}),
    @('objectDataId',{$script:action.dataId=[pscustomobject]@{value='0'}}),
    @('stringDimension',{$script:action.dimensionIndex='1'}),
    @('negativeDimension',{$script:action.dimensionIndex=-1}),
    @('wrongLayout',{$script:action.layoutId='funnel'}),
    @('objectLayout',{$script:action.layoutId=[pscustomobject]@{value='treemap'}}),
    @('wrongSeriesBound',{$script:action.maxSeriesCount=2}),
    @('nullCells',{$script:action.workbookCells=$null}),
    @('scalarCells',{$script:action.workbookCells='B2'}),
    @('shortCells',{$script:action.workbookCells=@('B2')}),
    @('duplicateCells',{$script:action.workbookCells=@('B2','B2','B4','B5')}),
    @('lowercaseCell',{$script:action.workbookCells=@('B2','b3','B4','B5')}),
    @('nonstringCell',{$script:action.workbookCells=@('B2',$false,'B4','B5')}),
    @('controlCell',{$script:action.workbookCells=@('B2',"B3`n",'B4','B5')}),
    @('oversizedName',{$script:action.seriesName='x'*256})
)
foreach($mutant in $metadataMutants) {
    $script:action=$baselineActionJson|ConvertFrom-Json
    Initialize-ValueTest ('metadata-'+$mutant[0]) '' ''
    & ($mutant[1])
    $caught=$false;try {Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne 0 -or [SevenValueFake]::Sets -ne 0) {throw 'Malformed action metadata reached a getter or setter'}
    $results+=@([ordered]@{name=$mutant[0];passed=$true;calls=0;setterCalls=0})
}
$script:action=$baselineActionJson|ConvertFrom-Json
foreach($mutant in @('malformedModel','extraWireField','zeroWireBytes','stringWireBytes','invalidWireHash')) {
    Initialize-ValueTest ('identity-'+$mutant) '' ''
    $model=$actionModelSha256;$wire=[pscustomobject]@{bytes=$actionFileIdentity.bytes;sha256=$actionFileIdentity.sha256}
    switch($mutant) {'malformedModel'{$model='invalid'}'extraWireField'{$wire|Add-Member -MemberType NoteProperty -Name extra -Value $true}'zeroWireBytes'{$wire.bytes=0}'stringWireBytes'{$wire.bytes=[string]$wire.bytes}'invalidWireHash'{$wire.sha256='invalid'}}
    $caught=$false;try {Set-SevenNumericArray $action $model $wire}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne 0 -or [SevenValueFake]::Sets -ne 0) {throw 'Malformed model/wire identity reached a getter or setter'}
    $results+=@([ordered]@{name=$mutant;passed=$true;calls=0;setterCalls=0})
}
foreach($mutant in @('reopenedModelMismatch','reopenedWireLengthMismatch','reopenedWireHashMismatch')) {
    Initialize-ValueTest $mutant '' ''
    Set-SevenNumericArray $action $actionModelSha256 $actionFileIdentity
    $model=$actionModelSha256;$wire=[pscustomobject]@{bytes=$actionFileIdentity.bytes;sha256=$actionFileIdentity.sha256}
    switch($mutant) {'reopenedModelMismatch'{$model='0'*64}'reopenedWireLengthMismatch'{$wire.bytes++}'reopenedWireHashMismatch'{$wire.sha256='0'*64}}
    $before=[SevenValueFake]::Calls.Count;$caught=$false;try {Read-SevenReopenedNumericArray $action $model $wire}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [SevenValueFake]::Calls.Count -ne $before -or [SevenValueFake]::Sets -ne 1 -or [SevenValueFake]::Gets -ne 2) {throw 'Reopened identity mismatch reached another getter or setter'}
    $results+=@([ordered]@{name=$mutant;passed=$true;laterOperations=0;setterCalls=1;valueReads=2})
}
[ordered]@{schemaVersion=1;mockOnly=$true;officeInvoked=$false;processQueries=0;sourceWorkerSha256=(Get-SevenHash $Worker);sourceActionsSha256=(Get-SevenHash $Actions);actionModelSha256=$actionModelSha256;actionFileIdentity=$actionFileIdentity;results=$results;baselineCalls=$baselineCalls;scope='Actual allowlisted action and lifecycle definitions over managed objects only. No physical COM/native/editability acceptance.'}|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $Output 'mock-results.json') -Encoding UTF8
Write-Output "Managed prospective value controls: $($results.Count) cases; Office invoked false"
