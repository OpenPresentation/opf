param([Parameter(Mandatory=$true)][string]$ReportDirectory)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportDirectory) { throw 'Fresh managed report directory required' }
[void](New-Item -ItemType Directory -Path $ReportDirectory)
$folder=$PSScriptRoot;$worker=Join-Path $folder 'worker-package/test/native-furniture-control.ps1'
$source=Get-Content -LiteralPath (Join-Path $folder 'SOURCE.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Hash-Bytes([byte[]]$Bytes) { $h=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($h.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()} }
function Expand-Gzip([string]$File) { $inputStream=[IO.File]::OpenRead($File);$gzip=New-Object IO.Compression.GZipStream($inputStream,[IO.Compression.CompressionMode]::Decompress);$output=New-Object IO.MemoryStream;try{$gzip.CopyTo($output);return ,$output.ToArray()}finally{$output.Dispose();$gzip.Dispose();$inputStream.Dispose()} }
function Parse-Worker([string]$File) { $t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile($File,[ref]$t,[ref]$e);if($e.Count){throw ($e|Out-String)};return $a }
$baseBytes=Expand-Gzip (Join-Path $folder 'references/base-worker.ps1.gz');if((Hash-Bytes $baseBytes) -cne $source.baseWorkerFiles[0].sha256){throw 'Base worker identity differs'}
$baseFile=Join-Path $ReportDirectory 'base-worker.ps1';[IO.File]::WriteAllBytes($baseFile,$baseBytes)
$base=Parse-Worker $baseFile;$current=Parse-Worker $worker
$protected=@();$allBase=@($base.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true))
foreach($f in $allBase) { $other=@($current.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $f.Name},$true));if($other.Count -ne 1){throw "Missing/ambiguous base function $($f.Name)"};$old=Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($f.Extent.Text));$new=Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($other[0].Extent.Text));if($f.Name -cne 'Read-FurnitureState' -and $old -cne $new){throw "Protected function changed: $($f.Name)"};$protected+=@([ordered]@{name=$f.Name;baseSha256=$old;derivedSha256=$new;unchanged=($old -ceq $new);allowedObservationHook=($f.Name -ceq 'Read-FurnitureState')}) }
if($base.ParamBlock.Extent.Text -cne $current.ParamBlock.Extent.Text){throw 'Worker parameter block changed'}
$extract=@('Test-Integer','Invoke-FurnitureCom','Read-FurnitureProperty','Stop-FurnitureLifecycle','Get-FurnitureCharacterPlan','Test-FurnitureCharacterNumber','Assert-FurnitureCharacterPhase','Read-FurnitureCharacterBounds')
foreach($name in $extract){$f=@($current.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($f.Count -ne 1){throw "Missing observer function $name"};Invoke-Expression $f[0].Extent.Text}
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null){$script:stages+=@([ordered]@{name=$Name;status=$Status;error=$ErrorMessage})}
function Write-FurnitureReport {$script:reportWrites++}
Add-Type -TypeDefinition @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class CBCalls {public static List<string> Names=new List<string>();public static void Reset(){Names.Clear();}public static void Touch(string n){Names.Add(n);}}
public class CBChar {string t,mode;int p;double origin;public CBChar(string text,int position,double x,string m){t=text;p=position;origin=x;mode=m;}
 public object Text {get{CBCalls.Touch("char.text");if(mode=="text-throw")throw new COMException("text getter fault");return mode=="text-wrong"?"?":t;}}
 public object BoundLeft {get{CBCalls.Touch("char.left");if(mode=="left-throw")throw new COMException("left getter fault");if(mode=="left-null")return null;if(mode=="left-string")return "100";if(mode=="left-nan")return double.NaN;if(mode=="left-infinity")return double.PositiveInfinity;return (float)(mode=="negative-left"?-p*3:origin+(mode=="descending"?-p:p)*3);}}
 public object BoundWidth {get{CBCalls.Touch("char.width");if(mode=="width-throw")throw new COMException("width getter fault");if(mode=="width-negative")return -1.0;if(mode=="width-nan")return double.NaN;if(mode=="width-zero")return 0.0;return (float)2.0;}}
}
public class CBRange {string text,mode;double origin;public CBRange(string t,double x,string m){text=t;origin=x;mode=m;}
 public object Text {get{CBCalls.Touch("whole.text");return mode=="whole-wrong"?text+"x":text;}}
 public object Characters(int p,int n){CBCalls.Touch("characters:"+p+":"+n);if(mode=="characters-throw")throw new COMException("Characters getter fault");if(mode=="characters-null")return null;if(p<1||p>text.Length||n!=1)throw new Exception("Unexpected selection");return new CBChar(text.Substring(p-1,1),p,origin,mode);}
}
"@
function Reset-Observer {
 $script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true;$script:stages=@();$script:reportWrites=0
 $script:report=[ordered]@{characterBounds=[ordered]@{observations=@();completedPhases=@()}}
 [CBCalls]::Reset()
}
function Geometry($Plan){return [ordered]@{index=$Plan.index;id=$Plan.id;name=$Plan.name;left=[single]43.2;top=[single]270.1;width=[single]870.5;height=[single]33.8;rotation=[single]0}}
function Observe-Plan($Plan,[string]$Phase,[string]$Mode='normal',$Geo=$null,[string]$OverrideText='') {
 if($null -eq $Geo){$Geo=Geometry $Plan};$text=if($OverrideText -ceq ''){$Plan.text}else{$OverrideText};$shape=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=(New-Object CBRange($Plan.text,[double]$Geo.left,$Mode))}}
 return Read-FurnitureCharacterBounds $shape $text $Phase 1 $Plan.name ($Phase+'.slide-1.shape-'+$Plan.index) $Geo
}
$cases=@();$plans=@(Get-FurnitureCharacterPlan)
foreach($mode in @('normal','descending','width-zero','negative-left')) {
 Reset-Observer
 foreach($phase in @('original','edited','reopened')){Assert-FurnitureCharacterPhase $phase $false;foreach($plan in $plans){$null=Observe-Plan $plan $phase $mode};Assert-FurnitureCharacterPhase $phase $true}
 if($report.characterBounds.observations.Count -ne 30 -or $officeOperationsStopped -or -not $cleanupConfirmed){throw 'Positive observer contract failed'}
 $cases+=@([ordered]@{name=$mode;passed=$true;observations=$report.characterBounds.observations;completed=$report.characterBounds.completedPhases;calls=@([CBCalls]::Names);reportWrites=$reportWrites;physicalFontClaim=$false;causalClaim=$false})
}
foreach($mode in @('characters-throw','characters-null','text-throw','text-wrong','left-throw','left-null','left-string','left-nan','left-infinity','width-throw','width-negative','width-nan','whole-wrong')){
 Reset-Observer;$caught=$false;$message=$null
 try{$null=Observe-Plan $plans[1] 'original' $mode}catch{$caught=$true;$message=$_.Exception.Message}
 if(-not $caught -or -not $officeOperationsStopped -or $cleanupConfirmed){throw "Fault did not latch: $mode"}
 $before=@([CBCalls]::Names);$later=$false;try{$null=Invoke-FurnitureCom 'after.failure' {$script:unexpectedAfterFailure=$true}}catch{$later=$true}
 if(-not $later -or ([CBCalls]::Names.Count -ne $before.Count)){throw 'Operation continued after failure'}
 if($mode -like 'left-*' -and @($before|Where-Object {$_ -ceq 'char.width'}).Count -ne 0){throw 'Invalid left coordinate did not stop before width read'}
 $cases+=@([ordered]@{name=$mode;passed=$true;caught=$caught;error=$message;stopped=$officeOperationsStopped;cleanupConfirmed=$cleanupConfirmed;observations=$report.characterBounds.observations;calls=$before;reportWrites=$reportWrites})
}
foreach($mode in @('wrong-id','wrong-text','wrong-phase','missing-phase','duplicate-sample')){
 Reset-Observer;$caught=$false
 try{switch($mode){
 'wrong-id' {$g=Geometry $plans[1];$g.id=4;$null=Observe-Plan $plans[1] 'original' 'normal' $g}
 'wrong-text' {$null=Observe-Plan $plans[1] 'original' 'normal' $null 'changed text'}
 'wrong-phase' {$null=Observe-Plan $plans[1] 'edited'}
 'missing-phase' {Assert-FurnitureCharacterPhase 'original' $true}
 'duplicate-sample' {$null=Observe-Plan $plans[1] 'original';$null=Observe-Plan $plans[1] 'original'}
 }}catch{$caught=$true}
 if(-not $caught -or -not $officeOperationsStopped -or $cleanupConfirmed){throw "Binding refusal did not latch: $mode"}
 $cases+=@([ordered]@{name=$mode;passed=$true;stopped=$officeOperationsStopped;cleanupConfirmed=$cleanupConfirmed;calls=@([CBCalls]::Names)})
}
# Real report serialization must retain enough precision to reconstruct the exact relative position.
$snapshot=ConvertTo-Json -Depth 30 -InputObject ([ordered]@{observations=(@($cases[0].observations)+@($cases[1].observations)+@($cases[2].observations)+@($cases[3].observations))}) | ConvertFrom-Json
$roundTrip=$snapshot.observations
foreach($position in $roundTrip) {
 if([double]$position.relativeLeftPoints -ne ([double]$position.boundLeftPoints-[double]$position.shape.left)) { throw 'JSON round-trip lost the native shape coordinate; no tolerance is permitted' }
}
$cases+=@([ordered]@{name='actual-PS5-JSON-coordinate-roundtrip';passed=$true;positions=$roundTrip.Count;tolerance=0})
# Only byte/ZIP/XML facts: no Office or worker entrypoint. Original bytes are copied unchanged for independent review.
Add-Type -AssemblyName System.IO.Compression
$original=Expand-Gzip (Join-Path $folder 'references/original09.pptx.gz');if((Hash-Bytes $original) -cne $source.originalArchiveSha256){throw 'Original09 changed'}
[IO.File]::WriteAllBytes((Join-Path $ReportDirectory 'original09.pptx'),$original)
$stream=[IO.MemoryStream]::new($original,$false);$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Read,$false)
try{if($zip.Entries.Count -ne 147){throw 'Original09 part count differs'};$entries=@($zip.Entries|ForEach-Object {$_.FullName});$slide=$zip.GetEntry('ppt/slides/slide1.xml');$reader=New-Object IO.StreamReader($slide.Open());try{[xml]$xml=$reader.ReadToEnd()}finally{$reader.Dispose()};$ns=New-Object Xml.XmlNamespaceManager($xml.NameTable);$ns.AddNamespace('p','http://schemas.openxmlformats.org/presentationml/2006/main');$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main');$shapes=@($xml.SelectNodes('/p:sld/p:cSld/p:spTree/p:sp',$ns));if($shapes.Count -ne 3){throw 'Original09 shape count differs'};foreach($plan in $plans){$shape=$shapes[$plan.index-1];$nv=$shape.SelectSingleNode('p:nvSpPr/p:cNvPr',$ns);$texts=@($shape.SelectNodes('.//a:t',$ns)|ForEach-Object {$_.InnerText});if($nv.GetAttribute('id') -cne [string]$plan.id -or $nv.GetAttribute('name') -cne $plan.name -or ($texts -join '') -cne $plan.text){throw 'Fixed original09 text/shape binding differs'}}}finally{$zip.Dispose();$stream.Dispose()}
$result=[ordered]@{mode='PURE_MANAGED_ONLY';checkerSha256=(Get-FileHash $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();workerSha256=(Get-FileHash $worker -Algorithm SHA256).Hash.ToLowerInvariant();baseWorkerSha256=(Hash-Bytes $baseBytes);protectedFunctions=$protected;cases=$cases;originalArchiveSha256=(Hash-Bytes $original);zipPartNamesInOrder=$entries;samplePlan=$source.samplePlan;nativeRun=$false;validateOnlyRun=$false;officeActivated=$false;glyphFix=$false;currentRuntimeAcceptance=$false}
$result|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $ReportDirectory 'managed.json') -Encoding UTF8
Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{passed=$true;cases=$cases.Count;protectedFunctions=$protected.Count;originalParts=$entries.Count;officeActivated=$false;nativeRun=$false}))
