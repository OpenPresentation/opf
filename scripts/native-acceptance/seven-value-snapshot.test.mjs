// Synthetic prepared archives and managed objects are not native observations.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
import {currentSevenSource,bindCurrentTreemap} from './seven-value-current.mjs';
import {sevenExpectedOperations} from './seven-postflight.mjs';
import {digest,fileIdentity} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {syntheticValueControl} from './seven-value-control-fixture.mjs';
import {compareSevenNativeBefore,compareSevenNativeSnapshots,snapshotNumericReadback} from './seven-value-snapshot-compare.mjs';
import {projectSnapshotNamespacePair,assertSnapshotRawPreservation} from './seven-value-snapshot-namespace.mjs';
import {snapshotOperations,snapshotBeforeOperations,snapshotCriticalProbes,SNAPSHOT_PROFILE,SNAPSHOT_POLICY} from './seven-value-snapshot-profile.mjs';
const deps=archiveDependencies(),selection={slideIndex:1,seriesIndex:1,pointIndex:1,newValue:43},ROOT=path.resolve(import.meta.dirname,'../..');
const once=(text,before,after)=>{assert.equal(text.split(before).length,2);return text.replace(before,after);};
const change=(parts,name,edit)=>{assert.ok(parts[name]);parts[name]=deps.strToU8(edit(deps.strFromU8(parts[name])));};
const zip=parts=>Buffer.from(deps.zipSync(parts));
function phase(archive){return{slideCount:7,rasters:Array.from({length:7},(_,i)=>({slideIndex:i+1})),slides:archive.slides.map((slide,i)=>{const shapes=slide.shapes.filter(s=>s.kind==='title'||s.branch==='choice'||s.branch==='direct').map((s,j)=>({index:j+1,id:s.id,name:s.name,type:s.kind==='title'?14:3,...s.geometry,hasTextFrame:s.kind==='title'?-1:0,text:s.kind==='title'?s.text:null,alternativeText:''}));return{index:i+1,slideId:i+256,name:'Synthetic '+i,shapeCount:shapes.length,shapes};})};}
let pending;
async function fixture(){pending??=(async()=>{
 const source=currentSevenSource(),input=Buffer.from(await toPptx(source,{chartex:'native'})),bound=bindCurrentTreemap(input,source,selection),action=bound.action,parts=deps.unzipSync(input);
 for(const slide of bound.archive.slides)for(const shape of slide.shapes){if(shape.kind!=='chart'||shape.chart.workbook.part!==action.workbookPart)continue;change(parts,shape.chartPart,text=>shape.chart.family==='chartEx'?once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>'):once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>'));}
 const book=deps.unzipSync(parts[action.workbookPart]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));parts[action.workbookPart]=deps.zipSync(book);const edited=zip(parts),imports={};
 for(const [name,bytes]of [['source',input],['before',input],['edited',edited],['reopened',edited]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});imports[name]={document,diagnostics};}
 return{input,before:input,edited,reopened:edited,source,selection,action,imports,root:ROOT,deps,bound,phases:{original:phase(bound.archive),'saved-reopened':phase(inspectSevenArchive(edited,deps,bound.archiveContext))}};
})();return pending;}
const uri=prefix=>prefix==='cx1'?'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex':'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex';
function xml(prefix='cx1',location='choice'){return '<p:sld xmlns:p="p" xmlns:mc="mc"><p:cSld><p:spTree><mc:AlternateContent'+(location==='parent'?' xmlns:'+prefix+'="'+uri(prefix)+'"':'')+'><mc:Choice Requires="'+prefix+'"'+(location==='choice'?' xmlns:'+prefix+'="'+uri(prefix)+'"':'')+'><p:graphicFrame><'+prefix+':chart/></p:graphicFrame></mc:Choice><mc:Fallback><p:sp/></mc:Fallback></mc:AlternateContent></p:spTree></p:cSld></p:sld>';}
test('snapshot namespace policy admits only the real pairwise local/direct-parent declaration move',()=>{
 for(const prefix of ['cx1','cx2'])for(const reverse of [false,true]){const a=xml(prefix),b=xml(prefix,'parent'),pair=projectSnapshotNamespacePair(reverse?b:a,reverse?a:b);assert.equal(pair.changes.length,1);assert.equal(pair.changes[0].effectiveUri,uri(prefix));const parser=new deps.XMLParser({ignoreAttributes:false});assert.deepEqual(parser.parse(pair.before),parser.parse(pair.after));assert.equal(pair.changes[0].beforeDeclaration,reverse?'AlternateContent':'Choice');}
 const unchanged=xml();assert.deepEqual(projectSnapshotNamespacePair(unchanged,unchanged),{before:unchanged,after:unchanged,changes:[]});
});
test('namespace projection refuses container scope effects, QName mentions, shadows and unknown topology',()=>{
 const a=xml(),b=xml('cx1','parent'),cases=[
 ['own-QName',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent cx1:unknown="x"')],['own-Ignorable',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent mc:Ignorable="cx1"')],['container-text',t=>t.replace('<mc:Choice','cx1<mc:Choice')],['encoded-mention',t=>t.replace('<mc:Fallback>','<mc:Fallback note="c&#120;1">')],['fallback-QName',t=>t.replace('<p:sp/>','<cx1:unknown/>')],['shadow',t=>t.replace('<p:graphicFrame>','<p:graphicFrame xmlns:cx1="urn:foreign">')],['redundant-nested',t=>t.replace('<p:graphicFrame>','<p:graphicFrame xmlns:cx1="'+uri('cx1')+'">')],['redundant-parent',t=>t.replace('<mc:Choice Requires="cx1"','<mc:Choice xmlns:cx1="'+uri('cx1')+'" Requires="cx1"')],['ancestor',t=>t.replace('<p:cSld>','<p:cSld xmlns:cx1="'+uri('cx1')+'">')],['foreign',t=>t.replace(uri('cx1'),'urn:foreign')],['unbound',t=>t.replace(' xmlns:cx1="'+uri('cx1')+'"','')],['multiple',t=>t.replace('Requires="cx1"','Requires="cx1 cx2"')],['whitespace',t=>t.replace('Requires="cx1"','Requires=" cx1 "')],['topology',t=>t.replace('<mc:Fallback>','<mc:Fallback/><mc:Fallback>')],['unknown-child',t=>t.replace('</mc:AlternateContent>','<p:sp/></mc:AlternateContent>')],
 ];for(const [name,edit]of cases)assert.throws(()=>projectSnapshotNamespacePair(a,edit(b)),undefined,name);
 // A different owner path receives no exception: the raw comparison still sees it.
 const foreignA=a.replace('<p:spTree>','<p:other>').replace('</p:spTree>','</p:other>'),foreignB=b.replace('<p:spTree>','<p:other>').replace('</p:spTree>','</p:other>');assert.equal(projectSnapshotNamespacePair(foreignA,foreignB).changes.length,0);
});
test('public current seven source/before/edited/reopened archives prove exactly one actual cache/workbook delta',async()=>{
 const f=await fixture(),result=compareSevenNativeSnapshots(f);assert.deepEqual(result.archiveReadbacks.before.values,[42,31,-8,19]);assert.deepEqual(result.archiveReadbacks.edited.values,[43,31,-8,19]);assert.deepEqual(result.archiveReadbacks.reopened.workbookValues,[43,31,-8,19]);assert.equal(result.nativeAcceptance,false);assert.match(result.baseline.observation,/not COM getter/);assert.deepEqual(f.imports.reopened,f.imports.edited);
});
test('source-to-before admission refuses unknown data/style/import changes before any setter',async()=>{
 const f=await fixture();assert.throws(()=>compareSevenNativeBefore({...f,before:f.edited}));
 const imported=structuredClone(f.imports);imported.before.document.slides[1].title='Foreign title';assert.throws(()=>compareSevenNativeBefore({...f,imports:imported}),/public import/);
 for(const mode of ['title','chart-style','relationship','part']){const parts=deps.unzipSync(f.input);if(mode==='title')change(parts,'ppt/slides/slide1.xml',t=>t.replace('</a:t>',' changed</a:t>'));if(mode==='chart-style')change(parts,f.action.chartPart,t=>t.replace('<cx:chartSpace ','<cx:chartSpace unknown="changed" '));if(mode==='relationship')change(parts,'ppt/slides/_rels/slide1.xml.rels',t=>t.replace('Id="rId1"','Id="rIdChanged"'));if(mode==='part')parts['ppt/unknown.bin']=new Uint8Array([1]);assert.throws(()=>compareSevenNativeBefore({...f,before:zip(parts)}),undefined,mode);}
});
test('edited/reopened incoherence, extra changes, diagnostics, unknown raw leaves and title/style changes refuse',async()=>{
 const f=await fixture();for(const phaseName of ['edited','reopened']){for(const mode of ['cache','workbook','style','title']){const parts=deps.unzipSync(f.edited);if(mode==='cache')change(parts,f.action.chartPart,t=>once(t,'<cx:pt idx="0">43</cx:pt>','<cx:pt idx="0">44</cx:pt>'));if(mode==='workbook'){const book=deps.unzipSync(parts[f.action.workbookPart]);change(book,'xl/worksheets/sheet1.xml',t=>once(t,'<c r="B2"><v>43</v></c>','<c r="B2"><v>44</v></c>'));parts[f.action.workbookPart]=deps.zipSync(book);}if(mode==='style')change(parts,f.action.chartPart,t=>t.replace('<cx:chartSpace ','<cx:chartSpace newStyle="foreign" '));if(mode==='title')change(parts,'ppt/slides/slide2.xml',t=>t.replace('</a:t>',' changed</a:t>'));assert.throws(()=>compareSevenNativeSnapshots({...f,[phaseName]:zip(parts)}),undefined,phaseName+'/'+mode);}}
 const imports=structuredClone(f.imports);imports.reopened.diagnostics.push({code:'foreign'});assert.throws(()=>compareSevenNativeSnapshots({...f,imports}),/diagnostics/);const model=structuredClone(f.bound.archive),chart=model.slides[0].shapes.find(s=>s.kind==='chart'&&s.branch==='choice');chart.chart.workbook.cells.find(c=>c.cell===f.action.workbookCells[0]).value=999;assert.throws(()=>snapshotNumericReadback(model,f.action),/disagree/);
});
test('real slide namespace-only rewrite stays scoped while all other archive bytes remain protected',async()=>{
 const f=await fixture(),parts=deps.unzipSync(f.input);let moves=0;
 for(const name of Object.keys(parts).filter(n=>/^ppt\/slides\/slide\d+\.xml$/u.test(n)))change(parts,name,t=>t.replace(/<mc:AlternateContent\b([^>]*)><mc:Choice\s+([^>]*?)>/gu,(all,parentAttributes,attrs)=>{assert.equal(parentAttributes,' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"');const match=/\bxmlns:(cx[12])="([^"]+)"/u.exec(attrs);if(!match)return all;moves++;return '<mc:AlternateContent'+parentAttributes+' xmlns:'+match[1]+'="'+match[2]+'"><mc:Choice '+attrs.replace(match[0],'').trim()+'>';}));
 assert.ok(moves>0);const before=zip(parts),result=compareSevenNativeBefore({...f,before});assert.equal(result.raw.namespacePlacement.projection.flatMap(p=>p.changes).length,moves);
 const unknown=deps.unzipSync(before);change(unknown,'ppt/slides/slide1.xml',t=>t.replace('<mc:AlternateContent','<mc:AlternateContent unknown="changed"'));assert.throws(()=>assertSnapshotRawPreservation({...f,saved:zip(unknown),action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext}));
});
test('snapshot wrapper applies the maintained decompression limits before any unbounded scan',async()=>{
 const f=await fixture(),bomb=zip({'oversized.xml':new Uint8Array(8*1024*1024+1)}),calls=[],checked={...deps,unzipSync(input,options){calls.push(!!options?.filter);return deps.unzipSync(input,options);}};assert.throws(()=>assertSnapshotRawPreservation({...f,input:bomb,saved:f.input,deps:checked,archiveContext:f.bound.archiveContext}),/expansion bound/);assert.deepEqual(calls,[true]);
 const parts=deps.unzipSync(f.input);change(parts,'[Content_Types].xml',t=>t+'<!-- unreviewed native package rewrite -->');assert.throws(()=>assertSnapshotRawPreservation({...f,saved:zip(parts),action:{...f.action,newValues:[...f.action.expectedValues]},archiveContext:f.bound.archiveContext}),/package part|XML/);
});
test('exact lifecycle grammar is 2 opens, 3 actual copies, 2 closes, one setter, one Quit and zero getter',async()=>{
 const f=await fixture(),report={phases:f.phases,sourcePath:'original',snapshots:{edited:{path:'edited'}}},names=snapshotOperations(report,f.action),old=sevenExpectedOperations(report);assert.deepEqual(snapshotBeforeOperations(report),names.slice(0,names.indexOf('archive.before.check')));assert.deepEqual(snapshotBeforeOperations(report).filter(n=>!n.startsWith('archive.')&&n!=='preflight.globalIdle'),old.slice(0,old.indexOf('copy.fullName')));assert.equal(names.filter(n=>n.endsWith('.open')).length,2);assert.equal(names.filter(n=>n.endsWith('.saveCopyAs')).length,3);assert.equal(names.filter(n=>n.endsWith('.close')).length,2);assert.equal(names.filter(n=>n==='snapshot.series.values.set').length,1);assert.equal(names.filter(n=>n==='application.quit').length,1);assert.ok(!names.some(n=>/values\.get/i.test(n)));const proofs=snapshotCriticalProbes(report,f.action);assert.equal(proofs.length,53);assert.ok(proofs.every(p=>p.matched));assert.deepEqual(proofs.filter(p=>p.stage.endsWith('.readOnly')||p.stage.endsWith('.hasChart')).map(p=>p.expected),Array(9).fill(-1));
});
// Synthetic completion records test the new private adapter AFTER its external
// source/data/import reader boundary. They cannot qualify that reader or Office.
function snapshotBridgeFixture(output) {
 const f=syntheticValueControl(path.join(output,'bridge-fixture')),e=f.evidence,q=e.request,r=e.report;
 q.profile=SNAPSHOT_PROFILE;q.policy=structuredClone(SNAPSHOT_POLICY);q.selectedCase.representation='native-treemap-choice; setter-and-three-native-archives';
 r.schemaVersion=4;r.profile=SNAPSHOT_PROFILE;r.saveCopies=3;r.snapshots={};
 for(const phase of ['before','edited','reopened']){const file=path.join(q.nativeRoot,phase+'.pptx');fs.writeFileSync(file,'SYNTHETIC INERT '+phase+'; NOT A PPTX',{flag:'wx'});r.snapshots[phase]={path:file,sha256:fileIdentity(file).sha256};}
 r.opens[1].path=r.snapshots.edited.path;r.opens[1].sha256=r.snapshots.edited.sha256;
 r.actions=[{op:q.selectedCase.action.op,actionModelSha256:q.selectedCase.actionModelSha256,actionFileIdentity:q.selectedCase.actionFileIdentity,status:'success',setterAttempts:1}];
 r.probes=snapshotCriticalProbes(r,q.selectedCase.action);
 const values=name=>['preflight.globalIdle','application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count'].includes(name)?0:null;
 e.stages=snapshotOperations(r,q.selectedCase.action).flatMap(stage=>stage.startsWith('worker.')?[{stage,status:'success'}]:[{stage,status:'begin'},{stage,status:'success'}]).map((row,index)=>({...row,sequence:index+1,timestamp:'2000-01-01T00:00:00.000Z',value:row.status==='success'?values(row.stage):null,error:'',officeOperationsStopped:false,cleanupConfirmed:row.stage.startsWith('worker.')}));
 e.admission.profile=SNAPSHOT_PROFILE;e.admission.policy=structuredClone(SNAPSHOT_POLICY);e.admission.ready={workerCleanupConfirmed:true,stageCount:e.stages.length,lifecycle:e.stages.filter(s=>s.status==='success').map(s=>({stage:s.stage,sequence:s.sequence})),opens:2,saves:3,closes:2,edits:1,quits:1};
 const fixture=path.join(output,'snapshot-bridge.json');fs.writeFileSync(fixture,JSON.stringify({synthetic:true,nativeAcceptance:false,controllerRoot:ROOT,root:f.root,admissionFile:f.admissionFile,evidence:e},null,2)+'\n',{flag:'wx'});return fixture;
}
test('actual PS5 AST-only setter plus real snapshot typed-adapter controls never call Values getter or Office',{skip:process.platform!=='win32'},async()=>{
 const f=await fixture(),output=fs.mkdtempSync(path.join(os.tmpdir(),'opf-snapshot-managed-')),actionFile=path.join(output,'action.json'),wire=Buffer.from(JSON.stringify(f.action,null,2)+'\n');fs.writeFileSync(actionFile,wire,{flag:'wx'});
 const bridge=snapshotBridgeFixture(output),shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'scripts/native-acceptance/seven-value-snapshot-check.ps1'),'-Root',ROOT,'-ActionFile',actionFile,'-ActionModelSha256',digest(Buffer.from(JSON.stringify(f.action))),'-ActionFileSha256',digest(wire),'-ActionFileBytes',String(wire.length),'-FixtureFile',bridge,'-Output',path.join(output,'managed')],{env:windowsPowerShellEnvironment(process.env),timeout:60000,encoding:'utf8',maxBuffer:4*1024*1024});
 fs.writeFileSync(path.join(output,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(output,'stderr.log'),result.stderr??'');assert.equal(result.error,undefined,output);assert.equal(result.status,0,JSON.stringify({output,stdout:result.stdout,stderr:result.stderr}));
 const receipt=JSON.parse(fs.readFileSync(path.join(output,'managed/result.json'),'utf8').replace(/^\uFEFF/u,''));assert.equal(receipt.officeInvoked,false);assert.equal(receipt.realProcessQueries,0);assert.equal(receipt.officeActions,0);assert.ok(receipt.rows.length>10);assert.ok(receipt.rows.every(r=>r.getterCalls===0));
 const names=['complete-first-zero','foreign-profile','foreign-request-profile','foreign-policy','failed-worker','timed-out','pending-worker','cleanup-false','stopped','missing-stage','duplicate-stage','reordered-stage','stage-gap','stage-error','nonzero-preflight','wrong-model','wrong-wire','second-setter','missing-snapshot','foreign-snapshot','snapshot-hash','identity-bytes','identity-hash','reader-wire-pin','reader-file-identity'];
 assert.deepEqual(receipt.bridge.map(row=>row.name),names);assert.ok(receipt.bridge.every(row=>row.passed===true&&row.realProcessQueries===0&&row.officeActions===0));
 assert.equal(receipt.bridge[0].mockProcessQueries,1);assert.equal(receipt.bridge[0].observedRows,1);assert.ok(receipt.bridge.slice(1).every(row=>row.mockProcessQueries===0&&row.observedRows===0));
});
