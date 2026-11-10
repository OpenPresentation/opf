param([Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
$here=$PSScriptRoot;$worker=Join-Path $here 'worker-package/test/native-furniture-control.ps1'
$errors=$null;$tokens=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
function Expand-Gzip([string]$Path){$input=[IO.File]::OpenRead($Path);try{$gzip=[IO.Compression.GZipStream]::new($input,[IO.Compression.CompressionMode]::Decompress);$out=[IO.MemoryStream]::new();try{$gzip.CopyTo($out);return ,$out.ToArray()}finally{$gzip.Dispose();$out.Dispose()}}finally{$input.Dispose()}}
$baselineText=[Text.Encoding]::UTF8.GetString((Expand-Gzip (Join-Path $here 'reference-worker.ps1.gz')))
$base=[Management.Automation.Language.Parser]::ParseInput($baselineText,[ref]$tokens,[ref]$errors)
function Find($Ast,[string]$Name){$all=@($Ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $Name},$true));if($all.Count -ne 1){throw "Function identity $Name"};return $all[0]}
function Check([bool]$Truth,[string]$Why){if(-not $Truth){throw $Why}}
$cases=[Collections.Generic.List[string]]::new();$protected=0
foreach($f in $base.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)){
 $now=Find $ast $f.Name
 if($f.Name -in @('Read-FurnitureState','Assert-FurnitureProofingInput')){Check ($now.Extent.Text -cne $f.Extent.Text) "Missing intended extension $($f.Name)"}
 else{Check ($now.Extent.Text -ceq $f.Extent.Text) "Protected function changed $($f.Name)";$protected++}
}
Check ($ast.ParamBlock.Extent.Text -ceq $base.ParamBlock.Extent.Text) 'Worker parameters changed'
function Supervisor($a){return @($a.FindAll({param($n)$n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text.StartsWith('if(-not $Worker) {')},$true))[0].Extent.Text}
Check ((Supervisor $ast) -ceq (Supervisor $base)) 'Supervisor changed'
$raw=[IO.File]::ReadAllText($worker);$tail="Write-FurnitureReport; Write-FurnitureStage 'worker.initialize' 'success'"
Check ($raw.Substring($raw.IndexOf($tail,[StringComparison]::Ordinal)) -ceq $baselineText.Substring($baselineText.IndexOf($tail,[StringComparison]::Ordinal))) 'Acquisition/SaveCopy/three-phase/ownedClose/Quit tail changed'
foreach($a in $ast.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst]},$true)){Check ($a.Left.Extent.Text -notmatch '\.(TextDirection|LanguageID)\b') 'Native setter introduced'}
Check ($raw -notmatch '\.(LtrRun|RtlRun)\b') 'Mutating direction API introduced'
$new=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|Where-Object {$n=$_.Name;-not @($base.FindAll({param($x)$x -is [Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -ceq $n},$true)).Count}|ForEach-Object {$_.Name})
Check (($new|Sort-Object)-join '|' -ceq 'Assert-FurnitureDirectionPhase|Read-FurnitureParagraphDirection') 'Unexpected new functions'
$cases.Add('all-protected-functions-supervisor-parameters-and-three-phase-tail-exact')
foreach($name in @('Get-FurnitureSha256','Test-Integer','Read-NativeTags','Read-FurnitureProperty','Read-FurnitureTextFont','Read-FurnitureProofingLanguage','Assert-FurnitureProofingPhase','Read-FurnitureParagraphDirection','Assert-FurnitureDirectionPhase','Read-FurnitureState','Read-FurnitureSeriesNameState','Invoke-FurnitureCom','Stop-FurnitureLifecycle','Write-FurnitureReport')){Invoke-Expression (Find $ast $name).Extent.Text}
Rename-Item Function:Write-FurnitureReport Write-ExactFurnitureReport
function Write-FurnitureReport{
 $script:writes++
 if($script:writes -eq $script:failWriteAt){throw 'Injected report IO failure'}
 Write-ExactFurnitureReport
 $script:snapshots.Add([IO.File]::ReadAllText($script:reportFile))
}
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$Message=$null){$script:events.Add($Name+':'+$Status)}
Add-Type -TypeDefinition @"
using System;
public class DirectionProbe {
 public object Value=1; public bool Throws=false; public int Calls=0;
 public object TextDirection { get { Calls++; if(Throws) throw new InvalidOperationException("Injected direction getter failure"); return Value; } }
}
public class RangeProbe {
 public string Text; public int LanguageID=1025; public DirectionProbe Probe=new DirectionProbe(); public bool Throws=false; public bool Missing=false; public int Calls=0;
 public object ParagraphFormat { get { Calls++; if(Throws) throw new InvalidOperationException("Injected paragraph getter failure"); return Missing ? null : Probe; } }
}
"@
$parent=Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath));if(-not(Test-Path $parent)){[void](New-Item -ItemType Directory -Path $parent)}
if(Test-Path -LiteralPath $ReportPath){throw 'Preserve existing pure report'}
$script:work=Join-Path $parent ('pure-'+[Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $script:work)
$reference=([Text.Encoding]::UTF8.GetString((Expand-Gzip (Join-Path $here 'reference-native-shapes.json.gz')))|ConvertFrom-Json).rows
function Collection($Values,[int]$Count){$c=[pscustomobject]@{Values=@($Values);Count=$Count};$c|Add-Member ScriptMethod Item {param([int]$i)return ,$this.Values[$i-1]};return ,$c}
function Fixture{
 $script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true;$script:lastStage='pure';$script:lastStatus='begin';$script:actions=@();$script:ReadOnlySurvey=$false;$script:CaptureTextFonts=$true
 $script:events=[Collections.Generic.List[string]]::new();$script:snapshots=[Collections.Generic.List[string]]::new();$script:exports=[Collections.Generic.List[string]]::new();$script:writes=0;$script:failWriteAt=-1
 $script:root=Join-Path $script:work ([Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $script:root);$script:reportFile=Join-Path $script:root 'report.json'
 $script:report=[ordered]@{proofingLanguage=[ordered]@{observations=@();completedPhases=@()};paragraphDirection=[ordered]@{observations=@();completedPhases=@()}}
 $shapes=@();$ranges=@();$tags=[pscustomobject]@{Count=0}
 foreach($row in $reference){$r=[RangeProbe]::new();$r.Text=$row.text;$r.Probe.Value=if($shapes.Count -eq 0){2}else{1};$ranges+=@($r);$font=[pscustomobject]@{Name=$row.font.name;Size=$row.font.sizePoints;Bold=$row.font.bold;Italic=$row.font.italic};$shapes+=@([pscustomobject]@{Id=$row.id;Name=$row.name;Type=$row.type;Left=$row.left;Top=$row.top;Width=$row.width;Height=$row.height;Rotation=$row.rotation;HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=$r};TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Font=$font}};AlternativeText=$row.alternativeText;Tags=$tags})}
 $slide=[pscustomobject]@{SlideID=256;Name='Slide1';Tags=$tags;Shapes=(Collection $shapes 3)}
 $slide|Add-Member ScriptMethod Export {param($Path,$Format,$Width,$Height) if($Format -cne 'PNG' -or $Width -ne 1280 -or $Height -ne 720){throw 'Mock export boundary changed'};$script:exports.Add($script:phase);[IO.File]::WriteAllText($Path,'PURE MOCK boundary; never native pixels')}
 return [pscustomobject]@{presentation=[pscustomobject]@{Slides=(Collection @($slide) 1)};shapes=$shapes;ranges=$ranges}
}
function Phase($f,[string]$p){$script:phase=$p;return Read-FurnitureState $f.presentation $p}
function Latched([string]$Name,[int]$Count=0){Check ($script:officeOperationsStopped -and -not $script:cleanupConfirmed) "$Name not fail-stopped";Check ($script:exports.Count -eq $Count) "$Name exported after failure";$script:later=$false;$before=$script:events.Count;try{Invoke-FurnitureCom 'forbidden.later' {$script:later=$true}}catch{};Check (-not $script:later -and $script:events.Count -eq $before) "$Name made a later COM operation"}
function One($f,[string]$Phase='original',[int]$Slide=1,[string]$Name=$reference[0].name,[string]$Prefix='original.slide-1.shape-1',[string]$Text=$reference[0].text){return Read-FurnitureParagraphDirection $f.ranges[0] $Text $Phase $Slide $Name $Prefix}
$passed=$false
try{
 $f=Fixture;$states=@();foreach($p in @('original','edited','reopened')){$states+=@(Phase $f $p)}
 Check ($report.paragraphDirection.observations.Count -eq 9 -and $report.proofingLanguage.observations.Count -eq 9 -and $exports.Count -eq 3) 'Nine exact direction/proofing observations and three phase PNG boundaries required'
 foreach($state in $states){for($i=0;$i -lt 3;$i++){$row=$state.slides[0].shapes[$i];Check ([string]::Equals($row.text,$reference[$i].text,[StringComparison]::Ordinal)) 'UTF16 changed';foreach($k in @('left','top','width','height','rotation')){Check ($row[$k] -eq $reference[$i].$k) "Geometry $k changed"};foreach($k in @('name','sizePoints','bold','italic')){Check ($row.textFont[$k] -ceq $reference[$i].font.$k) "Font $k changed"};Check ($row.textProofingLanguage.languageId -eq 1025) 'Proofing changed'}}
 Check (($report.paragraphDirection.completedPhases -join '|') -ceq 'original|edited|reopened') 'Direction phase order changed';$cases.Add('actual-reader-mocks-nine-getters-three-phases-original-UTF16-font-geometry-exact')
 foreach($value in @(1,2,-2)){$f=Fixture;$f.ranges[0].Probe.Value=$value;$null=One $f;Check (-not $script:officeOperationsStopped) 'Diagnostic enum incorrectly treated as acceptance';Check (@($snapshots|Where-Object {$_ -match '"classification":\s*"pending"' -and $_ -match ('"observedValue":\s*'+$value+'[,\s]')}).Count -gt 0) 'Observed primitive not persisted before classification';$cases.Add('valid-observation-not-acceptance-'+$value)}
 foreach($bad in @(@('null',$null),@('string','1'),@('fraction',1.5),@('boolean',$true),@('enum',0),@('object',[pscustomobject]@{x=1}))){$f=Fixture;$f.ranges[0].Probe.Value=$bad[1];$rejected=$false;try{$null=One $f}catch{$rejected=$true};Check $rejected ('Accepted invalid '+$bad[0]);Latched $bad[0];Check ($report.paragraphDirection.observations[0].status -ceq 'failed') 'Invalid value not retained';$cases.Add('reject-direction-'+$bad[0])}
 foreach($mode in @('direction-throw','paragraph-throw','paragraph-missing','write-begin','write-observed')){$f=Fixture;switch($mode){'direction-throw'{$f.ranges[0].Probe.Throws=$true};'paragraph-throw'{$f.ranges[0].Throws=$true};'paragraph-missing'{$f.ranges[0].Missing=$true};'write-begin'{$script:failWriteAt=1};'write-observed'{$script:failWriteAt=2}};$rejected=$false;try{$null=One $f}catch{$rejected=$true};Check $rejected "$mode accepted";Latched $mode;if($mode -eq 'write-begin'){Check ($f.ranges[0].Calls -eq 0) 'COM getter after initial persistence failure'};$cases.Add('fail-stop-'+$mode)}
 foreach($mode in @('phase','slide','name','case','prefix','text','newline')){$f=Fixture;$rejected=$false;try{switch($mode){'phase'{$null=One $f 'foreign'};'slide'{$null=One $f 'original' 2};'name'{$null=One $f 'original' 1 'Foreign'};'case'{$null=One $f 'original' 1 'opf heading slides.0.title line 0'};'prefix'{$null=One $f 'original' 1 $reference[0].name 'edited.slide-1.shape-1'};'text'{$null=One $f 'original' 1 $reference[0].name 'original.slide-1.shape-1' 'Changed'};'newline'{$null=One $f 'original' 1 $reference[0].name 'original.slide-1.shape-1' ($reference[0].text+"`r")}}}catch{$rejected=$true};Check $rejected "$mode binding accepted";Latched $mode;Check ($f.ranges[0].Calls -eq 0) 'Binding refusal after getter';$cases.Add('reject-binding-'+$mode)}
 $f=Fixture;$null=One $f;$rejected=$false;try{$null=One $f}catch{$rejected=$true};Check $rejected 'Duplicate pair accepted';Latched 'duplicate';$cases.Add('reject-duplicate-pair')
 $f=Fixture;$null=Phase $f 'original';$rejected=$false;try{$null=Phase $f 'reopened'}catch{$rejected=$true};Check $rejected 'Skipped phase accepted';Latched 'skipped-phase' 1;$cases.Add('reject-skipped-phase')
 foreach($mode in @('missing','duplicate','foreign','prefix','unobserved')){$f=Fixture;for($i=0;$i -lt 3;$i++){$null=Read-FurnitureParagraphDirection $f.ranges[$i] $reference[$i].text 'original' 1 $reference[$i].name ('original.slide-1.shape-'+($i+1))};switch($mode){'missing'{$report.paragraphDirection.observations=@($report.paragraphDirection.observations[0..1])};'duplicate'{$report.paragraphDirection.observations[2].shapeName=$reference[0].name};'foreign'{$report.paragraphDirection.observations[2].shapeName='Foreign'};'prefix'{$report.paragraphDirection.observations[2].prefix='foreign'};'unobserved'{$report.paragraphDirection.observations[2].status='begin'}};$rejected=$false;try{Assert-FurnitureDirectionPhase 'original' $true}catch{$rejected=$true};Check $rejected "$mode phase accepted";Latched $mode;$cases.Add('reject-phase-'+$mode)}
 $passed=$true
}finally{[ordered]@{passed=$passed;officeConstructed=$false;workerEntrypointExecuted=$false;protectedFunctions=$protected;cases=@($cases.ToArray());scope='Actual source functions with managed getter mocks and literal fake PNG boundaries; no Office/native acceptance.'}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $ReportPath -Encoding UTF8}
Write-Output ('PASS pure direction source controls: '+$cases.Count)