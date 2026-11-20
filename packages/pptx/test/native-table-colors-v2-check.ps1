param([Parameter(Mandatory=$true)][string]$WorkerPath,[Parameter(Mandatory=$true)][string]$GenerationFile,[Parameter(Mandatory=$true)][string]$ReportPath,[Parameter(Mandatory=$true)][string]$ArchiveDirectory)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve the pure table control report' }
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($WorkerPath,[ref]$tokens,[ref]$errors)
if($errors.Count) { throw ($errors | Out-String) }
foreach($name in @('Get-TableHash','Assert-TableArchive','Assert-TablePlainPath','Read-TableEnvironment','Assert-TableWorkerAuthorization','Write-TableStage','Stop-TableLifecycle','Assert-TableCondition','Invoke-TableCom','Own-TableApplication','Open-TableOwned','Read-TableObject','Get-TableCharacterProbe','Write-TableCharacterProbe','Read-TablePhase','Edit-TablePrefixes','Save-TableCopy','Close-TableOwned','Quit-TableOwned','Invoke-TableLifecycle')) {
    $definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)
    if($null -eq $definition) { throw "Missing actual source helper: $name" };Invoke-Expression $definition.Extent.Text
}
$archiveResults=New-Object 'System.Collections.Generic.List[object]'
$archiveCases=Get-Content -LiteralPath (Join-Path $ArchiveDirectory 'cases.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($case in $archiveCases) {
    $caught=$null
    try {Assert-TableArchive (Join-Path $ArchiveDirectory $case.file)} catch {$caught=$_.Exception.Message}
    if($case.pass -and $null -ne $caught) {throw "Actual archive validator rejected positive: $caught"}
    if(-not $case.pass -and ($null -eq $caught -or ($case.message -and -not $caught.Contains($case.message)))) {throw "Archive mutant did not fail its actual bound: $($case.file):$caught"}
    $archiveResults.Add([pscustomobject]@{name=('archive-'+$case.file);passed=$true;expectedAcceptance=$case.pass})
}
try {Assert-TablePlainPath '\\server\share\file.pptx';throw 'UNC unexpectedly accepted'} catch {if($_.Exception.Message -cne 'Local table paths only') {throw}}
$archiveResults.Add([pscustomobject]@{name='pure-path-UNC-refusal';passed=$true})
$authProfile=[pscustomobject]@{suiteSha256=('a'*64);generationIdentity=[pscustomobject]@{kind='original'};controller=[pscustomobject]@{kind='new'}}
$authBase=[pscustomobject]@{schemaVersion=2;profile='table-colors-v2';envelopeSha256=('b'*64);sourceSuiteSha256=('a'*64);runOfficeRequested=$true;status='native-worker-pending';timeoutSeconds=45;generationIdentity=$authProfile.generationIdentity;executionIdentity=$authProfile.controller}
Assert-TableWorkerAuthorization $authBase $authProfile ('b'*64)
$archiveResults.Add([pscustomobject]@{name='explicit-supervisor-positive';passed=$true})
foreach($name in @('flag','status','sha','generation','controller','timeout','timeout-type')) {
    $auth=$authBase | ConvertTo-Json -Depth 10 | ConvertFrom-Json
    switch($name) {'flag' {$auth.runOfficeRequested=$false};'status' {$auth.status='failed; no-retry'};'sha' {$auth.envelopeSha256='0'*64};'generation' {$auth.generationIdentity.kind='changed'};'controller' {$auth.executionIdentity.kind='old'};'timeout' {$auth.timeoutSeconds=61};'timeout-type' {$auth.timeoutSeconds='45'}}
    $caught=$false;try {Assert-TableWorkerAuthorization $auth $authProfile ('b'*64)} catch {$caught=$true};if(-not $caught) {throw "Invalid supervisor accepted: $name"}
    $archiveResults.Add([pscustomobject]@{name=('supervisor-'+$name);passed=$true})
}
# These managed objects emulate the exact object members used by the imported
# source functions. No COM factory, Office entrypoint, UI or process is invoked.
Add-Type -TypeDefinition @"
using System;using System.Collections.Generic;using System.IO;
public static class TableFake {
 public static string Stage,Fail,ForeignStage,BinaryDirectory;public static bool BadPath,BadReadonly,BadColor,BadText,BadEdit,BadSlides,BadDimensions,BadShapes,IdleBusy,NullRgb,ThrowRgb;
 public static int Calls,Closes,Quits;public static List<string> Captures=new List<string>();public static List<string> Opens=new List<string>();
 public static List<TFTable> Source;public static Dictionary<string,List<TFTable>> Saved=new Dictionary<string,List<TFTable>>(StringComparer.OrdinalIgnoreCase);
 public static void Touch(){Calls++;if(Stage==Fail)throw new InvalidOperationException("injected "+Stage);}
 public static List<TFTable> Clone(List<TFTable> source){var r=new List<TFTable>();foreach(var t in source)r.Add(t.Copy());return r;}
 public static void Reset(){Stage="";Fail=null;ForeignStage=null;BadPath=BadReadonly=BadColor=BadText=BadEdit=BadSlides=BadDimensions=BadShapes=IdleBusy=NullRgb=ThrowRgb=false;Calls=Closes=Quits=0;Captures.Clear();Opens.Clear();Saved.Clear();}
}
public class TFCount {public int Count {get{TableFake.Touch();return TableFake.BadDimensions?3:2;}}}
public class TFColor {int value;public TFColor(int v){value=v;}public object RGB {get{TableFake.Touch();if(TableFake.ThrowRgb)throw new InvalidOperationException("RGB getter");if(TableFake.NullRgb)return null;return TableFake.BadColor?123456:value;}}}
public class TFFont {int value;public TFFont(int v){value=v;}public TFColor Color {get{TableFake.Touch();return new TFColor(value);}}}
public class TFChar {int value;public TFChar(int v){value=v;}public TFFont Font {get{TableFake.Touch();return new TFFont(value);}}}
public class TFRange {
 public string Value;public int[] Colors;public TFRange(string text,int[] colors){Value=text;Colors=colors;}
 public string Text {get{TableFake.Touch();return TableFake.BadText?"WRONG":Value;}set{TableFake.Touch();if(!TableFake.BadEdit)Value=value;}}
 public TFChar Characters(int i,int n){TableFake.Touch();int index=Value.StartsWith("Native ")?Math.Max(0,i-8):i-1;return new TFChar(Colors[Math.Min(index,Colors.Length-1)]);}
 public TFRange Copy(){return new TFRange(Value,(int[])Colors.Clone());}
}
public class TFFrame {TFRange r;public TFFrame(TFRange value){r=value;}public TFRange TextRange {get{TableFake.Touch();return r;}}}
public class TFCellShape {TFRange r;public TFCellShape(TFRange value){r=value;}public TFFrame TextFrame {get{TableFake.Touch();return new TFFrame(r);}}}
public class TFCell {TFRange r;public TFCell(TFRange value){r=value;}public TFCellShape Shape {get{TableFake.Touch();return new TFCellShape(r);}}}
public class TFTable {
 public List<TFRange> Values=new List<TFRange>();public TFCount Rows {get{TableFake.Touch();return new TFCount();}}public TFCount Columns {get{TableFake.Touch();return new TFCount();}}
 public TFCell Cell(int row,int col){TableFake.Touch();return new TFCell(Values[(row-1)*2+col-1]);}
 public TFTable Copy(){var t=new TFTable();foreach(var r in Values)t.Values.Add(r.Copy());return t;}
}
public class TFShape {TFTable t;public TFShape(TFTable value){t=value;}public int HasTable {get{TableFake.Touch();return -1;}}public TFTable Table {get{TableFake.Touch();return t;}}}
public class TFShapes {TFTable t;public TFShapes(TFTable value){t=value;}public int Count {get{TableFake.Touch();return TableFake.BadShapes?2:1;}}public TFShape Item(int i){TableFake.Touch();if(i!=1)throw new Exception("shape index");return new TFShape(t);}}
public class TFSlide {
 TFTable t;int index;public TFSlide(TFTable value,int i){t=value;index=i;}public TFShapes Shapes {get{TableFake.Touch();return new TFShapes(t);}}
 public void Export(string file,string format,int width,int height){TableFake.Touch();if(format!="PNG"||width!=1280||height!=720)throw new Exception("capture options");TableFake.Captures.Add(Path.GetFileName(file));File.WriteAllText(file,"synthetic png "+index);}
}
public class TFSlides {
 List<TFTable> tables;public TFSlides(List<TFTable> value){tables=value;}public int Count {get{TableFake.Touch();return TableFake.BadSlides?5:tables.Count;}}
 public TFSlide Item(int index){TableFake.Touch();return new TFSlide(tables[index-1],index);}
}
public class TFPresentation {
 public string File;public List<TFTable> Tables;TFPresentations owner;public TFPresentation(string file,List<TFTable> tables,TFPresentations parent){File=file;Tables=tables;owner=parent;}
 public string FullName {get{TableFake.Touch();return TableFake.BadPath?File+"-foreign":File;}}public int ReadOnly {get{TableFake.Touch();return TableFake.BadReadonly?0:-1;}}
 public TFSlides Slides {get{TableFake.Touch();return new TFSlides(Tables);}}public int Saved {set{TableFake.Touch();if(value!=-1)throw new Exception("discard value");}}
 public void SaveCopyAs(string file,int format){TableFake.Touch();if(format!=24||System.IO.File.Exists(file))throw new Exception("fresh copy options");TableFake.Saved[file]=TableFake.Clone(Tables);System.IO.File.WriteAllText(file,"synthetic archive "+file);}
 public void Close(){TableFake.Touch();TableFake.Closes++;owner.Opened=null;}
}
public class TFPresentations {
 public TFPresentation Opened;public int Count {get{TableFake.Touch();return TableFake.Stage==TableFake.ForeignStage?1:(Opened==null?0:1);}}
 public TFPresentation Open(string file,int readOnly,int untitled,int withWindow){TableFake.Touch();if(Opened!=null||readOnly!=-1||untitled!=0||withWindow!=0)throw new Exception("read-only hidden owned open options");TableFake.Opens.Add(file);List<TFTable> source=TableFake.Saved.ContainsKey(file)?TableFake.Saved[file]:TableFake.Source;Opened=new TFPresentation(file,TableFake.Clone(source),this);return Opened;}
}
public class TFApplication {public TFApplication(){TableFake.Touch();}public string Version{get{TableFake.Touch();return "managed.fake";}}public string Path{get{TableFake.Touch();return TableFake.BinaryDirectory;}}TFPresentations p=new TFPresentations();public TFPresentations Presentations {get{TableFake.Touch();return p;}}public void Quit(){TableFake.Touch();if(p.Opened!=null)throw new Exception("quit nonempty");TableFake.Quits++;}}
"@
# Other lifecycle controls keep diagnostics in memory; the color/null and I/O
# fault controls below exercise the actual durable writer before refusal.
$actualProbeWriter=(Get-Command Write-TableCharacterProbe).ScriptBlock
function Write-TableCharacterProbe($Probe) {
    if($script:durableProbes) {& $actualProbeWriter $Probe} else {$script:report.currentCellProbe=$Probe}
}
function Write-TableStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++;$script:lastStage=$Name;$script:lastStatus=$Status;[TableFake]::Stage=$Name
    $script:stages.Add([pscustomobject]@{stage=$Name;status=$Status;error=$ErrorMessage})
}
function Assert-TableOfficeIdle { if([TableFake]::IdleBusy) { Stop-TableLifecycle 'PowerPoint already running; refuse attachment' } }
function New-TableApplication { return Invoke-TableCom 'application.create' {New-Object TFApplication} }
function Assert-TableArchive([string]$Path) { if(-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'Missing synthetic derivative' } }
$generation=Get-Content -LiteralPath $GenerationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$parent=Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath));$scratch=Join-Path $parent ([IO.Path]::GetFileName($ReportPath)+'.cases')
[void](New-Item -ItemType Directory -Path $scratch)
$results=New-Object 'System.Collections.Generic.List[object]'
foreach($result in $archiveResults) {$results.Add($result)}
function Setup-TableCase([string]$Name) {
    [TableFake]::Reset();$script:durableProbes=$false;$script:root=Join-Path $scratch $Name;[void](New-Item -ItemType Directory -Path $script:root)
    $script:sourcePath=Join-Path $script:root 'input.pptx';$script:savedPath=Join-Path $script:root 'saved.pptx';$script:editedPath=Join-Path $script:root 'edited.pptx';[IO.File]::WriteAllText($script:sourcePath,'synthetic source')
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:ownedPath=$null;$script:presentation=$null;$script:app=$null;$script:report=[ordered]@{original=@();reopened=@();edited=@();edits=@();opens=@()};$script:generation=$generation
    [TableFake]::BinaryDirectory=$script:root;[IO.File]::WriteAllText((Join-Path $script:root 'POWERPNT.EXE'),'Not an executable; managed-only table control fixture')
    $script:archiveHashes=@{};$script:archiveHashes[$script:sourcePath]=Get-TableHash $script:sourcePath;$script:stages=New-Object 'System.Collections.Generic.List[object]'
    $tables=New-Object 'System.Collections.Generic.List[TFTable]'
    foreach($slide in $generation.expected) {
        $table=New-Object TFTable
        foreach($cell in $slide.cells) {
            $text=($cell.runs | ForEach-Object {$_.text}) -join '';$colors=New-Object 'System.Collections.Generic.List[int]'
            foreach($run in $cell.runs) { $hex=$run.color.Substring(1);$rgb=[Convert]::ToInt32($hex.Substring(0,2),16)+([Convert]::ToInt32($hex.Substring(2,2),16) -shl 8)+([Convert]::ToInt32($hex.Substring(4,2),16) -shl 16);for($i=0;$i -lt $run.text.Length;$i++) {$colors.Add($rgb)} }
            $table.Values.Add((New-Object TFRange($text,$colors.ToArray())))
        }
        $tables.Add($table)
    }
    [TableFake]::Source=$tables
}
Setup-TableCase 'complete';Invoke-TableLifecycle
if([TableFake]::Opens.Count -ne 3 -or [TableFake]::Captures.Count -ne 18 -or [TableFake]::Closes -ne 3 -or [TableFake]::Quits -ne 1 -or $script:report.edits.Count -ne 6 -or -not $script:cleanup -or $script:stopped) { throw 'Complete actual-source lifecycle counts differ' }
foreach($phase in @('original','reopened','edited')) { if($script:report[$phase].Count -ne 6 -or @($script:report[$phase] | ForEach-Object {$_.cells}).Count -ne 24) { throw 'Incomplete native phase cell observations' } }
if($script:report.environment.powerPointVersion -cne 'managed.fake' -or $script:report.environment.executableSha256 -cne (Get-TableHash (Join-Path $script:root 'POWERPNT.EXE')) -or [string]::IsNullOrEmpty($script:report.environment.windowsBuild)) {throw 'Descriptive metadata was not read from the managed control, or was fabricated'}
$results.Add([pscustomobject]@{name='complete-3opens-2saves-3closes-1quit-18captures-72cells-6edits';passed=$true})
$failStages=@('application.version','application.path','application.create','original.open','original.saveCopyAs','original.close','reopened.open','edited.saveCopyAs','reopened.close','edited.open','edited.close','application.quit')
foreach($phase in @('original','reopened','edited')) { for($i=1;$i -le 6;$i++) {$failStages+=@("$phase.slide.$i.capture")} }
for($i=1;$i -le 6;$i++) {$failStages+=@("edit.slide.$i.prefix")}
$failStages+=@('original.slide.1.cell.1.1.character.1.color','original.close.discard','reopened.close.discard','edited.close.discard')
$mutants=@('idle','foreign-initial','foreign-original','foreign-reopened','foreign-edited','foreign-final','path','readonly','text','color','edit','slides','dimensions','shapes','stale-save','stale-capture','rgb-null','rgb-getter-throws','probe-write-failure')
foreach($name in @($failStages)+$mutants) {
    $safe=$name -replace '[^A-Za-z0-9-]','-';Setup-TableCase $safe
    if($failStages -ccontains $name) {[TableFake]::Fail=$name}
    switch -CaseSensitive ($name) {
      'idle' {[TableFake]::IdleBusy=$true}
      'foreign-initial' {[TableFake]::ForeignStage='application.initial.count'}
      'foreign-original' {[TableFake]::ForeignStage='original.preflight.count'}
      'foreign-reopened' {[TableFake]::ForeignStage='reopened.preflight.count'}
      'foreign-edited' {[TableFake]::ForeignStage='edited.preflight.count'}
      'foreign-final' {[TableFake]::ForeignStage='application.final.count'}
      'path' {[TableFake]::BadPath=$true}
      'readonly' {[TableFake]::BadReadonly=$true}
      'text' {[TableFake]::BadText=$true}
      'color' {[TableFake]::BadColor=$true;$script:durableProbes=$true}
      'edit' {[TableFake]::BadEdit=$true}
      'slides' {[TableFake]::BadSlides=$true}
      'dimensions' {[TableFake]::BadDimensions=$true}
      'shapes' {[TableFake]::BadShapes=$true}
      'rgb-null' {[TableFake]::NullRgb=$true;$script:durableProbes=$true}
      'probe-write-failure' {$script:durableProbes=$true;[void](New-Item -ItemType Directory -Path (Join-Path $script:root 'character-probes.jsonl'))}
      'rgb-getter-throws' {[TableFake]::ThrowRgb=$true}
      'stale-save' {[IO.File]::WriteAllText($script:savedPath,'old attempt')}
      'stale-capture' {[IO.File]::WriteAllText((Join-Path $script:root 'original-1.png'),'old capture')}
    }
    $caught=$false;try {Invoke-TableLifecycle} catch {$caught=$true}
    if(-not $caught -or -not $script:stopped -or $script:cleanup) { throw "Failure did not latch: $name" }
    if($name -in @('rgb-null','rgb-getter-throws') -and $script:lastStage -cne 'original.slide.1.cell.1.1.character.1.color') {throw 'Unavailable RGB was converted to black or Office continued after the first failed color probe'}
    if($name -in @('color','rgb-null')) {
        $probe=Get-Content -LiteralPath (Join-Path $script:root 'character-probes.jsonl') -Raw -Encoding UTF8 | ConvertFrom-Json
        if($probe.phase -cne 'original' -or $probe.slide -ne 1 -or $probe.row -ne 1 -or $probe.column -ne 1 -or $probe.characterIndex -ne 1 -or $probe.character -cne 'H' -or $probe.expectedColor -cne '#000000' -or ($probe | ConvertTo-Json -Compress) -cne ($script:report.currentCellProbe | ConvertTo-Json -Compress)) {throw 'Color refusal lost the exact current-cell diagnostic'}
        if($name -ceq 'color' -and ($probe.actualRgb -ne 123456 -or $probe.actualType -cne 'System.Int32' -or $probe.actualHex -cne '#40E201' -or -not $probe.rgbValid)) {throw 'Wrong-color observation was not persisted before validation'}
        if($name -ceq 'rgb-null' -and ($null -ne $probe.actualRgb -or $null -ne $probe.actualType -or $null -ne $probe.actualHex -or $probe.rgbValid)) {throw 'Unavailable color was fabricated in durable diagnostic'}
    }
    if($name -ceq 'probe-write-failure' -and $script:lastStage -cne 'original.slide.1.cell.1.1.character.1.color') {throw 'Office continued after diagnostic write failure'}
    $calls=[TableFake]::Calls;$stageCount=$script:stages.Count
    try {Invoke-TableCom 'forbidden-after-failure' {[TableFake]::Touch()};throw 'Unexpected call after latch'} catch {if($_.Exception.Message -cne 'Table Office operations stopped after failure') {throw}}
    if([TableFake]::Calls -ne $calls -or $script:stages.Count -ne $stageCount) { throw "Office/cleanup continued after failure: $name" }
    $results.Add([pscustomobject]@{name=$name;passed=$true;calls=$calls;closeCalls=[TableFake]::Closes;quitCalls=[TableFake]::Quits;noCallsAfterFailure=$true})
}
[ordered]@{sourceWorkerSha256=(Get-FileHash -LiteralPath $WorkerPath -Algorithm SHA256).Hash.ToLowerInvariant();scope='Imported actual table-v2 functions with managed fake objects only; no Office/COM; no physical/native acceptance';cases=$results;passed=$true} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Output "Pure table-v2 source lifecycle controls passed: $($results.Count). No Office invoked."
