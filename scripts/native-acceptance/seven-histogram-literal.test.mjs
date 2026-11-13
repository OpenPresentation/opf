// Office-free synthetic representation controls; never native-run acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {gallery} from '@openpresentation/gallery';
import {archiveDependencies,inspectSevenArchive,inspectHistogramLiteralArchive} from './seven-chart-archive.mjs';
import {currentSevenSource} from './seven-value-current.mjs';
import {bindCurrentHistogram,HISTOGRAM_SELECTION,HISTOGRAM_SOURCE_ARCHIVE} from './seven-histogram-classic.mjs';
import {compareHistogramNativeSnapshots} from './seven-value-snapshot-compare.mjs';
import {histogramSnapshotRoute,histogramLiteralSnapshotRoute,SNAPSHOT_ENTRIES,SNAPSHOT_FILES} from './seven-value-snapshot-profile.mjs';
import {HISTOGRAM_LITERAL_PROFILE,HISTOGRAM_LITERAL_POLICY,compareHistogramLiteralSnapshots} from './seven-histogram-literal.mjs';
import {VALUE_FILES} from './seven-value-profile.mjs';
import {syntheticValueControl} from './seven-value-control-fixture.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {digest,fileIdentity} from './identity.mjs';
const ROOT=fs.realpathSync(path.resolve(import.meta.dirname,'../..')),deps=archiveDependencies(),chart='ppt/charts/chart2.xml';
const once=(text,from,to)=>{assert.equal(text.split(from).length,2,from);return text.replace(from,to);};
const zip=parts=>Buffer.from(deps.zipSync(parts));
function mutate(bytes,file,edit){const parts=deps.unzipSync(bytes);assert.ok(parts[file]);parts[file]=deps.strToU8(edit(deps.strFromU8(parts[file])));return zip(parts);}
function valueBranch(text,edit){const found=[...text.matchAll(/<c:val(?:\s[^<>]*?)?>[\s\S]*?<\/c:val>/gu)];assert.equal(found.length,1,'One selected synthetic value branch required');return once(text,found[0][0],edit(found[0][0]));}
function mutateValue(bytes,edit){
 const changed=mutate(bytes,chart,text=>valueBranch(text,edit)),a=deps.unzipSync(bytes),b=deps.unzipSync(changed);assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort());
 for(const name of Object.keys(a))if(name!==chart)assert.deepEqual(b[name],a[name],'Synthetic value mutation changed another part: '+name);
 assert.equal(valueBranch(deps.strFromU8(b[chart]),()=>'<c:val>@selected-test-branch</c:val>'),valueBranch(deps.strFromU8(a[chart]),()=>'<c:val>@selected-test-branch</c:val>'),'Synthetic value mutation changed bytes outside its selected branch');return changed;
}
const literal='<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="4"/><c:pt idx="0"><c:v>43</c:v></c:pt><c:pt idx="1"><c:v>31</c:v></c:pt><c:pt idx="2"><c:v>-8</c:v></c:pt><c:pt idx="3"><c:v>19</c:v></c:pt></c:numLit>';
async function publicImport(bytes){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:row=>diagnostics.push(row)});return{document,diagnostics};}
function phase(archive){return{slideCount:7,rasters:Array.from({length:7},(_,i)=>({slideIndex:i+1})),slides:archive.slides.map((slide,i)=>{const shapes=slide.shapes.filter(s=>s.kind==='title'||s.branch==='choice'||s.branch==='direct').map((s,j)=>({index:j+1,id:s.id,name:s.name,type:s.kind==='title'?14:3,...s.geometry,hasTextFrame:s.kind==='title'?-1:0,text:s.kind==='title'?s.text:null,alternativeText:''}));return{index:i+1,slideId:i+256,name:'Synthetic '+i,shapeCount:shapes.length,shapes};})};}
let pending;
function fixture(){pending??=(async()=>{
 const source=currentSevenSource(),input=Buffer.from(await toPptx(source,{catalogs:[gallery],chartex:'native'})),bound=bindCurrentHistogram(input,source,HISTOGRAM_SELECTION);
 assert.deepEqual({bytes:input.length,sha256:digest(input)},HISTOGRAM_SOURCE_ARCHIVE);
 // This is a synthetic Office-before representation, not the unchanged source archive.
 // Compact only the exact known range branch; every other part/outside byte is proved unchanged.
 const linked='<c:val><c:numRef><c:f>Sheet1!$B$2:$B$5</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="4"/>'+[42,31,-8,19].map((value,index)=>'<c:pt idx="'+index+'"><c:v>'+value+'</c:v></c:pt>').join('')+'</c:numCache></c:numRef></c:val>';
 const before=mutateValue(input,value=>{const compact=value.replace(/>[ \t\r\n]+</gu,'><');assert.equal(compact,linked);return compact;}),edited=mutate(mutateValue(before,()=>'<c:val>'+literal+'</c:val>'),'docProps/core.xml',text=>once(text,'<cp:revision>1</cp:revision>','<cp:revision>2</cp:revision>'));
 const imports={source:await publicImport(input),before:await publicImport(before),edited:await publicImport(edited),reopened:await publicImport(edited)};
 return{input,before,edited,reopened:edited,source,selection:HISTOGRAM_SELECTION,action:bound.action,bound,imports,root:ROOT,deps,phases:{original:phase(bound.archive),'saved-reopened':phase(inspectHistogramLiteralArchive(edited,deps,bound.archiveContext))}};
})();return pending;}
test('separate literal result preserves all7 public documents, exact workbook bytes and old linked refusal',async()=>{
 const f=await fixture(),copies=[f.before,f.edited,f.reopened].map(bytes=>Buffer.from(bytes)),result=compareHistogramLiteralSnapshots(f);
 assert.equal(result.expectedResultBinding,'numeric-literal');assert.equal(result.nativeTypeQualified,false);assert.equal(result.numericWorksheetEditabilityQualified,false);
 assert.deepEqual(result.archiveReadbacks.edited.values,[43,31,-8,19]);assert.deepEqual(result.archiveReadbacks.edited.workbookValues,[42,31,-8,19]);assert.equal(result.raw.valueBranches[0].kind,'worksheet-range');assert.equal(result.raw.valueBranches[1].kind,'numeric-literal');
 const wanted=structuredClone(f.imports.before.document);wanted.slides[1].chart.data.rows[0][1]=43;assert.deepEqual(f.imports.edited.document,wanted);assert.deepEqual(f.imports.edited.diagnostics,f.imports.before.diagnostics);assert.equal(f.imports.edited.diagnostics.length,2);
 assert.throws(()=>inspectSevenArchive(f.edited,deps,f.bound.archiveContext));assert.throws(()=>compareHistogramNativeSnapshots(f),'Old linked qualification MUST remain refused');
 for(const [index,bytes]of [f.before,f.edited,f.reopened].entries())assert.deepEqual(bytes,copies[index]);
});
test('literal reader closes representation, formula, format, count, ordered points, values and attributes',async()=>{
 const f=await fixture();const mutants=[
  [literal,literal+'<c:numRef/>'],[literal,'<c:v>43</c:v>'],['<c:numLit>','<c:numLit unknown="1">'],['<c:numLit>','<c:numLit><c:f>Sheet1!$B$2:$B$5</c:f>'],['General','0.0'],['<c:ptCount val="4"/>','<c:ptCount val="3"/>'],['<c:ptCount val="4"/>','<c:ptCount val="4" unknown="1"/>'],['idx="0"','idx="1"'],['<c:pt idx="0">','<c:pt idx="0" unknown="1">'],['<c:v>43</c:v>','<c:v>NaN</c:v>'],['<c:v>43</c:v>','<c:v>44</c:v>'],['<c:v>31</c:v>','<c:v>32</c:v>'],['</c:numLit>','<c:extLst/></c:numLit>'],['<c:val>','<c:val unknown="1">'],
 ];for(const [from,to]of mutants){const bytes=mutateValue(f.edited,value=>once(value,from,to));assert.throws(()=>inspectHistogramLiteralArchive(bytes,deps,f.bound.archiveContext),undefined,from);}
 const moved=mutate(f.edited,f.bound.archive.slides[6].shapes.find(shape=>shape.kind==='chart').chartPart,text=>text.replace(/<c:val>[\s\S]*?<\/c:val>/u,'<c:val>'+literal+'</c:val>'));assert.throws(()=>inspectHistogramLiteralArchive(moved,deps,f.bound.archiveContext));assert.throws(()=>inspectHistogramLiteralArchive(f.before,deps,f.bound.archiveContext));
});
test('every workbook byte, name/category reference, other6 data, all raw styles/relationships and public fields stay strict',async()=>{
 const f=await fixture();
 const workbook=deps.unzipSync(f.edited)[f.action.workbookPart],parts=deps.unzipSync(f.edited),nested=deps.unzipSync(workbook);nested['xl/worksheets/sheet1.xml']=deps.strToU8(once(deps.strFromU8(nested['xl/worksheets/sheet1.xml']),'<v>42</v>','<v>43</v>'));parts[f.action.workbookPart]=deps.zipSync(nested);assert.throws(()=>compareHistogramLiteralSnapshots({...f,edited:zip(parts)}),'Even updating the old B2 value is forbidden in literal mode');
 for(const [file,edit]of [[chart,t=>once(t,'Sheet1!$B$1','Sheet1!$B$2')],[chart,t=>once(t,'Sheet1!$A$2:$A$5','Sheet1!$A$3:$A$6')],[chart,t=>t.replace('<c:chartSpace ','<c:chartSpace styleUnknown="changed" ')],[f.bound.archive.slides[0].shapes.find(shape=>shape.branch==='choice').chartPart,t=>once(t,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>')],['ppt/charts/_rels/chart2.xml.rels',t=>once(t,'Id="rId1"','Id="foreign"')]]){assert.throws(()=>compareHistogramLiteralSnapshots({...f,edited:mutate(f.edited,file,edit)}),undefined,file);}
 const dirty=structuredClone(f.imports);dirty.edited.document.slides[6].title+='foreign';assert.throws(()=>compareHistogramLiteralSnapshots({...f,imports:dirty}));const diag=structuredClone(f.imports);diag.reopened.diagnostics.push({code:'foreign'});assert.throws(()=>compareHistogramLiteralSnapshots({...f,imports:diag}));
 const extra=deps.unzipSync(f.edited);extra['ppt/unknown-resource.bin']=new Uint8Array([1]);assert.throws(()=>compareHistogramLiteralSnapshots({...f,edited:zip(extra)}));
});
test('literal-only revision rule closes exact1→2→2 and preserves all other metadata and mixed text',async()=>{
 const f=await fixture();for(const value of ['1','3','2.0','-2','2\n'])assert.throws(()=>compareHistogramLiteralSnapshots({...f,edited:mutate(f.edited,'docProps/core.xml',t=>once(t,'<cp:revision>2</cp:revision>','<cp:revision>'+value+'</cp:revision>'))}),undefined,value);
 for(const edit of [t=>once(t,'<cp:revision>2</cp:revision>',''),t=>once(t,'<cp:revision>2</cp:revision>','<cp:revision>2</cp:revision><cp:revision>2</cp:revision>'),t=>once(t,'<cp:revision>2</cp:revision>','<cp:revision xml:space="preserve">2</cp:revision>'),t=>once(t,'<dc:creator>OpenPresentation</dc:creator>','<dc:creator>Changed</dc:creator>')])assert.throws(()=>compareHistogramLiteralSnapshots({...f,reopened:mutate(f.reopened,'docProps/core.xml',edit)}));
 const unknown=mutate(f.edited,chart,t=>t.replace('</c:chartSpace>','<x:unknown xmlns:x="urn:unknown" xml:space="preserve"> <x:child/> </x:unknown></c:chartSpace>'));assert.throws(()=>compareHistogramLiteralSnapshots({...f,edited:unknown}));
});
test('closed literal request/lifecycle preserves linked defaults and exact expanded source closure',async()=>{
 const f=await fixture(),report={phases:f.phases,sourcePath:'original',snapshots:{edited:{path:'edited'}}};assert.deepEqual(histogramLiteralSnapshotRoute.snapshotOperations(report,f.action),histogramSnapshotRoute.snapshotOperations(report,f.action));assert.deepEqual(histogramLiteralSnapshotRoute.snapshotCriticalProbes(report,f.action),histogramSnapshotRoute.snapshotCriticalProbes(report,f.action));
 const read=name=>fs.readFileSync(path.join(ROOT,'scripts/native-acceptance',name),'utf8'),strings=value=>[...value.matchAll(/'([^']+)'/gu)].map(m=>m[1]),extra=strings(/\$extra=@\(([\s\S]*?)\) \|/u.exec(read('seven-value-snapshot-bootstrap.ps1'))[1]).map(name=>'scripts/native-acceptance/'+name);assert.deepEqual(extra,SNAPSHOT_ENTRIES);assert.deepEqual(extra.filter(file=>VALUE_FILES.includes(file)),[]);assert.deepEqual([...VALUE_FILES,...extra].sort(),SNAPSHOT_FILES);
 const binding={envelopeSha256:'a'.repeat(64),envelope:{sourceAdmission:{base:{generation:{caseId:'all-seven'},node:{path:'node'}},action:f.action,actionModelSha256:'b'.repeat(64),actionFileIdentity:{bytes:1,sha256:'c'.repeat(64)}},controller:{}}},request=histogramLiteralSnapshotRoute.expectedSnapshotRequest(binding,ROOT,{timeoutSeconds:45,runOfficeRequested:false},[]),old=histogramSnapshotRoute.expectedSnapshotRequest(binding,ROOT,{timeoutSeconds:45,runOfficeRequested:false},[]);
 assert.equal(request.selectedCase.expectedResultBinding,'numeric-literal');assert.equal(request.selectedCase.numericWorksheetEditabilityQualified,false);assert.ok(request.workerArguments.includes('-HistogramLiteral'));assert.equal(Object.hasOwn(old.selectedCase,'expectedResultBinding'),false);assert.equal(old.workerArguments.includes('-HistogramLiteral'),false);assert.equal(request.policy.maximumQueries,51);assert.equal(request.policy.budgetMilliseconds,5000);
});
function bridgeFixture(output,action){
 const f=syntheticValueControl(path.join(output,'bridge')),e=f.evidence,q=e.request,r=e.report;q.profile=HISTOGRAM_LITERAL_PROFILE;q.policy={...q.policy,policy:HISTOGRAM_LITERAL_POLICY};q.selectedCase.action=action;q.selectedCase.actionModelSha256=digest(Buffer.from(JSON.stringify(action)));q.selectedCase.actionFileIdentity={bytes:Buffer.byteLength(JSON.stringify(action,null,2)+'\n'),sha256:digest(Buffer.from(JSON.stringify(action,null,2)+'\n'))};q.selectedCase.nativeTypeQualified=false;q.selectedCase.expectedResultBinding='numeric-literal';q.selectedCase.numericWorksheetEditabilityQualified=false;
 r.schemaVersion=4;r.profile=q.profile;r.saveCopies=3;r.snapshots={};for(const name of ['before','edited','reopened']){const file=path.join(q.nativeRoot,name+'.pptx');fs.writeFileSync(file,'SYNTHETIC INERT '+name);r.snapshots[name]={path:file,sha256:fileIdentity(file).sha256};}r.opens[1].path=r.snapshots.edited.path;r.opens[1].sha256=r.snapshots.edited.sha256;r.actions=[{op:action.op,actionModelSha256:q.selectedCase.actionModelSha256,actionFileIdentity:q.selectedCase.actionFileIdentity,status:'success',setterAttempts:1}];r.probes=histogramLiteralSnapshotRoute.snapshotCriticalProbes(r,action);
 const value=name=>['preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count'].includes(name)?0:name==='snapshot.target.chart.type'||name==='snapshot.target.series.type'?51:name==='snapshot.target.series.count'?1:null;
 e.stages=histogramLiteralSnapshotRoute.snapshotOperations(r,action).flatMap(stage=>stage.startsWith('worker.')?[{stage,status:'success'}]:[{stage,status:'begin'},{stage,status:'success'}]).map((row,i)=>({...row,sequence:i+1,timestamp:'2000-01-01T00:00:00.000Z',value:row.status==='success'?value(row.stage):null,error:'',officeOperationsStopped:false,cleanupConfirmed:row.stage.startsWith('worker.')}));e.admission.profile=q.profile;e.admission.policy=structuredClone(q.policy);e.admission.ready={workerCleanupConfirmed:true,stageCount:e.stages.length,lifecycle:e.stages.filter(s=>s.status==='success').map(s=>({stage:s.stage,sequence:s.sequence})),opens:2,saves:3,closes:2,edits:1,quits:1};const file=path.join(output,'bridge.json');fs.writeFileSync(file,JSON.stringify({synthetic:true,nativeAcceptance:false,controllerRoot:ROOT,root:f.root,admissionFile:f.admissionFile,evidence:e}));return file;
}
test('actualPS5 literal setter proof and real typed adapter close new binding without process/Office IO',{skip:process.platform!=='win32'},async()=>{
 const f=await fixture(),out=fs.mkdtempSync(path.join(os.tmpdir(),'opf-histogram-literal-managed-')),wire=Buffer.from(JSON.stringify(f.action,null,2)+'\n'),actionFile=path.join(out,'action.json');fs.writeFileSync(actionFile,wire);const bridge=bridgeFixture(out,f.action),shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'scripts/native-acceptance/seven-value-snapshot-check.ps1'),'-Root',ROOT,'-ActionFile',actionFile,'-ActionModelSha256',digest(Buffer.from(JSON.stringify(f.action))),'-ActionFileSha256',digest(wire),'-ActionFileBytes',String(wire.length),'-FixtureFile',bridge,'-Output',path.join(out,'managed'),'-HistogramClassic','-HistogramLiteral'],{env:windowsPowerShellEnvironment(process.env),timeout:60000,encoding:'utf8',maxBuffer:4*1024*1024});fs.writeFileSync(path.join(out,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(out,'stderr.log'),result.stderr??'');assert.equal(result.error,undefined,out);assert.equal(result.status,0,JSON.stringify({out,stdout:result.stdout,stderr:result.stderr}));const receipt=JSON.parse(fs.readFileSync(path.join(out,'managed/result.json'),'utf8').replace(/^\uFEFF/u,''));assert.equal(receipt.officeInvoked,false);assert.equal(receipt.realProcessQueries,0);assert.equal(receipt.officeActions,0);assert.equal(receipt.rows.length,73);assert.ok(receipt.rows.every(row=>row.getterCalls===0));assert.equal(receipt.bridge.length,31);assert.deepEqual(receipt.bridge.slice(-3).map(row=>row.name),['wrong-result-binding','worksheet-editability-claim','missing-result-binding']);assert.ok(receipt.bridge.every(row=>row.passed&&row.realProcessQueries===0&&row.officeActions===0));assert.equal(receipt.bridge[0].mockProcessQueries,1);assert.ok(receipt.bridge.slice(1).every(row=>row.mockProcessQueries===0));
});
