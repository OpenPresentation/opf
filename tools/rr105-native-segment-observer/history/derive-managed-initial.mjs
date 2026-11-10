import fs from 'node:fs';import path from 'node:path';const d=path.resolve('tools/rr105-native-segment-observer');const read=p=>fs.readFileSync(path.join(d,p),'utf8');const write=(p,s)=>fs.writeFileSync(path.join(d,p),s.replace(/\r\n/g,'\n'));
let s=read('references/base-managed.ps1');
s=s.replace("if(Test-Path -LiteralPath $Output)","$source=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) 'SOURCE.json') -Raw -Encoding UTF8 | ConvertFrom-Json\n$script:expectation=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) $source.cases[2].expectation) -Raw -Encoding UTF8 | ConvertFrom-Json\nif(Test-Path -LiteralPath $Output)");
s=s.replace('public static List<string> Calls = new List<string>();','public static List<SegmentExpected> Expected = new List<SegmentExpected>(); public static List<string> Calls = new List<string>();');
s=s.replace('public sealed class ReferenceWitnessUnexpected', 'public sealed class SegmentExpected { public int Id;public string Name;public string Text;public int LanguageId;public float FontSize;public float Left;public float Top;public float Width;public float Height;}\npublic sealed class ReferenceWitnessUnexpected');
s=s.replace('ReferenceWitnessFake.Mutant=="slideCount"?2:3','ReferenceWitnessFake.Mutant=="slideCount"?2:1');
s=s.replace('ReferenceWitnessFake.Mutant=="shapeCount"?4:2','ReferenceWitnessFake.Mutant=="shapeCount"?ReferenceWitnessFake.Expected.Count+1:ReferenceWitnessFake.Expected.Count');
s=s.replace('public int Id {get {ReferenceWitnessFake.Hit(K+".id");return N+1;}}','public SegmentExpected E {get{return ReferenceWitnessFake.Expected[N-1];}}\n public int Id {get {ReferenceWitnessFake.Hit(K+".id");return E.Id;}}');
s=s.replace('return N==1?"Title":"Chart";','return ReferenceWitnessFake.Mutant=="wrongName"?E.Name+".changed":E.Name;');
s=s.replace('return N==1?14:3;','return N==1?14:17;');
s=s.replace('public double Left {get {ReferenceWitnessFake.Hit(K+".left");return 20;}}','public float Left {get {ReferenceWitnessFake.Hit(K+".left");return E.Left;}}');
s=s.replace('public double Top {get {ReferenceWitnessFake.Hit(K+".top");return 20;}}','public float Top {get {ReferenceWitnessFake.Hit(K+".top");return E.Top;}}');
s=s.replace('public double Width {get {ReferenceWitnessFake.Hit(K+".width");return ReferenceWitnessFake.Mutant=="nonfinite"?Double.PositiveInfinity:800;}}','public float Width {get {ReferenceWitnessFake.Hit(K+".width");return ReferenceWitnessFake.Mutant=="nonfinite"?Single.PositiveInfinity:ReferenceWitnessFake.Mutant=="wrongFrame"?E.Width+1:E.Width;}}');
s=s.replace('public double Height {get {ReferenceWitnessFake.Hit(K+".height");return 300;}}','public float Height {get {ReferenceWitnessFake.Hit(K+".height");return E.Height;}}');
s=s.replace('return ReferenceWitnessFake.Mutant=="badTriState"?2:N==1?-1:0;','return ReferenceWitnessFake.Mutant=="badTriState"?2:-1;');
s=s.replace('new ReferenceWitnessTextFrame(K);','new ReferenceWitnessTextFrame(K,E);');
const classStart=s.indexOf('public sealed class ReferenceWitnessTextFrame '),classEnd=s.indexOf('\n"@',classStart);
s=s.slice(0,classStart)+String.raw`public sealed class ReferenceWitnessTextFrame {public string K;public SegmentExpected E;public ReferenceWitnessTextFrame(string k,SegmentExpected e){K=k;E=e;}public ReferenceWitnessTextRange TextRange {get {ReferenceWitnessFake.Hit(K+".textRange");return new ReferenceWitnessTextRange(K,E);}}}
public sealed class ReferenceWitnessTextRange {public string K;public SegmentExpected E;public ReferenceWitnessTextRange(string k,SegmentExpected e){K=k;E=e;}public object Text {get {ReferenceWitnessFake.Hit(K+".text");if(ReferenceWitnessFake.Mutant=="textObject")return new ReferenceWitnessUnexpected();return ReferenceWitnessFake.Mutant=="wrongText"?E.Text+"changed":E.Text;}} public int LanguageID {get {ReferenceWitnessFake.Hit(K+".languageId");return ReferenceWitnessFake.Mutant=="wrongLanguage"?1033:E.LanguageId;}} public ReferenceWitnessFont Font {get {ReferenceWitnessFake.Hit(K+".font");return new ReferenceWitnessFont(K,E);}}}
public sealed class ReferenceWitnessFont {public string K;public SegmentExpected E;public ReferenceWitnessFont(string k,SegmentExpected e){K=k;E=e;}public string Name {get {ReferenceWitnessFake.Hit(K+".fontName");return "Synthetic API font name; not physical font";}}public float Size {get {ReferenceWitnessFake.Hit(K+".fontSize");return ReferenceWitnessFake.Mutant=="wrongSize"?E.FontSize+1:E.FontSize;}}}
`+s.slice(classEnd);
// JS String.raw retained literal C# quotes correctly; only unescape the quote notation above.
s=s.replaceAll('\\"','"');
s=s.replace('[ReferenceWitnessFake]::Reset($script:root,$Fault,$Mutant)',String.raw`[ReferenceWitnessFake]::Reset($script:root,$Fault,$Mutant)
    [ReferenceWitnessFake]::Expected.Clear()
    foreach($e in $script:expectation.shapes) { $v=New-Object SegmentExpected;$v.Id=$e.id;$v.Name=$e.name;$v.Text=$e.text;$v.LanguageId=$e.languageId;$v.FontSize=$e.fontSize;$v.Left=$e.framePoints.left;$v.Top=$e.framePoints.top;$v.Width=$e.framePoints.width;$v.Height=$e.framePoints.height;[ReferenceWitnessFake]::Expected.Add($v) }`);
s=s.replaceAll('.rasters).Count -ne 3','.rasters).Count -ne 1').replace('syntheticPngs=14','syntheticPngs=2');
s=s.replace("'saved.slide.3.export'","'saved.slide.1.export'");
s=s.replace("'original.slide.1.shape.1.text','original.slide.1.export'","'original.slide.1.shape.1.text','original.slide.1.shape.1.languageId','original.slide.1.shape.1.font','original.slide.1.shape.1.fontName','original.slide.1.shape.1.fontSize','original.slide.1.export'");
s=s.replace("'badTriState'))","'badTriState','wrongName','wrongText','textObject','wrongLanguage','wrongSize','wrongFrame'))");
const pos=s.indexOf("[ordered]@{schemaVersion=1;mockOnly=$true");
s=s.slice(0,pos)+String.raw`# Every fixed case succeeds through the SAME actual lifecycle functions, not a shape-count substitute.
foreach($case in $source.cases) {
    $script:expectation=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $Worker) $case.expectation) -Raw -Encoding UTF8 | ConvertFrom-Json
    Initialize-ReferenceWitnessMock ('whole-'+$case.id) '' ''
    Invoke-ReferenceWitnessLifecycle
    if($script:report.closes -ne 2 -or $script:report.quits -ne 1 -or $script:report.saveCopies -ne 1 -or @($script:report.phases.original.slides[0].shapes).Count -ne $case.shapeCount) {throw 'Whole fixed case differs'}
    # PS5 JSON must preserve the exact promoted Single value. No tolerance or metadata substitution.
    $persisted=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($phase in @('original','saved-reopened')) {foreach($shape in $persisted.phases.$phase.slides[0].shapes) {foreach($key in @('left','top','width','height')) {if([double]$shape.$key -ne [double]$script:expectation.shapes[$shape.index-1].framePoints.$key) {throw 'PS5 JSON changed a native Single projection'}}}}
    $results+=@([ordered]@{name=$case.id;shapes=$case.shapeCount;exactCoordinateComparisons=($case.shapeCount*8);opens=2;closes=2;saves=1;quits=1;syntheticPngs=2;passed=$true})
}
[ordered]@{schemaVersion=1;mockOnly=$true;officeInvoked=$false;sourceWorkerSha256=(Get-ReferenceWitnessHash $Worker);cases=$results.Count;results=$results;baselineCalls=$baselineCalls;scope='Actual worker functions and managed getter/method/ownership faults; synthetic PNG bytes are NOT render evidence.'} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Output 'mock-results.json') -Encoding UTF8
Write-Output "Managed closed segment worker: $($results.Count) cases PASS; Office invoked: false"
`;
write('managed.ps1',s);
// Explicit single-backslash component boundary in PowerShell (backslash is not its escape character).
let wrapper=read('run-segment-observer.ps1').replaceAll("+'\\\\'","+'\\'");write('run-segment-observer.ps1',wrapper);
let profile=read('profile.mjs');profile=profile.replace("assert.equal(e.generation.installedConsumerClaim,false);", "assert.deepEqual(e.generation,{artifactEvidenceHead:s.artifactEvidenceHead,diagnosticConstructorHead:s.diagnosticConstructorHead,originalExporterHead:s.originalExporterHead,sourceFile:fact(asset(folder,'SOURCE.json')),installedConsumerClaim:false});");
profile=profile.replace("assert.deepEqual(fact(worker),fact(binding.workerPath));return", "assert.deepEqual(fact(worker),fact(binding.workerPath));assert.deepEqual(fact(asset(root,'inputs/native-process.ps1')),fact(binding.supervisorPath));return");
write('profile.mjs',profile);
console.log('Actual-function mock source derived; no COM/worker entrypoint.');
