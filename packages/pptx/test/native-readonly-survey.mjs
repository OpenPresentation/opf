import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,strToU8} from 'fflate';
import {scanPowerShellSource} from './powershell-scan.mjs';

// PowerShell formats long error records at the host width. Keep the precise ZIP
// failure and exception identity while accepting a wrapped message; retain raw logs.
function assertCorruptZipDiagnostic(output){
 assert.match(output,/Central\s+Directory corrupt\./);
 assert.match(output,/FullyQualifiedErrorId\s*:\s*InvalidDataException,run-windows\.ps1(?:\s|$)/);
}
const wrappedZipDiagnostic='run-windows.ps1 : Exception calling "OpenRead" with "1" argument(s): "Central \r\nDirectory corrupt."\r\n    + FullyQualifiedErrorId : InvalidDataException,run-windows.ps1\r\n';
for(const output of [wrappedZipDiagnostic,wrappedZipDiagnostic.replace('Central \r\nDirectory','Central Directory'),wrappedZipDiagnostic.replaceAll('\r\n','\n')]){
 assert.doesNotThrow(()=>assertCorruptZipDiagnostic(output));
}
for(const output of [wrappedZipDiagnostic.replace('InvalidDataException','FileNotFoundException'),wrappedZipDiagnostic.replace('Directory corrupt.','Directory missing.'),wrappedZipDiagnostic.replace(/\s*\+ FullyQualifiedErrorId[\s\S]*/,''),'']){
 assert.throws(()=>assertCorruptZipDiagnostic(output),assert.AssertionError);
}

console.log('Malformed ZIP diagnostics PASS: 3 formatting controls and 4 wrong-cause refusals; no Office.');

const root=fileURLToPath(new URL('../../../',import.meta.url));
const workerRoot=path.join(root,'packages/pptx');
const worker=path.join(workerRoot,'test/native-furniture-control.ps1');
const runner=path.join(root,'scripts/native-acceptance/run-windows.ps1');
for(const file of [worker,runner]) {
 const source=fs.readFileSync(file,'utf8');
 assert.deepEqual(scanPowerShellSource(source).issues,[]);
 assert.match(source,/\[ValidateRange\(5,60\)\]\[int\]\$TimeoutSeconds=45/);
 assert.match(source,/\[switch\]\$ReadOnlySurvey/);
}
if(process.platform!=='win32') {
 console.log('Read-only survey static policy passes; actual PowerShell controls require Windows. No native acceptance claimed.');
} else {
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'opf-survey-'));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const shell=path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const run=args=>spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...args],{encoding:'utf8',windowsHide:true,env,timeout:60000,maxBuffer:4*1024*1024});
 const saveResult=(name,r)=>{assert.ifError(r.error);fs.writeFileSync(path.join(out,name+'.log'),r.stdout+r.stderr);return r;};
 const zip=parts=>Buffer.from(zipSync(Object.fromEntries(parts.map(p=>[p,strToU8('<p:sld/>')]))));
 const single=zip(['ppt/slides/slide1.xml']);
 fs.writeFileSync(path.join(out,'one.pptx'),single);
 fs.writeFileSync(path.join(out,'two.pptx'),zip(['ppt/slides/slide1.xml','ppt/slides/slide2.xml']));
 fs.writeFileSync(path.join(out,'zero.pptx'),zip(['ppt/slides/not-a-slide.xml']));
 fs.writeFileSync(path.join(out,'bad.pptx'),'Not a ZIP');
 fs.writeFileSync(path.join(out,'large.pptx'),Buffer.alloc(16*1024*1024+1));
 fs.writeFileSync(path.join(out,'entries.pptx'),zip(['ppt/slides/slide1.xml',...Array.from({length:4096},(_,i)=>'filler/'+i)]));
 const control=String.raw`param([string]$Worker,[string]$Root,[string]$Runner)
$ErrorActionPreference='Stop'
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Worker,[ref]$t,[ref]$e);if($e.Count){throw ($e|Out-String)}
foreach($name in @('Get-FurnitureSha256','Get-FurnitureSurveySlideCount','Assert-FurnitureSurvey','Read-FurnitureState')){$fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true);if($null -eq $fn){throw ('Missing function '+$name)};Invoke-Expression $fn.Extent.Text}
$cases=New-Object 'System.Collections.Generic.List[object]'
function Check([string]$Name,[bool]$Accept,[scriptblock]$Operation){$errorText=$null;try{& $Operation}catch{$errorText=$_.Exception.Message};if($Accept -and $errorText){throw ($Name+': '+$errorText)};if(-not $Accept -and -not $errorText){throw ($Name+' unexpectedly accepted')};$cases.Add([ordered]@{name=$Name;passed=$true;accepted=$Accept;error=$errorText})}
$runnerAst=[Management.Automation.Language.Parser]::ParseFile($Runner,[ref]$t,[ref]$e);if($e.Count){throw ($e|Out-String)}
$importer=$runnerAst.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Import-NativePlanValidation'},$true);Invoke-Expression $importer.Extent.Text
$fake=Join-Path $Root 'unsupported.ps1';[IO.File]::WriteAllText($fake,'param([switch]$Other)')
Check 'missing-survey-switch-refuse' $false {Import-NativePlanValidation $fake $true}
[IO.File]::WriteAllText($fake,'param([string]$ReadOnlySurvey)')
Check 'wrong-survey-switch-type-refuse' $false {Import-NativePlanValidation $fake $true}
Import-NativePlanValidation $Worker $true
$one=Join-Path $Root 'one.pptx'
Check 'one-slide-empty' $true {Assert-FurnitureSurvey $true @() $one}
Check 'default-does-not-enable-survey' $true {Assert-FurnitureSurvey $false @('editable') (Join-Path $Root 'bad.pptx')}
Check 'refuse-action' $false {Assert-FurnitureSurvey $true @([pscustomobject]@{op='set-text'}) $one}
Check 'refuse-null-action-list' $false {Assert-FurnitureSurvey $true $null $one}
foreach($name in @('two','zero','bad','large','entries')){Check ('refuse-'+$name) $false {Assert-FurnitureSurvey $true @() (Join-Path $Root ($name+'.pptx'))}}
function Invoke-FurnitureCom([string]$Stage,[scriptblock]$Operation){return (& $Operation)}
function Read-NativeTags($Tags,[string]$Prefix){return ,@()}
function Read-FurnitureSeriesNameState($Presentation,$Actions,[string]$Phase){return ,@()}
$CaptureTextFonts=$false;$actions=@();$ReadOnlySurvey=$false
function Presentation([int]$Count,[int]$SlideCount=1){
 $values=@();for($i=1;$i -le $Count;$i++){$values+=@([pscustomobject]@{Id=$i;Name=('shape-'+$i);Type=1;Left=1;Top=2;Width=3;Height=4;Rotation=0;HasTextFrame=0;AlternativeText='';Tags=[pscustomobject]@{}})}
 $shapes=[pscustomobject]@{Count=$Count;Values=$values};$shapes|Add-Member ScriptMethod Item {param($Index)return $this.Values[$Index-1]}
 $slide=[pscustomobject]@{SlideID=1;Name='survey';Tags=[pscustomobject]@{};Shapes=$shapes};$slide|Add-Member ScriptMethod Export {param($Path,$Format,$Width,$Height)[IO.File]::WriteAllBytes($Path,[byte[]]@(0))}
 $slides=[pscustomobject]@{Count=$SlideCount;Values=@($slide)};$slides|Add-Member ScriptMethod Item {param($Index)return $this.Values[0]};return [pscustomobject]@{Slides=$slides}
}
Check 'default-30-accept' $true {$state=Read-FurnitureState (Presentation 30) 'default30';if($state.slides[0].shapeCount -ne 30){throw 'Lost default shapes'}}
Check 'default-31-refuse' $false {$null=Read-FurnitureState (Presentation 31) 'default31'}
$ReadOnlySurvey=$true
foreach($count in @(92,100)){Check ('survey-'+$count+'-accept') $true {$state=Read-FurnitureState (Presentation $count) ('survey'+$count);if($state.slides[0].shapes.Count -ne $count -or $state.slides[0].shapes[-1].name -cne ('shape-'+$count)){throw 'Survey lost a shape'}}}
Check 'survey-101-refuse' $false {$null=Read-FurnitureState (Presentation 101) 'survey101'}
Check 'survey-two-actual-slides-refuse' $false {$null=Read-FurnitureState (Presentation 1 2) 'surveyTwo'}
[ordered]@{passed=$true;officeConstructed=$false;cases=$cases.ToArray()}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Root 'pure-report.json') -Encoding UTF8
Write-Output ('PASS: '+$cases.Count+' actual pure survey and state-boundary controls; no Office')
`;
 const pure=path.join(out,'pure.ps1');fs.writeFileSync(pure,control);
 const pureResult=saveResult('pure',run(['-File',pure,'-Worker',worker,'-Root',out,'-Runner',runner]));assert.equal(pureResult.status,0,pureResult.stdout+pureResult.stderr);
 const pureReport=JSON.parse(fs.readFileSync(path.join(out,'pure-report.json'),'utf8').replace(/^\uFEFF/,''));assert.equal(pureReport.passed,true);assert.equal(pureReport.officeConstructed,false);assert.equal(pureReport.cases.length,17);
 const record=(base,p)=>{const b=fs.readFileSync(path.join(base,p));return{path:p,bytes:b.length,sha256:hash(b)};};
 const identity=(base,files)=>({revision:execFileSync('git',['rev-parse','HEAD'],{cwd:base,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:base,encoding:'utf8'}).trim()!=='',files:files.map(p=>record(base,p))});
 const cases=[];
 for(const mode of ['valid','actions','declared-two','declared-string','declared-boolean','physical-two','bad-zip','too-large','too-many-entries','timeout-61']){
 const suite=path.join(out,'suite-'+mode),attempt=path.join(out,'attempt-'+mode);fs.mkdirSync(suite);
 const input=mode==='physical-two'?'two':mode==='bad-zip'?'bad':mode==='too-large'?'large':mode==='too-many-entries'?'entries':'one';
 fs.copyFileSync(path.join(out,input+'.pptx'),path.join(suite,'case.pptx'));
 fs.writeFileSync(path.join(suite,'action-plan.json'),JSON.stringify(mode==='actions'?[{op:'set-text',slideIndex:1,shapeName:'shape',text:'edit'}]:[]));
 fs.writeFileSync(path.join(suite,'suite.json'),JSON.stringify({schemaVersion:1,files:['case.pptx','action-plan.json'].map(p=>record(suite,p)),cases:[{id:'survey',input:'case.pptx',actionPlan:'action-plan.json',slideCount:mode==='declared-two'?2:mode==='declared-string'?'1':mode==='declared-boolean'?true:1,worker:'furniture',automaticControlEligible:true}],provenance:{workerRepository:identity(workerRoot,['test/native-furniture-control.ps1','test/native-process.ps1','test/native-process-check.ps1','test/native-furniture-harness-check.ps1']),suiteRepository:identity(root,['scripts/native-acceptance/run-windows.ps1'])}}));
 const result=saveResult(mode,run(['-File',runner,'-SuiteDirectory',suite,'-PptxRepository',workerRoot,'-Case','survey','-OutputDirectory',attempt,'-ValidateOnly','-ReadOnlySurvey',...(mode==='timeout-61'?['-TimeoutSeconds','61']:[])]));
 if(mode==='valid'){assert.equal(result.status,0,result.stdout+result.stderr);const receipt=JSON.parse(fs.readFileSync(path.join(attempt,'runner.json'),'utf8').replace(/^\uFEFF/,''));assert.equal(receipt.readOnlySurvey,true);assert.equal(receipt.nativeAcceptance,false);assert.equal(receipt.status,'pure-checks-completed; native-not-run');}
 else {assert.notEqual(result.status,0,mode+' must refuse');assert.equal(fs.existsSync(attempt),false,mode+' must refuse before output or Office');if(mode==='bad-zip')assertCorruptZipDiagnostic(result.stdout+result.stderr);else assert.match(result.stdout+result.stderr,mode==='actions'?/empty validated action plan/:mode.startsWith('declared-')?/one declared slide/:mode==='physical-two'?/one slide part/:mode==='too-large'?/16 MiB/:mode==='too-many-entries'?/4096 entries/:/ValidateRange|greater than|60/);}
 cases.push({mode,passed:true,exitCode:result.status});
 }
 // A worker-mode request cannot silently turn the larger survey boundary on or off.
 for(const [flag,value]of [[false,true],[true,false],[true,'true']]){
 const attempt=path.join(out,'request-'+flag+'-'+value);fs.mkdirSync(attempt);fs.writeFileSync(path.join(attempt,'request.json'),JSON.stringify({captureTextFonts:false,readOnlySurvey:value}));
 const result=saveResult('request-'+flag+'-'+value,run(['-File',worker,'-Worker','-OutputDirectory',attempt,'-InputPresentation',path.join(out,'one.pptx'),...(flag?['-ReadOnlySurvey']:[])]));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/survey (option differs|request must be a Boolean)/);assert.equal(fs.existsSync(path.join(attempt,'native-furniture-control.pptx')),false);cases.push({mode:'request-'+flag+'-'+value,passed:true,exitCode:result.status});
 }
 fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify({passed:true,officeConstructed:false,pure:pureReport.cases,runner:cases},null,2));
 console.log('Read-only survey PASS: 17 actual function boundaries, 10 actual maintained runner ValidateOnly cases, 3 bound-request refusals; no Office. Raw controls '+out);
}
