import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only, relocation-safe verification of preserved E8 records. Original
// machine paths are binding strings only; no Office, subprocess or dependency.
const root=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=name=>readFileSync(path.join(root,name));
const json=name=>JSON.parse(bytes(name).toString('utf8').replace(/^\uFEFF/,''));
const safe=name=>typeof name==='string'&&!/[\\:]/.test(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..');
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const list=(dir=root)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  assert(!entry.isSymbolicLink(),'No symlinks in evidence');
  const full=path.join(dir,entry.name);
  assert(entry.isDirectory()||entry.isFile(),'Regular files only');
  return entry.isDirectory()?list(full):[path.relative(root,full).split(path.sep).join('/')];
}).sort();
const all=list(),manifest=json('manifest.json'),ledger=json('source-copy-ledger.json');
assert.equal(manifest.schemaVersion,1);assert.equal(ledger.schemaVersion,1);
assert(manifest.files.every(row=>safe(row.path)&&integer(row.bytes,0,1_000_000)&&/^[a-f0-9]{64}$/.test(row.sha256)));
assert.deepEqual(manifest.files.map(row=>row.path).sort(),all.filter(name=>name!=='manifest.json'),'Exact bundle membership');
for(const row of manifest.files){assert.equal(bytes(row.path).length,row.bytes,row.path);assert.equal(hash(bytes(row.path)),row.sha256,row.path);}
const copied=all.filter(name=>/^(fixture|environment|native-inventory-01|auditor|invocation)\//.test(name));
assert.equal(copied.length,25);assert.equal(all.length,30);
assert.deepEqual(ledger.files.map(row=>row.bundlePath).sort(),copied,'All copies have provenance');
for(const row of ledger.files){
  assert(safe(row.bundlePath)&&safe(row.sourceArtifactPath));assert.equal(row.kind,'byte-copy');
  assert.equal(row.sourceSha256,row.bundleSha256);assert.equal(hash(bytes(row.bundlePath)),row.sourceSha256);assert.equal(bytes(row.bundlePath).length,row.bytes);
}
assert.equal(bytes('.gitattributes').toString(),'* -text\n');
const sourceHashes={
  'native-font-inventory.ps1':'dd21258aca3b8b4777e928bb96ee7c6488199b53326c594e0c2bd63ea4322c82',
  'native-font-inventory-audit.mjs':'f0a9f9652a1f7d84202910f615cb1ad64246b521474b90e97f77411e03492352',
  'native-process.ps1':'2a49f620b77fd998b791b835dd17bc64487f9539fa20935cbbba50ea5b7dc015',
  'native-text-fonts.ps1':'853d51c68d123c354748e948dbcb8c31aaa923dc6319734dfb393010e8cb3ba6',
  'powershell-scan.mjs':'02df02cdc1ef0ecf9d24358575899a825d58ffada62ad8ac0e0ac47ce2bc41e6',
  'native-font-embed-audit.mjs':'6ad35992b75e1c677194c832289824d588c223a3d25aff029983bf3ba3f4d704',
};
for(const [name,sha] of Object.entries(sourceHashes))assert.equal(hash(bytes('auditor/'+name)),sha,name);
const control='4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7';
assert.deepEqual(manifest.inputAncestry,{bundle:'../windows-native-explicit-slots-20260929/README.md',sha256:control,bytes:15616});
assert.equal(hash(bytes('fixture/calibri-explicit-slots-control.pptx')),control);
assert.equal(hash(bytes('native-inventory-01/inputs/source.pptx')),control);
assert.equal(bytes('fixture/calibri-explicit-slots-control.pptx').length,15616);

// Exact input SHA binds the accepted E7 input and its prior derivation proof.
// No duplicate ZIP parser or derivation adapter is needed for this observation.
const isFont=name=>/(^|\/)ppt\/fonts\/|\.(ttf|otf|ttc|odttf|woff2?|fntdata)$/i.test(name);
assert(!all.some(isFont));

const base='native-inventory-01/',read=name=>json(base+name);
const request=read('request.json'),report=read('report.json'),supervisor=read('supervisor.json'),worker=read('worker.json'),progress=read('progress.json'),audit=read('audit.json');
const bounds={maxPresentationFonts:64,maxSlides:2,maxShapesPerSlide:10,maxParagraphsPerShape:12,maxParagraphsTotal:24,maxRunsPerShape:24,maxRunsTotal:40,maxTextCharacters:1024};
for(const record of [request,report]){
  assert.equal(record.schemaVersion,1);assert.equal(record.kind,'native-font-inventory');assert.equal(record.inputMode,'control-deck');
  assert.equal(record.compareAfterContentFonts,true);assert.deepEqual(record.fontRegistration,{mode:'none',flags:null});
  assert.equal(record.source.sha256,control);assert.equal(record.source.snapshotSha256,control);assert.deepEqual(record.bounds,bounds);
}
assert.equal(request.fixture,null);assert.equal(report.source.path,request.source.path);assert.equal(report.source.snapshotPath,request.source.snapshotPath);
assert.equal(report.source.fullName,request.source.snapshotPath);assert.equal(report.source.readOnly,-1);assert.equal(report.source.openedPathMatches,true);assert.equal(report.source.snapshotUnchangedAfterClose,true);
assert.equal(report.ownedOpenCount,1);assert.equal(report.ownedCloseCount,1);assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);
assert.equal(report.error,null);assert.equal(report.failureCleanup,null);assert.deepEqual(report.semanticFailures,[]);assert.deepEqual(report.boundsExceeded,[]);
assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
const expectedFonts={count:2,entries:[{index:1,name:'',embedded:0,embeddable:0},{index:2,name:'Aptos',embedded:0,embeddable:-1}]};
for(const snapshot of [report.presentationFonts,report.presentationFontsAfterContent]){
  assert(integer(snapshot?.count,0,64));assert(Array.isArray(snapshot.entries));assert.equal(snapshot.entries.length,snapshot.count);
  snapshot.entries.forEach((entry,index)=>{assert.equal(entry.index,index+1);assert.equal(typeof entry.name,'string');assert(Number.isSafeInteger(entry.embedded));assert(Number.isSafeInteger(entry.embeddable));});
  assert.deepEqual(snapshot,expectedFonts,'Exact normalized getter observations');
}
const first=report.presentationFonts,second=report.presentationFontsAfterContent;
const raw=snapshot=>snapshot.entries.map(entry=>[entry.index,entry.name,entry.embedded,entry.embeddable]);
const multiset=snapshot=>snapshot.entries.map(entry=>JSON.stringify([entry.name,entry.embedded,entry.embeddable])).sort();
const entriesEqual=JSON.stringify(raw(first))===JSON.stringify(raw(second));
const ignoringOrder=JSON.stringify(multiset(first))===JSON.stringify(multiset(second));
const comparison={beforeCount:first.count,afterCount:second.count,entriesEqual,namesEqualInOrder:JSON.stringify(first.entries.map(entry=>entry.name))===JSON.stringify(second.entries.map(entry=>entry.name)),entriesEqualIgnoringOrder:ignoringOrder,
  outcome:entriesEqual?'unchanged':ignoringOrder?'reordered':'changed',beforeAptosReported:first.entries.some(entry=>/^aptos/i.test(entry.name)),afterAptosReported:second.entries.some(entry=>/^aptos/i.test(entry.name)),
  beforeEmptyNameIndexes:first.entries.filter(entry=>entry.name==='').map(entry=>entry.index),afterEmptyNameIndexes:second.entries.filter(entry=>entry.name==='').map(entry=>entry.index)};
assert.deepEqual(report.fontQueryComparison,comparison);assert.deepEqual(audit.findings.fontQueryComparison,comparison);
assert.deepEqual(report.theme,{major:{latin:'Calibri',complexScript:'Calibri',eastAsian:'Calibri'},minor:{latin:'Calibri',complexScript:'Calibri',eastAsian:'Calibri'}});
const font2Slots=['name','nameAscii','nameOther','nameFarEast','nameComplexScript'];
const shapeFonts=shapes=>shapes.flatMap(shape=>[shape.rangeFont,...shape.paragraphs.map(row=>row.font),...shape.runs.map(row=>row.font)]);
const observations=shapeFonts(report.slides.entries.flatMap(slide=>slide.shapes));assert.equal(observations.length,6);
for(const font of observations){for(const name of font2Slots)assert.equal(font[name],name==='nameOther'?'':'Calibri');assert(Number.isFinite(font.size));assert(Number.isSafeInteger(font.bold)&&Number.isSafeInteger(font.italic));}
assert.equal(report.slides.count,1);assert.equal(report.slides.entries.length,1);assert.equal(report.slideMaster.shapeCount,0);assert.deepEqual(report.slideMaster.shapes,[]);
const distinct=values=>[...new Set(values.filter(value=>typeof value==='string'&&value.length>0))].sort();
const computedLedger={presentationFontNames:distinct(first.entries.map(entry=>entry.name)),slideTextSlotNames:distinct(observations.flatMap(font=>font2Slots.map(slot=>font[slot]))),
  masterTextSlotNames:distinct(shapeFonts(report.slideMaster.shapes).flatMap(font=>font2Slots.map(slot=>font[slot]))),themeFontNames:distinct(['major','minor'].flatMap(kind=>['latin','complexScript','eastAsian'].map(slot=>report.theme[kind][slot])))};
for(const [source,target] of [['presentationFontNames','aptosPresentationFontNames'],['slideTextSlotNames','aptosSlideTextSlotNames'],['masterTextSlotNames','aptosMasterTextSlotNames'],['themeFontNames','aptosThemeFontNames']])computedLedger[target]=computedLedger[source].filter(name=>/^aptos/i.test(name));
computedLedger.nonCarlitoPresentationFontNames=computedLedger.presentationFontNames.filter(name=>name!=='Carlito');
computedLedger.carlitoOnlyPresentationFonts=computedLedger.presentationFontNames.length>0&&computedLedger.nonCarlitoPresentationFontNames.length===0;
computedLedger.aptosReported=['aptosPresentationFontNames','aptosSlideTextSlotNames','aptosMasterTextSlotNames','aptosThemeFontNames'].some(key=>computedLedger[key].length>0);
const {scope:ledgerScope,...reportedLedger}=report.fontLedger;assert.equal(typeof ledgerScope,'string');assert.deepEqual(reportedLedger,computedLedger);
assert.deepEqual(audit.findings.ledger,{...computedLedger,emptyNamePresentationFontIndexes:[1],emptyNameFontReported:true});
assert.equal(supervisor.aptosReported,computedLedger.aptosReported);assert.deepEqual(supervisor.presentationFontNames,computedLedger.presentationFontNames);
for(const key of ['passed','officeLifecycleComplete','readOnlyConfirmed','inventoryComplete','inputsUnchanged'])assert.equal(supervisor[key],true,key);
assert.equal(supervisor.compareAfterContentFonts,true);assert.equal(supervisor.inputMode,'control-deck');assert.equal(supervisor.fontRegistrationMode,'none');assert.equal(supervisor.registrationFilePresent,false);assert.equal(supervisor.fontCleanupConfirmed,null);
assert.equal(supervisor.parentError,null);assert.equal(supervisor.exitCode,0);assert.equal(supervisor.timedOut,false);assert.equal(supervisor.ownedOpenCount,1);assert.equal(supervisor.ownedCloseCount,1);
assert.equal(supervisor.lastDurableStage,'worker.complete');assert.equal(supervisor.lastDurableStatus,'success');
assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(worker.timeoutSeconds,45);assert.equal(worker.processId,2808);
assert.equal(worker.startedAt,'2026-09-29T15:07:36.5509998Z');assert.equal(worker.finishedAt,'2026-09-29T15:07:37.9558843Z');assert.equal(Date.parse(worker.finishedAt)-Date.parse(worker.startedAt),1405);
assert.equal(supervisor.inputChecks.length,8);
for(const [role,key,name] of [['source','source','source.pptx'],['verifier','verifier','native-font-inventory.ps1'],['process-helper','processHelper','native-process.ps1'],['font-helper','fontHelper','native-text-fonts.ps1']]){
  const binding=request[key];assert.equal(binding.sha256,binding.snapshotSha256);assert.equal(hash(bytes(base+'inputs/'+name)),binding.sha256);
  if(role!=='source')assert.equal(hash(bytes('auditor/'+name)),binding.sha256);
  for(const copy of ['original','snapshot']){const rows=supervisor.inputChecks.filter(row=>row.role===role&&row.copy===copy);assert.equal(rows.length,1);assert.equal(rows[0].path,binding[copy==='original'?'path':'snapshotPath']);assert.equal(rows[0].matched,true);assert.equal(rows[0].expected,binding.sha256);assert.equal(rows[0].actual,binding.sha256);}
}
assert.equal(audit.schemaVersion,2);assert.equal(audit.kind,'native-font-inventory-audit');assert.equal(audit.passed,true);assert.deepEqual(audit.failures,[]);assert.equal(audit.reviewedVerifierRevision,'current');assert.equal(audit.mode,'audit');
assert.deepEqual(Object.keys(audit.rawHashes).sort(),[
  'request.json','report.json','supervisor.json','worker.json','progress.json','stages.jsonl',
  'inputs/source.pptx','inputs/native-font-inventory.ps1','inputs/native-process.ps1','inputs/native-text-fonts.ps1',
  'original:source','original:verifier','original:process-helper','original:font-helper',
  'reviewed/native-font-inventory.ps1','reviewed/native-process.ps1','reviewed/native-text-fonts.ps1',
].sort(),'Exact raw audit hash keys');
for(const [name,sha] of Object.entries(audit.rawHashes)){
  let actual;
  if(name.startsWith('original:')){const key={source:'source',verifier:'verifier','process-helper':'processHelper','font-helper':'fontHelper'}[name.slice(9)];assert(key);actual=request[key].sha256;}
  else if(name.startsWith('reviewed/'))actual=hash(bytes('auditor/'+name.slice(9)));
  else{assert(safe(name));actual=hash(bytes(base+name));}
  assert.equal(actual,sha,name);
}
for(const name of ['request.json','report.json','supervisor.json','worker.json','progress.json','stages.jsonl'])assert.equal(audit.rawHashes[name],hash(bytes(base+name)));
assert.deepEqual(audit.findings.theme,report.theme);assert.deepEqual(audit.findings.presentationFonts,first.entries);assert.deepEqual(audit.findings.presentationFontsAfterContent,second.entries);
assert.equal(audit.findings.inputMode,'control-deck');assert.equal(audit.findings.fontRegistrationMode,'none');assert.equal(audit.findings.powerPointVersion,'16.0');
assert.deepEqual(audit.findings.failureCleanup,{applicable:false,outcome:null,closeInvocations:1,consistent:true,problems:[]});

// Reconstruct every stage from complete bounded content and both collections.
const expected=[];const pair=name=>expected.push([name,'begin'],[name,'success']);const single=name=>expected.push([name,'success']);
const fontCollection=(prefix,snapshot)=>{pair(prefix+'.get');pair(prefix+'.count.get');snapshot.entries.forEach((entry,n)=>{for(const suffix of ['get','name.get','embedded.get','embeddable.get'])pair(prefix+'.item-'+(n+1)+'.'+suffix);});};
const font2=prefix=>{pair(prefix+'.font.get');for(const key of [...font2Slots,'size','bold','italic'])pair(prefix+'.font.'+key+'.get');};
let paragraphTotal=0,runTotal=0;
const text=(value,length,truncated)=>{assert.equal(typeof value,'string');assert(value.length<=1024);assert(integer(length,0,Number.MAX_SAFE_INTEGER));assert.equal(typeof truncated,'boolean');};
const shapes=(prefix,record)=>{
  assert(integer(record.shapeCount,0,10));assert.equal(record.shapes.length,record.shapeCount);pair(prefix+'.shapes.count.get');
  for(const [index,shape] of record.shapes.entries()){
    const p=prefix+'.shape-'+(index+1);assert.equal(shape.index,index+1);assert.equal(typeof shape.name,'string');assert(Number.isSafeInteger(shape.type));assert([0,-1].includes(shape.hasTextFrame));
    for(const suffix of ['get','name.get','type.get','hasTextFrame.get'])pair(p+'.'+suffix);
    if(shape.hasTextFrame!==-1)continue;
    assert([0,-1].includes(shape.hasText));text(shape.text,shape.textLength,shape.textTruncated);
    for(const suffix of ['textFrame2.get','hasText.get','textRange2.get','text.get','length.get'])pair(p+'.'+suffix);font2(p);
    if(shape.hasText!==-1)continue;
    for(const [kind,rows,count,maximum] of [['paragraphs',shape.paragraphs,shape.paragraphCount,12],['runs',shape.runs,shape.runCount,24]]){
      assert(integer(count,0,maximum));assert.equal(rows.length,count);if(kind==='runs')runTotal+=count;else paragraphTotal+=count;
      pair(p+'.'+kind+'.get');pair(p+'.'+kind+'.count.get');
      rows.forEach((row,n)=>{assert.equal(row.index,n+1);assert(integer(row.start,0,Number.MAX_SAFE_INTEGER));text(row.text,row.length,row.textTruncated);const sub=p+'.'+(kind==='runs'?'run':'paragraph')+'-'+(n+1);for(const suffix of ['get','text.get','start.get','length.get'])pair(sub+'.'+suffix);font2(sub);});
    }
  }
};
single('worker.initialize');for(const name of ['application.create','application.version.get','input.preflight.presentations.get','input.preflight.presentations.count.get'])pair(name);
assert.equal(report.preflightPresentationCount,0);
for(const name of ['input.presentations.get','input.presentation.open-readonly','owned.presentation.fullName.get','owned.presentation.readOnly.get'])pair(name);
fontCollection('owned.presentation.fonts',first);
for(const name of ['owned.presentation.slideMaster.get','owned.slideMaster.theme.get','owned.theme.themeFontScheme.get'])pair(name);
for(const kind of ['major','minor']){pair('owned.theme.'+kind+'Font.get');for(const slot of ['latin','complexScript','eastAsian']){pair('owned.theme.'+kind+'Font.'+slot+'.get');pair('owned.theme.'+kind+'Font.'+slot+'.name.get');}}
pair('owned.presentation.slides.get');pair('owned.presentation.slides.count.get');assert(integer(report.slides.count,0,2));assert.equal(report.slides.entries.length,report.slides.count);
report.slides.entries.forEach((slide,n)=>{assert.equal(slide.index,n+1);const p='owned.slide-'+(n+1);pair(p+'.get');pair(p+'.shapes.get');shapes(p,slide);});
pair('owned.slideMaster.shapes.get');shapes('owned.slideMaster',report.slideMaster);assert(paragraphTotal<=24&&runTotal<=40);
fontCollection('owned.presentation.fonts-after-content',second);
pair('owned.presentation.fullName-before-close.get');pair('owned.presentation.close');single('owned.presentation.cleanup');single('worker.complete');
const stages=bytes(base+'stages.jsonl').toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(line=>JSON.parse(line));
assert.equal(stages.length,303);assert.deepEqual(stages.map(row=>[row.stage,row.status]),expected);
const open=stages.findIndex(row=>row.stage==='input.presentation.open-readonly'),close=stages.findIndex(row=>row.stage==='owned.presentation.close'&&row.status==='success');
for(const [index,row] of stages.entries()){
  assert.equal(row.sequence,index+1);assert.equal(row.error,null);assert.equal(row.officeOperationsStopped,false);const time=Date.parse(row.timestamp);assert(Number.isFinite(time));
  assert(time>=Date.parse(worker.startedAt)&&time<=Date.parse(worker.finishedAt));if(index>0)assert(time>=Date.parse(stages[index-1].timestamp));
  const owned=index>=open&&index<=close;assert.equal(row.ownedPresentationPath,owned?request.source.snapshotPath:null);assert.equal(row.cleanupConfirmed,!owned);
}
assert.deepEqual(stages.at(-1),progress);assert.equal(progress.stage,'worker.complete');assert(Date.parse(supervisor.timestamp)>=Date.parse(progress.timestamp));
for(const name of ['input.presentation.open-readonly','owned.presentation.close'])assert.equal(stages.filter(row=>row.stage===name&&row.status==='success').length,1);
const firstQuery=stages.find(row=>row.stage==='owned.presentation.fonts.get'),secondQuery=stages.find(row=>row.stage==='owned.presentation.fonts-after-content.get');
assert.equal(firstQuery.timestamp,'2026-09-29T15:07:37.1595987Z');assert.equal(secondQuery.timestamp,'2026-09-29T15:07:37.8560631Z');
const pre=json('environment/host-preflight.json'),post=json('environment/host-postflight.json'),invocation=json('invocation/native-invocation.json');
assert.equal(pre.plannedInputSha256,control);assert.equal(pre.plannedMode,'control-deck');assert.equal(pre.compareAfterContentFonts,true);assert.equal(pre.plannedRegistrationMode,'none');assert.equal(pre.temporaryFontRegistrationsThisExperiment,0);
assert.equal(post.sourceSha256,control);assert.equal(post.auditPassed,true);assert.equal(post.attemptedNativeRunsThisExperiment,1);assert.equal(post.temporaryFontRegistrations,0);assert.equal(post.physicalFontIdentityProven,false);assert.deepEqual(post.comparison,comparison);
assert.equal(pre.timeoutSeconds,45);assert.equal(pre.priorNativeInventoryRunsThisPowerPointProcess,0);assert.equal(pre.priorNativeInventoryRunsThisProgramToday,3);
assert.equal(pre.officeProcesses.length,1);assert.deepEqual(post.officeProcesses,pre.officeProcesses);
const office=pre.officeProcesses[0];assert.equal(office.processId,5288);assert.equal(office.name,'POWERPNT');assert.equal(office.fileVersion,'16.0.20430.20092');assert.equal(office.productVersion,office.fileVersion);assert.equal(office.startedAt,'2026-09-29T14:52:46.9201081Z');
assert.equal(typeof pre.uiObservation,'string');assert.equal(typeof post.uiObservation,'string');assert(pre.uiObservation.includes('Home'));assert(post.uiObservation.includes('Home'));
assert(Date.parse(pre.observedAt)<=Date.parse(worker.startedAt));assert(Date.parse(post.observedAt)>=Date.parse(worker.finishedAt));
const nativeGraph={opf:'9261eac59011cec04aebc3c9003809f05c7b1cd3','opf-pptx':'9a7f3c1513c5875b4ac9d5974c04151a4ac26cbe','opf-render':'c62b3f98a4ac98cdec8ffd28c035a17a04197396','opf-editor':'d0c95a16b50eccb3eee695ace44cc6c3a6754f2f','pptx-gallery':'f17e9ae5869669d5fbac3720f285652d0c37551c'};
assert.deepEqual(pre.sourceGraph,nativeGraph);assert.deepEqual(manifest.nativeSourceGraph,nativeGraph);assert.equal(pre.harnessPr,'https://github.com/OpenPresentation/opf-pptx/pull/88');
assert.deepEqual(manifest.harnessReview,{mergedHead:nativeGraph['opf-pptx'],reviewedHead:'2822107cde8549b5150dab49fed403b52e9a232d',equalTree:'5807a63ab571c173689e995ef69991f19aaff82b',ownerReportedActionsCreditShortage:true,ownerAcceptedLocalChecks:true});
assert.equal(invocation.exitCode,0);assert.equal(invocation.attempts,1);assert(Date.parse(invocation.endedAt)>=Date.parse(worker.finishedAt));assert.equal(bytes(base+'worker.stderr.log').length,0);
const parent=JSON.parse(bytes('invocation/native-parent.log').toString().trim().split(/\r?\n/).at(-1)),auditLog=JSON.parse(bytes('invocation/native-audit.log').toString().trim());
assert.equal(parent.passed,true);assert.equal(parent.inputMode,'control-deck');assert.equal(parent.fontRegistrationMode,'none');assert.equal(parent.aptosReported,true);assert.deepEqual(parent.presentationFontNames,['Aptos']);
assert.equal(auditLog.passed,true);assert.equal(auditLog.failures,0);assert.equal(auditLog.emptyNameFontReported,true);assert.equal(auditLog.reviewedVerifierRevision,'current');
console.log(JSON.stringify({passed:true,files:all.length,provenanceRecords:ledger.files.length,stages:stages.length,elapsedMs:1405,queryBeginIntervalMs:Date.parse(secondQuery.timestamp)-Date.parse(firstQuery.timestamp),comparison:comparison.outcome,
  scope:'Recorded E8 query sequence and elapsed interval only; no Office replay, UI proof, root-cause conclusion, physical glyph identity, font allowlist or embedding acceptance.'}));
