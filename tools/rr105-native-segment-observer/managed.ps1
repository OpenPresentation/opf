param([Parameter(Mandatory=$true)][string]$Worker,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) 'SOURCE.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$script:expectation=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) $source.cases[2].expectation) -Raw -Encoding UTF8 | ConvertFrom-Json
if(Test-Path -LiteralPath $Output) { throw 'Select fresh managed-test output' }
[void](New-Item -ItemType Directory -Path $Output)
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Worker,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
# Load actual worker functions only. The executable bootstrap, COM factory and supervisor are never evaluated.
$excluded=@()
foreach($f in @($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))) {
    if($f.Name -notin $excluded) { Invoke-Expression ($f.Extent.Text -replace '^function\s+','function script:') }
}
# Factory/preflight interception is test-owned. No actual COM factory or process query is called.
function global:New-Object {
    param([string]$TypeName,[object[]]$ArgumentList,[string]$ComObject)
    if($ComObject) { if($ComObject -cne 'PowerPoint.Application') {throw 'Unexpected factory'};[ReferenceWitnessFake]::Hit('application.factory');return $script:mockApp }
    return Microsoft.PowerShell.Utility\New-Object @PSBoundParameters
}
function global:Get-Process { param([string]$Name);if($Name -cne 'POWERPNT'){throw 'Unexpected process query'};[ReferenceWitnessFake]::Hit('global.preflight');if([ReferenceWitnessFake]::Mutant -ceq 'busyOffice'){return [pscustomobject]@{Id=12345}} }

function global:Stop-Process { throw 'Mock test forbids process termination' }
function global:Start-Process { throw 'Mock test forbids native child processes' }
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Collections.Generic;
public static class ReferenceWitnessFake {
 public static List<SegmentExpected> Expected = new List<SegmentExpected>(); public static List<string> Calls = new List<string>(); public static string Fault; public static string Mutant; public static string Directory; public static int UnexpectedReads; public static int PresentationCountReads;
 public static void Hit(string name) { Calls.Add(name); if(name == Fault) throw new InvalidOperationException("managed fault: " + name); }
 public static void Reset(string dir,string fault,string mutant) { Calls.Clear();Fault=fault;Mutant=mutant;Directory=dir;UnexpectedReads=0;PresentationCountReads=0; }
}
public sealed class SegmentExpected { public int Id;public string Name;public string Text;public int LanguageId;public float FontSize;public float Left;public float Top;public float Width;public float Height;}
public sealed class ReferenceWitnessUnexpected { public int ForbiddenGetter { get { ReferenceWitnessFake.UnexpectedReads++; return 42; } } }
public sealed class ReferenceWitnessApp {
 public ReferenceWitnessPresentations Collection; public ReferenceWitnessApp() { Collection=new ReferenceWitnessPresentations(this); }
 public ReferenceWitnessPresentations Presentations { get { ReferenceWitnessFake.Hit("app.presentations");return Collection; } }
 public string Version { get { ReferenceWitnessFake.Hit("app.version");return "managed-only"; } }
 public string Path { get { ReferenceWitnessFake.Hit("app.path");return ReferenceWitnessFake.Directory; } }
 public void Quit() { ReferenceWitnessFake.Hit("app.quit");if(Collection.Current!=null)throw new Exception("nonempty quit"); }
}
public sealed class ReferenceWitnessPresentations {
 public ReferenceWitnessApp App;public ReferenceWitnessPresentation Current;
 public ReferenceWitnessPresentations(ReferenceWitnessApp app) { App=app; }
 public int Count { get { ReferenceWitnessFake.Hit("presentations.count");ReferenceWitnessFake.PresentationCountReads++;if(ReferenceWitnessFake.Mutant=="busyApplication"||(ReferenceWitnessFake.Mutant=="foreignBeforeOpen"&&ReferenceWitnessFake.PresentationCountReads>=2)||(ReferenceWitnessFake.Mutant=="foreignBeforeQuit"&&ReferenceWitnessFake.PresentationCountReads>=4))return 1;return Current==null?0:1; } }
 public ReferenceWitnessPresentation Open(string path,int readOnly,int untitled,int withWindow) { ReferenceWitnessFake.Hit("open."+(path.EndsWith("saved.pptx")?"saved":"original"));if(readOnly!=-1||untitled!=0||withWindow!=0)throw new Exception("incorrect open flags");if(Current!=null)throw new Exception("nonempty open");Current=new ReferenceWitnessPresentation(this,path);return Current; }
}
public sealed class ReferenceWitnessPresentation {
 public ReferenceWitnessPresentations Owner;public string File;public string Phase;
 public ReferenceWitnessPresentation(ReferenceWitnessPresentations owner,string path) { Owner=owner;File=path;Phase=path.EndsWith("saved.pptx")?"saved":"original"; }
 public string FullName { get { ReferenceWitnessFake.Hit(Phase+".fullName");return ReferenceWitnessFake.Mutant=="foreignFullName"?File+".foreign":File; } }
 public int ReadOnly { get { ReferenceWitnessFake.Hit(Phase+".readOnly");return ReferenceWitnessFake.Mutant=="writable"?0:-1; } }
 public ReferenceWitnessSlides Slides { get { ReferenceWitnessFake.Hit(Phase+".slides");return new ReferenceWitnessSlides(this); } }
 public int Saved { set { ReferenceWitnessFake.Hit(Phase+".discard");if(value!=-1)throw new Exception("incorrect Saved"); } }
 public void Close() { ReferenceWitnessFake.Hit(Phase+".close");Owner.Current=null; }
 public void SaveCopyAs(string destination,int type) { ReferenceWitnessFake.Hit("saveCopyAs");if(type!=24||System.IO.File.Exists(destination))throw new Exception("incorrect copy");System.IO.File.Copy(File,destination,false); }
}
public sealed class ReferenceWitnessSlides {
 public ReferenceWitnessPresentation P;public ReferenceWitnessSlides(ReferenceWitnessPresentation p) {P=p;}
 public object Count {get {ReferenceWitnessFake.Hit(P.Phase+".slides.count");if(ReferenceWitnessFake.Mutant=="countObject")return new ReferenceWitnessUnexpected();return ReferenceWitnessFake.Mutant=="slideCount"?2:1;}}
 public ReferenceWitnessSlide Item(int n) {ReferenceWitnessFake.Hit(P.Phase+".slide."+n);return new ReferenceWitnessSlide(P,n);}
}
public sealed class ReferenceWitnessSlide {
 public ReferenceWitnessPresentation P;public int N;public string K {get{return P.Phase+".slide."+N;}}
 public ReferenceWitnessSlide(ReferenceWitnessPresentation p,int n) {P=p;N=n;}
 public int SlideID {get {ReferenceWitnessFake.Hit(K+".id");return N+255;}}
 public string Name {get {ReferenceWitnessFake.Hit(K+".name");return "Slide "+N;}}
 public ReferenceWitnessShapes Shapes {get {ReferenceWitnessFake.Hit(K+".shapes");return new ReferenceWitnessShapes(this);}}
 public void Export(string path,string format,int width,int height) {ReferenceWitnessFake.Hit(K+".export");if(format!="PNG"||width!=1280||height!=720||System.IO.File.Exists(path))throw new Exception("incorrect PNG export");System.IO.File.WriteAllBytes(path,new byte[33]);}
}
public sealed class ReferenceWitnessShapes {
 public ReferenceWitnessSlide S;public ReferenceWitnessShapes(ReferenceWitnessSlide s){S=s;}
 public int Count {get {ReferenceWitnessFake.Hit(S.K+".shapes.count");return ReferenceWitnessFake.Mutant=="shapeCount"?ReferenceWitnessFake.Expected.Count+1:ReferenceWitnessFake.Expected.Count;}}
 public ReferenceWitnessShape Item(int n){ReferenceWitnessFake.Hit(S.K+".shape."+n);return new ReferenceWitnessShape(S,n);}
}
public sealed class ReferenceWitnessShape {
 public ReferenceWitnessSlide S;public int N;public string K {get{return S.K+".shape."+N;}}
 public ReferenceWitnessShape(ReferenceWitnessSlide s,int n){S=s;N=n;}
 public SegmentExpected E {get{return ReferenceWitnessFake.Expected[N-1];}}
 public int Id {get {ReferenceWitnessFake.Hit(K+".id");return E.Id;}}
 public string Name {get {ReferenceWitnessFake.Hit(K+".name");return ReferenceWitnessFake.Mutant=="wrongName"?E.Name+".changed":E.Name;}}
 public int Type {get {ReferenceWitnessFake.Hit(K+".type");return N==1?14:17;}}
 public float Left {get {ReferenceWitnessFake.Hit(K+".left");return E.Left;}}
 public float Top {get {ReferenceWitnessFake.Hit(K+".top");return E.Top;}}
 public float Width {get {ReferenceWitnessFake.Hit(K+".width");return ReferenceWitnessFake.Mutant=="nonfinite"?Single.PositiveInfinity:ReferenceWitnessFake.Mutant=="wrongFrame"?E.Width+1:E.Width;}}
 public float Height {get {ReferenceWitnessFake.Hit(K+".height");return E.Height;}}
 public double Rotation {get {ReferenceWitnessFake.Hit(K+".rotation");return 0;}}
 public int HasTextFrame {get {ReferenceWitnessFake.Hit(K+".hasTextFrame");return ReferenceWitnessFake.Mutant=="badTriState"?2:-1;}}
 public string AlternativeText {get {ReferenceWitnessFake.Hit(K+".alternativeText");return "";}}
 public ReferenceWitnessTextFrame TextFrame {get {ReferenceWitnessFake.Hit(K+".textFrame");return new ReferenceWitnessTextFrame(K,E);}}
 public object Chart {get {ReferenceWitnessFake.Hit("FORBIDDEN.Chart");throw new Exception("forbidden Chart getter");}}
 public object ChartData {get {ReferenceWitnessFake.Hit("FORBIDDEN.ChartData");throw new Exception("forbidden ChartData getter");}}
 public object Series {get {ReferenceWitnessFake.Hit("FORBIDDEN.Series");throw new Exception("forbidden Series getter");}}
 public object Points {get {ReferenceWitnessFake.Hit("FORBIDDEN.Points");throw new Exception("forbidden Points getter");}}
 public object Workbook {get {ReferenceWitnessFake.Hit("FORBIDDEN.Workbook");throw new Exception("forbidden Workbook getter");}}
}
public sealed class ReferenceWitnessTextFrame {public string K;public SegmentExpected E;public ReferenceWitnessTextFrame(string k,SegmentExpected e){K=k;E=e;}public ReferenceWitnessTextRange TextRange {get {ReferenceWitnessFake.Hit(K+".textRange");return new ReferenceWitnessTextRange(K,E);}}}
public sealed class ReferenceWitnessTextRange {public string K;public SegmentExpected E;public ReferenceWitnessTextRange(string k,SegmentExpected e){K=k;E=e;}public object Text {get {ReferenceWitnessFake.Hit(K+".text");if(ReferenceWitnessFake.Mutant=="textObject")return new ReferenceWitnessUnexpected();return ReferenceWitnessFake.Mutant=="wrongText"?E.Text+"changed":E.Text;}} public int LanguageID {get {ReferenceWitnessFake.Hit(K+".languageId");return ReferenceWitnessFake.Mutant=="wrongLanguage"?1033:E.LanguageId;}} public ReferenceWitnessFont Font {get {ReferenceWitnessFake.Hit(K+".font");return new ReferenceWitnessFont(K,E);}}}
public sealed class ReferenceWitnessFont {public string K;public SegmentExpected E;public ReferenceWitnessFont(string k,SegmentExpected e){K=k;E=e;}public string Name {get {ReferenceWitnessFake.Hit(K+".fontName");return "Synthetic API font name; not physical font";}}public float Size {get {ReferenceWitnessFake.Hit(K+".fontSize");return ReferenceWitnessFake.Mutant=="wrongSize"?E.FontSize+1:E.FontSize;}}}

"@
$results=@()
function Initialize-ReferenceWitnessMock([string]$Name,[string]$Fault,[string]$Mutant) {
    $script:root=Join-Path $Output $Name;[void](New-Item -ItemType Directory -Path $script:root)
    [IO.File]::WriteAllText((Join-Path $script:root 'POWERPNT.EXE'),'synthetic metadata file; never executable')
    [ReferenceWitnessFake]::Reset($script:root,$Fault,$Mutant)
    [ReferenceWitnessFake]::Expected.Clear()
    foreach($e in $script:expectation.shapes) { $v=New-Object SegmentExpected;$v.Id=$e.id;$v.Name=$e.name;$v.Text=$e.text;$v.LanguageId=$e.languageId;$v.FontSize=$e.fontSize;$v.Left=$e.framePoints.left;$v.Top=$e.framePoints.top;$v.Width=$e.framePoints.width;$v.Height=$e.framePoints.height;[ReferenceWitnessFake]::Expected.Add($v) }
    $script:sourcePath=Join-Path $script:root 'case.pptx';[IO.File]::WriteAllText($script:sourcePath,'synthetic bytes; no actual native input')
    $script:savedPath=Join-Path $script:root 'saved.pptx';$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-ReferenceWitnessHash $script:sourcePath
    $script:mockApp=New-Object ReferenceWitnessApp
    $script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$true
    $script:report=[ordered]@{sourceSha256=$script:hashes[$script:sourcePath];savedSha256=$null;phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;lastStage=$null;lastStatus=$null}
}
Initialize-ReferenceWitnessMock 'success' '' ''
Write-ReferenceWitnessStage 'worker.initialize' 'success'
Invoke-ReferenceWitnessLifecycle
Write-ReferenceWitnessStage 'worker.complete' 'success'
if($script:report.opens.Count -ne 2 -or $script:report.closes -ne 2 -or $script:report.saveCopies -ne 1 -or $script:report.quits -ne 1 -or -not $script:cleanup -or $script:stopped -or @($script:report.phases.original.rasters).Count -ne 1 -or @($script:report.phases.'saved-reopened'.rasters).Count -ne 1) {throw 'Actual managed lifecycle contract differs'}
$baselineCalls=@([ReferenceWitnessFake]::Calls)
$results+=@([ordered]@{name='complete actual-function managed lifecycle';calls=$baselineCalls.Count;opens=2;closes=2;saves=1;quits=1;syntheticPngs=2;passed=$true})
$faults=@('global.preflight','application.factory','app.presentations','presentations.count','app.version','app.path','open.original','original.fullName','original.readOnly','original.slides','original.slides.count','original.slide.1','original.slide.1.id','original.slide.1.name','original.slide.1.shapes','original.slide.1.shapes.count','original.slide.1.shape.1','original.slide.1.shape.1.id','original.slide.1.shape.1.name','original.slide.1.shape.1.type','original.slide.1.shape.1.left','original.slide.1.shape.1.top','original.slide.1.shape.1.width','original.slide.1.shape.1.height','original.slide.1.shape.1.rotation','original.slide.1.shape.1.hasTextFrame','original.slide.1.shape.1.alternativeText','original.slide.1.shape.1.textFrame','original.slide.1.shape.1.textRange','original.slide.1.shape.1.text','original.slide.1.shape.1.languageId','original.slide.1.shape.1.font','original.slide.1.shape.1.fontName','original.slide.1.shape.1.fontSize','original.slide.1.export','saveCopyAs','original.discard','original.close','open.saved','saved.slide.1.export','saved.close','app.quit')
foreach($fault in $faults) {
    Initialize-ReferenceWitnessMock ('fault-'+($fault -replace '\.','-')) $fault ''
    $caught=$false;try {Invoke-ReferenceWitnessLifecycle}catch{$caught=$true}
    # Actual entrypoint catches every error and latches; global-preflight replacement emulates that outer boundary.
    if($fault -eq 'global.preflight') {$script:stopped=$true;$script:cleanup=$false}
    $before=[ReferenceWitnessFake]::Calls.Count
    try {Invoke-ReferenceWitnessCom 'prohibited-after-failure' {[ReferenceWitnessFake]::Hit('AFTER-FAILURE')}}catch{}
    if(-not $caught -or -not $script:stopped -or $script:cleanup -or [ReferenceWitnessFake]::Calls.Count -ne $before -or [ReferenceWitnessFake]::Calls[-1] -cne $fault) {throw "Actual worker made a later operation after $fault"}
    $results+=@([ordered]@{name=$fault;calls=$before;laterOperations=0;passed=$true})
}
foreach($mutant in @('foreignFullName','writable','countObject','slideCount','shapeCount','nonfinite','busyApplication','foreignBeforeOpen','foreignBeforeQuit','badTriState','wrongName','wrongText','textObject','wrongLanguage','wrongSize','wrongFrame')) {
    Initialize-ReferenceWitnessMock ('mutant-'+$mutant) '' $mutant
    $caught=$false;try {Invoke-ReferenceWitnessLifecycle}catch{$caught=$true}
    $before=[ReferenceWitnessFake]::Calls.Count;try {Read-ReferenceWitnessProperty $script:mockApp 'Presentations' 'after-failed-probe'}catch{}
    if(-not $caught -or -not $script:stopped -or $script:cleanup -or [ReferenceWitnessFake]::Calls.Count -ne $before -or [ReferenceWitnessFake]::UnexpectedReads -ne 0 -or $script:report.probes[-1].matched) {throw "Primitive/ownership refusal failed: $mutant"}
    if($mutant -eq 'badTriState' -and [ReferenceWitnessFake]::Calls[-1] -cne 'original.slide.1.shape.1.hasTextFrame') {throw 'A later getter ran after the invalid tri-state'}
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($persisted.probes[-1].matched -ne $false) {throw 'Primitive refusal was not persisted before validation'}
    $results+=@([ordered]@{name=$mutant;probe=$persisted.probes[-1];laterOperations=0;unexpectedGetterReads=[ReferenceWitnessFake]::UnexpectedReads;passed=$true})
}
Initialize-ReferenceWitnessMock 'global-busy' '' 'busyOffice'
$caught=$false;try {Invoke-ReferenceWitnessLifecycle}catch{$caught=$true}
if(-not $caught -or -not $script:stopped -or [ReferenceWitnessFake]::Calls.Count -ne 1 -or [ReferenceWitnessFake]::Calls[0] -cne 'global.preflight') {throw 'Existing global PowerPoint did not refuse before the owned factory'}
$results+=@([ordered]@{name='existing global PowerPoint';factoryCalls=0;passed=$true})
foreach($operation in @('Read-ReferenceWitnessPhase','Save-ReferenceWitnessCopy','Close-ReferenceWitnessOwned','Quit-ReferenceWitnessOwned')) {
    Initialize-ReferenceWitnessMock ('ownership-'+$operation) '' ''
    $script:app=$script:mockApp;$script:ownedApp=New-Object ReferenceWitnessApp;$script:presentation=New-Object object;$script:ownedPresentation=New-Object object;$script:ownedPath='foreign'
    $caught=$false;try {switch($operation){'Read-ReferenceWitnessPhase'{Read-ReferenceWitnessPhase 'original'}'Save-ReferenceWitnessCopy'{Save-ReferenceWitnessCopy}'Close-ReferenceWitnessOwned'{Close-ReferenceWitnessOwned 'foreign' 'original'}'Quit-ReferenceWitnessOwned'{Quit-ReferenceWitnessOwned}}}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [ReferenceWitnessFake]::Calls.Count -ne 0) {throw 'Foreign ownership reached a getter or method'}
    $results+=@([ordered]@{name=$operation;ownershipRefused=$true;calls=0;passed=$true})
}
Initialize-ReferenceWitnessMock 'forbidden-getter' '' ''
$caught=$false;try {Read-ReferenceWitnessProperty (New-Object ReferenceWitnessShape ($null,1)) 'Chart' 'forbidden-chart'}catch{$caught=$true}
if(-not $caught -or -not $script:stopped -or [ReferenceWitnessFake]::Calls.Count -ne 0) {throw 'Unreviewed property was accessed'}
$results+=@([ordered]@{name='forbidden Chart getter allowlist';calls=0;passed=$true})
# Every fixed case succeeds through the SAME actual lifecycle functions, not a shape-count substitute.
foreach($case in $source.cases) {
    $script:expectation=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) $case.expectation) -Raw -Encoding UTF8 | ConvertFrom-Json
    Initialize-ReferenceWitnessMock ('whole-'+$case.id) '' ''
    Invoke-ReferenceWitnessLifecycle
    if($script:report.closes -ne 2 -or $script:report.quits -ne 1 -or $script:report.saveCopies -ne 1 -or @($script:report.phases.original.slides[0].shapes).Count -ne $case.shapeCount) {throw 'Whole fixed case differs'}
    # PS5 JSON must preserve the exact promoted Single value. No tolerance or metadata substitution.
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($phase in @('original','saved-reopened')) {foreach($shape in $persisted.phases.$phase.slides[0].shapes) {foreach($key in @('left','top','width','height')) {if([double]::Parse($shape.$key.ToString([Globalization.CultureInfo]::InvariantCulture),[Globalization.CultureInfo]::InvariantCulture) -ne [double][single]$script:expectation.shapes[$shape.index-1].framePoints.$key) {throw 'PS5 JSON changed a native Single projection'}}}}
    $results+=@([ordered]@{name=$case.id;shapes=$case.shapeCount;exactCoordinateComparisons=($case.shapeCount*8);opens=2;closes=2;saves=1;quits=1;syntheticPngs=2;passed=$true})
}
[ordered]@{schemaVersion=1;mockOnly=$true;officeInvoked=$false;sourceWorkerSha256=(Get-ReferenceWitnessHash $Worker);cases=$results.Count;results=$results;baselineCalls=$baselineCalls;scope='Actual worker functions and managed getter/method/ownership faults; synthetic PNG bytes are NOT render evidence.'} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Output 'mock-results.json') -Encoding UTF8
Write-Output "Managed closed segment worker: $($results.Count) cases PASS; Office invoked: false"
