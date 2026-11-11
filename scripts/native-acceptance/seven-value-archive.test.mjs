// Pure ZIP/XML mutants are controls, never evidence of actual COM support or acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
import {importSevenPublic} from './seven-chart-profile.mjs';
import {digest,fileIdentity} from './identity.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
import {SEVEN_VALUE_PROFILE,SEVEN_VALUE_MAX_VALUES,assertSevenNumericArray,assertSevenSingleDelta,assertSevenValueAction,sevenCorpusNumericMaximum,bindSingleSevenValueTarget,bindSevenValueActionFile,sevenWorkbookAliasPartition,comparePersistedSevenValueEdit} from './seven-value-archive.mjs';
import {sevenValueCriticalProbes} from './seven-value-profile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),fixture=path.join(here,'test-fixtures/seven-chart'),deps=archiveDependencies();
const census=JSON.parse(fs.readFileSync(path.join(here,'seven-value-corpus.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(fixture,'whole-seven.opf.json'),'utf8'));
const bytes=id=>fs.readFileSync(path.join(fixture,id+'.pptx'));
const main=()=>bytes('chart-all-seven');
const select=(slideIndex=1)=>({slideIndex,branch:slideIndex===7?'direct':'choice',seriesIndex:1,pointIndex:1,newValue:43});
const xml=(parts,file,change)=>{assert.ok(parts[file]);parts[file]=deps.strToU8(change(deps.strFromU8(parts[file])));};
function once(text,from,to){assert.equal(text.split(from).length,2,'Mutant must affect exactly one source span');return text.replace(from,to);}
function phaseFor(archive){
 return{slideCount:7,rasters:Array.from({length:7},(_,index)=>({slideIndex:index+1})),slides:archive.slides.map((slide,index)=>{
  const shapes=slide.shapes.filter(shape=>shape.kind==='title'||shape.branch==='choice'||shape.branch==='direct').map((shape,position)=>({index:position+1,id:shape.id,name:shape.name,type:shape.kind==='title'?14:3,...shape.geometry,hasTextFrame:shape.kind==='title'?-1:0,text:shape.kind==='title'?shape.text:null,alternativeText:''}));
  return{index:index+1,slideId:index+256,name:'Managed fixture '+index,shapeCount:shapes.length,shapes};
 })};
}
function editedArchive(input,action,{cache=true,workbook=true,otherCell=false}={}){
 const parsed=inspectSevenArchive(input,deps),parts=deps.unzipSync(input);
 if(cache)for(const slide of parsed.slides)for(const shape of slide.shapes){
  if(shape.kind!=='chart'||shape.chart.workbook.part!==action.workbookPart)continue;
  xml(parts,shape.chartPart,text=>{
   if(shape.chart.family==='chartEx')return once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>');
   return once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>');
  });
 }
 if(workbook||otherCell){
  const book=deps.unzipSync(parts[action.workbookPart]);
  xml(book,'xl/worksheets/sheet1.xml',text=>{
   if(workbook)text=once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>');
   if(otherCell)text=once(text,'<c r="B3"><v>31</v></c>','<c r="B3"><v>32</v></c>');
   return text;
  });parts[action.workbookPart]=deps.zipSync(book);
 }
 return Buffer.from(deps.zipSync(parts));
}
function pureContext(slideIndex=1){
 const input=main(),{archive,action}=bindSingleSevenValueTarget(input,source,select(slideIndex),{deps}),saved=editedArchive(input,action);
 const original={document:structuredClone(source),diagnostics:[]},reopened=structuredClone(original);reopened.document.slides[slideIndex-1].chart.data.rows[0][1]=43;
 return{input,saved,source,action,phases:{original:phaseFor(archive),'saved-reopened':phaseFor(inspectSevenArchive(saved,deps))},imports:{original,'saved-reopened':reopened},deps};
}
test('prospective cap comes from exact historical corpus bytes:46 arrays, maximum4, no qualification claim',()=>{
 assert.equal(census.profile,SEVEN_VALUE_PROFILE);assert.equal(census.nativeAcceptance,false);assert.equal(census.registryAcceptance,false);
 let count=0;
 for(const record of census.archives){
  assert.deepEqual(fileIdentity(path.join(fixture,record.path)),{bytes:record.bytes,sha256:record.sha256});
  const archive=inspectSevenArchive(fs.readFileSync(path.join(fixture,record.path)),deps);assert.equal(sevenCorpusNumericMaximum(archive),record.maximumNumericValues);
  const charts=archive.slides.flatMap(slide=>slide.shapes.filter(shape=>shape.kind==='chart'));
  const classic=charts.filter(shape=>shape.chart.family==='classic').reduce((sum,shape)=>sum+shape.chart.series.length,0);
  const extended=charts.filter(shape=>shape.chart.family==='chartEx').reduce((sum,shape)=>sum+shape.chart.caches.reduce((n,cache)=>n+cache.dimensions.filter(dim=>dim.kind==='cx:numDim').length,0),0);
  assert.equal(classic,record.classicNumericArrays);assert.equal(extended,record.chartExNumericArrays);count+=classic+extended;
 }
 assert.equal(count,census.totalNumericArrays);assert.equal(count,46);assert.equal(SEVEN_VALUE_MAX_VALUES,4);assert.equal(census.maximumNumericValues,4);
});
test('all22 admitted original targets bind numeric cache, shared workbook, native choice and explicit world fallback',()=>{
 let count=0;
 for(const record of census.archives)for(let index=1;index<=7;index++){
  if(record.path.includes('-fallback')&&index!==7)continue;
  const input=fs.readFileSync(path.join(fixture,record.path)),{action}=bindSingleSevenValueTarget(input,source,select(index),{deps});
  assertSevenValueAction(action);assert.equal(action.inputSha256,digest(input));assert.deepEqual(action.expectedValues,[42,31,-8,19]);assert.deepEqual(action.newValues,[43,31,-8,19]);assert.deepEqual(action.workbookCells,['B2','B3','B4','B5']);assert.equal(action.seriesName,'Value');count++;
 }
 assert.equal(count,22);
 for(let index=1;index<=6;index++)assert.throws(()=>bindSingleSevenValueTarget(bytes('chart-mode-all-seven-fallback'),source,{...select(index),branch:'direct'},{deps}));
});
test('strict numeric primitives, same length and exactly one meaningful index refuse coercion and no-op plans',()=>{
 for(const values of [[],[1,2,3,4,5],[1,'2'],[1,true],[1,null],[1,NaN],[1,Infinity],Array(2),[[1]],new Float64Array([1])])assert.throws(()=>assertSevenNumericArray(values));
 for(const [before,after,index]of [[[1,2],[2,3],1],[[1,2],[1,2],1],[[1,2],[1,3],1],[[1],[2,3],1],[[0],[-0],1],[[1],[2],0],[[1],[2],2]])assert.throws(()=>assertSevenSingleDelta(before,after,index));
 assertSevenSingleDelta([42,31,-8,19],[42,31,-9,19],3);
});
test('one deterministic rebound action model binds distinct minified/pretty/newline/BOM/reordered wire identities',()=>{
 const{action,actionModelSha256}=bindSingleSevenValueTarget(main(),source,select(),{deps}),minified=JSON.stringify(action),reordered=Object.fromEntries(Object.entries(action).reverse());
 const wires=[minified,JSON.stringify(action,null,2),minified+'\n','\uFEFF'+minified,JSON.stringify(reordered)],identities=new Set();
 for(const wire of wires){const bytes=Buffer.from(wire),bound=bindSevenValueActionFile(bytes,action);assert.equal(bound.actionModelSha256,actionModelSha256);assert.deepEqual(bound.action,action);assert.deepEqual(bound.actionFileIdentity,{bytes:bytes.length,sha256:digest(bytes)});identities.add(bound.actionFileIdentity.sha256);}
 assert.equal(identities.size,5);
 assert.throws(()=>bindSevenValueActionFile(Buffer.from('{invalid'),action));assert.throws(()=>bindSevenValueActionFile(Buffer.from([0xff]),action));
 const changed=structuredClone(action);changed.newValues[0]=44;assert.throws(()=>bindSevenValueActionFile(Buffer.from(JSON.stringify(changed)),action));
 const context=pureContext();context.action=reordered;assert.equal(comparePersistedSevenValueEdit(context).actionModelSha256,actionModelSha256);
});
test('normalized workbook names preserve exact shared alias classes; coherent split copies refuse',()=>{
 const context=pureContext(),archive=inspectSevenArchive(context.saved,deps),partition=sevenWorkbookAliasPartition(archive),renamed=structuredClone(archive),names=new Map();
 for(const slide of renamed.slides)for(const shape of slide.shapes)if(shape.kind==='chart'){const part=shape.chart.workbook.part;if(!names.has(part))names.set(part,'renamed-'+names.size+'.xlsx');shape.chart.workbook.part=names.get(part);}
 assert.deepEqual(sevenWorkbookAliasPartition(renamed),partition);
 const split=structuredClone(archive);split.slides[0].shapes.find(shape=>shape.branch==='fallback').chart.workbook.part+='-split';assert.notDeepEqual(sevenWorkbookAliasPartition(split),partition);
 const merged=structuredClone(archive),first=merged.slides[0].shapes.find(shape=>shape.kind==='chart').chart.workbook.part;for(const shape of merged.slides[1].shapes)if(shape.kind==='chart')shape.chart.workbook.part=first;assert.notDeepEqual(sevenWorkbookAliasPartition(merged),partition);
 const parts=deps.unzipSync(context.saved),fallback=archive.slides[0].shapes.find(shape=>shape.branch==='fallback'),copy='ppt/embeddings/seven-value-alias-copy.xlsx';parts[copy]=new Uint8Array(parts[fallback.chart.workbook.part]);
 const relationships=path.posix.join(path.posix.dirname(fallback.chartPart),'_rels',path.posix.basename(fallback.chartPart)+'.rels'),oldTarget=path.posix.relative(path.posix.dirname(fallback.chartPart),fallback.chart.workbook.part),newTarget=path.posix.relative(path.posix.dirname(fallback.chartPart),copy);
 xml(parts,relationships,text=>once(text,'Target="'+oldTarget+'"','Target="'+newTarget+'"'));
 assert.throws(()=>comparePersistedSevenValueEdit({...context,saved:Buffer.from(deps.zipSync(parts))}),/workbook sharing classes changed/u);
});
test('source and exact target/type/branch/formula/series admission controls reject widened plans',()=>{
 const input=main();
 for(const mutate of [s=>s.extra=true,s=>s.seriesIndex=2,s=>s.pointIndex=0,s=>s.pointIndex=5,s=>s.newValue=42,s=>s.newValue='43',s=>s.branch='fallback',s=>s.slideIndex=8]){const selection=select();mutate(selection);assert.throws(()=>bindSingleSevenValueTarget(input,source,selection,{deps}));}
 for(const mutate of [s=>s.slides[0].chart.type='waterfall',s=>s.slides[0].chart.data.rows[0][1]=41,s=>s.slides[0].chart.data.columns[1]='Other',s=>s.slides[0].chart.data.rows.push(['Extra',4]),s=>s.slides[0].title='Other']){const altered=structuredClone(source);mutate(altered);assert.throws(()=>bindSingleSevenValueTarget(input,altered,select(),{deps}));}
 const {action}=bindSingleSevenValueTarget(input,source,select(),{deps});
 for(const mutate of [a=>a.extra=true,a=>a.shapeId=0,a=>a.seriesIndex=2,a=>a.maxSeriesCount=2,a=>a.comChartType=51,a=>a.branch='fallback',a=>a.dataId=null,a=>a.dimensionIndex='1',a=>a.dimensionIndex=-1,a=>a.layoutId='funnel',a=>a.workbookCells=null,a=>a.workbookCells=['B2'],a=>a.workbookCells[1]='B2',a=>a.workbookCells[1]='b3',a=>a.workbookCells[1]=false,a=>a.newValues[1]=32,a=>a.inputSha256='0']){const altered=structuredClone(action);mutate(altered);assert.throws(()=>assertSevenValueAction(altered));}
});
test('admitted Pareto has no persisted derived percentages/formulas; unknown derived dependencies refuse',()=>{
 const input=main(),{action}=bindSingleSevenValueTarget(input,source,select(3),{deps});assert.equal(action.maxSeriesCount,2);
 for(const addition of ['<cx:layoutPr><cx:aggregation/></cx:layoutPr>','<cx:numDim type="val"><cx:lvl ptCount="1"><cx:pt idx="0">50</cx:pt></cx:lvl></cx:numDim>']){
  const parts=deps.unzipSync(input);xml(parts,action.chartPart,text=>{
   const marker='layoutId="paretoLine"',at=text.indexOf(marker);assert.ok(at>=0);const end=text.indexOf('</cx:series>',at);assert.ok(end>at);return text.slice(0,end)+addition+text.slice(end);
  });assert.throws(()=>bindSingleSevenValueTarget(Buffer.from(deps.zipSync(parts)),source,select(3),{deps}));
 }
 const context=pureContext(3),parts=deps.unzipSync(context.saved);
 xml(parts,context.action.chartPart,text=>once(text,'<a:srgbClr val="91BCE6"/>','<a:srgbClr val="112233"/>'));
 assert.throws(()=>comparePersistedSevenValueEdit({...context,saved:Buffer.from(deps.zipSync(parts))}));
});
test('all seven owned synthetic saved copies preserve exactly one logical value across XML caches/workbook/public model',()=>{
 for(let index=1;index<=7;index++){
  const result=comparePersistedSevenValueEdit(pureContext(index));assert.equal(result.nativeAcceptance,false);assert.equal(result.registryAcceptance,false);assert.equal(result.nativeMapQualified,false);assert.equal(result.rawOoxmlStyleFidelity,'OPEN');assert.equal(result.cacheReferences,index===7?1:2);assert.equal(result.workbookReferences,index===7?1:2);
 }
});
test('stale cache, stale workbook, another cell, public data/diagnostics and hidden fallback mutations refuse',()=>{
 const context=pureContext();
 for(const options of [{cache:true,workbook:false},{cache:false,workbook:true},{otherCell:true}])assert.throws(()=>comparePersistedSevenValueEdit({...context,saved:editedArchive(context.input,context.action,options)}));
 for(const mutate of [c=>c.imports['saved-reopened'].document.slides[0].chart.data.rows[0][1]=42,c=>c.imports['saved-reopened'].document.slides[1].title='Other',c=>c.imports['saved-reopened'].diagnostics.push({code:'changed'}),c=>c.phases['saved-reopened'].slides[0].shapes[1].id=999]){const altered={...context,imports:structuredClone(context.imports),phases:structuredClone(context.phases)};mutate(altered);assert.throws(()=>comparePersistedSevenValueEdit(altered));}
 const parts=deps.unzipSync(context.saved),parsed=inspectSevenArchive(context.saved,deps),fallback=parsed.slides[0].shapes.find(shape=>shape.branch==='fallback');
 xml(parts,fallback.chartPart,text=>once(text,'<c:idx val="0"/>','<c:idx val="1"/>'));
 assert.throws(()=>comparePersistedSevenValueEdit({...context,saved:Buffer.from(deps.zipSync(parts))}));
});
test('five historical public imports retain the exact one-value edit without an injected engine',async()=>{
 for(const slideIndex of [1,2,3,5,6]){
  const context=pureContext(slideIndex),consumer=path.resolve(here,'../..');
  context.imports={original:await importSevenPublic(context.input,{consumer}),'saved-reopened':await importSevenPublic(context.saved,{consumer})};
  comparePersistedSevenValueEdit(context);
 }
});
test('historical adapted Box cannot qualify after its numeric edit invalidates whole-cache provenance',async()=>{
 const context=pureContext(4),consumer=path.resolve(here,'../..');
 context.imports={original:await importSevenPublic(context.input,{consumer}),'saved-reopened':await importSevenPublic(context.saved,{consumer})};
 assert.equal(digest(context.input),census.archives.find(item=>item.path==='chart-all-seven.pptx').sha256);
 const archive=inspectSevenArchive(context.input,deps),charts=archive.slides[3].shapes.filter(shape=>shape.kind==='chart');
 assert.equal(charts.length,2);
 const native=charts.find(shape=>shape.branch==='choice').chart,classic=charts.find(shape=>shape.branch==='fallback').chart;
 assert.deepEqual(native.caches[0].dimensions.find(dim=>dim.kind==='cx:strDim').values,['Region','Region','Region','Region']);
 assert.deepEqual(classic.series[0]['c:cat'].values,['Region','Region','Region','Region']);
 assert.equal(native.workbook.part,classic.workbook.part);
 assert.deepEqual(native.workbook.cells.filter(item=>['A2','A3','A4','A5','B2','B3','B4','B5'].includes(item.cell)),[
  {cell:'A2',value:'Region'},{cell:'B2',value:42},{cell:'A3',value:'Region'},{cell:'B3',value:31},{cell:'A4',value:'Region'},{cell:'B4',value:-8},{cell:'A5',value:'Region'},{cell:'B5',value:19},
 ]);
 const parts=deps.unzipSync(context.input),tag=deps.strFromU8(parts['ppt/tags/opfData1.xml']),savedParts=deps.unzipSync(context.saved);assert.equal(deps.strFromU8(savedParts['ppt/tags/opfData1.xml']),tag,'Numeric edit must retain the exact original provenance record');const matches=[...tag.matchAll(/<p:tag name="OPF_DATA_V1" val="([0-9A-F]+)"\/>/gu)];assert.equal(matches.length,1);
 assert.deepEqual(JSON.parse(Buffer.from(matches[0][1],'hex').toString('utf8')),{v:1,kind:'chart',data:source.slides[3].chart.data,evidence:['b9c0f32ce68326b0','2c6723e21d970fc7']});
 const before=context.imports.original,after=context.imports['saved-reopened'];
 assert.deepEqual(before.document.slides[3].chart.data,source.slides[3].chart.data);
 const expected=structuredClone(before.document);expected.slides[3].chart.data.rows=[['Region',43],['Region',31],['Region',-8],['Region',19]];
 assert.deepEqual(after.document,expected,'Native category fallback and ONE numeric edit are the entire historical public document delta');
 const changed=after.diagnostics.filter(issue=>issue.code==='chart-data-provenance-changed');
 assert.deepEqual(changed,[{code:'chart-data-provenance-changed',path:'slides.3.charts.alt0',message:"The chart's cached data or number formats changed after export (for example in Edit Data), so the authored data form, dataset reference, column mapping, column formats and data source recorded at export were not restored; the chart imports the values and formats it now shows."}]);
 assert.deepEqual(after.diagnostics.filter(issue=>issue!==changed[0]),before.diagnostics,'No other diagnostic delta is admitted');
 assert.throws(()=>comparePersistedSevenValueEdit(context),/Public import must retain the native value edit and nothing else/u,'The historical adapted Box archive cannot qualify as an exact one-cell edit');
});
test('historical World classic fallback retains the exact numeric edit but refuses changed provenance diagnostics',async()=>{
 const context=pureContext(7),consumer=path.resolve(here,'../..');
 context.imports={original:await importSevenPublic(context.input,{consumer}),'saved-reopened':await importSevenPublic(context.saved,{consumer})};
 assert.equal(digest(context.input),census.archives.find(item=>item.path==='chart-all-seven.pptx').sha256);
 const archive=inspectSevenArchive(context.input,deps),charts=archive.slides[6].shapes.filter(shape=>shape.kind==='chart');assert.equal(charts.length,1);
 const shape=charts[0],classic=shape.chart;assert.deepEqual([shape.branch,shape.chartPart,classic.family,classic.construct],['direct','ppt/charts/chart7.xml','classic','c:barChart']);
 assert.deepEqual([context.action.sourceType,context.action.comChartType],['world',51]);
 assert.equal(classic.workbook.part,'ppt/embeddings/Microsoft_Excel_Worksheet7.xlsx');
 assert.deepEqual(classic.series[0]['c:cat'],{formula:'Sheet1!$A$2:$A$5',values:['North','South','East','West']});
 assert.deepEqual(classic.series[0]['c:val'],{formula:'Sheet1!$B$2:$B$5',values:[42,31,-8,19]});
 assert.deepEqual(classic.workbook.cells,[{cell:'A1',value:'Region'},{cell:'B1',value:'Value'},{cell:'A2',value:'North'},{cell:'B2',value:42},{cell:'A3',value:'South'},{cell:'B3',value:31},{cell:'A4',value:'East'},{cell:'B4',value:-8},{cell:'A5',value:'West'},{cell:'B5',value:19}]);
 const parts=deps.unzipSync(context.input),savedParts=deps.unzipSync(context.saved),tag=deps.strFromU8(parts['ppt/tags/opfData2.xml']);
 assert.match(deps.strFromU8(parts[shape.chartPart]),/<c:barDir val="col"\/>/u);assert.match(deps.strFromU8(parts[shape.chartPart]),/<c:grouping val="clustered"\/>/u);
 assert.equal(deps.strFromU8(savedParts['ppt/tags/opfData2.xml']),tag,'Numeric edit retains the exact original provenance record');
 const matches=[...tag.matchAll(/<p:tag name="OPF_DATA_V1" val="([0-9A-F]+)"\/>/gu)];assert.equal(matches.length,1);
 assert.deepEqual(JSON.parse(Buffer.from(matches[0][1],'hex').toString('utf8')),{v:1,kind:'chart',data:source.slides[6].chart.data,evidence:['1881775e18d9126b']});
 const before=context.imports.original,after=context.imports['saved-reopened'];assert.equal(before.document.slides[6].chart.type,'column');assert.deepEqual(before.document.slides[6].chart.data,source.slides[6].chart.data);
 const expected=structuredClone(before.document);expected.slides[6].chart.data.rows[0][1]=43;assert.deepEqual(after.document,expected,'The complete historical World public document changes by ONE numeric cell only');
 assert.deepEqual(before.diagnostics,[]);
 assert.deepEqual(after.diagnostics,[{code:'chart-data-provenance-changed',path:'slides.6.charts.0',message:"The chart's cached data or number formats changed after export (for example in Edit Data), so the authored data form, dataset reference, column mapping, column formats and data source recorded at export were not restored; the chart imports the values and formats it now shows."}]);
 assert.throws(()=>comparePersistedSevenValueEdit(context),/Changed import diagnostics require review; no blanket waiver/u,'An expected provenance warning still refuses the unchanged strict qualification comparator');
});
test('Windows actual PowerShell5.1 action definitions: one setter, managed faults, primitive/ownership refusals and no later operation',{
 skip:process.platform!=='win32'?'Actual Windows PowerShell5.1 managed controls; a portable skip is not serialization or COM qualification':false,
},()=>{
 const output=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'opf-seven-value-'))),actionFile=path.join(output,'action.json');
 let passed=false;
 try{
  const{action}=bindSingleSevenValueTarget(main(),source,select(),{deps}),wire=Buffer.from('\uFEFF'+JSON.stringify(Object.fromEntries(Object.entries(action).reverse()),null,2)+'\n'),bound=bindSevenValueActionFile(wire,action);fs.writeFileSync(actionFile,wire,{flag:'wx'});assert.notEqual(bound.actionModelSha256,bound.actionFileIdentity.sha256);
  const run=spawnSync(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(here,'seven-value-actions-self-test.ps1'),'-Worker',path.join(here,'seven-chart-worker.ps1'),'-Actions',path.join(here,'seven-value-actions.ps1'),'-ActionFile',actionFile,'-ExpectedActionModelSha256',bound.actionModelSha256,'-ExpectedActionFileBytes',String(bound.actionFileIdentity.bytes),'-ExpectedActionFileSha256',bound.actionFileIdentity.sha256,'-Output',path.join(output,'results')],{encoding:'utf8',env:windowsPowerShellEnvironment(process.env),timeout:60000,maxBuffer:4*1024*1024});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const receipt=JSON.parse(fs.readFileSync(path.join(output,'results/mock-results.json'),'utf8').replace(/^\uFEFF/u,''));
  assert.equal(receipt.mockOnly,true);assert.equal(receipt.officeInvoked,false);assert.equal(receipt.processQueries,0);assert.equal(receipt.sourceWorkerSha256,fileIdentity(path.join(here,'seven-chart-worker.ps1')).sha256);assert.equal(receipt.sourceActionsSha256,fileIdentity(path.join(here,'seven-value-actions.ps1')).sha256);assert.equal(receipt.actionModelSha256,bound.actionModelSha256);assert.deepEqual(receipt.actionFileIdentity,bound.actionFileIdentity);assert.equal(receipt.actionFileIdentity.sha256,fileIdentity(actionFile).sha256);
  const report=JSON.parse(fs.readFileSync(path.join(output,'results/success/report.json'),'utf8').replace(/^\uFEFF/u,''));assert.equal(report.actions[0].actionModelSha256,bound.actionModelSha256);assert.deepEqual(report.actions[0].actionFileIdentity,bound.actionFileIdentity);
  const proofContext={sourcePath:'managed-owned-only',savedPath:'managed-owned-only',phases:{original:{slides:[{shapeCount:2}]},'saved-reopened':{slides:[{shapeCount:2}]}}};
  assert.deepEqual(report.probes,sevenValueCriticalProbes(proofContext,action).filter(probe=>probe.stage.startsWith('value.')),'Actual managed action helpers must emit the exact Node-owned proof grammar, not a synthetic mirror');
  assert.ok(receipt.results.every(item=>item.passed===true));assert.ok(!receipt.baselineCalls.some(name=>name.startsWith('FORBIDDEN.')));
  const names=receipt.results.map(item=>item.name);for(const required of ['valuesSet','valuesGet.1','valuesGet.2','valuesGet.3','silentSetter','staleReopened','rankTwo','null','bool','string','nan','infinity','unexpected','secondSetter','foreignApplication','foreignPresentation','foreignPath','writable','beforeValueOwnedAppSwap','beforeValueOwnedPresentationSwap','beforeValueOwnedPathSwap','beforeValueForeignPath','beforeValueWritable','malformedModel','extraWireField','zeroWireBytes','stringWireBytes','invalidWireHash','reopenedModelMismatch','reopenedWireLengthMismatch','reopenedWireHashMismatch'])assert.ok(names.includes(required),required);
  for(const change of ['hash','length']){
   const refused=path.join(output,'wire-refused-'+change),args=['-NoProfile','-NonInteractive','-File',path.join(here,'seven-value-actions-self-test.ps1'),'-Worker',path.join(here,'seven-chart-worker.ps1'),'-Actions',path.join(here,'seven-value-actions.ps1'),'-ActionFile',actionFile,'-ExpectedActionModelSha256',bound.actionModelSha256,'-ExpectedActionFileBytes',String(bound.actionFileIdentity.bytes+(change==='length'?1:0)),'-ExpectedActionFileSha256',change==='hash'?'0'.repeat(64):bound.actionFileIdentity.sha256,'-Output',refused];
   const result=spawnSync(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),args,{encoding:'utf8',env:windowsPowerShellEnvironment(process.env),timeout:60000,maxBuffer:4*1024*1024});assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/Action wire snapshot identity differs before any managed target operation/u);
   const refusal=JSON.parse(fs.readFileSync(path.join(refused,'wire-identity-refusal.json'),'utf8').replace(/^\uFEFF/u,''));assert.equal(refusal.managedOperations,0);assert.equal(refusal.officeInvoked,false);
  }
  passed=true;
 }finally{if(passed)fs.rmSync(output,{recursive:true,force:true});else console.error('Preserved failed managed control output: '+output);}
});
