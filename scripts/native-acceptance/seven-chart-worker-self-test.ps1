param([Parameter(Mandatory=$true)][string]$Worker,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
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
    if($ComObject) { if($ComObject -cne 'PowerPoint.Application') {throw 'Unexpected factory'};[SevenFake]::Hit('application.factory');return $script:mockApp }
    return Microsoft.PowerShell.Utility\New-Object @PSBoundParameters
}
function global:Get-Process { param([string]$Name);if($Name -cne 'POWERPNT'){throw 'Unexpected process query'};[SevenFake]::Hit('global.preflight') }

function global:Stop-Process { throw 'Mock test forbids process termination' }
function global:Start-Process { throw 'Mock test forbids native child processes' }
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Collections.Generic;
public static class SevenFake {
 public static List<string> Calls = new List<string>(); public static string Fault; public static string Mutant; public static string Directory; public static int UnexpectedReads;
 public static void Hit(string name) { Calls.Add(name); if(name == Fault) throw new InvalidOperationException("managed fault: " + name); }
 public static void Reset(string dir,string fault,string mutant) { Calls.Clear();Fault=fault;Mutant=mutant;Directory=dir;UnexpectedReads=0; }
}
public sealed class SevenUnexpected { public int ForbiddenGetter { get { SevenFake.UnexpectedReads++; return 42; } } }
public sealed class SevenApp {
 public SevenPresentations Collection; public SevenApp() { Collection=new SevenPresentations(this); }
 public SevenPresentations Presentations { get { SevenFake.Hit("app.presentations");return Collection; } }
 public string Version { get { SevenFake.Hit("app.version");return "managed-only"; } }
 public string Path { get { SevenFake.Hit("app.path");return SevenFake.Directory; } }
 public void Quit() { SevenFake.Hit("app.quit");if(Collection.Current!=null)throw new Exception("nonempty quit"); }
}
public sealed class SevenPresentations {
 public SevenApp App;public SevenPresentation Current;
 public SevenPresentations(SevenApp app) { App=app; }
 public int Count { get { SevenFake.Hit("presentations.count");return Current==null?0:1; } }
 public SevenPresentation Open(string path,int readOnly,int untitled,int withWindow) { SevenFake.Hit("open."+(path.EndsWith("saved.pptx")?"saved":"original"));if(readOnly!=-1||untitled!=0||withWindow!=0)throw new Exception("incorrect open flags");if(Current!=null)throw new Exception("nonempty open");Current=new SevenPresentation(this,path);return Current; }
}
public sealed class SevenPresentation {
 public SevenPresentations Owner;public string File;public string Phase;
 public SevenPresentation(SevenPresentations owner,string path) { Owner=owner;File=path;Phase=path.EndsWith("saved.pptx")?"saved":"original"; }
 public string FullName { get { SevenFake.Hit(Phase+".fullName");return SevenFake.Mutant=="foreignFullName"?File+".foreign":File; } }
 public int ReadOnly { get { SevenFake.Hit(Phase+".readOnly");return SevenFake.Mutant=="writable"?0:-1; } }
 public SevenSlides Slides { get { SevenFake.Hit(Phase+".slides");return new SevenSlides(this); } }
 public int Saved { set { SevenFake.Hit(Phase+".discard");if(value!=-1)throw new Exception("incorrect Saved"); } }
 public void Close() { SevenFake.Hit(Phase+".close");Owner.Current=null; }
 public void SaveCopyAs(string destination,int type) { SevenFake.Hit("saveCopyAs");if(type!=24||System.IO.File.Exists(destination))throw new Exception("incorrect copy");System.IO.File.Copy(File,destination,false); }
}
public sealed class SevenSlides {
 public SevenPresentation P;public SevenSlides(SevenPresentation p) {P=p;}
 public object Count {get {SevenFake.Hit(P.Phase+".slides.count");if(SevenFake.Mutant=="countObject")return new SevenUnexpected();return SevenFake.Mutant=="slideCount"?6:7;}}
 public SevenSlide Item(int n) {SevenFake.Hit(P.Phase+".slide."+n);return new SevenSlide(P,n);}
}
public sealed class SevenSlide {
 public SevenPresentation P;public int N;public string K {get{return P.Phase+".slide."+N;}}
 public SevenSlide(SevenPresentation p,int n) {P=p;N=n;}
 public int SlideID {get {SevenFake.Hit(K+".id");return N+255;}}
 public string Name {get {SevenFake.Hit(K+".name");return "Slide "+N;}}
 public SevenShapes Shapes {get {SevenFake.Hit(K+".shapes");return new SevenShapes(this);}}
 public void Export(string path,string format,int width,int height) {SevenFake.Hit(K+".export");if(format!="PNG"||width!=1280||height!=720||System.IO.File.Exists(path))throw new Exception("incorrect PNG export");System.IO.File.WriteAllBytes(path,new byte[33]);}
}
public sealed class SevenShapes {
 public SevenSlide S;public SevenShapes(SevenSlide s){S=s;}
 public int Count {get {SevenFake.Hit(S.K+".shapes.count");return SevenFake.Mutant=="shapeCount"?4:2;}}
 public SevenShape Item(int n){SevenFake.Hit(S.K+".shape."+n);return new SevenShape(S,n);}
}
public sealed class SevenShape {
 public SevenSlide S;public int N;public string K {get{return S.K+".shape."+N;}}
 public SevenShape(SevenSlide s,int n){S=s;N=n;}
 public int Id {get {SevenFake.Hit(K+".id");return N+1;}}
 public string Name {get {SevenFake.Hit(K+".name");return N==1?"Title":"Chart";}}
 public int Type {get {SevenFake.Hit(K+".type");return N==1?14:3;}}
 public double Left {get {SevenFake.Hit(K+".left");return 20;}}
 public double Top {get {SevenFake.Hit(K+".top");return 20;}}
 public double Width {get {SevenFake.Hit(K+".width");return SevenFake.Mutant=="nonfinite"?Double.PositiveInfinity:800;}}
 public double Height {get {SevenFake.Hit(K+".height");return 300;}}
 public double Rotation {get {SevenFake.Hit(K+".rotation");return 0;}}
 public int HasTextFrame {get {SevenFake.Hit(K+".hasTextFrame");return N==1?-1:0;}}
 public string AlternativeText {get {SevenFake.Hit(K+".alternativeText");return "";}}
 public SevenTextFrame TextFrame {get {SevenFake.Hit(K+".textFrame");return new SevenTextFrame(K);}}
 public object Chart {get {SevenFake.Hit("FORBIDDEN.Chart");throw new Exception("forbidden Chart getter");}}
 public object ChartData {get {SevenFake.Hit("FORBIDDEN.ChartData");throw new Exception("forbidden ChartData getter");}}
 public object Series {get {SevenFake.Hit("FORBIDDEN.Series");throw new Exception("forbidden Series getter");}}
 public object Points {get {SevenFake.Hit("FORBIDDEN.Points");throw new Exception("forbidden Points getter");}}
 public object Workbook {get {SevenFake.Hit("FORBIDDEN.Workbook");throw new Exception("forbidden Workbook getter");}}
}
public sealed class SevenTextFrame {public string K;public SevenTextFrame(string k){K=k;}public SevenTextRange TextRange {get {SevenFake.Hit(K+".textRange");return new SevenTextRange(K);}}}
public sealed class SevenTextRange {public string K;public SevenTextRange(string k){K=k;}public string Text {get {SevenFake.Hit(K+".text");return "Synthetic managed title";}}}
"@
$results=@()
function Initialize-SevenMock([string]$Name,[string]$Fault,[string]$Mutant) {
    $script:root=Join-Path $Output $Name;[void](New-Item -ItemType Directory -Path $script:root)
    [IO.File]::WriteAllText((Join-Path $script:root 'POWERPNT.EXE'),'synthetic metadata file; never executable')
    [SevenFake]::Reset($script:root,$Fault,$Mutant)
    $script:sourcePath=Join-Path $script:root 'case.pptx';[IO.File]::WriteAllText($script:sourcePath,'synthetic bytes; no actual native input')
    $script:savedPath=Join-Path $script:root 'saved.pptx';$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
    $script:mockApp=New-Object SevenApp
    $script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$true
    $script:report=[ordered]@{sourceSha256=$script:hashes[$script:sourcePath];savedSha256=$null;phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;lastStage=$null;lastStatus=$null}
}
Initialize-SevenMock 'success' '' ''
Write-SevenStage 'worker.initialize' 'success'
Invoke-SevenLifecycle
Write-SevenStage 'worker.complete' 'success'
if($script:report.opens.Count -ne 2 -or $script:report.closes -ne 2 -or $script:report.saveCopies -ne 1 -or $script:report.quits -ne 1 -or -not $script:cleanup -or $script:stopped -or @($script:report.phases.original.rasters).Count -ne 7 -or @($script:report.phases.'saved-reopened'.rasters).Count -ne 7) {throw 'Actual managed lifecycle contract differs'}
$baselineCalls=@([SevenFake]::Calls)
$results+=@([ordered]@{name='complete actual-function managed lifecycle';calls=$baselineCalls.Count;opens=2;closes=2;saves=1;quits=1;syntheticPngs=14;passed=$true})
$faults=@('global.preflight','application.factory','app.presentations','presentations.count','app.version','app.path','open.original','original.fullName','original.readOnly','original.slides','original.slides.count','original.slide.1','original.slide.1.id','original.slide.1.name','original.slide.1.shapes','original.slide.1.shapes.count','original.slide.1.shape.1','original.slide.1.shape.1.id','original.slide.1.shape.1.name','original.slide.1.shape.1.type','original.slide.1.shape.1.left','original.slide.1.shape.1.top','original.slide.1.shape.1.width','original.slide.1.shape.1.height','original.slide.1.shape.1.rotation','original.slide.1.shape.1.hasTextFrame','original.slide.1.shape.1.alternativeText','original.slide.1.shape.1.textFrame','original.slide.1.shape.1.textRange','original.slide.1.shape.1.text','original.slide.1.export','saveCopyAs','original.discard','original.close','open.saved','saved.slide.7.export','saved.close','app.quit')
foreach($fault in $faults) {
    Initialize-SevenMock ('fault-'+($fault -replace '\.','-')) $fault ''
    $caught=$false;try {Invoke-SevenLifecycle}catch{$caught=$true}
    # Actual entrypoint catches every error and latches; global-preflight replacement emulates that outer boundary.
    if($fault -eq 'global.preflight') {$script:stopped=$true;$script:cleanup=$false}
    $before=[SevenFake]::Calls.Count
    try {Invoke-SevenCom 'prohibited-after-failure' {[SevenFake]::Hit('AFTER-FAILURE')}}catch{}
    if(-not $caught -or -not $script:stopped -or $script:cleanup -or [SevenFake]::Calls.Count -ne $before -or [SevenFake]::Calls[-1] -cne $fault) {throw "Actual worker made a later operation after $fault"}
    $results+=@([ordered]@{name=$fault;calls=$before;laterOperations=0;passed=$true})
}
foreach($mutant in @('foreignFullName','writable','countObject','slideCount','shapeCount','nonfinite')) {
    Initialize-SevenMock ('mutant-'+$mutant) '' $mutant
    $caught=$false;try {Invoke-SevenLifecycle}catch{$caught=$true}
    $before=[SevenFake]::Calls.Count;try {Read-SevenProperty $script:mockApp 'Presentations' 'after-failed-probe'}catch{}
    if(-not $caught -or -not $script:stopped -or $script:cleanup -or [SevenFake]::Calls.Count -ne $before -or [SevenFake]::UnexpectedReads -ne 0 -or $script:report.probes[-1].matched) {throw "Primitive/ownership refusal failed: $mutant"}
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($persisted.probes[-1].matched -ne $false) {throw 'Primitive refusal was not persisted before validation'}
    $results+=@([ordered]@{name=$mutant;probe=$persisted.probes[-1];laterOperations=0;unexpectedGetterReads=[SevenFake]::UnexpectedReads;passed=$true})
}
foreach($operation in @('Read-SevenPhase','Save-SevenCopy','Close-SevenOwned','Quit-SevenOwned')) {
    Initialize-SevenMock ('ownership-'+$operation) '' ''
    $script:app=$script:mockApp;$script:ownedApp=New-Object SevenApp;$script:presentation=New-Object object;$script:ownedPresentation=New-Object object;$script:ownedPath='foreign'
    $caught=$false;try {switch($operation){'Read-SevenPhase'{Read-SevenPhase 'original'}'Save-SevenCopy'{Save-SevenCopy}'Close-SevenOwned'{Close-SevenOwned 'foreign' 'original'}'Quit-SevenOwned'{Quit-SevenOwned}}}catch{$caught=$true}
    if(-not $caught -or -not $script:stopped -or [SevenFake]::Calls.Count -ne 0) {throw 'Foreign ownership reached a getter or method'}
    $results+=@([ordered]@{name=$operation;ownershipRefused=$true;calls=0;passed=$true})
}
Initialize-SevenMock 'forbidden-getter' '' ''
$caught=$false;try {Read-SevenProperty (New-Object SevenShape ($null,1)) 'Chart' 'forbidden-chart'}catch{$caught=$true}
if(-not $caught -or -not $script:stopped -or [SevenFake]::Calls.Count -ne 0) {throw 'Unreviewed property was accessed'}
$results+=@([ordered]@{name='forbidden Chart getter allowlist';calls=0;passed=$true})
[ordered]@{schemaVersion=1;mockOnly=$true;officeInvoked=$false;sourceWorkerSha256=(Get-SevenHash $Worker);cases=$results.Count;results=$results;baselineCalls=$baselineCalls;scope='Actual worker function definitions and managed object faults only; synthetic PNG bytes are not render evidence.'} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Output 'mock-results.json') -Encoding UTF8
Write-Output "Managed seven worker: $($results.Count) cases PASS; Office invoked: false"
