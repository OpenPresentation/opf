import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {inflateRawSync, crc32} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only, relocation-safe evidence verification. No Office, subprocess,
// font API, original machine path, or installed package is consulted.
const root=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=name=>readFileSync(path.join(root,name));
const json=name=>JSON.parse(bytes(name).toString('utf8').replace(/^\uFEFF/,''));
const safe=name=>typeof name==='string' && !/[\\:]/.test(name) && name.split('/').every(p=>p && p!=='.' && p!=='..');
const list=(dir=root)=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  assert(!entry.isSymbolicLink(),'No symlinks in evidence');
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?list(full):[path.relative(root,full).split(path.sep).join('/')];
}).sort();
const all=list(), manifest=json('manifest.json');
assert.equal(manifest.schemaVersion,1);
assert(manifest.files.every(row=>safe(row.path)));
assert.deepEqual(manifest.files.map(row=>row.path).sort(),all.filter(name=>name!=='manifest.json'),'Exact bundle membership');
for(const row of manifest.files){assert.equal(bytes(row.path).length,row.bytes,row.path);assert.equal(hash(bytes(row.path)),row.sha256,row.path);}
const ledger=json('source-copy-ledger.json');
const copied=all.filter(name=>/^(fixture|environment|native-inventory-01|auditor|preparation)\//.test(name)&&name!=='preparation/derive.mjs');
assert.deepEqual(ledger.files.map(row=>row.bundlePath).sort(),copied,'Every original copy has provenance');
for(const row of ledger.files){
  assert(safe(row.bundlePath)&&safe(row.sourceArtifactPath));assert.equal(row.kind,'byte-copy');
  assert.equal(row.sourceSha256,row.bundleSha256);assert.equal(hash(bytes(row.bundlePath)),row.sourceSha256);assert.equal(bytes(row.bundlePath).length,row.bytes);
}
const canonical='776147ddfd2a35ceca4480b66d58c82c9255609b5abe245a2b3bb342651ebce5';
const control='4e2bab2a4f5a0f09350d2edc2463bcb29302fa7db34a8c621e39fcd5c9a16cd7';
assert.equal(hash(bytes('fixture/parent/source.pptx')),canonical);
assert.equal(hash(bytes('fixture/calibri-explicit-slots-control.pptx')),control);
assert.equal(hash(bytes('native-inventory-01/inputs/source.pptx')),control);

// Decode central-directory entries with independent built-in DEFLATE/CRC,
// rejecting duplicate names and local/central name, flag or method disagreement.
// Expanded sizes and CRCs are checked against the central directory; pinned
// whole-input hashes also bind all local headers and container metadata.
function unzip(buffer){
  let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50 && i+22+buffer.readUInt16LE(i+20)===buffer.length){end=i;break;}
  assert(end>=0);assert.equal(buffer.readUInt16LE(end+4),0);assert.equal(buffer.readUInt16LE(end+6),0);
  const count=buffer.readUInt16LE(end+10);assert.equal(buffer.readUInt16LE(end+8),count);assert.equal(count,41);
  let offset=buffer.readUInt32LE(end+16);const limit=offset+buffer.readUInt32LE(end+12);assert.equal(limit,end);
  const entries=new Map();
  for(let i=0;i<count;i++){
    assert.equal(buffer.readUInt32LE(offset),0x02014b50);
    const flags=buffer.readUInt16LE(offset+8), method=buffer.readUInt16LE(offset+10), crc=buffer.readUInt32LE(offset+16);
    const compressed=buffer.readUInt32LE(offset+20), expanded=buffer.readUInt32LE(offset+24), nl=buffer.readUInt16LE(offset+28), local=buffer.readUInt32LE(offset+42);
    const name=buffer.subarray(offset+46,offset+46+nl).toString('utf8');assert(safe(name.endsWith('/')?name.slice(0,-1):name)&&!entries.has(name));assert.equal(flags&1,0);assert([0,8].includes(method));
    assert.equal(buffer.readUInt32LE(local),0x04034b50);assert.equal(buffer.readUInt16LE(local+8),method);assert.equal(buffer.readUInt16LE(local+6),flags);
    const ln=buffer.readUInt16LE(local+26), extra=buffer.readUInt16LE(local+28);assert.equal(buffer.subarray(local+30,local+30+ln).toString('utf8'),name);
    const start=local+30+ln+extra;assert(start+compressed<=limit);
    const payload=buffer.subarray(start,start+compressed), content=method===8?inflateRawSync(payload):payload;
    assert.equal(content.length,expanded);assert.equal(crc32(content),crc);entries.set(name,content);
    offset+=46+nl+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
  assert.equal(offset,limit);return entries;
}
const before=unzip(bytes('fixture/parent/source.pptx')), after=unzip(bytes('fixture/calibri-explicit-slots-control.pptx'));
const names=[...before.keys()].sort();assert.deepEqual([...after.keys()].sort(),names);
const preparation=json('preparation/prepared-01/manifest.json'),repeatPreparation=json('preparation/prepared-repeat-01/manifest.json');
assert.equal(preparation.source.sha256,canonical);assert.equal(preparation.output.sha256,control);
assert.equal(preparation.generator.sha256,hash(bytes('preparation/prepare-explicit-slots.mjs')));
assert.equal(preparation.dependency.sha256,hash(bytes('preparation/fflate/index.mjs')));
assert.equal(preparation.dependency.version,'0.8.3');assert.equal(json('preparation/fflate/package.json').version,'0.8.3');
assert.equal(preparation.dependency.packageSha256,hash(bytes('preparation/fflate/package.json')));
assert.equal(preparation.source.bytes,bytes('fixture/parent/source.pptx').length);assert.equal(preparation.output.bytes,bytes('fixture/calibri-explicit-slots-control.pptx').length);
assert.deepEqual(preparation.counts,{entries:41,changedEntries:1,changedTypefaceAttributes:4,unchangedEntryContents:40,remainingEmptyThemeScriptSlots:0});
assert.deepEqual(preparation.finiteControlGuard,{expectedSourceSha256:canonical,expectedDependencySha256:'8d75534a30a0580608e1271c13d70943ed4cd3589fddff7b1197748036a5116e',expectedEntries:41,expectedChangedAttributes:4,expectedChangedEntries:1,expectedRemainingEmptyThemeScriptSlots:0,expectedLiteralCarlitoOccurrences:0,expectedLiteralAptosOccurrences:0});
assert.deepEqual(preparation.sourceGraph,{core:'0e81a407f57e5106ad607a9617c571d86b5428da',pptx:'7fca9a2eb5088ee2325fb686d1ff84332af2b8d9',render:'6c7d7818e40d0f9c519e4b34f7a24e9150c1787f',editor:'d0c95a16b50eccb3eee695ace44cc6c3a6754f2f',editorScope:'Dependency-only; not used to derive this control.'});
assert.equal(preparation.nativeResult,null);
assert.deepEqual(preparation.verified,{sourceUnchanged:true,deterministicRepeatedOutput:true,exactEntrySet:true,onlyListedAttributesChanged:true,allOtherEntryContentsUnchanged:true,allRelationshipsUnchanged:true,noEmbeddedFonts:true,noLiteralCarlitoOrAptos:true});
for(const inventory of [preparation.beforeInventory,preparation.afterInventory])assert.deepEqual(inventory,{literalOccurrences:[],fontEntries:[],fontRelationships:[],fontContentTypes:[]});
assert.equal(preparation.entries.length,41);assert.deepEqual(preparation.entries.map(row=>row.entry),names);
assert.equal(preparation.changes.length,4);
const expectedPaths=['majorFont','minorFont'].flatMap(kind=>['ea','cs'].map(slot=>`/a:theme[1]/a:themeElements[1]/a:fontScheme[1]/a:${kind}[1]/a:${slot}[1]`));
assert.deepEqual(preparation.changes.map(edit=>edit.path),expectedPaths);
const changed=[];
for(const name of names){
  const original=before.get(name), current=after.get(name), part=preparation.entries.find(row=>row.entry===name);
  assert.equal(hash(original),part.beforeSha256);assert.equal(hash(current),part.afterSha256);
  assert.equal(original.length,part.beforeBytes);assert.equal(current.length,part.afterBytes);
  const edits=preparation.changes.filter(edit=>edit.part===name).sort((a,b)=>a.beforeValueByteOffset-b.beforeValueByteOffset);
  assert.equal(edits.length,part.changedAttributes);
  let expected=Buffer.from(original);
  for(const edit of [...edits].reverse()){
    assert.equal(edit.part,'ppt/theme/theme1.xml');assert.equal(edit.attribute,'typeface');assert.equal(edit.beforeValue,'');assert.equal(edit.afterValue,'Calibri');
    assert.equal(edit.beforeAttribute,'typeface=""');assert.equal(edit.afterAttribute,'typeface="Calibri"');
    const index=edit.beforeValueByteOffset;assert(Number.isSafeInteger(index)&&index>=10&&index<original.length);
    assert.equal(original.subarray(index-10,index+1).toString(),'typeface=""');
    const afterIndex=edit.afterValueByteOffset;assert.equal(current.subarray(afterIndex-10,afterIndex+8).toString(),'typeface="Calibri"');
    assert.equal(Buffer.byteLength(original.toString('utf8').slice(0,edit.beforeValueCharacterOffset)),index);
    assert.equal(Buffer.byteLength(current.toString('utf8').slice(0,edit.afterValueCharacterOffset)),afterIndex);
    assert(original.toString('utf8').includes(edit.beforeOpeningTag));assert(current.toString('utf8').includes(edit.afterOpeningTag));
    expected=Buffer.concat([expected.subarray(0,index),Buffer.from('Calibri'),expected.subarray(index)]);
  }
  assert.deepEqual(current,expected,name+': only listed attributes change');
  assert(!/Carlito|Aptos/i.test(original.toString()));assert(!/Carlito|Aptos/i.test(current.toString()));
  if(!current.equals(original))changed.push(part);else assert.equal(edits.length,0);
  if(name.endsWith('.rels'))assert.deepEqual(current,original,'Relationships unchanged');
}
assert.deepEqual(changed,preparation.changedEntries);assert.equal(changed.length,1);assert.equal(names.length-changed.length,40);
assert.equal(changed[0].entry,'ppt/theme/theme1.xml');assert.equal(changed[0].afterBytes-changed[0].beforeBytes,28);
const expectedDiff=preparation.changes.map(edit=>`${edit.part} ${edit.path}/@typeface\n(before byte ${edit.beforeValueByteOffset}; after byte ${edit.afterValueByteOffset})\n- ${edit.beforeAttribute}\n+ ${edit.afterAttribute}`).join('\n\n')+'\n';
assert.equal(bytes('preparation/prepared-01/xml-attribute-diff.txt').toString(),expectedDiff);
assert.equal(bytes('preparation/prepared-repeat-01/xml-attribute-diff.txt').toString(),expectedDiff);
assert.deepEqual(bytes('preparation/prepared-repeat-01/calibri-explicit-slots-control.pptx'),bytes('fixture/calibri-explicit-slots-control.pptx'));
const {output:repeatOutput,...repeatStable}=repeatPreparation,{output:firstOutput,...firstStable}=preparation;
assert.deepEqual(repeatStable,firstStable);assert.equal(repeatOutput.sha256,firstOutput.sha256);assert.equal(repeatOutput.bytes,firstOutput.bytes);
assert.notEqual(repeatOutput.path,firstOutput.path);
const preparationReceipt=json('preparation/verification-receipt.json');
for(const key of ['sameOutputBytes','sameChanges','sameEntryHashes','existingOutputRejected','existingOutputUnchanged'])assert.equal(preparationReceipt[key],true);
assert.equal(preparationReceipt.sourceSha256,canonical);assert.equal(preparationReceipt.outputSha256,control);
assert.equal(preparationReceipt.generatorSha256,preparation.generator.sha256);assert.equal(preparationReceipt.outputBytes,firstOutput.bytes);
assert.equal(preparationReceipt.manifestSha256,hash(bytes('preparation/prepared-01/manifest.json')));
assert.equal(preparationReceipt.repeatManifestSha256,hash(bytes('preparation/prepared-repeat-01/manifest.json')));
assert.equal(preparationReceipt.diffSha256,hash(bytes('preparation/prepared-01/xml-attribute-diff.txt')));
const theme=after.get('ppt/theme/theme1.xml').toString();assert.equal([...theme.matchAll(/<a:(?:ea|cs) typeface=""\/>/g)].length,0);
assert.equal([...theme.matchAll(/<a:(?:ea|cs) typeface="Calibri"\/>/g)].length,4);
const isFont=name=>/(^|\/)ppt\/fonts\/|\.(ttf|otf|ttc|odttf|woff2?|fntdata)$/i.test(name);
assert(!all.some(isFont));assert(!names.some(isFont));
for(const entries of [before,after]){
  assert(![...entries].filter(([name])=>name.endsWith('.rels')).some(([,b])=>/Type="[^"]*\/(?:font|fontData)"/.test(b.toString())));
  assert(!/fontdata|obfuscatedFont|font-sfnt|opentype/i.test(entries.get('[Content_Types].xml').toString()));
}

const base='native-inventory-01/', read=name=>json(base+name);
const request=read('request.json'),report=read('report.json'),supervisor=read('supervisor.json'),worker=read('worker.json'),progress=read('progress.json'),audit=read('audit.json');
assert.equal(request.source.path,preparation.output.path,'Native attempt uses the reviewed prepared control');
const reviewedBounds={maxPresentationFonts:64,maxSlides:2,maxShapesPerSlide:10,maxParagraphsPerShape:12,maxParagraphsTotal:24,maxRunsPerShape:24,maxRunsTotal:40,maxTextCharacters:1024};
for(const record of [request,report]){
  assert.equal(record.inputMode,'control-deck');assert.deepEqual(record.fontRegistration,{mode:'none',flags:null});
  assert.equal(record.source.sha256,control);assert.equal(record.source.snapshotSha256,control);
  assert.deepEqual(record.bounds,reviewedBounds,'Exact reviewed inventory bounds');
}
assert.equal(request.fixture,null);assert.equal(report.source.path,request.source.path);assert.equal(report.source.snapshotPath,request.source.snapshotPath);
assert.equal(report.source.fullName,request.source.snapshotPath);assert.equal(report.source.readOnly,-1);assert.equal(report.source.openedPathMatches,true);assert.equal(report.source.snapshotUnchangedAfterClose,true);
assert.equal(report.ownedOpenCount,1);assert.equal(report.ownedCloseCount,1);assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);
assert.equal(report.error,null);assert.deepEqual(report.semanticFailures,[]);assert.deepEqual(report.boundsExceeded,[]);
assert.deepEqual(report.presentationFonts,{count:2,entries:[{index:1,name:'',embedded:0,embeddable:0},{index:2,name:'Aptos',embedded:0,embeddable:-1}]});
assert.deepEqual(report.theme,{major:{latin:'Calibri',complexScript:'Calibri',eastAsian:'Calibri'},minor:{latin:'Calibri',complexScript:'Calibri',eastAsian:'Calibri'}});
assert.equal(report.slides.count,1);assert.equal(report.slides.entries.length,1);assert.equal(report.slideMaster.shapeCount,0);
const observations=report.slides.entries.flatMap(slide=>slide.shapes.flatMap(shape=>[shape.rangeFont,...shape.paragraphs.map(p=>p.font),...shape.runs.map(r=>r.font)]));
assert.equal(observations.length,6);
for(const font of observations){for(const name of ['name','nameAscii','nameFarEast','nameComplexScript'])assert.equal(font[name],'Calibri');assert.equal(font.nameOther,'');}
// Derive every name-ledger field from observations rather than trusting the
// worker's summary. Empty Presentation.Fonts names remain separate findings.
const distinct=values=>[...new Set(values.filter(value=>typeof value==='string'&&value.length>0))].sort();
const fontNames=shapes=>shapes.flatMap(shape=>[shape.rangeFont,...shape.paragraphs.map(p=>p.font),...shape.runs.map(r=>r.font)]
  .flatMap(font=>['name','nameAscii','nameOther','nameFarEast','nameComplexScript'].map(slot=>font?.[slot])));
const computedLedger={
  presentationFontNames:distinct(report.presentationFonts.entries.map(entry=>entry.name)),
  slideTextSlotNames:distinct(fontNames(report.slides.entries.flatMap(slide=>slide.shapes))),
  masterTextSlotNames:distinct(fontNames(report.slideMaster.shapes)),
  themeFontNames:distinct(['major','minor'].flatMap(kind=>['latin','complexScript','eastAsian'].map(slot=>report.theme[kind][slot]))),
};
for(const [source,target] of [['presentationFontNames','aptosPresentationFontNames'],['slideTextSlotNames','aptosSlideTextSlotNames'],['masterTextSlotNames','aptosMasterTextSlotNames'],['themeFontNames','aptosThemeFontNames']])
  computedLedger[target]=computedLedger[source].filter(name=>/^aptos/i.test(name));
computedLedger.nonCarlitoPresentationFontNames=computedLedger.presentationFontNames.filter(name=>name!=='Carlito');
computedLedger.carlitoOnlyPresentationFonts=computedLedger.presentationFontNames.length>0&&computedLedger.nonCarlitoPresentationFontNames.length===0;
computedLedger.aptosReported=['aptosPresentationFontNames','aptosSlideTextSlotNames','aptosMasterTextSlotNames','aptosThemeFontNames'].some(key=>computedLedger[key].length>0);
const {scope:ledgerScope,...reportedLedger}=report.fontLedger;
assert.equal(typeof ledgerScope,'string');assert.deepEqual(reportedLedger,computedLedger,'Recomputed full worker font ledger');
assert.equal(supervisor.aptosReported,computedLedger.aptosReported);assert.deepEqual(supervisor.presentationFontNames,computedLedger.presentationFontNames);
const emptyNames=report.presentationFonts.entries.filter(entry=>entry.name==='');
assert.deepEqual(audit.findings.ledger,{...computedLedger,emptyNamePresentationFontIndexes:emptyNames.map(entry=>entry.index),emptyNameFontReported:emptyNames.length>0},'Recomputed full audit ledger including empty-name findings');
for(const key of ['passed','officeLifecycleComplete','readOnlyConfirmed','inventoryComplete','inputsUnchanged'])assert.equal(supervisor[key],true,key);
assert.equal(supervisor.inputMode,'control-deck');assert.equal(supervisor.fontRegistrationMode,'none');assert.equal(supervisor.registrationFilePresent,false);assert.equal(supervisor.fontCleanupConfirmed,null);
assert.equal(supervisor.parentError,null);assert.equal(supervisor.exitCode,0);assert.equal(supervisor.timedOut,false);assert.equal(supervisor.ownedOpenCount,1);assert.equal(supervisor.ownedCloseCount,1);
assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(worker.timeoutSeconds,45);
assert.equal(Date.parse(worker.finishedAt)-Date.parse(worker.startedAt),1227);
assert.equal(supervisor.inputChecks.length,8);
for(const [role,key,name] of [['source','source','source.pptx'],['verifier','verifier','native-font-inventory.ps1'],['process-helper','processHelper','native-process.ps1'],['font-helper','fontHelper','native-text-fonts.ps1']]){
  const binding=request[key];assert.equal(binding.sha256,binding.snapshotSha256);assert.equal(hash(bytes(base+'inputs/'+name)),binding.sha256);
  if(role!=='source')assert.equal(hash(bytes('auditor/'+name)),binding.sha256);
  for(const copy of ['original','snapshot']){
    const rows=supervisor.inputChecks.filter(row=>row.role===role&&row.copy===copy);assert.equal(rows.length,1);
    assert.equal(rows[0].path,binding[copy==='original'?'path':'snapshotPath']);assert.equal(rows[0].matched,true);assert.equal(rows[0].expected,binding.sha256);assert.equal(rows[0].actual,binding.sha256);
  }
}
assert.equal(audit.schemaVersion,2);assert.equal(audit.passed,true);assert.deepEqual(audit.failures,[]);assert.equal(audit.reviewedVerifierRevision,'current');
for(const [name,sha] of Object.entries(audit.rawHashes)){
  let actual;
  if(name.startsWith('original:')){const key={'source':'source','verifier':'verifier','process-helper':'processHelper','font-helper':'fontHelper'}[name.slice(9)];assert(key);actual=request[key].sha256;}
  else if(name.startsWith('reviewed/'))actual=hash(bytes('auditor/'+name.slice(9)));
  else actual=hash(bytes(base+name));
  assert.equal(actual,sha,name);
}
for(const name of ['request.json','report.json','supervisor.json','worker.json','progress.json','stages.jsonl'])assert.equal(audit.rawHashes[name],hash(bytes(base+name)));
assert.deepEqual(audit.findings.theme,report.theme);assert.deepEqual(audit.findings.presentationFonts,report.presentationFonts.entries);

// Reconstruct all expected stage names from the bounded observations, rather
// than accepting arbitrary well-paired stage names or trusting a stage count.
const expected=[];const pair=name=>expected.push([name,'begin'],[name,'success']);const single=name=>expected.push([name,'success']);
const font2=prefix=>{pair(prefix+'.font.get');for(const key of ['name','nameAscii','nameOther','nameFarEast','nameComplexScript','size','bold','italic'])pair(prefix+'.font.'+key+'.get');};
const shapes=(prefix,record)=>{
  assert.equal(record.shapes.length,record.shapeCount);assert(record.shapeCount<=10);pair(prefix+'.shapes.count.get');
  for(const [index,shape] of record.shapes.entries()){
    const p=prefix+'.shape-'+(index+1);assert.equal(shape.index,index+1);
    for(const suffix of ['get','name.get','type.get','hasTextFrame.get'])pair(p+'.'+suffix);
    if(shape.hasTextFrame!==-1)continue;
    for(const suffix of ['textFrame2.get','hasText.get','textRange2.get','text.get','length.get'])pair(p+'.'+suffix);font2(p);
    if(shape.hasText!==-1)continue;
    for(const [kind,rows,count] of [['paragraphs',shape.paragraphs,shape.paragraphCount],['runs',shape.runs,shape.runCount]]){
      assert.equal(rows.length,count);assert(count<=24);pair(p+'.'+kind+'.get');pair(p+'.'+kind+'.count.get');
      rows.forEach((row,n)=>{assert.equal(row.index,n+1);const sub=p+'.'+(kind==='runs'?'run':'paragraph')+'-'+(n+1);for(const suffix of ['get','text.get','start.get','length.get'])pair(sub+'.'+suffix);font2(sub);});
    }
  }
};
single('worker.initialize');for(const name of ['application.create','application.version.get','input.preflight.presentations.get','input.preflight.presentations.count.get'])pair(name);
assert.equal(report.preflightPresentationCount,0);
for(const name of ['input.presentations.get','input.presentation.open-readonly','owned.presentation.fullName.get','owned.presentation.readOnly.get','owned.presentation.fonts.get','owned.presentation.fonts.count.get'])pair(name);
for(let n=1;n<=2;n++)for(const suffix of ['get','name.get','embedded.get','embeddable.get'])pair('owned.presentation.fonts.item-'+n+'.'+suffix);
for(const name of ['owned.presentation.slideMaster.get','owned.slideMaster.theme.get','owned.theme.themeFontScheme.get'])pair(name);
for(const kind of ['major','minor']){pair('owned.theme.'+kind+'Font.get');for(const slot of ['latin','complexScript','eastAsian']){pair('owned.theme.'+kind+'Font.'+slot+'.get');pair('owned.theme.'+kind+'Font.'+slot+'.name.get');}}
pair('owned.presentation.slides.get');pair('owned.presentation.slides.count.get');
report.slides.entries.forEach((slide,n)=>{const p='owned.slide-'+(n+1);pair(p+'.get');pair(p+'.shapes.get');shapes(p,slide);});
pair('owned.slideMaster.shapes.get');shapes('owned.slideMaster',report.slideMaster);
pair('owned.presentation.fullName-before-close.get');pair('owned.presentation.close');single('owned.presentation.cleanup');single('worker.complete');
const stages=bytes(base+'stages.jsonl').toString('utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));
assert.equal(stages.length,283);assert.deepEqual(stages.map(row=>[row.stage,row.status]),expected);
const open=stages.findIndex(row=>row.stage==='input.presentation.open-readonly'),close=stages.findIndex(row=>row.stage==='owned.presentation.close'&&row.status==='success');
for(const [index,row] of stages.entries()){
  assert.equal(row.sequence,index+1);assert.equal(row.error,null);assert.equal(row.officeOperationsStopped,false);assert(Number.isFinite(Date.parse(row.timestamp)));
  if(index>0)assert(Date.parse(row.timestamp)>=Date.parse(stages[index-1].timestamp));
  const owned=index>=open&&index<=close;assert.equal(row.ownedPresentationPath,owned?request.source.snapshotPath:null);assert.equal(row.cleanupConfirmed,!owned);
}
assert.deepEqual(stages.at(-1),progress);assert.equal(progress.stage,'worker.complete');assert(Date.parse(supervisor.timestamp)>=Date.parse(progress.timestamp));
for(const name of ['input.presentation.open-readonly','owned.presentation.close'])assert.equal(stages.filter(row=>row.stage===name&&row.status==='success').length,1);
assert(stages.findIndex(row=>row.stage==='owned.presentation.fonts.get')<stages.findIndex(row=>row.stage==='owned.theme.themeFontScheme.get'));
const pre=json('environment/host-preflight.json'),post=json('environment/host-postflight.json');
assert.equal(pre.plannedInputSha256,control);assert.equal(pre.plannedMode,'control-deck');assert.equal(pre.plannedRegistrationMode,'none');assert.equal(pre.temporaryFontRegistrationsThisSession,0);
assert.equal(post.sourceSha256,control);assert.equal(post.auditPassed,true);assert.equal(post.attemptedNativeRunsThisExperiment,1);assert.equal(post.temporaryFontRegistrations,0);assert.equal(post.physicalFontIdentityProven,false);
assert.equal(post.aptosReported,computedLedger.aptosReported);assert.equal(pre.timeoutSeconds,45);assert.equal(pre.priorNativeInventoryRunsThisSession,2);
assert.equal(pre.officeProcesses.length,1);assert.deepEqual(post.officeProcesses,pre.officeProcesses);
assert.equal(pre.officeProcesses[0].name,'POWERPNT');assert.equal(pre.officeProcesses[0].fileVersion,'16.0.20430.20092');assert.equal(pre.officeProcesses[0].productVersion,'16.0.20430.20092');
console.log(JSON.stringify({passed:true,files:manifest.files.length,provenanceRecords:ledger.files.length,entries:41,changedParts:1,changedAttributes:4,unchangedParts:40,stages:283,elapsedMs:1227,
  scope:'Recorded E7 derivation and native inventory evidence only; no Office replay, root-cause fix, physical font identity, font allowlist or embedding acceptance.'}));
